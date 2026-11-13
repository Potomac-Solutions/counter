// Counter: order ahead, on one small Node server.
//
// - The menu shows what's left, live; a guest adds to an order, picks a pickup time and pays
//   once. The kitchen moves each order along and the guest's phone follows.
// - Every form is a plain post to a route here, so it all works without JavaScript.
// - The deciding is the kit's (src/counter.js): catalog, cart, checkout, pay, hold, stages.
import { createServer } from 'node:http';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createZubra } from '@zubra/server';
import { signedCookie } from '@potomac-solutions/kit/auth';
import { createStaff } from '@potomac-solutions/kit/staff';
import { staffPages } from '@potomac-solutions/kit/staff/pages';
import { createCounter, timeLabel, dayWord } from './src/counter.js';
import { layout, escape } from './src/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, 'src', 'components');
const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export async function createApp({ db = join(process.env.DATA_DIR ?? here, 'counter.db'), cache = true, secret = process.env.SESSION_SECRET, now = Date.now, holdMs , staffCost } = {}) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('Set SESSION_SECRET.');
    secret = 'counter-development-only';
  }
  const counter = await createCounter({ db, now, holdMs });
  const guests = signedCookie({ secret, name: 'guest' });
  counter.identify((request) => guests.session(request));
  const zubra = createZubra({ components, cache, packages: ['@potomac-solutions/kit/components'] });
  const { shop } = counter;
  const pickupWords = (slot) => `${dayWord(slot, now())} at ${timeLabel(slot)}`;

  // The people who run the shop: an owner and the staff they invite (the kit's staff module), in the
  // shop's own log; their pages and routes are the kit's too.
  const production = process.env.NODE_ENV === 'production';
  const staff = createStaff({ store: counter.store, secure: production, ...(staffCost ? { cost: staffCost } : {}) });
  const pages = staffPages({ staff, home: '/kitchen', business: shop.name, secure: production, render: (res, title, body) => page(res, zubra.page(), title, body) });
  const send = (res, status, html) => (res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }), res.end(html));
  const back = (res, location) => (res.writeHead(303, { location }), res.end());
  const page = (res, p, title, body, { guest = null, refresh = 0 } = {}) => send(res, 200, p.finish(layout({ title, shop, body, count: guest ? counter.cart(guest).count : null, refresh })));
  const note = (url) => {
    const problem = (url.searchParams.get('problem') ?? '').slice(0, 200);
    const done = (url.searchParams.get('done') ?? '').slice(0, 200);
    return `${problem ? `<p class="notice" role="alert">${escape(problem)}</p>` : ''}${done ? `<p class="ok" role="status">${escape(done)}</p>` : ''}`;
  };
  const withProblem = (path, answer) => `${path}?problem=${encodeURIComponent(answer.error)}`;
  async function readForm(req) {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 4000) return null;
    }
    return new URLSearchParams(body);
  }
  const lineList = (lines) => `<ul>${lines.map((line) => `<li>${line.qty} × ${escape(line.name)}</li>`).join('')}</ul>`;

  function menuPage(p, url, guest) {
    const mine = counter.ordersFor(guest).filter((order) => order.status !== 'picked-up');
    const today = counter.note();
    return `<section><h1>Order ahead</h1><p class="lede">Choose a pickup time, pay once, and we’ll have it bagged at the side window.</p></section>
${note(url)}
${p.render('kitchen-note', { note: 'today', textNow: today.text, atNow: today.at, atLabel: today.at ? new Date(today.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: shop.timeZone }) : '', timeZone: shop.timeZone })}
${mine.length ? `<section class="panel"><h2>Your orders</h2><ul>${mine.map((order) => `<li><a href="/orders/${order.key}">${escape(pickupWords(order.slot))}</a> · ${order.status.replace('-', ' ')}</li>`).join('')}</ul></section>` : ''}
${counter
  .menu()
  .map(({ section, items }) => `<section class="section panel"><h2>${escape(section)}</h2>${items.map((item) => p.render('menu-item', { item: item.key, name: item.name, unit: item.unit, cents: item.cents, leftNow: item.left, add: '/cart/add' })).join('')}</section>`)
  .join('')}`;
  }

  function orderPage(p, url, guest) {
    const view = counter.cart(guest);
    const times = counter.times();
    // A time that filled up since the guest chose it has to be chosen again.
    const chosen = times.find((time) => time.slot === counter.pickup(guest) && !time.full)?.slot ?? '';
    return `<section><a href="/">Back to the menu</a><h1>Your order</h1></section>
${note(url)}
${p.render('cart-panel', { cart: view, change: '/cart/change', checkout: chosen ? '/checkout' : '', heading: 'In your bag' })}
${view.lines.length ? `<form class="panel" method="post" action="/order/time"><h2>Pickup time</h2>
  <label>When you’ll come by <select name="slot" required><option value="">Choose…</option>${times.map((time) => `<option value="${escape(time.slot)}"${time.slot === chosen && !time.full ? ' selected' : ''}${time.full ? ' disabled' : ''}>${escape(dayWord(time.slot, now()))} ${escape(time.label)}${time.full ? ' (full)' : ''}</option>`).join('')}</select></label>
  <button type="submit">${chosen ? 'Change the time' : 'Set the time'}</button>
  <p>${chosen ? `Pickup ${escape(pickupWords(chosen))}. Check out above when you’re ready.` : 'Choose a time, then check out.'}</p>
</form>` : ''}`;
  }

  function checkoutPage(p, url, guest) {
    const view = counter.cart(guest);
    const slot = counter.pickup(guest);
    return `<section><a href="/order">Back to your order</a><h1>Check out</h1><p class="lede">Pickup ${escape(pickupWords(slot))}. ${escape(shop.pickup)}</p></section>
${p.render('checkout-form', { cart: view, place: '/checkout', checkout: counter.checkoutKey(), problem: (url.searchParams.get('problem') ?? '').slice(0, 200), testMode: true })}`;
  }

  function orderStatus(p, order) {
    return `<section><p class="lede">Order · test mode</p><h1>Pickup ${escape(pickupWords(order.slot))}</h1><p class="lede">For ${escape(order.name)} · ${money(order.cents)}. ${escape(shop.pickup)}</p></section>
${p.render('order-progress', { order: order.key, statusNow: order.status })}
<section class="panel"><h2>In the bag</h2>${lineList(order.lines)}</section>`;
  }

  function kitchenPage(url) {
    const orders = counter.kitchen();
    const label = { making: 'Start making', ready: 'Ready', 'picked-up': 'Picked up' };
    return `<section><h1>The kitchen</h1><p class="lede">Orders by pickup time. This page refreshes itself every 20 seconds; the guest’s phone follows each step at once. <a href="/kitchen/menu">Stock and today’s note</a></p></section>
${note(url)}
${orders.length ? `<ul class="orders">${orders
      .map((order) => {
        const next = counter.steps[counter.steps.indexOf(order.status) + 1];
        return `<li class="ticket"><p><strong>${escape(timeLabel(order.slot))}</strong> ${dayWord(order.slot, now()) === 'tomorrow' ? '(tomorrow) ' : ''}· ${escape(order.name)} · ${order.status.replace('-', ' ')}</p>${lineList(order.lines)}<form method="post" action="/kitchen/advance"><input type="hidden" name="key" value="${order.key}"><input type="hidden" name="to" value="${next}"><button type="submit">${label[next]}</button></form></li>`;
      })
      .join('')}</ul>` : '<p>No orders waiting.</p>'}`;
  }

  function kitchenMenu(url) {
    const items = counter.menu().flatMap(({ items }) => items);
    return `<section><a href="/kitchen">Back to the orders</a><h1>Stock and today’s note</h1><p class="lede">Set how many are left (0 is sold out). Every open menu shows it at once.</p></section>
${note(url)}
<section class="panel">${items
      .filter((item) => item.left !== null)
      .map((item) => `<form class="stock" method="post" action="/kitchen/stock"><input type="hidden" name="item" value="${item.key}"><label>${escape(item.name)}<input name="left" type="number" min="0" max="500" value="${item.left}"></label><button type="submit">Set</button></form>`)
      .join('')}</section>
<form class="panel" method="post" action="/kitchen/note"><h2>Today’s note</h2><label>The special, what’s fresh<textarea name="text" rows="2" maxlength="200">${escape(counter.note().text)}</textarea></label><button type="submit">Post it</button></form>`;
  }

  const server = createServer(async (req, res) => {
    try {
      if (await counter.sync.handle(req, res)) return;
      if (zubra.handle(req, res)) return;
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      if (url.pathname === '/favicon.ico') return res.writeHead(204).end();
      const guest = guests.ensure(req, res);
      const who = staff.session(req);
      const onShift = staff.can(who, 'staff');

      if (req.method === 'POST') {
        // Every form is ours: another site's post is refused (the cookies are SameSite=Lax too).
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, 'Forbidden');
        const form = await readForm(req);
        if (!form) return send(res, 413, 'Too large');
        if (url.pathname === '/cart/add') {
          const done = await counter.add(guest, form);
          return back(res, done.ok ? `/?done=${encodeURIComponent('Added to your order.')}` : withProblem('/', done));
        }
        if (url.pathname === '/cart/change') {
          const done = await counter.change(guest, form);
          return back(res, done.ok ? '/order' : withProblem('/order', done));
        }
        if (url.pathname === '/order/time') {
          const done = await counter.choose(guest, form);
          return back(res, done.ok ? '/order' : withProblem('/order', done));
        }
        if (url.pathname === '/checkout') {
          const done = await counter.place(guest, form);
          return back(res, done.ok ? `/orders/${done.key}` : withProblem(done.back ?? '/checkout', done));
        }
        // Sign-in, links, people and passwords.
        if (await pages.handle(req, res, url, form)) return;
        if (url.pathname.startsWith('/kitchen/')) {
          if (!onShift) return back(res, '/kitchen');
          if (url.pathname === '/kitchen/advance') {
            const done = await counter.advance(String(form.get('key') ?? ''), String(form.get('to') ?? ''));
            return back(res, done.ok ? `/kitchen?done=${encodeURIComponent(`${done.order.name}: ${done.to.replace('-', ' ')}.`)}` : withProblem('/kitchen', done));
          }
          if (url.pathname === '/kitchen/stock') {
            const done = await counter.stock(form);
            return back(res, done.ok ? `/kitchen/menu?done=${encodeURIComponent(done.item.left ? `${done.item.name}: ${done.item.left} left.` : `${done.item.name}: sold out.`)}` : withProblem('/kitchen/menu', done));
          }
          if (url.pathname === '/kitchen/note') {
            await counter.setNote(form.get('text'));
            return back(res, `/kitchen/menu?done=${encodeURIComponent('Posted. Every open menu shows it now.')}`);
          }
        }
        return send(res, 404, 'Not found');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

      if (await pages.handle(req, res, url, null)) return;
      const p = zubra.page();
      if (url.pathname === '/') return page(res, p, 'Menu', menuPage(p, url, guest), { guest });
      if (url.pathname === '/order') return page(res, p, 'Your order', orderPage(p, url, guest), { guest });
      if (url.pathname === '/checkout') {
        if (!counter.cart(guest).lines.length) return back(res, '/order');
        if (!counter.pickup(guest)) return back(res, withProblem('/order', { error: 'Choose a pickup time first.' }));
        return page(res, p, 'Check out', checkoutPage(p, url, guest), { guest });
      }
      const ordering = url.pathname.match(/^\/orders\/(c[a-z0-9]+)$/);
      const order = ordering && counter.order(guest, ordering[1]);
      if (order) return page(res, p, 'Your order', orderStatus(p, order), { guest });
      if (url.pathname === '/kitchen' || url.pathname === '/kitchen/menu') {
        if (!onShift) return page(res, p, 'Sign in', pages.signIn(url));
        if (url.pathname === '/kitchen') return page(res, p, 'The kitchen', pages.bar(who) + kitchenPage(url), { refresh: 20 });
        return page(res, p, 'Stock', pages.bar(who) + kitchenMenu(url));
      }
      send(res, 404, 'Not found');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, 'Something went wrong.');
      else res.end();
    }
  });
  return Object.assign(server, { counter, staff });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 3000);
  const server = await createApp();
  if (server.staff.needsOwner()) console.log(`Set up the first owner (works once, for a day): http://localhost:${port}/staff/accept?token=${await server.staff.setup()}`);
  server.listen(port, '0.0.0.0', () => console.log(`Counter on http://localhost:${port}`));
}
