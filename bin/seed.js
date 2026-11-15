// Demo data: an owner and a counter hand, forty customers, four months of orders behind today
// and a morning's orders ahead, so every admin page and report has something to show.
//
//   npm run seed            add to an empty shop (refuses if it has orders)
//   npm run seed -- --fresh start over: delete the database first
//
// Past orders are written as finished records. Today's go through the real order (bag, pickup
// time, payment), so the stock goes down, the pickup times fill and the kitchen sees them.
// The names are made up and every address is @example.com. Run it with the server stopped.
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from '../server.js';
import { menu } from '../src/shop.js';

const here = dirname(fileURLToPath(import.meta.url));
const db = join(process.env.DATA_DIR ?? join(here, '..'), 'counter.db');
if (process.argv.includes('--fresh')) for (const file of [db, `${db}-wal`, `${db}-shm`]) if (existsSync(file)) rmSync(file);

export const DEMO = {
  owner: { email: 'owner@example.com', name: 'Nell Fairbanks', password: 'hickory-owner-demo' },
  staff: { email: 'counter@example.com', name: 'Theo Marsh', password: 'hickory-staff-demo' },
  customer: { email: 'riley@example.com', name: 'Riley Morgan', password: 'hickory-guest-demo' },
};

let seed = 20261115;
const random = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (list) => list[Math.floor(random() * list.length)];
const weighted = (pairs) => {
  let roll = random() * pairs.reduce((sum, [, w]) => sum + w, 0);
  for (const [value, w] of pairs) if ((roll -= w) < 0) return value;
  return pairs.at(-1)[0];
};
const FIRST = ['Avery', 'Blake', 'Casey', 'Drew', 'Emerson', 'Finley', 'Harper', 'Jamie', 'Kendall', 'Logan', 'Morgan', 'Noah', 'Parker', 'Quinn', 'Reese', 'Sawyer', 'Taylor', 'Peyton', 'Rowan', 'Skyler', 'Elliot', 'Hayden', 'Jordan', 'Kai', 'Lane', 'Micah', 'Sasha', 'Tatum', 'Wren', 'Ari'];
const LAST = ['Abbott', 'Barnes', 'Calloway', 'Dunmore', 'Ellison', 'Fairbanks', 'Garrett', 'Holloway', 'Iverson', 'Jessup', 'Kessler', 'Lowry', 'Marsh', 'Nolan', 'Oakley', 'Pruitt', 'Ramsey', 'Sutton', 'Thayer', 'Underwood', 'Vance', 'Whitaker', 'Yates', 'Zeller'];
const person = () => {
  const name = `${pick(FIRST)} ${pick(LAST)}`;
  return { name, email: `${name.toLowerCase().replace(' ', '.')}${Math.floor(random() * 90 + 10)}@example.com`, phone: `301-555-0${String(Math.floor(random() * 200)).padStart(3, '0')}` };
};
const DAY = 86_400_000;
const NOW = Date.now();
const localDate = (ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const addDays = (date, n) => new Date(Date.parse(`${date}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);
const at = (date, hhmm) => Date.parse(`${date}T${hhmm}:00-05:00`);
const hhmm = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

const server = await createApp({ db, cache: false });
const { counter, staff, customers } = server;
const { store } = counter;
if (store.under('orders').length) {
  console.log(`The shop in ${db} already has orders. Run \`npm run seed -- --fresh\` to start over.`);
  process.exit(1);
}

// The staff and the customers.
await staff.accept(await staff.setup(), DEMO.owner);
const ownerView = staff.list().find((one) => one.email === DEMO.owner.email);
await staff.accept((await staff.invite(ownerView, { email: DEMO.staff.email, name: DEMO.staff.name, roles: ['staff'] })).token, DEMO.staff);
const counterHand = staff.list().find((one) => one.email === DEMO.staff.email);
const accounts = [];
const riley = await customers.signUp(DEMO.customer);
accounts.push({ id: riley.customer, ...DEMO.customer, phone: '301-555-0142', at: NOW - 130 * DAY });
for (let i = 0; i < 40; i++) {
  const one = person();
  const made = await customers.signUp({ ...one, password: `demo-password-${i}-${Math.floor(random() * 1e6)}` });
  if (made.ok) accounts.push({ id: made.customer, ...one, at: NOW - Math.floor(random() * 130 + 1) * DAY });
}
for (const one of accounts) await store.write('customers', one.id, { at: one.at });
await customers.setDisabled(accounts.at(-1).id, true);
const whoBy = (when) => {
  const joined = accounts.slice(0, -1).filter((one) => one.at < when);
  return joined.length && random() < 0.5 ? { ...(random() < 0.04 ? accounts[0] : pick(joined)), account: true } : person();
};

// What people order: mostly a coffee and a pastry; a loaf on weekends.
const items = Object.fromEntries(menu.map((item) => [item.key, item]));
function basket(weekend) {
  const lines = new Map();
  const add = (key, qty = 1) => lines.set(key, (lines.get(key) ?? 0) + qty);
  if (random() < 0.7) add(weighted([['drip', 55], ['latte', 45]]), weighted([[1, 70], [2, 30]]));
  if (random() < 0.75) add(weighted([['cinnamon', 35], ['croissant', 40], ['apple-hand-pie', 25]]), weighted([[1, 50], [2, 30], [4, 12], [6, 8]]));
  if (random() < (weekend ? 0.55 : 0.3)) add(weighted([['sourdough', 50], ['rye', 25], ['baguette', 25]]), weighted([[1, 80], [2, 20]]));
  if (!lines.size) add('croissant');
  return [...lines].map(([key, qty]) => ({ item: key, qty, name: items[key].name, unit: items[key].unit, cents: items[key].cents, total: items[key].cents * qty }));
}

// Four months of orders, Wednesday to Sunday, busier at weekends.
const today = localDate(NOW);
let past = 0;
for (let date = addDays(today, -120); date < today; date = addDays(date, 1)) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (weekday === 1 || weekday === 2) continue;
  const weekend = weekday === 0 || weekday === 6;
  const count = Math.round((weekend ? 30 : 16) * (0.7 + random() * 0.6));
  for (let n = 0; n < count; n++) {
    const slot = `${date} ${hhmm(7 * 60 + 15 * Math.floor(Math.pow(random(), weekend ? 1.2 : 0.8) * 28))}`;
    const placedAt = at(date, slot.slice(11)) - Math.floor(20 + random() * 600) * 60_000;
    const who = whoBy(placedAt);
    const lines = basket(weekend);
    const cents = lines.reduce((sum, line) => sum + line.total, 0);
    const key = `c${placedAt.toString(36)}${Math.floor(random() * 36 ** 6).toString(36).padStart(6, '0')}`;
    const ready = at(date, slot.slice(11)) - 5 * 60_000;
    await store.write('orders', key, {
      checkout: key, owner: `seed-${key}`, group: '', lines, cents, fee: 0,
      name: who.name, email: who.email, phone: who.phone ?? '', slot, placedAt, customer: who.account ? who.id : '',
      status: 'picked-up', placed: placedAt, making: ready - 15 * 60_000, ready, 'picked-up': ready + Math.floor(random() * 25) * 60_000,
    });
    past++;
  }
}

// This morning, through the real order.
const times = counter.times().filter((time) => !time.full);
let ahead = 0;
const keys = [];
for (let i = 0; i < 18 && times.length; i++) {
  const who = whoBy(NOW);
  const guest = { pub: `seed-guest-${i}`, customer: who.account ? who.id : undefined };
  for (const line of basket(true)) if (line.item !== 'apple-hand-pie' || i < 2) await counter.add(guest, new URLSearchParams({ item: line.item, qty: String(line.qty) }));
  if (!counter.cart(guest).lines.length) continue;
  const time = times[Math.floor(Math.pow(random(), 1.5) * Math.min(times.length, 16))];
  await counter.choose(guest, new URLSearchParams({ slot: time.slot }));
  const done = await counter.place(guest, new URLSearchParams({ checkout: counter.checkoutKey(), name: who.name, email: who.email, phone: who.phone ?? '', card: '4242 4242 4242 4242' }));
  if (!done.ok) continue;
  await store.write('orders', done.key, { placedAt: NOW - Math.floor(random() * 10 * 60) * 60_000 });
  keys.push(done.key);
  ahead++;
}
const soonest = counter.kitchen().slice(0, 3);
for (const [i, order] of soonest.entries()) {
  await counter.advance(order.key, 'making');
  await counter.audit(counterHand, `moved ${order.name}’s order to making`, order.key);
  if (i === 0) await counter.advance(order.key, 'ready');
}
await counter.stock(new URLSearchParams({ item: 'rye', left: '0' }));
await counter.audit(counterHand, 'marked Seeded rye sold out', 'rye');
await counter.setNote('Pumpkin scones at 9. The rye sold out early; more on Wednesday.');
await counter.audit(counterHand, 'posted today’s note');

console.log(`Seeded ${db}:
  ${accounts.length} customer accounts, ${past} past orders, ${ahead} for pickup today.

Sign in (this machine only; these are demo passwords):
  Owner     ${DEMO.owner.email} / ${DEMO.owner.password}    → /admin
  Staff     ${DEMO.staff.email} / ${DEMO.staff.password}  → /admin, /kitchen
  Customer  ${DEMO.customer.email} / ${DEMO.customer.password}    → /account

Then: npm start`);
process.exit(0);
