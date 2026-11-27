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
import { lockedStaff, lockedCustomers, staffSignIn, guestSignIn, nightly } from './src/demo.js';
import { createCounter, timeLabel, dayWord, minutesUntil } from './src/counter.js';
import { layout, escape } from './src/layout.js';
import { landing } from './src/site.js';
import { shell } from './src/shell.js';
import { serveAsset } from './src/assets.js';
import { createPayments } from './src/payments.js';
import { PLATFORM_NAMES as PAY_NAMES } from '@potomac-solutions/kit/pay/providers';

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, 'src', 'components');

export async function createApp({ db = join(process.env.DATA_DIR ?? here, 'counter.db'), cache = true, secret = process.env.SESSION_SECRET, now = Date.now, holdMs, staffCost, publicUrl = process.env.PUBLIC_URL ?? '', demo = process.env.DEMO === '1', payEnv = process.env, payFetch } = {}) {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') throw new Error('Set SESSION_SECRET.');
    secret = 'counter-development-only-not-a-real-secret';
  }
  // Square is this demo's platform; until its settings are on the server, the kit's test page stands in.
  const payments = createPayments({ env: payEnv, intended: 'square', fetch: payFetch });
  const counter = await createCounter({ db, now, holdMs, provider: payments.provider });
  const guests = signedCookie({ secret, name: 'guest' });
  const production = process.env.NODE_ENV === 'production';
  // Customers who make an account (kit/customers), in the shop's own log.
  const kitCustomers = createCustomers({ store: counter.store, secure: production, now, ...(staffCost ? { cost: staffCost } : {}) });
  // The public demo (src/demo.js) refuses changes to its sign-ins.
  const customers = demo ? lockedCustomers(kitCustomers) : kitCustomers;
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
      placed: ({ name, when, what, total, link }) => ({ subject: `Your order for ${when}`, body: `Hi ${name},\n\nWe’ve got your order for pickup ${when}: ${what}. ${total}, paid${payments.sandbox ? ' (test mode)' : ''}.\n\nFollow it here: ${link}\n\n${counter.shop.pickup}` }),
    },
  });
  const origin = (req) => publicUrl || `http://${req.headers.host ?? 'localhost'}`;
  const zubra = createZubra({ components, cache, packages: ['@potomac-solutions/kit/components'] });
  const { shop } = counter;
  const pickupWords = (slot) => `${dayWord(slot, now())} at ${timeLabel(slot)}`;

  // The people who run the shop: an owner and the staff they invite (the kit's staff module), in the
  // shop's own log; their pages and routes are the kit's too.
  const kitStaff = createStaff({ store: counter.store, secure: production, ...(staffCost ? { cost: staffCost } : {}) });
  const staff = demo ? lockedStaff(kitStaff) : kitStaff;
  // Staff are sent the kitchen's board: the document that says an order was placed or moved.
  counter.staffed((request) => staff.can(staff.session(request), 'staff'));
  // A message in an address shows only if the server signed it (kit/notice), so a link can't put
  // its own words in a page's alert.
  const notices = createNotices({ secret });
  const proxies = Number(process.env.TRUST_PROXIES ?? 0);
  const pages = staffPages({ staff, notices, proxies, home: '/admin', business: shop.name, secure: production, // A signed-in member of staff sees the kit's pages (people, their password) inside the staff shell;
    // signing in and accepting an invite are a narrow card on the shop's own page.
    render: (res, title, body) => (staff.can(res.who, 'staff') ? staffPage(res, zubra.page(), title, body, { here: title === 'People' ? '/staff/people' : '' }) : page(res, zubra.page(), title, `<div class="auth">${body}</div>`)) });
  const send = (res, status, html) => (res.writeHead(status, { 'content-type': 'text/html; charset=utf-8' }), res.end(html));
  const back = (res, location) => (res.writeHead(303, { location: notices.sign(location) }), res.end());
  const page = (res, p, title, body, { guest = null, refresh = 0, status = 200, ...options } = {}) => {
    const bag = guest ? counter.cart(guest) : null;
    return send(res, status, p.finish(layout({ title, shop, body, count: bag ? bag.count : null, bag, refresh, ...options })));
  };
  const staffPage = (res, p, title, body, { status = 200, ...options } = {}) => send(res, status, p.finish(shell({ title, shop, body, who: res.who, owner: staff.can(res.who, 'owner'), waiting: counter.kitchen().length, ...options })));
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
  /** The "we've got your order" email, once, when an order is first paid. */
  async function tellPlaced(req, guest, done) {
    if (done.ok && !done.again) {
      const order = counter.orderByKey(done.key);
      if (order?.email && !mail.sent.some((one) => one.body.includes(`/orders/${done.key}`))) {
        await notify.notify({ email: order.email }, 'placed', { name: order.name, when: pickupWords(order.slot), what: order.lines.map((line) => `${line.qty} × ${line.name}`).join(', '), total: money(order.cents), link: `${origin(req)}/orders/${done.key}` });
      }
    }
  }
  const lineList = (lines) => `<ul>${lines.map((line) => `<li>${line.qty} × ${escape(line.name)}</li>`).join('')}</ul>`;

  function menuPage(p, url, guest, account) {
    const mine = counter.ordersFor(guest).filter((order) => order.status !== 'picked-up').map((order) => ({ ...order, when: pickupWords(order.slot) }));
    const open = counter.times().find((time) => !time.full);
    return landing(p, { shop, menu: counter.menu(), next: open ? { label: open.label, day: dayWord(open.slot, now()) } : null, mine, today: counter.note(), account, problem: notices.read(url).problem });
  }

  function orderPage(p, url, guest) {
    const view = counter.cart(guest);
    const times = counter.times();
    // A time that filled up since the guest chose it has to be chosen again.
    const chosen = times.find((time) => time.slot === counter.pickup(guest) && !time.full)?.slot ?? '';
    const day = times.length ? dayWord(times[0].slot, now()) : '';
    const head = `<section class="page-head"><a class="back" href="/#menu">Back to the menu</a><h1>Your order</h1></section>
${note(url)}`;
    if (!view.lines.length) return `${head}
<section class="panel empty-bag"><h2>Your bag is empty</h2><p>Add something from today’s menu and it’ll be here.</p><a class="go" href="/#menu">See today’s menu</a></section>`;
    return `${head}
<div class="bag-grid">
${p.render('cart-panel', { cart: view, change: '/cart/change', checkout: chosen ? '/checkout' : '', heading: 'In your bag' })}
<form class="panel" id="pickup" method="post" action="/order/time"><h2>Pickup time</h2>
  <p class="chosen">${chosen ? `Pickup ${escape(pickupWords(chosen))}. Check out when you’re ready.` : 'Choose a time, then check out.'}</p>
  <fieldset class="times"><legend>${escape(day)}</legend><div class="grid">${times.map((time) => `<label class="time"><input type="radio" name="slot" value="${escape(time.slot)}" required${time.slot === chosen ? ' checked' : ''}${time.full ? ' disabled' : ''}><span>${escape(time.label)}${time.full ? '<small>Full</small>' : ''}</span></label>`).join('')}</div></fieldset>
  <p class="hint">Each time takes ${shop.perSlot} orders. ${escape(shop.pickup)}</p>
  <button type="submit" name="next" value="checkout" class="go lg">${chosen ? 'Check out' : 'Set the time and check out'}</button>
</form>
</div>`;
  }

  function checkoutPage(p, url, guest, account) {
    const view = counter.cart(guest);
    const slot = counter.pickup(guest);
    return `<div class="checkout">
<section class="page-head"><a class="back" href="/order">Back to your order</a><h1>Check out</h1></section>
<div class="summary"><p>Pickup<strong>${escape(pickupWords(slot))}</strong></p><a href="/order#pickup">Change the time</a></div>
${p.render('checkout-form', { cart: view, place: '/checkout', checkout: counter.checkoutKey(), problem: notices.read(url).problem, ...payments.form, name: account?.name ?? '', email: account?.email ?? '' })}
<p class="safe">${escape(shop.pickup)}${account ? '' : ' No account needed; <a href="/account/sign-in">sign in</a> if you have one.'}</p>
</div>`;
  }

  function orderStatus(p, order) {
    const over = order.status === 'picked-up';
    return `<div class="status">
<section class="page-head"><p class="kicker">Order ${escape(order.key.slice(-6).toUpperCase())}${payments.sandbox ? ' · test mode' : ''}</p><h1>Pickup ${escape(pickupWords(order.slot))}</h1><p class="lede">For ${escape(order.name)} · ${money(order.cents)}. ${escape(shop.pickup)}</p></section>
${p.render('order-progress', { order: order.key, statusNow: order.status })}
<section class="receipt" aria-label="In the bag"><h2>In the bag</h2>
  <ul>${order.lines.map((line) => `<li><span>${line.qty} × ${escape(line.name)}</span><span>${money(line.total ?? line.cents * line.qty)}</span></li>`).join('')}</ul>
  <p class="sum"><span>Paid</span><span>${money(order.cents)}</span></p>
  <p class="fine">${payments.sandbox ? 'Test mode: no money moved.' : `Paid on ${escape(payments.name === 'test' ? 'the test page' : PAY_NAMES[payments.name])}.`}${order.email ? ` A confirmation went to ${escape(order.email)}.` : ''}</p>
</section>
<p class="after"><a class="button light" href="/#menu">${over ? 'Order again' : 'Order something else'}</a>${order.customer ? '<a class="button light" href="/account">Your orders</a>' : '<a class="button light" href="/account/sign-up">Keep your orders in an account</a>'}</p>
</div>`;
  }

  function kitchenPage(p, url) {
    const orders = counter.kitchen();
    const label = { making: 'Start making', ready: 'Ready', 'picked-up': 'Picked up' };
    const lanes = [['placed', 'To make'], ['making', 'Making'], ['ready', 'Ready at the window']];
    // How long until pickup, in the kitchen's words. A ticket that should be made by now stands out.
    const due = (order) => {
      const mins = minutesUntil(order.slot, now());
      if (order.status === 'ready') return mins < 0 ? ['warn', `${-mins} min waiting`] : ['handled', mins > 60 ? timeLabel(order.slot) : `in ${mins} min`];
      if (mins < 0) return ['off', `${-mins} min late`];
      if (mins <= shop.leadMinutes) return ['warn', mins === 0 ? 'now' : `in ${mins} min`];
      return ['', mins >= 1440 ? 'tomorrow' : mins > 90 ? `in ${Math.round(mins / 60)} h` : `in ${mins} min`];
    };
    let n = 0;
    const ticket = (order) => {
      const next = counter.steps[counter.steps.indexOf(order.status) + 1];
      const [kind, words] = due(order);
      const key = ++n <= 9 ? n : 0;
      return `<li class="ticket${kind === 'off' ? ' late' : ''}"><div class="top"><span class="at">${escape(timeLabel(order.slot))}</span><span class="badge ${kind}">${escape(words)}</span></div><p class="who">${escape(order.name)}</p><ul class="lines">${order.lines.map((line) => `<li>${line.qty} × ${escape(line.name)}</li>`).join('')}</ul><form method="post" action="/kitchen/advance"><input type="hidden" name="key" value="${order.key}"><input type="hidden" name="to" value="${next}"><button type="submit"${key ? ` data-key="${key}"` : ''}>${label[next]}${key ? `<kbd aria-hidden="true">${key}</kbd>` : ''}</button></form></li>`;
    };
    return `${p.render('kitchen-watch', { board: 'kitchen', revNow: counter.board() })}<section class="page-head board-head" data-live="head"><div><h1>The kitchen</h1><p class="lede">${orders.length ? `${orders.length} order${orders.length === 1 ? '' : 's'} to hand over.` : 'Nothing waiting.'} New orders show as they come in; the guest’s phone follows each step at once.</p></div><a class="button light" href="/kitchen/menu">Stock and today’s note</a></section>
${note(url)}
<div class="lanes" data-live="lanes">${lanes
      .map(([status, title]) => {
        const list = orders.filter((order) => order.status === status);
        return `<section class="lane ${status}" aria-label="${title}"><h2>${title} <b>${list.length}</b></h2>${list.length ? `<ul class="orders">${list.map(ticket).join('')}</ul>` : `<p class="none">${status === 'placed' ? 'All caught up.' : status === 'making' ? 'Nothing on the bench.' : 'Nothing waiting at the window.'}</p>`}</section>`;
      })
      .join('')}</div>`;
  }

  function kitchenMenu(url) {
    const items = counter.menu().flatMap(({ items }) => items);
    return `<section class="page-head"><a class="back" href="/kitchen">The kitchen</a><h1>Stock and today’s note</h1><p class="lede">Set how many are left. Every open menu, and the board on the shop’s page, shows it at once.</p></section>
${note(url)}
<div class="stock-grid">${items
      .filter((item) => item.left !== null)
      .map((item) => `<div class="stock-item${item.left === 0 ? ' gone' : ''}"><h2>${escape(item.name)} ${item.left === 0 ? '<span class="badge off">Sold out</span>' : item.left <= 5 ? `<span class="badge warn">${item.left} left</span>` : ''}</h2><div class="row"><form class="stock" method="post" action="/kitchen/stock"><input type="hidden" name="item" value="${item.key}"><label>Left<input name="left" type="number" inputmode="numeric" min="0" max="500" value="${item.left}"></label><button type="submit">Set</button></form>${item.left === 0 ? '' : `<form method="post" action="/kitchen/stock"><input type="hidden" name="item" value="${item.key}"><input type="hidden" name="left" value="0"><button class="button light" type="submit" aria-label="Mark ${escape(item.name)} sold out">Sold out</button></form>`}</div></div>`)
      .join('')}</div>
<form class="panel" method="post" action="/kitchen/note"><h2>Today’s note</h2><label>The special, what’s fresh<span class="hint">Shown at the top of the shop’s page. Up to 200 characters.</span><textarea name="text" rows="2" maxlength="200">${escape(counter.note().text)}</textarea></label><button type="submit">Post it</button></form>`;
  }

  const server = createServer(async (req, res) => {
    try {
      if (await counter.sync.handle(req, res)) return;
      if (zubra.handle(req, res)) return;
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/health') return res.writeHead(200, { 'content-type': 'text/plain' }).end('ok');
      if (serveAsset(req, res, url)) return;
      // A made-up shop asks not to be listed; a real one (shop.listed) lists its public pages only.
      if (url.pathname === '/robots.txt') return res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }).end(shop.listed ? `User-agent: *\nDisallow: /admin\nDisallow: /kitchen\nDisallow: /staff\nDisallow: /account\nDisallow: /order\nDisallow: /checkout\n${publicUrl ? `Sitemap: ${publicUrl}/sitemap.xml\n` : ''}` : 'User-agent: *\nDisallow: /\n');
      if (url.pathname === '/sitemap.xml' && shop.listed && publicUrl) return res.writeHead(200, { 'content-type': 'application/xml; charset=utf-8' }).end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escape(publicUrl)}/</loc></url></urlset>`);
      if (url.pathname === '/favicon.ico') return res.writeHead(302, { location: '/assets/favicon.svg' }).end();
      const account = customers.session(req);
      const guest = { ...guests.ensure(req, res), customer: account?.customer };
      const who = staff.session(req);
      const onShift = staff.can(who, 'staff');
      const owner = staff.can(who, 'owner');
      res.who = who;
      const nav = { customer: account, staff: onShift };
      const signInPage = () => show(zubra.page(), 'Sign in', `<div class="auth">${demo ? staffSignIn(escape) : ''}${pages.signIn(url)}</div>`);
      const show = (p, title, body, options = {}) => page(res, p, title, body, { nav, ...options });
      if (url.pathname.startsWith('/account') || url.pathname.startsWith('/admin')) res.setHeader('cache-control', 'no-store');
      const said = () => note(url);

      // Paying on the platform's page: the test page, the way back, backing out, and the webhook.
      if (await payments.testRoute(req, res, url, readForm)) return;
      if (url.pathname === '/pay/back' && req.method === 'GET') {
        const done = await counter.finish(url.searchParams.get('checkout') ?? '');
        await tellPlaced(req, guest, done);
        return back(res, done.ok ? `/orders/${done.key}` : withProblem('/checkout', done));
      }
      if (url.pathname === '/pay/cancel' && req.method === 'GET') {
        const done = await counter.cancel(guest.pub, url.searchParams.get('checkout') ?? '');
        return back(res, done.ok ? `/orders/${done.key}` : withProblem('/checkout', done));
      }
      if (url.pathname === '/pay/webhook' && req.method === 'POST') {
        const request = await payments.webhook(req, publicUrl || origin(req));
        if (!request) return send(res, 413, 'Too large');
        const heard = await counter.heard(request);
        if (heard.ok && !heard.again) await tellPlaced(req, null, heard);
        return send(res, heard.error === 'bad-signature' ? 401 : 200, heard.error === 'bad-signature' ? 'Bad signature' : 'ok');
      }

      if (req.method === 'POST') {
        // Every form is ours: another site's post is refused (the cookies are SameSite=Lax too).
        if (req.headers['sec-fetch-site'] === 'cross-site') return send(res, 403, 'Forbidden');
        const form = await readForm(req);
        if (!form) return send(res, 413, 'Too large');
        if (url.pathname === '/cart/add') {
          const done = await counter.add(guest, form);
          // Back to the item they added, so the page doesn't jump to the top; the message floats.
          return back(res, done.ok ? `/?done=${encodeURIComponent('Added to your order.')}#item-${encodeURIComponent(String(form.get('item') ?? ''))}` : withProblem('/', done));
        }
        if (url.pathname === '/cart/change') {
          const done = await counter.change(guest, form);
          return back(res, done.ok ? '/order' : withProblem('/order', done));
        }
        if (url.pathname === '/order/time') {
          const done = await counter.choose(guest, form);
          // The page's own button goes straight on to checkout; a bare post stays on the order.
          return back(res, done.ok ? (form.get('next') === 'checkout' ? '/checkout' : '/order') : withProblem('/order', done));
        }
        if (url.pathname === '/checkout') {
          const done = await counter.place(guest, form, { back: `${origin(req)}/pay/back`, cancel: `${origin(req)}/pay/cancel` });
          if (done.paying) return payments.send(res, done.pay, { cancel: `/pay/cancel?checkout=${done.key}`, fields: { checkout: done.key } });
          await tellPlaced(req, guest, done);
          return back(res, done.ok ? `/orders/${done.key}` : withProblem(done.back ?? '/checkout', done));
        }
        // Helcim's frame says it's paid: the kit checks with Helcim before believing it.
        if (url.pathname === '/pay/told') {
          const done = await counter.finish(String(form.get('checkout') ?? ''), { told: String(form.get('told') ?? '') });
          await tellPlaced(req, guest, done);
          return back(res, done.ok ? `/orders/${done.key}` : withProblem('/checkout', done));
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
            const changed = await customers.setDisabled(one.customer, off);
            if (changed?.error) return back(res, withProblem(`/admin/customers/${one.customer}`, changed));
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
      if (url.pathname === '/') return show(p, 'Menu', menuPage(p, url, guest, account), { guest, here: '/', landing: true, toast: notices.read(url).done, canonical: publicUrl ? `${publicUrl}/` : '' });

      // A customer's pages.
      if (url.pathname === '/account') return account ? show(p, 'Your account', accountPages.account({ counter, guest, customer: account, said: said() }), { guest, here: '/account' }) : back(res, '/account/sign-in');
      if (url.pathname === '/account/sign-in') return account ? back(res, '/account') : show(p, 'Sign in', (demo ? `<div class="auth">${guestSignIn(escape)}</div>` : '') + accountPages.signIn({ problem: said() }), { here: '/account/sign-in' });
      if (url.pathname === '/account/sign-up') return account ? back(res, '/account') : show(p, 'Make an account', accountPages.signUp());
      if (url.pathname === '/account/forgot') return show(p, 'Reset your password', accountPages.forgot());
      if (url.pathname === '/account/reset') {
        const raw = url.searchParams.get('token') ?? '';
        return show(p, 'Choose a new password', accountPages.reset({ token: raw, works: customers.peek(raw) }));
      }

      // The admin: staff only; reports, settings and the outbox for owners.
      if (url.pathname === '/admin' || url.pathname.startsWith('/admin/')) {
        if (!onShift) return signInPage();
        const at = (here) => ({ here });
        if (url.pathname === '/admin') return staffPage(res, p, 'Overview', admin.dashboard({ who, owner }), at('/admin'));
        if (url.pathname === '/admin/orders') return staffPage(res, p, 'Orders', admin.orders({ url, owner }), at('/admin/orders'));
        if (url.pathname === '/admin/orders.csv') return downloadCsv(res, 'orders.csv', admin.ordersCsv(url));
        const oneOrder = url.pathname.match(/^\/admin\/orders\/(c[a-z0-9]+)$/);
        const order = oneOrder && counter.staffOrder(oneOrder[1]);
        if (order) return staffPage(res, p, `Order ${order.key}`, admin.order({ order, owner, said: said() }), at('/admin/orders'));
        if (url.pathname === '/admin/customers') return staffPage(res, p, 'Customers', admin.customers({ url, owner }), at('/admin/customers'));
        if (url.pathname === '/admin/customers.csv') return downloadCsv(res, 'customers.csv', admin.customersCsv());
        const oneCustomer = url.pathname.match(/^\/admin\/customers\/(c[a-z0-9]+)$/);
        const one = oneCustomer && customers.get(oneCustomer[1]);
        if (one) return staffPage(res, p, one.name, admin.customer({ one, owner, said: said() }), at('/admin/customers'));
        if (['/admin/reports', '/admin/reports.csv', '/admin/settings', '/admin/outbox'].includes(url.pathname) && !owner) return staffPage(res, p, 'Owners only', '<section class="page-head"><h1>Owners only</h1><p class="lede">Reports, settings and the outbox are for owners. Ask one to show you this page.</p></section><p><a class="button light" href="/admin">Back to the overview</a></p>', { status: 403 });
        if (url.pathname === '/admin/reports') return staffPage(res, p, 'Reports', admin.reports({ url, owner }), at('/admin/reports'));
        if (url.pathname === '/admin/reports.csv') return downloadCsv(res, 'takings.csv', admin.reportCsv(url));
        if (url.pathname === '/admin/settings') return staffPage(res, p, 'Settings', admin.settings({ owner, said: said() }), at('/admin/settings'));
        if (url.pathname === '/admin/outbox') return staffPage(res, p, 'Outbox', admin.outbox({ owner }), at('/admin/outbox'));
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
        if (!onShift) return signInPage();
        if (url.pathname === '/kitchen') return staffPage(res, p, 'The kitchen', kitchenPage(p, url), { refresh: 20, here: '/kitchen' });
        return staffPage(res, p, 'Stock and note', kitchenMenu(url), { here: '/kitchen/menu' });
      }
      send(res, 404, 'Not found');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) send(res, 500, 'Something went wrong.');
      else res.end();
    }
  });
  // Checkouts left on the platform's page give their stock and pickup place back.
  const sweeping = setInterval(() => counter.sweep().catch((error) => console.error(error)), 5 * 60_000);
  sweeping.unref();
  const stop = server.close.bind(server);
  server.close = (cb) => stop((error) => {
    clearInterval(sweeping);
    try { counter.close(); } finally { cb?.(error); }
  });
  return Object.assign(server, { counter, staff, customers, demo, payments, sent: mail.sent });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  // 6.0 runs in production unless this is set. `--dev` works in cmd, where a NODE_ENV= prefix does not.
  if (process.argv.includes('--dev')) process.env.NODE_ENV = 'development';
  const port = Number(process.env.PORT ?? 3000);
  const server = await createApp();
  if (server.demo) nightly();
  if (server.staff.needsOwner()) console.log(`Set up the first owner (works once, for a day): http://localhost:${port}/staff/accept?token=${await server.staff.setup()}`);
  server.listen(port, '0.0.0.0', () => console.log(`Counter on http://localhost:${port}${server.demo ? ' (the public demo: sign-ins on the sign-in pages, data reset every night)' : ''}`));
}
