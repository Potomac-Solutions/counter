// Paying on the platform's page: the test page until Square is set up, then Square's own, by
// one setting. Square is faked here (its calls are the kit's, tested there); the trip is real.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server.js';

const dir = mkdtempSync(join(tmpdir(), 'counter-pay-'));
after(() => rmSync(dir, { recursive: true, force: true }));
const COST = { N: 2 ** 10, r: 8, p: 1 };
const SECRET = 'test-only-secret-that-is-long-enough-1234';
const bakery = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date());
const sinceHalfSeven = ((Number(bakery.find((part) => part.type === 'hour').value) * 60 + Number(bakery.find((part) => part.type === 'minute').value) - 450 + 1440) % 1440) * 60_000;
const now = () => Date.now() - sinceHalfSeven;

async function shop(name, options = {}) {
  const server = await createApp({ staffCost: COST, db: join(dir, `${name}.db`), cache: false, secret: SECRET, now, ...options });
  await new Promise((done) => server.listen(0, done));
  const base = `http://localhost:${server.address().port}`;
  const jar = new Map();
  const call = async (path, init = {}) => {
    const response = await fetch(new URL(path, base), { ...init, redirect: 'manual', headers: { ...(init.headers ?? {}), cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } });
    for (const line of response.headers.getSetCookie()) {
      const [pair] = line.split(';');
      const at = pair.indexOf('=');
      jar.set(pair.slice(0, at), pair.slice(at + 1));
    }
    const location = decodeURIComponent((response.headers.get('location') ?? '').replace(/&sig=[\w-]+/, '').replaceAll('+', ' '));
    return { status: response.status, location, text: await response.text() };
  };
  const post = (path, form) => call(path, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form) });
  await call('/');
  const ready = async () => {
    await post('/cart/add', { item: 'croissant', qty: '2' });
    await post('/order/time', { slot: server.counter.times()[0].slot });
    const page = (await call('/checkout')).text;
    ready.page = page;
    return /name="checkout" value="(c[a-z0-9]+)"/.exec(page)[1];
  };
  const close = () => new Promise((done) => (server.closeAllConnections?.(), server.close(done)));
  return { server, base, call, post, ready, close };
}

test('backing out of the test page: nothing charged, the croissants and the pickup place go back, the bag stays', async () => {
  const s = await shop('back-out');
  try {
    const before = s.server.counter.store.get('items', 'croissant').left;
    const key = await s.ready();
    const sent = await s.post('/checkout', { checkout: key, name: 'Ada', email: 'ada@example.com' });
    assert.match(sent.location, /^\/pay\/test\?ref=test_page_\d+$/);
    assert.equal(s.server.counter.store.get('items', 'croissant').left, before - 2, 'held while they pay');
    const page = await s.call(sent.location);
    assert.match(page.text, /<h1>The Gilded Crumb order<\/h1>|<h1>[^<]+ order<\/h1>/);
    const cancel = /href="([^"]+)">Go back without paying/.exec(page.text)[1].replaceAll('&amp;', '&');
    const back = await s.call(new URL(cancel).pathname + new URL(cancel).search);
    assert.equal(back.location, '/checkout?problem=Nothing was charged. Your order is still here.');
    assert.equal(s.server.counter.store.get('items', 'croissant').left, before);
    assert.match((await s.call('/order')).text, /Butter croissant/);
    assert.equal(s.server.counter.store.under('orders').length, 0);
  } finally {
    await s.close();
  }
});

test('the same checkout on Square once its settings are there: off to Square, back, paid once, the webhook too', async () => {
  const calls = [];
  let paid = false;
  const square = async (url, init = {}) => {
    const path = new URL(url).pathname;
    calls.push({ path, body: init.body ? JSON.parse(init.body) : null, host: new URL(url).host });
    if (path === '/v2/online-checkout/payment-links') return Response.json({ payment_link: { id: 'PL1', order_id: 'ORDER1', url: 'https://sandbox.square.link/u/abc' } });
    if (path === '/v2/orders/ORDER1') return Response.json({ order: { id: 'ORDER1', state: paid ? 'COMPLETED' : 'OPEN', total_money: { amount: 850, currency: 'USD' }, tenders: paid ? [{ id: 'T1', payment_id: 'PAY1', amount_money: { amount: 850, currency: 'USD' } }] : [] } });
    return new Response('{}', { status: 404 });
  };
  const s = await shop('square', { payEnv: { PAY_SQUARE_TOKEN: 'sandbox-token', PAY_SQUARE_LOCATION: 'LOC1', PAY_SQUARE_SANDBOX: '1' }, payFetch: square, publicUrl: '' });
  try {
    assert.equal(s.server.payments.name, 'square');
    const key = await s.ready();
    assert.match(s.ready.page, /You’ll pay on Square’s secure page next, in its test mode: no money moves\. We never see your card number\./);
    const sent = await s.post('/checkout', { checkout: key, name: 'Ada', email: 'ada@example.com' });
    assert.equal(sent.location, 'https://sandbox.square.link/u/abc');
    assert.equal(calls[0].host, 'connect.squareupsandbox.com');
    assert.equal(calls[0].body.quick_pay.price_money.amount, 850, 'the server’s total, never the page’s');
    assert.equal(calls[0].body.checkout_options.redirect_url, `${s.base}/pay/back?checkout=${key}`);
    assert.equal((await s.call('/pay/test?ref=x')).status, 404, 'no test page once Square is in use');

    paid = true;
    const back = await s.call(`/pay/back?checkout=${key}`);
    assert.equal(back.location, `/orders/${key}`);
    assert.equal(s.server.counter.store.get('orders', key).status, 'placed');
    assert.equal(s.server.sent.filter((mail) => mail.body.includes(`/orders/${key}`)).length, 1, 'one email');
    const webhook = await s.call('/pay/webhook', { method: 'POST', body: JSON.stringify({ type: 'payment.updated', data: { object: { payment: { order_id: 'ORDER1' } } } }) });
    assert.equal(webhook.status, 200);
    assert.equal(s.server.counter.store.under('orders').length, 1, 'the webhook finds it done');
    assert.equal(s.server.sent.filter((mail) => mail.body.includes(`/orders/${key}`)).length, 1);
  } finally {
    await s.close();
  }
});
