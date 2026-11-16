// The slice in Stencil: a plain Node server whose pages Stencil's hydrate script renders, the
// items hydrated in the browser by Stencil's loader, the menu kept live with server-sent events.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToString } from './hydrate/index.mjs';
import { createSlice, money, pickupWords } from 'counter-slice-backend';

const here = import.meta.dirname;
const css = readFileSync(join(here, 'node_modules', 'counter-slice-backend', 'slice.css'));
const built = join(here, 'www', 'build');
const client = readFileSync(join(here, 'client.js'));
const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function createApp(options = {}) {
  const slice = await createSlice(options);
  const { shop } = slice;

  const notice = ({ done, problem }) => (problem ? `<p class="notice problem" role="alert">${escape(problem)}</p>` : done ? `<p class="notice" role="status">${escape(done)}</p>` : '');
  const page = (title, count, main, script = false) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · ${escape(shop.name)}</title>
  <link rel="stylesheet" href="/slice.css">${script ? '\n  <script type="module" src="/build/slice.esm.js"></script>\n  <script type="module" src="/client.js"></script>' : ''}
</head>
<body>
<header class="site-head"><a href="/">${escape(shop.name)}</a><nav aria-label="Site"><a href="/">Menu</a><a href="/order">Your order${count ? ` (${count})` : ''}</a></nav></header>
<main>${main}</main>
</body>
</html>`;

  const menu = (said) => `${notice(said)}
<h1>Order ahead</h1>
${slice
  .menu()
  .map(({ section, items }) => `<section><h2>${escape(section)}</h2><ul class="items">${items.map((item) => `<li class="${item.left != null && item.left <= 0 ? 'item out' : 'item'}"><slice-item item="${escape(item.key)}" name="${escape(item.name)}" unit="${escape(item.unit)}" cents="${item.cents}" ${item.left == null ? '' : `left="${item.left}" `}add="/add"></slice-item></li>`).join('')}</ul></section>`)
  .join('')}`;

  const qty = (line, to, words) => `<form method="post" action="/change"><input type="hidden" name="item" value="${escape(line.item)}"><button name="qty" value="${to}">${words}</button></form>`;
  const bag = (guest, said) => {
    const cart = slice.cart(guest);
    const times = slice.times();
    const chosen = slice.pickup(guest);
    const lines = cart.lines.length
      ? `<ul class="lines">${cart.lines.map((line) => `<li class="line"><div><h3>${escape(line.name)}</h3><p class="meta">${money(line.cents)} each · ${money(line.total)}</p></div><div class="qty">${qty(line, line.qty - 1, '−')}<span>${line.qty}</span>${qty(line, line.qty + 1, '+')}${qty(line, 0, 'Remove')}</div></li>`).join('')}</ul><p class="total">Total ${money(cart.cents)}</p>`
      : '<p>Your bag is empty.</p>';
    const options = times.map((one) => `<option value="${one.slot}"${one.full ? ' disabled' : ''}${one.slot === chosen ? ' selected' : ''}>${one.day} ${one.label}${one.full ? ' (full)' : ''}</option>`).join('');
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
  const send = async (res, page, headers = {}) => {
    const { html, diagnostics } = await renderToString(page, { fullDocument: true, removeScripts: false, prettyHtml: false });
    if (diagnostics.some((one) => one.level === 'error')) throw new Error(diagnostics.map((one) => one.messageText).join('; '));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers }).end(html);
  };
  const rows = (menu) => JSON.stringify(menu.flatMap(({ items }) => items.map((item) => [item.key, item.left])));

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://slice');
      if (url.pathname === '/slice.css') return res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'public, max-age=3600' }).end(css);
      if (url.pathname.startsWith('/build/') && /^\/build\/[\w.-]+\.js$/.test(url.pathname)) {
        try {
          return res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }).end(readFileSync(join(built, url.pathname.slice(7))));
        } catch {
          return res.writeHead(404).end();
        }
      }
      if (url.pathname === '/client.js') return res.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'public, max-age=3600' }).end(client);
      if (url.pathname === '/live') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store' });
        res.write(`data: ${rows(slice.menu())}\n\n`);
        const unsubscribe = slice.subscribe((menu) => res.write(`data: ${rows(menu)}\n\n`));
        const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
        return req.on('close', () => {
          unsubscribe();
          clearInterval(ping);
        });
      }
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
      if (url.pathname === '/') return send(res, page('Menu', count, menu(said), true), cookie);
      if (url.pathname === '/order') return send(res, page('Your order', count, bag(guest, said)), cookie);
      res.writeHead(404, { 'content-type': 'text/plain' }).end('Not found');
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' }).end('Something went wrong.');
    }
  });
  return server;
}

if (import.meta.main) {
  const server = await createApp();
  server.listen(Number(process.env.PORT ?? 3107), () => console.log(`Stencil slice on http://localhost:${server.address().port}`));
}
