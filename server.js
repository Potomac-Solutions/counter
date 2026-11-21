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
import { staffPages, clientAddress } from '@potomac-solutions/kit/staff/pages';
import { createCustomers } from '@potomac-solutions/kit/customers';
import { createNotify, outbox } from '@potomac-solutions/kit/notify';
import * as accountPages from './src/account.js';
import { money } from './src/account.js';
import { createAdmin } from './src/admin.js';
import { createNotices } from '@potomac-solutions/kit/notice';
import { createCounter, timeLabel, dayWord } from './src/counter.js';
import { layout, escape } from './src/layout.js';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, 'src', 'components');

export async function createApp({ db = join(process.env.DATA_DIR ?? here, 'counter.db'), cache = true, secret = process.env.SESSION_SECRET, now = Date.now, holdMs, staffCost, publicUrl = process.env.PUBLIC_URL ?? '' } = {}) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('Set SESSION_SECRET.');
    secret = 'counter-development-only';
  }
  const counter = await createCounter({ db, now, holdMs });
  const guests = signedCookie({ secret, name: 'guest' });
  const production = process.env.NODE_ENV === 'production';
  // Customers who make an account (kit/customers), in the shop's own log.
  const customers = createCustomers({ store: counter.store, secure: production, now, ...(staffCost ? { cost: staffCost } : {}) });
  // A page follows the orders of its browser and, signed in, of its account.
  counter.identify((request) => {
    const guest = guests.session(request);
    return guest ? { ...guest, customer: customers.session(request)?.customer } : null;
  });
  // Email goes to an outbox the owner can read: this demo sends nothing for real.
  const mail = outbox();
  const notify = createNotify({
    send: mail.send,
    templates: {
      reset: ({ name, link }) => ({ subject: `Reset your ${counter.shop.name} password`, body: `Hi ${name},\n\nThis link sets a new password. It works once, for an hour:\n${link}\n\nIf it wasn’t you, ignore this email.` }),
      placed: ({ name, when, what, total, link }) => ({ subject: `Your order for ${when}`, body: `Hi ${name},\n\nWe’ve got your order for pickup ${when}: ${what}. ${total}, paid (test mode).\n\nFollow it here: ${link}\n\n${counter.shop.pickup}` }),
    },
  });
  const origin = (req) => publicUrl || `http://${req.headers.host ?? 'localhost'}`;
  const zubra = createZubra({ components, cache, packages: ['@potomac-solutions/kit/components'] });
  const { shop } = counter;
  const pickupWords = (slot) => `${dayWord(slot, now())} at ${timeLabel(slot)}`;

  // The people who run the shop: an owner and the staff they invite (the kit's staff module), in the
  // shop's own log; their pages and routes are the kit's too.
  const staff = createStaff({ store: counter.store, secure: production, ...(staffCost ? { cost: staffCost } : {}) });
  // A message in an address shows only if the server signed it (kit/notice), so a link can't put
  // its own words in a page's alert.
  const notices = createNotices({ secret });
  const proxies = Number(process.env.TRUST_PROXIES ?? 0);
  const pages = staffPages({ staff, notices, proxies, home: '/admin', business: shop.name, secure: production, render: (res, title, body) => page(res, zubra.page(), title, body) });
  const send = (res, status, html) => (res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }), res.end(html));
  const back = (res, location) => (res.writeHead(303, { location: notices.sign(location) }), res.end());
  const page = (res, p, title, body, { guest = null, refresh = 0, status = 200, ...options } = {}) => send(res, status, p.finish(layout({ title, shop, body, count: guest ? counter.cart(guest).count : null, refresh, ...options })));
  const admin = createAdmin({ counter, customers, sent: mail.sent, now });
  const downloadCsv = (res, name, text) => (res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store' }), res.end(text));
  const note = (url) => {
    const problem = notices.read(url).problem;
    const done = notices.read(url).done;
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

  function menuPage(p, url, guest, account) {
    const mine = counter.ordersFor(guest).filter((order) => order.status !== 'picked-up');
    const today = counter.note();
    return `<section class="hero"><h1>Order ahead</h1><p class="lede">Bread, pastry and coffee from ${escape(shop.name)}. Choose a pickup time, pay once, and we’ll have it bagged at the side window. ${escape(shop.hours)}.</p><div class="actions"><a class="go" href="#menu">See today’s menu</a>${account ? '<a class="button light" href="/account">Your orders</a>' : '<a class="button light" href="/account/sign-up">Make an account</a>'}</div></section>
${note(url)}
${p.render('kitchen-note', { note: 'today', textNow: today.text, atNow: today.at, atLabel: today.at ? new Date(today.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: shop.timeZone }) : '', timeZone: shop.timeZone })}
${mine.length ? `<section class="panel"><h2>Your orders</h2><ul>${mine.map((order) => `<li><a href="/orders/${order.key}">${escape(pickupWords(order.slot))}</a> · ${order.status.replace('-', ' ')}</li>`).join('')}</ul></section>` : ''}
${counter
  .menu()
  .map(({ section, items }, i) => `<section class="section panel"${i === 0 ? ' id="menu"' : ''}><h2>${escape(section)}</h2>${items.map((item) => p.render('menu-item', { item: item.key, name: item.name, unit: item.unit, cents: item.cents, leftNow: item.left, add: '/cart/add' })).join('')}</section>`)
  .join('')}
<section class="two">
  <div class="panel"><h2>How it works</h2><ol><li>Add what you’d like; the menu shows what’s left, live.</li><li>Choose a pickup time and pay once.</li><li>Your page follows the kitchen: making, then ready.</li></ol></div>
  <div class="panel"><h2>Visit</h2><dl><dt>Where</dt><dd>${escape(shop.town)}</dd><dt>Hours</dt><dd>${escape(shop.hours)}</dd><dt>Pickup</dt><dd>${escape(shop.pickup)}</dd></dl></div>
</section>`;
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

  function checkoutPage(p, url, guest, account) {
    const view = counter.cart(guest);
    const slot = counter.pickup(guest);
    return `<section><a href="/order">Back to your order</a><h1>Check out</h1><p class="lede">Pickup ${escape(pickupWords(slot))}. ${escape(shop.pickup)}</p></section>
${p.render('checkout-form', { cart: view, place: '/checkout', checkout: counter.checkoutKey(), problem: notices.read(url).problem, testMode: true, name: account?.name ?? '', email: account?.email ?? '' })}`;
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
      const account = customers.session(req);
      const guest = { ...guests.ensure(req, res), customer: account?.customer };
      const who = staff.session(req);
      const onShift = staff.can(who, 'staff');
      const owner = staff.can(who, 'owner');
      const nav = { customer: account, staff: onShift };
      const show = (p, title, body, options = {}) => page(res, p, title, body, { nav, ...options });
      if (url.pathname.startsWith('/account') || url.pathname.startsWith('/admin')) res.setHeader('cache-control', 'no-store');
      const said = () => note(url);

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
          if (done.ok && !done.again) {
            const order = counter.order(guest, done.key);
            if (order?.email && !mail.sent.some((one) => one.body.includes(`/orders/${done.key}`))) {
              await notify.notify({ email: order.email }, 'placed', { name: order.name, when: pickupWords(order.slot), what: order.lines.map((line) => `${line.qty} × ${line.name}`).join(', '), total: money(order.cents), link: `${origin(req)}/orders/${done.key}` });
            }
          }
          return back(res, done.ok ? `/orders/${done.key}` : withProblem(done.back ?? '/checkout', done));
        }
        // A customer's account.
        if (url.pathname.startsWith('/account/')) {
          const p = zubra.page();
          const problem = (words) => `<p class="notice" role="alert">${escape(words)}</p>`;
          if (url.pathname === '/account/sign-up') {
            const made = await customers.signUp({ email: form.get('email'), name: form.get('name'), password: form.get('password') });
            if (made.error) return show(p, 'Make an account', accountPages.signUp({ problem: problem(made.error), form }), { status: 422 });
            await counter.claim(guest, made.customer);
            res.setHeader('set-cookie', made.cookie);
            return back(res, `/account?done=${encodeURIComponent('Welcome. Your account is ready.')}`);
          }
          if (url.pathname === '/account/sign-in') {
            const signed = await customers.signIn(form.get('email'), form.get('password'), { client: clientAddress(req, { proxies }) });
            if (signed.error) return show(p, 'Sign in', accountPages.signIn({ problem: problem(signed.error === 'locked' ? 'Too many tries. Wait 15 minutes, or reset your password.' : 'That email and password don’t match.'), email: String(form.get('email') ?? '') }), { status: 401 });
            await counter.claim(guest, signed.customer);
            res.setHeader('set-cookie', signed.cookie);
            return back(res, '/account');
          }
          if (url.pathname === '/account/sign-out') {
            res.setHeader('set-cookie', (await customers.signOut(req)).cookie);
            return back(res, '/');
          }
          if (url.pathname === '/account/forgot') {
            const email = String(form.get('email') ?? '').trim().toLowerCase();
            const raw = await customers.resetToken(email);
            const one = raw && customers.list().find((c) => c.email === email);
            if (one) {
              const link = `${origin(req)}/account/reset?token=${raw}`;
              await notify.notify({ email: one.email }, 'reset', { name: one.name, link });
              if (!production) console.log(`Password reset for ${one.email}: ${link}`);
            }
            return show(p, 'Reset your password', accountPages.forgot({ sent: true }));
          }
          if (url.pathname === '/account/reset') {
            const raw = String(form.get('token') ?? '');
            const reset = await customers.reset(raw, form.get('password'));
            if (reset.error) return show(p, 'Choose a new password', accountPages.reset({ token: raw, problem: problem(reset.error), works: customers.peek(raw) }), { status: 422 });
            res.setHeader('set-cookie', reset.cookie);
            return back(res, `/account?done=${encodeURIComponent('Your new password is saved.')}`);
          }
          if (url.pathname === '/account/profile') {
            if (!account) return back(res, '/account/sign-in');
            const renamed = await customers.rename(account.customer, form.get('name'));
            return back(res, renamed.ok ? `/account?done=${encodeURIComponent('Saved.')}` : withProblem('/account', renamed));
          }
          return send(res, 404, 'Not found');
        }
        // The admin's changes. Staff move orders; owners change customers and settings.
        if (url.pathname.startsWith('/admin/')) {
          if (!onShift) return back(res, '/admin');
          const moving = url.pathname.match(/^\/admin\/orders\/(c[a-z0-9]+)\/advance$/);
          if (moving) {
            const done = await counter.advance(moving[1], String(form.get('to') ?? ''));
            if (!done.ok) return back(res, withProblem(`/admin/orders/${moving[1]}`, done));
            await counter.audit(who, `moved ${done.order.name}’s order to ${done.to.replace('-', ' ')}`, moving[1]);
            return back(res, `/admin/orders/${moving[1]}?done=${encodeURIComponent(`Now ${done.to.replace('-', ' ')}.`)}`);
          }
          if (!owner) return back(res, '/admin');
          const customerAction = url.pathname.match(/^\/admin\/customers\/(c[a-z0-9]+)\/(disabled|reset)$/);
          const one = customerAction && customers.get(customerAction[1]);
          if (one && customerAction[2] === 'disabled') {
            const off = form.get('disabled') === 'yes';
            await customers.setDisabled(one.customer, off);
            await counter.audit(who, `${off ? 'turned off' : 'turned back on'} ${one.name}’s account`, one.customer);
            return back(res, `/admin/customers/${one.customer}?done=${encodeURIComponent(off ? 'Turned off and signed out everywhere.' : 'Turned back on.')}`);
          }
          if (one) {
            const raw = await customers.resetToken(one.email);
            if (!raw) return back(res, withProblem(`/admin/customers/${one.customer}`, { error: 'That account is turned off.' }));
            await notify.notify({ email: one.email }, 'reset', { name: one.name, link: `${origin(req)}/account/reset?token=${raw}` });
            await counter.audit(who, `emailed ${one.name} a reset link`, one.customer);
            return back(res, `/admin/customers/${one.customer}?done=${encodeURIComponent('Sent. It’s in the outbox.')}`);
          }
          if (url.pathname === '/admin/settings/item') {
            const saved = await counter.setItem(form);
            if (saved.error) return back(res, withProblem('/admin/settings', saved));
            await counter.audit(who, `set ${saved.item.name} to ${money(saved.item.cents)}`, saved.item.key);
            return back(res, `/admin/settings?done=${encodeURIComponent(`Saved ${saved.item.name}.`)}`);
          }
          if (url.pathname === '/admin/settings/shop') {
            const saved = await counter.setShop(form);
            if (saved.error) return back(res, withProblem('/admin/settings', saved));
            await counter.audit(who, 'changed the hours or pickup words');
            return back(res, `/admin/settings?done=${encodeURIComponent('Saved.')}`);
          }
          return send(res, 404, 'Not found');
        }
        // Sign-in, links, people and passwords.
        if (await pages.handle(req, res, url, form)) return;
        if (url.pathname.startsWith('/kitchen/')) {
          if (!onShift) return back(res, '/kitchen');
          if (url.pathname === '/kitchen/advance') {
            const done = await counter.advance(String(form.get('key') ?? ''), String(form.get('to') ?? ''));
            if (done.ok) await counter.audit(who, `moved ${done.order.name}’s order to ${done.to.replace('-', ' ')}`, done.order.key);
            return back(res, done.ok ? `/kitchen?done=${encodeURIComponent(`${done.order.name}: ${done.to.replace('-', ' ')}.`)}` : withProblem('/kitchen', done));
          }
          if (url.pathname === '/kitchen/stock') {
            const done = await counter.stock(form);
            if (done.ok) await counter.audit(who, done.item.left ? `set ${done.item.name} to ${done.item.left} left` : `marked ${done.item.name} sold out`, done.item.key);
            return back(res, done.ok ? `/kitchen/menu?done=${encodeURIComponent(done.item.left ? `${done.item.name}: ${done.item.left} left.` : `${done.item.name}: sold out.`)}` : withProblem('/kitchen/menu', done));
          }
          if (url.pathname === '/kitchen/note') {
            await counter.setNote(form.get('text'));
            await counter.audit(who, 'posted today’s note');
            return back(res, `/kitchen/menu?done=${encodeURIComponent('Posted. Every open menu shows it now.')}`);
          }
        }
        return send(res, 404, 'Not found');
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

      if (await pages.handle(req, res, url, null)) return;
      const p = zubra.page();
      if (url.pathname === '/') return show(p, 'Menu', menuPage(p, url, guest, account), { guest, here: '/' });

      // A customer's pages.
      if (url.pathname === '/account') return account ? show(p, 'Your account', accountPages.account({ counter, guest, customer: account, said: said() }), { guest, here: '/account' }) : back(res, '/account/sign-in');
      if (url.pathname === '/account/sign-in') return account ? back(res, '/account') : show(p, 'Sign in', accountPages.signIn({ problem: said() }), { here: '/account/sign-in' });
      if (url.pathname === '/account/sign-up') return account ? back(res, '/account') : show(p, 'Make an account', accountPages.signUp());
      if (url.pathname === '/account/forgot') return show(p, 'Reset your password', accountPages.forgot());
      if (url.pathname === '/account/reset') {
        const raw = url.searchParams.get('token') ?? '';
        return show(p, 'Choose a new password', accountPages.reset({ token: raw, works: customers.peek(raw) }));
      }

      // The admin: staff only; reports, settings and the outbox for owners.
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        if (!onShift) return show(p, 'Sign in', pages.signIn(url));
        const bar = pages.bar(who);
        const wide = { wide: true, here: '/admin' };
        if (url.pathname === '/admin') return show(p, 'Overview', admin.dashboard({ who, owner, bar }), wide);
        if (url.pathname === '/admin/orders') return show(p, 'Orders', admin.orders({ url, owner, bar }), wide);
        if (url.pathname === '/admin/orders.csv') return downloadCsv(res, 'orders.csv', admin.ordersCsv(url));
        const oneOrder = url.pathname.match(/^\/admin\/orders\/(c[a-z0-9]+)$/);
        const order = oneOrder && counter.staffOrder(oneOrder[1]);
        if (order) return show(p, `Order ${order.key}`, admin.order({ order, owner, bar, said: said() }), wide);
        if (url.pathname === '/admin/customers') return show(p, 'Customers', admin.customers({ url, owner, bar }), wide);
        if (url.pathname === '/admin/customers.csv') return downloadCsv(res, 'customers.csv', admin.customersCsv());
        const oneCustomer = url.pathname.match(/^\/admin\/customers\/(c[a-z0-9]+)$/);
        const one = oneCustomer && customers.get(oneCustomer[1]);
        if (one) return show(p, one.name, admin.customer({ one, owner, bar, said: said() }), wide);
        if (['/admin/reports', '/admin/reports.csv', '/admin/settings', '/admin/outbox'].includes(url.pathname) && !owner) return show(p, 'Owners only', '<section><h1>Owners only</h1><p class="lede">Ask an owner to see this page.</p><p><a href="/admin">Back to the overview</a></p></section>', { status: 403 });
        if (url.pathname === '/admin/reports') return show(p, 'Reports', admin.reports({ url, owner, bar }), wide);
        if (url.pathname === '/admin/reports.csv') return downloadCsv(res, 'takings.csv', admin.reportCsv(url));
        if (url.pathname === '/admin/settings') return show(p, 'Settings', admin.settings({ owner, bar, said: said() }), wide);
        if (url.pathname === '/admin/outbox') return show(p, 'Outbox', admin.outbox({ owner, bar }), wide);
        return send(res, 404, 'Not found');
      }
      if (url.pathname === '/order') return show(p, 'Your order', orderPage(p, url, guest), { guest });
      if (url.pathname === '/checkout') {
        if (!counter.cart(guest).lines.length) return back(res, '/order');
        if (!counter.pickup(guest)) return back(res, withProblem('/order', { error: 'Choose a pickup time first.' }));
        return show(p, 'Check out', checkoutPage(p, url, guest, account), { guest });
      }
      const ordering = url.pathname.match(/^\/orders\/(c[a-z0-9]+)$/);
      const order = ordering && counter.order(guest, ordering[1]);
      if (order) return show(p, 'Your order', orderStatus(p, order), { guest });
      if (url.pathname === '/kitchen' || url.pathname === '/kitchen/menu') {
        if (!onShift) return show(p, 'Sign in', pages.signIn(url));
        if (url.pathname === '/kitchen') return show(p, 'The kitchen', pages.bar(who) + kitchenPage(url), { refresh: 20 });
        return show(p, 'Stock', pages.bar(who) + kitchenMenu(url));
      }
      send(res, 404, 'Not found');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, 'Something went wrong.');
      else res.end();
    }
  });
  const stop = server.close.bind(server);
  server.close = (cb) => stop((error) => {
    try { counter.close(); } finally { cb?.(error); }
  });
  return Object.assign(server, { counter, staff, customers, sent: mail.sent });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 6.0 runs in production unless this is set. `--dev` works in cmd, where a NODE_ENV= prefix does not.
  if (process.argv.includes('--dev')) process.env.NODE_ENV = 'development';
  const port = Number(process.env.PORT ?? 3000);
  const server = await createApp();
  if (server.staff.needsOwner()) console.log(`Set up the first owner (works once, for a day): http://localhost:${port}/staff/accept?token=${await server.staff.setup()}`);
  server.listen(port, '0.0.0.0', () => console.log(`Counter on http://localhost:${port}`));
}
