// Counter's walk: each browser context is one guest's phone, or the kitchen's tablet.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../server.js';

const dir = mkdtempSync(join(tmpdir(), 'counter-'));
const errors = [];
let browser;
let app;

before(async () => {
  const server = await createApp({ db: join(dir, 'app.db'), cache: false, secret: 'test' });
  await new Promise((done) => server.listen(0, done));
  app = { server, base: `http://localhost:${server.address().port}` };
  const system = ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find((path) => existsSync(path));
  browser = await chromium.launch().catch(() => chromium.launch({ executablePath: process.env.CHROME ?? system }));
});
after(async () => {
  await browser?.close();
  app.server.closeAllConnections?.();
  await new Promise((done) => app.server.close(done));
  rmSync(dir, { recursive: true, force: true });
  assert.deepEqual(errors, [], 'no page errors in any browser');
});

async function device(name, { javaScriptEnabled = true, shift = false } = {}) {
  const context = await browser.newContext({ javaScriptEnabled });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => message.type() === 'error' && !/403/.test(message.text()) && errors.push(`${name}: ${message.text()}`));
  await page.goto(app.base);
  const post = async (path, form, headers = {}) => {
    const response = await context.request.post(`${app.base}${path}`, { form, headers, maxRedirects: 0 });
    return { status: response.status(), location: decodeURIComponent(response.headers().location ?? '') };
  };
  const get = async (path) => (await context.request.get(`${app.base}${path}`)).text();
  if (shift) await post('/staff/start', {});
  return { context, page, post, get };
}
const counter = () => app.server.counter;
const left = (key) => counter().store.get('items', key).left;
const times = () => counter().times();

/** Fill a guest's bag, pick a time and pay, by plain posts: where it ends up. */
async function order(guest, lines, { slot = times()[0].slot, card = '4242 4242 4242 4242', name = 'Sam Teets' } = {}) {
  for (const [item, qty] of lines) await guest.post('/cart/add', { item, qty: String(qty) });
  await guest.post('/order/time', { slot });
  const key = /name="checkout" value="(c[a-z0-9]+)"/.exec(await guest.get('/checkout'))?.[1];
  return guest.post('/checkout', { checkout: key ?? '', name, email: 'sam@example.com', card });
}

test('without JavaScript: the menu, a bag, a pickup time, one payment, and the order', async () => {
  const guest = await device('no-js', { javaScriptEnabled: false });
  const { page } = guest;
  assert.deepEqual(await page.$$eval('.section h2', (h) => h.map((x) => x.textContent)), ['Bread', 'Pastry', 'Coffee']);
  assert.deepEqual(await page.$$eval('menu-item', (items) => items.map((item) => item.getAttribute('item'))), ['sourdough', 'rye', 'baguette', 'cinnamon', 'croissant', 'apple-hand-pie', 'drip', 'latte'], 'in the bakery’s order');
  await page.fill('menu-item[item=croissant] input[name=qty]', '2');
  await page.click('menu-item[item=croissant] button');
  await page.waitForURL(/done=Added/);
  await page.click('menu-item[item=drip] button');
  await page.click('a.bag');
  await page.waitForURL(`${app.base}/order`);
  assert.match(await page.locator('cart-panel').innerText(), /Butter croissant[\s\S]*\$8\.50[\s\S]*Drip coffee[\s\S]*Total\s*\$11\.50/);
  assert.equal(await page.locator('cart-panel a:has-text("Check out")').count(), 0, 'no checkout before a pickup time');
  const slot = times()[1].slot;
  await page.selectOption('select[name=slot]', slot);
  await page.click('form[action="/order/time"] button');
  await page.click('cart-panel a:has-text("Check out")');
  await page.waitForURL(`${app.base}/checkout`);
  await page.fill('checkout-form input[name=name]', 'Rosa Bittinger');
  await page.fill('checkout-form input[name=email]', 'rosa@example.com');
  await page.fill('checkout-form input[name=card]', '4242 4242 4242 4242');
  await page.click('checkout-form button[type=submit]');
  await page.waitForURL(/\/orders\/c[a-z0-9]+$/);
  const main = await page.locator('main').innerText();
  assert.match(main, /Pickup (today|tomorrow) at \d{1,2}:\d{2} (am|pm)[\s\S]*For Rosa Bittinger · \$11\.50[\s\S]*2 × Butter croissant[\s\S]*1 × Drip coffee/);
  assert.equal(left('croissant'), 18, 'taken off the shelf when paid');
  assert.equal(left('drip'), null, 'coffee doesn’t run out');
  await page.goto(app.base);
  assert.match(await page.locator('main').innerText(), /Your orders/);
  assert.equal(await page.locator('a.bag').innerText(), 'Your order', 'the bag is empty again');
  await guest.context.close();
});

test('the menu is live: what others buy and what the kitchen marks sold out show at once', async () => {
  const reader = await device('reader');
  await reader.page.waitForFunction(() => customElements.get('menu-item'));
  await reader.page.waitForTimeout(400); // the live stream open
  const buyer = await device('buyer', { javaScriptEnabled: false });
  assert.match((await order(buyer, [['rye', 3]])).location, /^\/orders\/c/);
  await reader.page.locator('menu-item[item=rye]', { hasText: '3 left' }).waitFor({ timeout: 5000 });
  const kitchen = await device('stocker', { javaScriptEnabled: false, shift: true });
  assert.equal((await kitchen.post('/kitchen/stock', { item: 'rye', left: '0' })).location, '/kitchen/menu?done=Seeded rye: sold out.');
  await reader.page.locator('menu-item[item=rye]', { hasText: 'Sold out' }).waitFor({ timeout: 5000 });
  assert.ok(await reader.page.locator('menu-item[item=rye] button').isDisabled());
  assert.equal((await buyer.post('/cart/add', { item: 'rye', qty: '1' })).location, '/?problem=Sold out.');
  assert.equal((await kitchen.post('/kitchen/stock', { item: 'rye', left: '5' })).location, '/kitchen/menu?done=Seeded rye: 5 left.');
  await reader.page.locator('menu-item[item=rye]', { hasText: '5 left' }).waitFor({ timeout: 5000 });
  // Today's note.
  await kitchen.post('/kitchen/note', { text: 'Pumpkin scones, out at 9.' });
  await reader.page.locator('kitchen-note', { hasText: 'Pumpkin scones, out at 9.' }).waitFor({ timeout: 5000 });
  // Without JavaScript too, with when it was posted.
  assert.match(await buyer.get('/'), /Pumpkin scones, out at 9\.<\/p>[\s\S]*Posted at \d{1,2}:\d{2} [AP]M/);
  // The kitchen's limits: a number, and coffee doesn't run out.
  assert.equal((await kitchen.post('/kitchen/stock', { item: 'rye', left: '-1' })).location, '/kitchen/menu?problem=Give a number from 0 to 500.');
  assert.equal((await kitchen.post('/kitchen/stock', { item: 'drip', left: '3' })).location, '/kitchen/menu?problem=Drip coffee doesn’t run out.');
  await Promise.all([reader.context.close(), buyer.context.close(), kitchen.context.close()]);
});

test('the last hand pies go to one guest; the other is told and keeps the bag', async () => {
  const a = await device('pie a', { javaScriptEnabled: false });
  const b = await device('pie b', { javaScriptEnabled: false });
  const all = String(left('apple-hand-pie'));
  for (const guest of [a, b]) {
    await guest.post('/cart/add', { item: 'apple-hand-pie', qty: all });
    await guest.post('/order/time', { slot: times()[2].slot });
  }
  const keys = await Promise.all([a, b].map(async (guest) => /name="checkout" value="(c[a-z0-9]+)"/.exec(await guest.get('/checkout'))[1]));
  const [x, y] = await Promise.all([a, b].map((guest, i) => guest.post('/checkout', { checkout: keys[i], name: 'Pie Person', email: 'p@example.com', card: '4242' })));
  const outcomes = [x.location, y.location].map((location) => (location.startsWith('/orders/') ? 'won' : location));
  assert.deepEqual(outcomes.sort(), ['/checkout?problem=Something in your order just sold out. Check it and try again.', 'won']);
  assert.equal(left('apple-hand-pie'), 0);
  const loser = x.location.startsWith('/orders/') ? b : a;
  assert.match(await loser.get('/order'), /Apple hand pie/, 'still in the loser’s bag, marked');
  await a.context.close();
  await b.context.close();
});

test('a pickup time takes three orders; the fourth is told it filled up, even at the same moment', async () => {
  const slot = times()[3].slot;
  const guests = await Promise.all([0, 1, 2, 3].map((i) => device(`slot ${i}`, { javaScriptEnabled: false })));
  for (const guest of guests) {
    await guest.post('/cart/add', { item: 'baguette', qty: '1' });
    await guest.post('/order/time', { slot });
  }
  const keys = await Promise.all(guests.map(async (guest) => /name="checkout" value="(c[a-z0-9]+)"/.exec(await guest.get('/checkout'))[1]));
  const answers = await Promise.all(guests.map((guest, i) => guest.post('/checkout', { checkout: keys[i], name: `Guest ${i}`, email: 'g@example.com', card: '4242' })));
  assert.equal(answers.filter((answer) => answer.location.startsWith('/orders/')).length, 3, JSON.stringify(answers));
  const full = answers.find((answer) => !answer.location.startsWith('/orders/'));
  assert.match(full.location, /^\/order\?problem=\d{1,2}:\d{2} (am|pm) just filled up\. Choose another time\.$/);
  assert.equal(times().find((time) => time.slot === slot).full, true);
  const page = await guests[3].get('/order');
  assert.match(page, new RegExp(`<option value="${slot}" disabled>[^<]*\\(full\\)`), 'full, and no longer chosen');
  assert.match(page, /Choose a time, then check out\./);
  assert.doesNotMatch(page, /cart-panel[^>]*checkout="\/checkout"/);
  await Promise.all(guests.map((guest) => guest.context.close()));
});

test('a paid order keeps its place after holds run out; a made-up time is refused', async () => {
  const quick = await createApp({ db: join(dir, 'quick.db'), cache: false, secret: 'test', holdMs: 800 });
  await new Promise((done) => quick.listen(0, done));
  const base = `http://localhost:${quick.address().port}`;
  const slot = quick.counter.times()[0].slot;
  try {
  for (let i = 0; i < 3; i++) {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const post = async (path, form) => decodeURIComponent((await context.request.post(`${base}${path}`, { form, maxRedirects: 0 })).headers().location ?? '');
    await context.request.get(base);
    await post('/cart/add', { item: 'baguette', qty: '1' });
    await post('/order/time', { slot });
    const key = /name="checkout" value="(c[a-z0-9]+)"/.exec(await (await context.request.get(`${base}/checkout`)).text())[1];
    assert.match(await post('/checkout', { checkout: key, name: `Early ${i}`, email: 'e@example.com', card: '4242' }), /^\/orders\//);
    await context.close();
  }
  await new Promise((done) => setTimeout(done, 1200));
  assert.equal(quick.counter.times().find((time) => time.slot === slot).full, true, 'paid places are kept, not held');
  } finally {
    quick.closeAllConnections?.();
    await new Promise((done) => quick.close(done));
  }

  const guest = await device('made up', { javaScriptEnabled: false });
  assert.equal((await guest.post('/order/time', { slot: '2026-01-01 03:00' })).location, '/order?problem=Choose one of the times shown.');
  await guest.context.close();
});

test('a declined card takes nothing: the stock, the pickup place and the bag stay as they were', async () => {
  const slot = times()[4].slot;
  const guest = await device('declined', { javaScriptEnabled: false });
  const before = left('sourdough');
  const answer = await order(guest, [['sourdough', 2]], { slot, card: '4000 0000 0000 0002' });
  assert.equal(answer.location, '/checkout?problem=That card was declined. Try another.');
  assert.equal(left('sourdough'), before);
  assert.equal(counter().times().find((time) => time.slot === slot).full, false);
  assert.equal([...counter().store.under('slots')].filter((place) => place.key.includes(slot.replace(/\D/g, '')) && place.state !== 'free').length, 0, 'the place was let go');
  assert.match(await guest.get('/order'), /Country sourdough/);
  // Checking out with no time sends the guest back to choose one.
  const fresh = await device('no time', { javaScriptEnabled: false });
  await fresh.post('/cart/add', { item: 'baguette', qty: '1' });
  assert.equal(decodeURIComponent((await fresh.context.request.get(`${app.base}/checkout`, { maxRedirects: 0 })).headers().location), '/order?problem=Choose a pickup time first.');
  await guest.context.close();
  await fresh.context.close();
});

test('the kitchen moves each order one step, the guest follows live, and two presses move it once', async () => {
  const guest = await device('waiting');
  const placed = await order(guest, [['cinnamon', 2]], { name: 'Dana Whitlock', slot: times()[5].slot });
  const key = placed.location.split('/').pop();
  await guest.page.goto(`${app.base}${placed.location}`);
  await guest.page.waitForFunction(() => customElements.get('order-progress'));
  await guest.page.waitForTimeout(400);
  const outsider = await device('not kitchen', { javaScriptEnabled: false });
  assert.match(await outsider.get('/kitchen'), /Start a kitchen shift/);
  assert.equal((await outsider.post('/kitchen/advance', { key, to: 'making' })).location, '/kitchen');
  assert.equal((await outsider.post('/staff/start', {}, { 'sec-fetch-site': 'cross-site' })).status, 403);

  const a = await device('kitchen a', { javaScriptEnabled: false, shift: true });
  const b = await device('kitchen b', { javaScriptEnabled: false, shift: true });
  assert.match(await a.get('/kitchen'), new RegExp(`Dana Whitlock[\\s\\S]*2 × Cinnamon roll`));
  const pressed = await Promise.all([a.post('/kitchen/advance', { key, to: 'making' }), b.post('/kitchen/advance', { key, to: 'making' })]);
  assert.deepEqual(pressed.map((answer) => answer.location).sort(), ['/kitchen?done=Dana Whitlock: making.', '/kitchen?problem=Dana Whitlock’s order is already making.']);
  await guest.page.locator('order-progress li[aria-current=step]', { hasText: 'Being made' }).waitFor({ timeout: 5000 });
  assert.equal((await a.post('/kitchen/advance', { key, to: 'ready' })).location, '/kitchen?done=Dana Whitlock: ready.');
  await guest.page.locator('order-progress .ready').waitFor({ timeout: 5000 });
  assert.equal((await a.post('/kitchen/advance', { key, to: 'picked-up' })).location, '/kitchen?done=Dana Whitlock: picked up.');
  assert.doesNotMatch(await a.get('/kitchen'), /Dana Whitlock/, 'picked up: off the list');
  await Promise.all([guest.context.close(), outsider.context.close(), a.context.close(), b.context.close()]);
});

test('a page reads the menu, the note and its own orders; nothing else; it writes nothing', async () => {
  const owner = await device('owner', { javaScriptEnabled: false });
  const mine = (await order(owner, [['latte', 1]], { slot: times()[6].slot })).location.split('/').pop();
  const other = await device('nosy', { javaScriptEnabled: false });
  const pull = async (person, scope = '') => {
    const all = [];
    for (let since = 0, i = 0; i < 200; i++) {
      const page = await (await person.context.request.get(`${app.base}/_zb/sync/pull?since=${encodeURIComponent(since)}${scope}`)).json();
      all.push(...(page.changes ?? []));
      if (!page.changes?.length || page.cursor === since) break;
      since = page.cursor;
    }
    return all;
  };
  for (const change of await pull(other)) assert.ok(['items', 'notes'].includes(change.collection), `${change.collection} isn't sent to another guest`);
  const theirs = await pull(owner);
  assert.deepEqual([...new Set(theirs.filter((change) => change.collection === 'orders').map((change) => change.key))], [mine]);
  assert.deepEqual((await pull(other, `&scope=${encodeURIComponent(JSON.stringify({ orders: true, carts: true, checkouts: true, pickups: true }))}`)).length, 0);
  for (const collection of ['items', 'orders', 'notes']) {
    const push = await other.context.request.post(`${app.base}/_zb/sync/push`, {
      headers: { 'sec-fetch-site': 'same-origin' },
      data: { changes: [{ collection, key: collection === 'items' ? 'rye' : 'x', field: 'left', value: 99, clock: `${String(Date.now()).padStart(15, '0')}-00000-x` }] },
    });
    assert.equal(push.status(), 403, collection);
  }
  assert.equal((await other.post('/cart/add', { item: 'rye', qty: '1' }, { 'sec-fetch-site': 'cross-site' })).status, 403);
  assert.equal((await other.context.request.get(`${app.base}/orders/${mine}`)).status(), 404);
  await owner.context.close();
  await other.context.close();
});
