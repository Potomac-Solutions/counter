// The slice every implementation shares: Counter's own backend (src/counter.js, on the kit),
// a guest cookie, and a change feed that isn't Zubra's. Each framework calls this from its own
// server code; only how it routes, renders and updates pages differs.
//
//   const slice = await createSlice({ db })
//   slice.guest(cookieHeader)  → { guest, setCookie }   (setCookie only for a newcomer)
//   slice.menu() / slice.cart(guest) / slice.times() / slice.pickup(guest)
//   slice.add(guest, { item, qty }) / slice.change(guest, { item, qty }) / slice.choose(guest, slot)
//   slice.subscribe(fn) → unsubscribe; fn(menu) whenever what's left changes
import { randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { signedCookie } from '@potomac-solutions/kit/auth';
import { createNotices } from '@potomac-solutions/kit/notice';
import { createCounter, dayWord } from '../../../src/counter.js';

const form = (fields) => new Map(Object.entries(fields).map(([k, v]) => [k, v == null ? null : String(v)]));

export async function createSlice({ db = process.env.SLICE_DB ?? ':memory:', secret = process.env.SESSION_SECRET ?? 'slice-development-only', now = Date.now, pollMs = 250, control = process.env.SLICE_CONTROL_PORT } = {}) {
  const counter = await createCounter({ db, now });
  const cookies = signedCookie({ secret, name: 'guest' });
  // A message in an address shows only if the server signed it, so a link can't put words in a page.
  const notices = createNotices({ secret });
  counter.identify((request) => cookies.session(request));

  // What's left, and where each order is, as strings, so a change is one comparison. Polled from the same store every
  // implementation reads, so no framework gets a faster feed than another.
  const listeners = new Set();
  const orderListeners = new Map(); // order key → Set of fn(order)
  const snapshot = () => JSON.stringify(counter.store.under('items').map((item) => [item.key, item.left]));
  const stages = () => new Map(counter.store.under('orders').map((order) => [order.key, order.status]));
  let last = snapshot();
  let lastStages = stages();
  const timer = setInterval(() => {
    const next = snapshot();
    if (next !== last) {
      last = next;
      const menu = counter.menu();
      for (const fn of listeners) fn(menu);
    }
    if (!orderListeners.size) return;
    const now = stages();
    for (const [key, fns] of orderListeners) {
      if (now.get(key) === lastStages.get(key)) continue;
      const order = { key, ...counter.store.get('orders', key) };
      for (const fn of fns) fn(view(order));
    }
    lastStages = now;
  }, pollMs);
  timer.unref();

  // The kitchen, for the contract: POST http://127.0.0.1:<control>/stock?item=rye&left=3 sets
  // what's left, as the kitchen's stock page does. Local only, and only when asked for.
  let kitchen = null;
  if (control) {
    kitchen = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://control');
      if (req.method !== 'POST') return res.writeHead(404).end();
      // POST /advance?key=c…&to=making moves an order along, as the kitchen board does.
      const done = url.pathname === '/stock' ? await counter.stock(url.searchParams) : url.pathname === '/advance' ? await counter.advance(url.searchParams.get('key'), url.searchParams.get('to')) : null;
      if (!done) return res.writeHead(404).end();
      res.writeHead(done.ok ? 200 : 400, { 'content-type': 'application/json' }).end(JSON.stringify(done));
    });
    kitchen.listen(Number(control), '127.0.0.1');
    kitchen.unref();
  }

  /** An order as a page shows it: who, when, what, the total, and each step done or not. */
  const STEP_WORDS = { placed: 'Placed', making: 'Being made', ready: 'Ready at the window', 'picked-up': 'Picked up' };
  const view = (order) => {
    const reached = counter.steps.indexOf(order.status);
    return {
      key: order.key,
      name: order.name,
      when: pickupWords(counter.times().map((time) => ({ ...time, day: dayWord(time.slot, now()) })), order.slot) || order.slot,
      lines: (order.lines ?? []).map((line) => ({ item: line.item, qty: line.qty, name: line.name })),
      total: money(order.total ?? order.cents ?? 0),
      status: order.status,
      steps: counter.steps.map((step, i) => ({ step, words: STEP_WORDS[step], done: i <= reached })),
    };
  };

  return {
    shop: counter.shop,
    /** A new checkout's key, put in the checkout form so a second press is the same checkout. */
    checkoutKey: () => counter.checkoutKey(),
    /**
     * Pay for the bag. Checks the name, email and card first, then `{ ok, key }` or `{ error }`, with
     * `back: '/order'` when the problem is the pickup time. Card 4000 0000 0000 0002 is declined.
     */
    async place(guest, { checkout, name, email, card }) {
      name = String(name ?? '').trim();
      email = String(email ?? '').trim();
      if (!counter.cart(guest).lines.length) return { error: 'Your bag is empty.', back: '/order' };
      if (!name) return { error: 'Give a name for the bag.' };
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: 'Give an email we can send the receipt to.' };
      if (String(card ?? '').replace(/\D/g, '').length < 12) return { error: 'Give a card number (test mode: 4242 4242 4242 4242).' };
      return counter.place(guest, form({ checkout, name, email, card }));
    },
    /** The guest's paid order as a page shows it, or null if it isn't theirs. */
    order(guest, key) {
      const order = counter.order(guest, String(key ?? ''));
      return order ? view(order) : null;
    },
    /** fn(order) whenever that order moves along; returns unsubscribe. */
    watchOrder(key, fn) {
      if (!orderListeners.has(key)) orderListeners.set(key, new Set());
      orderListeners.get(key).add(fn);
      lastStages = stages();
      return () => {
        orderListeners.get(key)?.delete(fn);
        if (!orderListeners.get(key)?.size) orderListeners.delete(key);
      };
    },
    /** Where to send the browser after a post: `back('/', { done: 'Added to your order.' })`. */
    back: (path, { done, problem } = {}) => notices.sign(`${path}${done ? `?done=${encodeURIComponent(done)}` : problem ? `?problem=${encodeURIComponent(problem)}` : ''}`),
    /** The signed message in a page's address, if any: `{ done }` or `{ problem }`. */
    said: (url) => notices.read(url),
    /** Zubra's sync server, for the Zubra build only: the others use `subscribe`. */
    sync: counter.sync,
    guest(cookieHeader = '') {
      const known = cookies.read(cookieHeader);
      if (known) return { guest: known, setCookie: null };
      const id = randomBytes(12).toString('base64url');
      return { guest: cookies.read(cookies.cookie(id).split(';')[0]), setCookie: cookies.cookie(id) };
    },
    menu: () => counter.menu(),
    cart: (guest) => counter.cart(guest),
    /** Pickup times: `{ slot, day: 'tomorrow', label: '7:15 am', full }`. */
    times: () => counter.times().map((time) => ({ ...time, day: dayWord(time.slot, now()) })),
    pickup: (guest) => counter.pickup(guest),
    add: (guest, { item, qty = 1 }) => counter.add(guest, form({ item, qty })),
    change: (guest, { item, qty }) => counter.change(guest, form({ item, qty })),
    choose: (guest, slot) => counter.choose(guest, form({ slot })),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    close() {
      clearInterval(timer);
      kitchen?.close();
    },
  };
}

/** "$9.00" from whole cents. */
export const money = (cents) => `$${(cents / 100).toFixed(2)}`;
/** What a menu row says about stock: "5 left", "Sold out", or nothing for no limit. */
/** "tomorrow at 7:15 am" for a pickup slot from `times()`. */
export const pickupWords = (times, slot) => {
  const time = times.find((one) => one.slot === slot);
  return time ? `${time.day} at ${time.label}` : '';
};
export const stockWords = (item) => (item.left == null ? '' : item.left > 0 ? `${item.left} left` : 'Sold out');
