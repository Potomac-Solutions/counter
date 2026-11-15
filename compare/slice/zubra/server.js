// The slice in Zubra: a plain Node server, pages rendered by @zubra/server, the menu kept live by
// @zubra/sync. Counter's own shape, cut down to the menu, the bag and the pickup time.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createZubra } from '@zubra/server';
import { createSlice, money, pickupWords } from '../shared/slice.js';

const here = import.meta.dirname;
const css = readFileSync(join(here, '..', 'shared', 'slice.css'));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function createApp(options = {}) {
  const slice = await createSlice(options);
  const zubra = createZubra({ components: join(here, 'components') });
  const { shop } = slice;

  const notice = ({ done, problem }) => (problem ? `<p class="notice problem" role="alert">${escape(problem)}</p>` : done ? `<p class="notice" role="status">${escape(done)}</p>` : '');
  const layout = (p, title, count, body) =>
    p.finish(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · ${escape(shop.name)}</title>
  <link rel="stylesheet" href="/slice.css">
</head>
<body>
  <header class="site-head"><a href="/">${escape(shop.name)}</a><nav aria-label="Site"><a href="/">Menu</a><a href="/order">Your order${count ? ` (${count})` : ''}</a></nav></header>
  <main>${body}</main>
  <script type="module">import { connect } from '@zubra/sync/connect'; connect();</script>
</body>
</html>`);

  const menuPage = (p, said) => `${notice(said)}
<h1>Order ahead</h1>
${slice
  .menu()
  .map(({ section, items }) => `<section><h2>${escape(section)}</h2><ul class="items">${items.map((item) => `<li class="item">${p.render('slice-item', { item: item.key, name: item.name, unit: item.unit, cents: item.cents, leftNow: item.left, add: '/add' })}</li>`).join('')}</ul></section>`)
  .join('')}`;

  const bagPage = (guest, said) => {
    const cart = slice.cart(guest);
    const times = slice.times();
    const chosen = slice.pickup(guest);
    const qty = (line, to, words) => `<form method="post" action="/change"><input type="hidden" name="item" value="${escape(line.item)}"><button name="qty" value="${to}">${words}</button></form>`;
    const lines = cart.lines.length
      ? `<ul class="lines">${cart.lines.map((line) => `<li class="line"><div><h3>${escape(line.name)}</h3><p class="meta">${money(line.cents)} each · ${money(line.total)}</p></div><div class="qty">${qty(line, line.qty - 1, '−')}<span>${line.qty}</span>${qty(line, line.qty + 1, '+')}${qty(line, 0, 'Remove')}</div></li>`).join('')}</ul><p class="total">Total ${money(cart.cents)}</p>`
      : '<p>Your bag is empty.</p>';
    const options = times.map((time) => `<option value="${time.slot}"${time.full ? ' disabled' : ''}${time.slot === chosen ? ' selected' : ''}>${time.day} ${time.label}${time.full ? ' (full)' : ''}</option>`).join('');
    return `${notice(said)}
<h1>Your order</h1>
<section class="panel"><h2>In your bag</h2>${lines}</section>
<section class="panel"><h2>Pickup time</h2>
  <form method="post" action="/time"><label for="slot">When you’ll come by</label><select id="slot" name="slot"><option value="">Choose…</option>${options}</select><button>Set the time</button></form>
  ${chosen ? `<p>Pickup: ${escape(pickupWords(times, chosen))}</p>` : ''}
</section>`;
  };

  const readForm = (req) =>
    new Promise((resolve, reject) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        body += chunk;
        if (body.length > 10_000) req.destroy();
      });
      req.on('end', () => resolve(new URLSearchParams(body)));
      req.on('error', reject);
    });
  const back = (res, location, headers = {}) => res.writeHead(303, { location, ...headers }).end();
  const html = (res, body, headers = {}) => res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers }).end(body);

  const server = createServer(async (req, res) => {
    try {
      if (await slice.sync.handle(req, res)) return;
      if (zubra.handle(req, res)) return;
      const url = new URL(req.url, 'http://slice');
      if (url.pathname === '/slice.css') return res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'public, max-age=3600' }).end(css);
      const { guest, setCookie } = slice.guest(req.headers.cookie);
      const cookie = setCookie ? { 'set-cookie': setCookie } : {};
      if (req.method === 'POST') {
        const form = await readForm(req);
        if (url.pathname === '/add') {
          const done = await slice.add(guest, { item: form.get('item'), qty: form.get('qty') });
          return back(res, slice.back('/', done.ok ? { done: 'Added to your order.' } : { problem: done.error }), cookie);
        }
        if (url.pathname === '/change') {
          const done = await slice.change(guest, { item: form.get('item'), qty: form.get('qty') });
          return back(res, slice.back('/order', done.ok ? {} : { problem: done.error }), cookie);
        }
        if (url.pathname === '/time') {
          const done = await slice.choose(guest, form.get('slot'));
          return back(res, slice.back('/order', done.ok ? {} : { problem: done.error }), cookie);
        }
        return res.writeHead(404).end();
      }
      const said = slice.said(url);
      const count = slice.cart(guest).count;
      const p = zubra.page(); // one per request: it collects the components the page uses
      if (url.pathname === '/') return html(res, layout(p, 'Menu', count, menuPage(p, said)), cookie);
      if (url.pathname === '/order') return html(res, layout(p, 'Your order', count, bagPage(guest, said)), cookie);
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' }).end('Something went wrong.');
    }
  });
  server.slice = slice;
  return server;
}

if (import.meta.main) {
  const server = await createApp();
  server.listen(Number(process.env.PORT ?? 3101), () => console.log(`Zubra slice on http://localhost:${server.address().port}`));
}
