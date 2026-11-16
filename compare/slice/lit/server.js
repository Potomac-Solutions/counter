// The slice in Lit: a plain Node server rendering Lit templates with @lit-labs/ssr, the items
// hydrated in the browser, the menu kept live with server-sent events.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { html, nothing } from 'lit';
import { render } from '@lit-labs/ssr';
import { RenderResultReadable } from '@lit-labs/ssr/lib/render-result-readable.js';
import { createSlice, money, pickupWords } from 'counter-slice-backend';
import './slice-item.js';

const here = import.meta.dirname;
const css = readFileSync(join(here, 'node_modules', 'counter-slice-backend', 'slice.css'));
const client = readFileSync(join(here, 'dist', 'client.js'));

export async function createApp(options = {}) {
  const slice = await createSlice(options);
  const { shop } = slice;

  const notice = ({ done, problem }) => (problem ? html`<p class="notice problem" role="alert">${problem}</p>` : done ? html`<p class="notice" role="status">${done}</p>` : nothing);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Lit renders the body; the head is plain text, since Lit's renderer can't bind inside <title>.
  const head = (title, script) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escape(title)} · ${escape(shop.name)}</title>
  <link rel="stylesheet" href="/slice.css">${script ? '\n  <script type="module" src="/client.js"></script>' : ''}
</head>
<body>`;
  const body = (count, main) => html`<header class="site-head"><a href="/">${shop.name}</a><nav aria-label="Site"><a href="/">Menu</a><a href="/order">Your order${count ? ` (${count})` : ''}</a></nav></header>
  <main>${main}</main>`;

  const menu = (said) => html`${notice(said)}
<h1>Order ahead</h1>
${slice.menu().map(({ section, items }) => html`<section><h2>${section}</h2><ul class="items">${items.map((item) => html`<li class=${item.left != null && item.left <= 0 ? 'item out' : 'item'}><slice-item item=${item.key} name=${item.name} unit=${item.unit} cents=${item.cents} .left=${item.left} add="/add"></slice-item></li>`)}</ul></section>`)}`;

  const qty = (line, to, words) => html`<form method="post" action="/change"><input type="hidden" name="item" value=${line.item}><button name="qty" value=${to}>${words}</button></form>`;
  const bag = (guest, said) => {
    const cart = slice.cart(guest);
    const times = slice.times();
    const chosen = slice.pickup(guest);
    return html`${notice(said)}
<h1>Your order</h1>
<section class="panel"><h2>In your bag</h2>${cart.lines.length
      ? html`<ul class="lines">${cart.lines.map((line) => html`<li class="line"><div><h3>${line.name}</h3><p class="meta">${money(line.cents)} each · ${money(line.total)}</p></div><div class="qty">${qty(line, line.qty - 1, '−')}<span>${line.qty}</span>${qty(line, line.qty + 1, '+')}${qty(line, 0, 'Remove')}</div></li>`)}</ul><p class="total">Total ${money(cart.cents)}</p>`
      : html`<p>Your bag is empty.</p>`}</section>
<section class="panel"><h2>Pickup time</h2>
  <form method="post" action="/time"><label for="slot">When you’ll come by</label><select id="slot" name="slot"><option value="">Choose…</option>${times.map((one) => html`<option value=${one.slot} ?disabled=${one.full} ?selected=${one.slot === chosen}>${one.day} ${one.label}${one.full ? ' (full)' : ''}</option>`)}</select><button>Set the time</button></form>
  ${chosen ? html`<p>Pickup: ${pickupWords(times, chosen)}</p>` : nothing}
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
  const send = (res, title, script, result, headers = {}) => {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', ...headers });
    res.write(head(title, script));
    const stream = new RenderResultReadable(render(result));
    stream.on('end', () => res.end('\n</body>\n</html>'));
    stream.pipe(res, { end: false });
  };
  const rows = (menu) => JSON.stringify(menu.flatMap(({ items }) => items.map((item) => [item.key, item.left])));

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://slice');
      if (url.pathname === '/slice.css') return res.writeHead(200, { 'content-type': 'text/css', 'cache-control': 'public, max-age=3600' }).end(css);
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
      if (url.pathname === '/') return send(res, 'Menu', true, body(count, menu(said)), cookie);
      if (url.pathname === '/order') return send(res, 'Your order', false, body(count, bag(guest, said)), cookie);
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
  server.listen(Number(process.env.PORT ?? 3105), () => console.log(`Lit slice on http://localhost:${server.address().port}`));
}
