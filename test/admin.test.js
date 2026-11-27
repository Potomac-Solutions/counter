// The admin, customer accounts and reports, over plain HTTP (no browser needed).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';

const COST = { N: 2 ** 10, r: 8, p: 1 };
const OWNER = { email: 'owner@example.com', name: 'Test Owner', password: 'test owner password' };
const STAFF = { email: 'hand@example.com', name: 'Counter Hand', password: 'counter hand password' };
const dir = mkdtempSync(join(tmpdir(), 'counter-admin-'));
let server;
let base;

before(async () => {
  server = await createApp({ staffCost: COST, db: join(dir, 'shop.db'), cache: false, secret: 'test-only-secret-that-is-long-enough-1234' });
  await server.staff.accept(await server.staff.setup(), OWNER);
  const owner = server.staff.list().find((one) => one.email === OWNER.email);
  await server.staff.accept((await server.staff.invite(owner, { email: STAFF.email, name: STAFF.name, roles: ['staff'] })).token, STAFF);
  await new Promise((done) => server.listen(0, done));
  base = `http://localhost:${server.address().port}`;
});
after(async () => {
  server.closeAllConnections?.();
  await new Promise((done) => server.close(done));
  rmSync(dir, { recursive: true, force: true });
});

function browser() {
  const jar = new Map();
  const remember = (response) => {
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      if (pair.slice(at + 1)) jar.set(pair.slice(0, at), pair.slice(at + 1));
      else jar.delete(pair.slice(0, at));
    }
    return response;
  };
  const cookie = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
  const where = (response) => decodeURIComponent((response.headers.get('location') ?? '').replace(/&sig=[\w-]+/, '').replaceAll('+', ' '));
  return {
    async get(path) {
      const response = remember(await fetch(`${base}${path}`, { headers: { cookie: cookie() }, redirect: 'manual' }));
      return { status: response.status, type: response.headers.get('content-type'), location: where(response), text: await response.text() };
    },
    async post(path, form) {
      const response = remember(await fetch(`${base}${path}`, { method: 'POST', headers: { cookie: cookie(), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form), redirect: 'manual' }));
      return { status: response.status, location: where(response), text: await response.text() };
    },
  };
}
async function signInStaff(who) {
  const b = browser();
  await b.get('/');
  assert.equal((await b.post('/staff/sign-in', { email: who.email, password: who.password })).location, '/admin');
  return b;
}
/** A bag, a pickup time and a payment: the order's key. */
async function order(b, { item = 'croissant', qty = 2, name = 'Pat Quill', email = 'pat@example.com' } = {}) {
  await b.post('/cart/add', { item, qty: String(qty) });
  await b.post('/order/time', { slot: server.counter.times().find((time) => !time.full).slot });
  const checkout = /name="checkout" value="(c[a-z0-9]+)"/.exec((await b.get('/checkout')).text)[1];
  const started = await b.post('/checkout', { checkout, name, email });
  // The test payment page, standing in for Square's: "Pay", then the way back.
  const ref = new URL(started.location, base).searchParams.get('ref');
  const back = new URL((await b.post('/pay/test', { ref, answer: 'pay' })).location);
  const paid = await b.get(back.pathname + back.search);
  const key = /^\/orders\/(c[a-z0-9]+)$/.exec(paid.location)?.[1];
  assert.ok(key, paid.location);
  return key;
}

test('the landing page leads with ordering ahead, then the menu; no admin link for a guest', async () => {
  const page = (await browser().get('/')).text;
  assert.match(page, /class="hero"[\s\S]*See today’s menu[\s\S]*id="menu"[\s\S]*How it works[\s\S]*Visit/);
  assert.ok(!page.includes('>Admin</a>'));
});

test('a customer signs up, the order follows the account, and checkout knows them; an email goes out', async () => {
  const phone = browser();
  await phone.get('/');
  const key = await order(phone);
  assert.match(server.sent.at(-1).body, new RegExp(`/orders/${key}`), 'the confirmation is in the outbox');
  assert.equal((await phone.post('/account/sign-up', { name: 'Pat Quill', email: 'pat@example.com', password: 'pat quill password' })).location, '/account?done=Welcome. Your account is ready.');
  assert.match((await phone.get('/account')).text, new RegExp(`Hello, Pat[\\s\\S]*/orders/${key}`));

  const laptop = browser();
  await laptop.get('/');
  assert.equal((await laptop.get(`/orders/${key}`)).status, 404);
  assert.equal((await laptop.post('/account/sign-in', { email: 'pat@example.com', password: 'pat quill password' })).location, '/account');
  assert.match((await laptop.get(`/orders/${key}`)).text, /2 × Butter croissant/);
  await laptop.post('/cart/add', { item: 'drip', qty: '1' });
  await laptop.post('/order/time', { slot: server.counter.times().find((time) => !time.full).slot });
  assert.match((await laptop.get('/checkout')).text, /value="Pat Quill"[\s\S]*value="pat@example.com"/, 'checkout is filled in');
  assert.equal((await laptop.post('/account/sign-out', {})).location, '/');
  assert.equal((await laptop.get(`/orders/${key}`)).status, 404);
});

test('a forgotten password: the same page either way, and the emailed link works once', async () => {
  const b = browser();
  await b.get('/');
  await b.post('/account/sign-up', { name: 'Lee Forgets', email: 'lee@example.com', password: 'lee first password' });
  const nobody = (await b.post('/account/forgot', { email: 'nobody@example.com' })).text.match(/<main[\s\S]*<\/main>/)[0];
  const lee = (await b.post('/account/forgot', { email: 'lee@example.com' })).text.match(/<main[\s\S]*<\/main>/)[0];
  assert.equal(nobody, lee);
  const token = /\/account\/reset\?token=([\w-]{43})/.exec(server.sent.at(-1).body)[1];
  assert.equal((await b.post('/account/reset', { token, password: 'lee second password' })).location, '/account?done=Your new password is saved.');
  assert.match((await b.post('/account/reset', { token, password: 'lee third password' })).text, /expired/);
});

test('the admin is for staff; reports, settings and the outbox for owners', async () => {
  const guest = browser();
  await guest.get('/');
  for (const path of ['/admin', '/admin/orders', '/admin/reports', '/admin/orders.csv']) {
    const page = await guest.get(path);
    assert.ok(!/Overview|text\/csv/.test(`${page.text}${page.type}`), path);
  }
  assert.equal((await guest.post('/admin/settings/item', { item: 'rye', name: 'Free bread', price: '0.25' })).location, '/admin');
  const hand = await signInStaff(STAFF);
  assert.match((await hand.get('/admin')).text, /Overview[\s\S]*Takings, last 30 days/);
  for (const path of ['/admin/reports', '/admin/settings', '/admin/outbox']) assert.equal((await hand.get(path)).status, 403, path);
  await hand.post('/admin/settings/item', { item: 'rye', name: 'Free bread', price: '0.25' });
  assert.equal(server.counter.store.get('items', 'rye').name, 'Seeded rye');
  const owner = await signInStaff(OWNER);
  for (const path of ['/admin/reports', '/admin/settings', '/admin/outbox']) assert.equal((await owner.get(path)).status, 200, path);
});

test('staff find an order and move it along from its page, once per step; it’s in the activity', async () => {
  const b = browser();
  await b.get('/');
  const key = await order(b, { item: 'cinnamon', qty: 1, name: 'Sam Finder', email: 'finder@example.com' });
  const hand = await signInStaff(STAFF);
  const found = (await hand.get('/admin/orders?q=finder%40example')).text;
  assert.match(found, new RegExp(`/admin/orders/${key}`));
  assert.ok(!found.includes('pat@example.com'));
  assert.match((await hand.get(`/admin/orders/${key}`)).text, /1 × Cinnamon roll[\s\S]*Start making/);
  assert.equal((await hand.post(`/admin/orders/${key}/advance`, { to: 'making' })).location, `/admin/orders/${key}?done=Now making.`);
  assert.match((await hand.post(`/admin/orders/${key}/advance`, { to: 'making' })).location, /already making/);
  assert.equal(server.counter.store.get('orders', key).status, 'making');
  assert.match((await hand.get('/admin')).text, /Counter Hand<\/strong> moved Sam Finder’s order to making/);
});

test('an owner changes a price: the menu shows it, new orders pay it, paid orders keep theirs', async () => {
  const owner = await signInStaff(OWNER);
  const before = server.counter.allOrders().find((one) => one.lines.some((line) => line.item === 'croissant'));
  assert.match((await owner.post('/admin/settings/item', { item: 'croissant', name: 'Butter croissant', price: 'cheap' })).location, /price/);
  assert.equal((await owner.post('/admin/settings/item', { item: 'croissant', name: 'All-butter croissant', price: '4.95' })).location, '/admin/settings?done=Saved All-butter croissant.');
  assert.match((await browser().get('/')).text, /All-butter croissant/);
  const b = browser();
  await b.get('/');
  const key = await order(b, { item: 'croissant', qty: 1 });
  assert.equal(server.counter.store.get('orders', key).cents, 495);
  assert.equal(server.counter.store.get('orders', before.key).cents, before.cents);
  assert.equal((await owner.post('/admin/settings/shop', { hours: 'Open 6 am', pickup: 'At the side window.' })).location, '/admin/settings?done=Saved.');
  assert.match((await browser().get('/')).text, /Open 6 am/);
});

test('reports and CSV: the takings match the orders, and a name can’t become a formula', async () => {
  const b = browser();
  await b.get('/');
  await order(b, { item: 'latte', qty: 1, name: '=HYPERLINK("http://evil.example")', email: 'sheet@example.com' });
  const owner = await signInStaff(OWNER);
  const total = server.counter.allOrders().reduce((sum, one) => sum + one.cents, 0);
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: total % 100 ? 2 : 0 }).format(total / 100);
  assert.ok((await owner.get('/admin/reports?range=30d')).text.includes(`Takings</span><strong>${money}</strong>`), money);
  const rows = (await owner.get('/admin/reports.csv?range=30d')).text.trim().split('\r\n');
  assert.equal(rows[0], 'Day,Orders,Takings (USD)');
  assert.equal(Math.round(rows.slice(1).reduce((sum, row) => sum + Number(row.split(',')[2]), 0) * 100), total);
  assert.match((await owner.get('/admin/orders.csv')).text, /"'=HYPERLINK\(""http:\/\/evil\.example""\)"/);
});

test('an owner turns a customer off; staff can’t turn them back on', async () => {
  const b = browser();
  await b.get('/');
  await b.post('/account/sign-up', { name: 'Off Switch', email: 'off@example.com', password: 'off switch password' });
  const id = server.customers.list().find((c) => c.email === 'off@example.com').customer;
  const owner = await signInStaff(OWNER);
  assert.match((await owner.post(`/admin/customers/${id}/disabled`, { disabled: 'yes' })).location, /Turned off/);
  assert.equal((await b.get('/account')).location, '/account/sign-in');
  const hand = await signInStaff(STAFF);
  await hand.post(`/admin/customers/${id}/disabled`, { disabled: 'no' });
  assert.equal(server.customers.get(id).disabled, true);
});
