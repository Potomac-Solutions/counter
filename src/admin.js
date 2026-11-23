// The admin pages: the bakery at a glance, every order, customers, reports and settings.
//
// Staff see the overview, orders and customers. Owners also see reports, settings and the
// outbox, and can turn a customer's account off. Every page is plain HTML and forms; each
// function returns the page's body, and src/shell.js puts the sidebar around it.
import { series, totals, breakdown, csv } from '@potomac-solutions/kit/reports';
import { barChart, rankBars } from '@potomac-solutions/kit/charts';
import { escape } from './layout.js';
import { timeLabel } from './counter.js';
import { money } from './account.js';

const DAY = 86_400_000;
const PAGE = 25;
const STATUS = { placed: ['booked', 'Placed'], making: ['booked', 'Making'], ready: ['past', 'Ready'], 'picked-up': ['handled', 'Picked up'] };
const badge = (status) => `<span class="badge ${STATUS[status]?.[0] ?? ''}">${escape(STATUS[status]?.[1] ?? status)}</span>`;

export const RANGES = {
  '30d': { label: 'Last 30 days', days: 30, by: 'day' },
  '13w': { label: 'Last 13 weeks', days: 91, by: 'week' },
  '12m': { label: 'Last 12 months', days: 365, by: 'month' },
};

export function createAdmin({ counter, customers, sent, now = Date.now }) {
  const { shop } = counter;
  const zone = shop.timeZone;
  const dateTime = (ms) => (ms ? new Date(ms).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: zone }) : '');
  const localDate = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: zone });
  const day = (date) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const short = (start, by) => {
    const date = new Date(`${start}T12:00:00Z`);
    return by === 'month' ? date.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }) : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  };
  const pickup = (order) => `${day(order.slot.slice(0, 10))}, ${timeLabel(order.slot)}`;
  const what = (order) => order.lines.map((line) => `${line.qty} × ${escape(line.name)}`).join(', ');
  const option = (value, words, current) => `<option value="${escape(value)}"${current === value ? ' selected' : ''}>${escape(words)}</option>`;
  const pageOf = (url) => Math.max(1, Number.parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const pager = (url, base, count, page) => {
    const pages = Math.max(1, Math.ceil(count / PAGE));
    const at = (n) => {
      const next = new URLSearchParams(url.searchParams);
      next.set('page', String(n));
      return `${base}?${next}`;
    };
    return pages > 1 ? `<p class="pager">${page > 1 ? `<a href="${escape(at(page - 1))}">Newer</a>` : ''}<span>Page ${page} of ${pages}</span>${page < pages ? `<a href="${escape(at(page + 1))}">Older</a>` : ''}</p>` : '';
  };

  /** A column heading that sorts by `key`: a link, so it works without JavaScript and stays in the address. */
  const sorter = (url, base, key, words, { num = false, first = 'desc' } = {}) => {
    const now = url.searchParams.get('sort') ?? '';
    const dir = url.searchParams.get('dir') === 'asc' ? 'asc' : 'desc';
    const next = new URLSearchParams(url.searchParams);
    next.set('sort', key);
    next.set('dir', now === key ? (dir === 'asc' ? 'desc' : 'asc') : first);
    next.delete('page');
    return `<th scope="col"${num ? ' class="num"' : ''}${now === key ? ` aria-sort="${dir === 'asc' ? 'ascending' : 'descending'}"` : ''}><a href="${base}?${escape(String(next))}">${words}</a></th>`;
  };
  const sorted = (url, list, keys) => {
    const by = keys[url.searchParams.get('sort')];
    if (!by) return list;
    const sign = url.searchParams.get('dir') === 'asc' ? 1 : -1;
    return list.slice().sort((a, b) => (by(a) < by(b) ? -sign : by(a) > by(b) ? sign : 0));
  };
  // Each page used to wrap itself in the admin's navigation; the shell does that now.
  const frame = (_here, _owner, _bar, body) => body;
  const head = (title, lede, tools = '') => `<section class="page-head"><h1>${title}</h1><p class="lede">${lede}</p>${tools ? `<div class="tools">${tools}</div>` : ''}</section>`;
  const orderRows = (list, heads = '<th scope="col">Pickup</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Status</th><th scope="col" class="num">Paid</th>') =>
    list.length
      ? `<div class="table-wrap"><table class="cards"><thead><tr>${heads}</tr></thead><tbody>${list
          .map(
            (order) =>
              `<tr><td class="lead" data-label="Pickup"><a href="/admin/orders/${order.key}">${escape(pickup(order))}</a><small class="muted">${escape(order.key.slice(-6).toUpperCase())}</small></td><td data-label="Who">${escape(order.name)}${order.customer ? ` <a class="muted" href="/admin/customers/${escape(order.customer)}">(account)</a>` : ''}<small class="muted">${escape(order.phone || order.email || '')}</small></td><td data-label="What">${what(order)}</td><td data-label="Status">${badge(order.status)}</td><td class="num" data-label="Paid">${money(order.cents)}</td></tr>`,
          )
          .join('')}</tbody></table></div>`
      : '<p class="muted">No orders here.</p>';

  function filterOrders(url) {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
    const status = url.searchParams.get('status') ?? '';
    const when = url.searchParams.get('when') ?? 'all';
    const today = localDate(now());
    return counter
      .allOrders()
      .filter(
        (order) =>
          (!status || order.status === status) &&
          (when === 'all' || (when === 'today' ? order.slot.startsWith(today) : when === 'ahead' ? order.slot.slice(0, 10) > today : order.slot.slice(0, 10) < today)) &&
          (!q || [order.key, order.name, order.email, order.phone].some((field) => String(field ?? '').toLowerCase().includes(q))),
      );
  }
  /** Units and takings by menu item, from the orders' lines. */
  const byItem = (orders) => {
    const lines = orders.flatMap((order) => order.lines);
    const items = new Map();
    for (const line of lines) {
      const one = items.get(line.name) ?? { key: line.name, count: 0, amount: 0 };
      one.count += line.qty;
      one.amount += line.total ?? line.cents * line.qty;
      items.set(line.name, one);
    }
    return [...items.values()].sort((a, b) => b.amount - a.amount);
  };

  return {
    dashboard({ who, owner }) {
      const at = now();
      const all = counter.allOrders();
      const today = localDate(at);
      const last30 = all.filter((order) => order.placedAt > at - 30 * DAY);
      const before30 = all.filter((order) => order.placedAt <= at - 30 * DAY && order.placedAt > at - 60 * DAY);
      const revenue = totals(last30, { amount: (order) => order.cents }).amount;
      const earlier = totals(before30, { amount: (order) => order.cents }).amount;
      const soldOut = counter.menu().flatMap(({ items }) => items).filter((item) => item.left === 0);
      const people = customers.list();
      const open = counter.kitchen();
      const days = series(all, { at: (order) => order.placedAt, amount: (order) => order.cents, by: 'day', zone, from: at - 29 * DAY, to: at });
      const activity = counter.activity(8);
      const todays = all.filter((order) => order.slot.startsWith(today));
      const todayTakings = totals(todays, { amount: (order) => order.cents }).amount;
      const count = (status) => open.filter((order) => order.status === status).length;
      const change = earlier ? Math.round(((revenue - earlier) / earlier) * 100) : null;
      const low = counter.menu().flatMap(({ items }) => items).filter((item) => item.left !== null && item.left > 0 && item.left <= 5);
      return `${head('Overview', `${escape(day(today))}. Good to see you, ${escape(who.name.split(' ')[0])}.`)}
<section class="stack" aria-label="Right now"><div class="section-title"><h2>Right now</h2><a href="/kitchen">Open the kitchen</a></div>
<div class="tiles">
  <a class="tile now" href="/kitchen" style="text-decoration:none"><span>To make</span><strong>${count('placed')}</strong><small>${count('making')} being made</small></a>
  <div class="tile"><span>Ready at the window</span><strong>${count('ready')}</strong><small>waiting to be picked up</small></div>
  <div class="tile"><span>For pickup today</span><strong>${todays.length}</strong><small>${money(todayTakings)} taken · ${open.length} not picked up yet</small></div>
  <div class="tile${soldOut.length ? ' alert' : ''}"><span>Sold out now</span><strong>${soldOut.length}</strong><small>${soldOut.length ? escape(soldOut.map((item) => item.name).join(', ')) : 'Everything’s in'}${low.length ? ` · low: ${escape(low.map((item) => `${item.name} (${item.left})`).join(', '))}` : ''} · <a href="/kitchen/menu">Stock</a></small></div>
</div></section>
<section class="panel"><div class="section-title"><h2>Next to hand over</h2><a href="/admin/orders?when=today">Today’s orders</a></div>${orderRows(open.slice(0, 6))}</section>
<section class="stack" aria-label="The last 30 days"><div class="section-title"><h2>The last 30 days</h2>${owner ? '<a href="/admin/reports">All reports</a>' : ''}</div>
<div class="tiles">
  <div class="tile"><span>Takings, last 30 days</span><strong>${money(revenue)}</strong><small>${change === null ? 'No earlier month to compare' : `<span class="${change >= 0 ? 'up' : 'down'}" style="display:inline">${change >= 0 ? '▲' : '▼'} ${Math.abs(change)}%</span> on the 30 days before`}</small></div>
  <div class="tile"><span>Orders, last 30 days</span><strong>${last30.length}</strong><small>${money(last30.length ? Math.round(revenue / last30.length) : 0)} on average</small></div>
  <div class="tile"><span>Customer accounts</span><strong>${people.length}</strong><small>${people.filter((one) => one.at > at - 30 * DAY).length} new in 30 days</small></div>
</div></section>
<section class="panel"><h2>Takings by day</h2>${barChart(days.map((b) => ({ label: short(b.start, 'day'), value: b.amount, tip: `${day(b.start)}: ${money(b.amount)} from ${b.count} order${b.count === 1 ? '' : 's'}` })), { name: 'Takings', format: money })}</section>
<section class="panel"><h2>Staff activity</h2>${activity.length ? `<ul class="activity">${activity.map((one) => `<li><span><strong>${escape(one.by)}</strong> ${escape(one.what)}</span><small>${dateTime(one.at)}</small></li>`).join('')}</ul>` : '<p class="muted">Nothing yet. What staff do here is listed as they do it.</p>'}</section>`;
    },

    orders({ url, owner, bar }) {
      const list = filterOrders(url);
      const page = pageOf(url);
      const when = url.searchParams.get('when') ?? 'all';
      const status = url.searchParams.get('status') ?? '';
      const query = new URLSearchParams(url.searchParams);
      query.delete('page');
      const shown = sorted(url, list, { pickup: (order) => order.slot, status: (order) => counter.steps.indexOf(order.status), paid: (order) => order.cents });
      return frame(
        '/admin/orders',
        owner,
        bar,
        `${head('Orders', `${list.length} order${list.length === 1 ? '' : 's'}, ${money(totals(list, { amount: (order) => order.cents }).amount)}.`)}
<div class="segments" role="group" aria-label="Pickup day">${[['all', 'All'], ['today', 'Today'], ['ahead', 'After today'], ['past', 'Before today']].map(([value, words]) => { const next = new URLSearchParams(query); next.set('when', value); return `<a href="/admin/orders?${escape(String(next))}"${when === value ? ' aria-current="true"' : ''}>${words}</a>`; }).join('')}</div>
<form class="panel filters" method="get" action="/admin/orders">
  <label class="grow">Search<input name="q" type="search" value="${escape(url.searchParams.get('q') ?? '')}" placeholder="Name, email, phone or code"></label>
  <input type="hidden" name="when" value="${escape(when)}">
  <label>Status<select name="status">${option('', 'Any', status)}${Object.entries(STATUS).map(([value, [, words]]) => option(value, words, status)).join('')}</select></label>
  <button type="submit">Show</button>
  <a class="button light" href="/admin/orders.csv?${escape(String(query))}">Download CSV</a>
</form>
<section class="panel">${list.length ? orderRows(shown.slice((page - 1) * PAGE, page * PAGE), `${sorter(url, '/admin/orders', 'pickup', 'Pickup')}<th scope="col">Who</th><th scope="col">What</th>${sorter(url, '/admin/orders', 'status', 'Status', { first: 'asc' })}${sorter(url, '/admin/orders', 'paid', 'Paid', { num: true })}`) : `<p class="muted">No orders match. <a href="/admin/orders">Clear the search</a>.</p>`}${pager(url, '/admin/orders', list.length, page)}</section>`,
      );
    },

    ordersCsv(url) {
      return csv(filterOrders(url), [
        { key: 'key', label: 'Code' },
        { key: 'placedAt', label: 'Placed', value: (order) => new Date(order.placedAt).toISOString() },
        { key: 'slot', label: 'Pickup' },
        { key: 'status', label: 'Status' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'lines', label: 'Items', value: (order) => order.lines.map((line) => `${line.qty} x ${line.name}`).join('; ') },
        { key: 'cents', label: 'Paid (USD)', value: (order) => order.cents / 100 },
      ]);
    },

    order({ order, owner, bar, said }) {
      const next = counter.steps[counter.steps.indexOf(order.status) + 1];
      const words = { making: 'Start making', ready: 'Ready', 'picked-up': 'Picked up' };
      const account = order.customer ? customers.get(order.customer) : null;
      return frame(
        '/admin/orders',
        owner,
        bar,
        `<section class="page-head"><a class="back" href="/admin/orders">All orders</a><h1>${escape(order.name)}: ${escape(pickup(order))}</h1><p class="lede">Order ${escape(order.key.slice(-6).toUpperCase())} · ${badge(order.status)}</p></section>
${said}
<section class="two">
  <div class="panel"><h2>In the bag</h2><dl>${order.lines.map((line) => `<dt>${line.qty} × ${escape(line.name)}</dt><dd>${money(line.total ?? line.cents * line.qty)}</dd>`).join('')}<dt>Paid</dt><dd>${money(order.cents)} (test mode)</dd></dl>${next ? `<form method="post" action="/admin/orders/${order.key}/advance"><input type="hidden" name="to" value="${next}"><button type="submit" class="go lg">${words[next]}</button></form>` : '<p class="muted">Picked up. Nothing more to do.</p>'}</div>
  <div class="panel"><h2>Who</h2><dl><dt>Name</dt><dd>${escape(order.name)}</dd><dt>Email</dt><dd>${escape(order.email || '—')}</dd><dt>Phone</dt><dd>${escape(order.phone || '—')}</dd><dt>Account</dt><dd>${account ? `<a href="/admin/customers/${escape(account.customer)}">${escape(account.name)}</a>` : 'Ordered as a guest'}</dd><dt>Placed</dt><dd>${dateTime(order.placedAt)}</dd></dl></div>
</section>`,
      );
    },

    customers({ url, owner, bar }) {
      const q = (url.searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80);
      const stats = new Map();
      for (const order of counter.allOrders()) {
        if (!order.customer) continue;
        const one = stats.get(order.customer) ?? { count: 0, cents: 0, last: 0 };
        one.count += 1;
        one.cents += order.cents;
        one.last = Math.max(one.last, order.placedAt);
        stats.set(order.customer, one);
      }
      const list = customers.list().filter((one) => !q || one.name.toLowerCase().includes(q) || one.email.includes(q));
      const page = pageOf(url);
      return frame(
        '/admin/customers',
        owner,
        bar,
        `${head('Customers', `${customers.list().length} with accounts. Anyone can also order as a guest.`)}
<form class="panel filters" method="get" action="/admin/customers"><label class="grow">Search<input name="q" type="search" value="${escape(url.searchParams.get('q') ?? '')}" placeholder="Name or email"></label><button type="submit">Show</button><a class="button light" href="/admin/customers.csv">Download CSV</a></form>
<section class="panel">${list.length ? '' : '<p class="muted">Nobody matches. <a href="/admin/customers">Clear the search</a>.</p>'}<div class="table-wrap"${list.length ? '' : ' hidden'}><table class="cards"><thead><tr>${sorter(url, '/admin/customers', 'name', 'Customer', { first: 'asc' })}${sorter(url, '/admin/customers', 'joined', 'Joined')}${sorter(url, '/admin/customers', 'orders', 'Orders', { num: true })}${sorter(url, '/admin/customers', 'spent', 'Spent', { num: true })}${sorter(url, '/admin/customers', 'last', 'Last order')}</tr></thead><tbody>${sorted(url, list, { name: (one) => one.name.toLowerCase(), joined: (one) => one.at, orders: (one) => stats.get(one.customer)?.count ?? 0, spent: (one) => stats.get(one.customer)?.cents ?? 0, last: (one) => stats.get(one.customer)?.last ?? 0 })
          .slice((page - 1) * PAGE, page * PAGE)
          .map((one) => {
            const s = stats.get(one.customer) ?? { count: 0, cents: 0, last: 0 };
            return `<tr><td class="lead" data-label="Customer"><a href="/admin/customers/${escape(one.customer)}">${escape(one.name)}</a>${one.disabled ? ' <span class="badge off">Off</span>' : ''}<small class="muted">${escape(one.email)}</small></td><td data-label="Joined">${dateTime(one.at)}</td><td class="num" data-label="Orders">${s.count}</td><td class="num" data-label="Spent">${money(s.cents)}</td><td data-label="Last order">${s.last ? dateTime(s.last) : '—'}</td></tr>`;
          })
          .join('')}</tbody></table></div>${pager(url, '/admin/customers', list.length, page)}</section>`,
      );
    },

    customersCsv() {
      const all = counter.allOrders();
      return csv(customers.list(), [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'at', label: 'Joined', value: (one) => new Date(one.at).toISOString() },
        { key: 'disabled', label: 'Turned off', value: (one) => (one.disabled ? 'yes' : 'no') },
        { key: 'orders', label: 'Orders', value: (one) => all.filter((order) => order.customer === one.customer).length },
        { key: 'spent', label: 'Spent (USD)', value: (one) => all.filter((order) => order.customer === one.customer).reduce((sum, order) => sum + order.cents, 0) / 100 },
      ]);
    },

    customer({ one, owner, bar, said }) {
      const orders = counter.allOrders().filter((order) => order.customer === one.customer);
      const favourite = byItem(orders).sort((a, b) => b.count - a.count)[0];
      return frame(
        '/admin/customers',
        owner,
        bar,
        `<section class="page-head"><a class="back" href="/admin/customers">All customers</a><h1>${escape(one.name)}</h1><p class="lede">${escape(one.email)} · joined ${dateTime(one.at)}${one.disabled ? ' · <span class="badge off">Turned off</span>' : ''}</p></section>
${said}
<div class="tiles"><div class="tile"><span>Orders</span><strong>${orders.length}</strong></div><div class="tile"><span>Spent</span><strong>${money(totals(orders, { amount: (order) => order.cents }).amount)}</strong></div><div class="tile"><span>Usually gets</span><strong>${escape(favourite?.key ?? '—')}</strong></div></div>
<section class="panel"><h2>Orders</h2>${orderRows(orders)}</section>
${
  owner
    ? `<section class="panel"><h2>Account</h2><div class="filters">${one.disabled ? `<form method="post" action="/admin/customers/${escape(one.customer)}/disabled"><input type="hidden" name="disabled" value="no"><button type="submit">Turn back on</button></form>` : `<form method="post" action="/admin/customers/${escape(one.customer)}/reset"><button class="button light" type="submit">Email a reset link</button></form>`}</div>${one.disabled ? '<p class="muted">This account is off: it can’t sign in. Its orders are kept.</p>' : `<details class="confirm"><summary>Turn this account off…</summary><div class="sure"><p><strong>${escape(one.name)} will be signed out everywhere and won’t be able to sign in.</strong> Their orders stay, and an owner can turn the account back on.</p><form method="post" action="/admin/customers/${escape(one.customer)}/disabled"><input type="hidden" name="disabled" value="yes"><button type="submit">Yes, turn it off</button></form></div></details>`}</section>`
    : ''
}`,
      );
    },

    report(url) {
      const key = RANGES[url.searchParams.get('range')] ? url.searchParams.get('range') : '30d';
      const { days, by, label } = RANGES[key];
      const to = now();
      const from = to - (days - 1) * DAY;
      const orders = counter.allOrders().filter((order) => order.placedAt >= from && order.placedAt <= to);
      return { key, by, label, from, to, orders, buckets: series(orders, { at: (order) => order.placedAt, amount: (order) => order.cents, by, zone, from, to }) };
    },

    reports({ url, owner, bar }) {
      const r = this.report(url);
      const sum = totals(r.orders, { amount: (order) => order.cents });
      const items = byItem(r.orders);
      const sections = new Map(counter.menu().flatMap(({ section, items: list }) => list.map((item) => [item.name, section])));
      const bySection = breakdown(r.orders.flatMap((order) => order.lines), { key: (line) => sections.get(line.name) ?? 'Other', amount: (line) => line.total ?? line.cents * line.qty }).sort((a, b) => b.amount - a.amount);
      const hours = Array.from({ length: 7 }, (_, i) => i + 7).map((hour) => ({ label: timeLabel(`2000-01-01 ${String(hour).padStart(2, '0')}:00`), value: r.orders.filter((order) => Number(order.slot.slice(11, 13)) === hour).length }));
      const returning = breakdown(r.orders.filter((order) => order.customer), { key: (order) => order.customer }).filter((row) => row.count > 1).length;
      const accounts = new Set(r.orders.filter((order) => order.customer).map((order) => order.customer)).size;
      return frame(
        '/admin/reports',
        owner,
        bar,
        `${head('Reports', `${r.label}, by ${r.by}, in the shop’s time (${escape(zone)}). Counted on the day each order was paid for.`)}
<div class="segments" role="group" aria-label="Range">${Object.entries(RANGES).map(([key, one]) => `<a href="?range=${key}"${key === r.key ? ' aria-current="true"' : ''}>${one.label}</a>`).join('')}</div>
<div class="tiles">
  <div class="tile"><span>Takings</span><strong>${money(sum.amount)}</strong></div>
  <div class="tile"><span>Orders</span><strong>${sum.count}</strong></div>
  <div class="tile"><span>Average order</span><strong>${money(sum.count ? Math.round(sum.amount / sum.count) : 0)}</strong></div>
  <div class="tile"><span>Items sold</span><strong>${items.reduce((n, item) => n + item.count, 0)}</strong></div>
  <div class="tile"><span>Came back</span><strong>${accounts ? `${Math.round((returning / accounts) * 100)}%` : '—'}</strong><small>of account holders who ordered</small></div>
</div>
<section class="panel"><h2>Takings by ${r.by}</h2>${barChart(r.buckets.map((b) => ({ label: short(b.start, r.by), value: b.amount, tip: `${short(b.start, r.by)}: ${money(b.amount)} from ${b.count} orders` })), { name: 'Takings', format: money })}<p><a class="button light" href="/admin/reports.csv?range=${r.key}">Download CSV</a></p></section>
<section class="panel"><h2>Orders by ${r.by}</h2>${barChart(r.buckets.map((b) => ({ label: short(b.start, r.by), value: b.count })), { name: 'Orders' })}</section>
<section class="two">
  <div class="panel"><h2>Takings by item</h2>${items.length ? rankBars(items.map((row) => ({ label: row.key, value: row.amount })), { format: money }) : '<p>None.</p>'}</div>
  <div class="panel"><h2>By section</h2>${bySection.length ? rankBars(bySection.map((row) => ({ label: row.key, value: row.amount })), { format: money }) : '<p>None.</p>'}<h2>Busiest pickup hours</h2>${rankBars(hours)}</div>
</section>
<section class="panel"><h2>Items</h2><div class="table-wrap"><table><thead><tr><th scope="col">Item</th><th scope="col" class="num">Sold</th><th scope="col" class="num">Takings</th></tr></thead><tbody>${items.map((row) => `<tr><td>${escape(row.key)}</td><td class="num">${row.count}</td><td class="num">${money(row.amount)}</td></tr>`).join('')}</tbody></table></div></section>`,
      );
    },

    reportCsv(url) {
      const r = this.report(url);
      return csv(r.buckets, [
        { key: 'start', label: r.by === 'day' ? 'Day' : r.by === 'week' ? 'Week starting' : 'Month' },
        { key: 'count', label: 'Orders' },
        { key: 'amount', label: 'Takings (USD)', value: (b) => b.amount / 100 },
      ]);
    },

    settings({ owner, bar, said }) {
      const items = counter.menu().flatMap(({ section, items: list }) => list.map((item) => ({ ...item, section })));
      return frame(
        '/admin/settings',
        owner,
        bar,
        `${head('Settings', 'Names, prices and the words guests see. Each row and each group saves on its own.')}
${said}
<section class="panel"><h2>The menu</h2><p class="hint">A new price applies to orders from now on; paid orders keep theirs. How many are left is on <a href="/kitchen/menu">Stock and note</a>.</p><div class="item-rows">${items
          .map((item) => `<form method="post" action="/admin/settings/item"><input type="hidden" name="item" value="${escape(item.key)}"><span class="sec-name">${escape(item.section)}</span><label>Name<input name="name" maxlength="80" required value="${escape(item.name)}"></label><label>Price ($)<input name="price" inputmode="decimal" maxlength="8" required value="${(item.cents / 100).toFixed(2)}"></label><button class="button light" type="submit" aria-label="Save ${escape(item.name)}">Save</button></form>`)
          .join('')}</div></section>
<form class="panel" method="post" action="/admin/settings/shop"><h2>The shop</h2><p class="hint">Shown in the hero’s board, the Visit section and the footer of the shop’s page.</p>
<label>Hours<input name="hours" maxlength="120" required value="${escape(shop.hours)}"></label>
<label>Pickup<textarea name="pickup" rows="2" maxlength="240" required>${escape(shop.pickup)}</textarea></label>
<button type="submit">Save the shop</button></form>`,
      );
    },

    outbox({ owner, bar }) {
      const list = [...sent].reverse();
      return frame(
        '/admin/outbox',
        owner,
        bar,
        `${head('Outbox', 'This demo sends no real email. What it would have sent since the server started is here, newest first.')}
<section class="panel">${list.length ? list.map((message) => `<article class="message"><p><strong>${escape(message.subject)}</strong><br><small class="muted">To ${escape(message.to)}</small></p><pre>${escape(message.body)}</pre></article>`).join('') : '<p class="muted">Nothing sent yet. Order confirmations and password links will show here.</p>'}</section>`,
      );
    },
  };
}
