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

  // What's left, as a string, so a change is one comparison. Polled from the same store every
  // implementation reads, so no framework gets a faster feed than another.
  const listeners = new Set();
  const snapshot = () => JSON.stringify(counter.store.under('items').map((item) => [item.key, item.left]));
  let last = snapshot();
  const timer = setInterval(() => {
    const next = snapshot();
    if (next === last) return;
    last = next;
    const menu = counter.menu();
    for (const fn of listeners) fn(menu);
  }, pollMs);
  timer.unref();

  // The kitchen, for the contract: POST http://127.0.0.1:<control>/stock?item=rye&left=3 sets
  // what's left, as the kitchen's stock page does. Local only, and only when asked for.
  let kitchen = null;
  if (control) {
    kitchen = createServer(async (req, res) => {
      const url = new URL(req.url, 'http://control');
      if (req.method !== 'POST' || url.pathname !== '/stock') return res.writeHead(404).end();
      const done = await counter.stock(url.searchParams);
      res.writeHead(done.ok ? 200 : 400, { 'content-type': 'application/json' }).end(JSON.stringify(done));
    });
    kitchen.listen(Number(control), '127.0.0.1');
    kitchen.unref();
  }

  return {
    shop: counter.shop,
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
