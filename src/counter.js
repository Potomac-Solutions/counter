// The counter: what the server knows, and what only it may decide.
//
// Everything lives in one Sync log (a SQLite file), read and written through the kit's store.
// The kit does the deciding: `catalog` says what's left and takes it, `cart` keeps what each
// guest means to buy, `checkout` turns a cart into a paid order all or nothing, `hold` keeps each
// pickup time to the orders the kitchen can make, `stages` moves an order from placed to picked
// up. This file knows the bakery's menu and hours, the pickup times, and the words.
//
//   items/<key>       a menu item: name, price, how many are left (live on the menu)
//   carts/<guest>     what a guest means to buy                       (kit cart)
//   checkouts/<key>   a checkout, pending then paid                   (kit checkout)
//   orders/<key>      a paid order: placed → making → ready → picked-up (kit stages)
//   slots/<time>/<n>  the places at a pickup time                     (kit hold)
//   pickups/<guest>   the pickup time a guest chose
//   notes/today       the kitchen's note on the menu (live)
import { createSyncServer } from '@zubra/sync/server';
import { sqliteLog } from '@zubra/sync/sqlite';
import { syncStore, serverOnly, SERVER_ONLY } from '@potomac-solutions/kit/store';
import { createCatalog } from '@potomac-solutions/kit/catalog';
import { createCart } from '@potomac-solutions/kit/cart';
import { createCheckout } from '@potomac-solutions/kit/checkout';
import { createPay, testProvider } from '@potomac-solutions/kit/pay';
import { createStages } from '@potomac-solutions/kit/stages';
import { createHolds } from '@potomac-solutions/kit/hold';
import { moment } from '@potomac-solutions/kit/price';
import { shop, menu, SECTIONS } from './shop.js';

const KEY = /^c[a-z0-9]{8,24}$/;
const newKey = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
const minutes = (hhmm) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
const hhmm = (total) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
const STEPS = ['placed', 'making', 'ready', 'picked-up'];

/**
 * The pickup times still open, on the bakery's clock: every `slotMinutes` from the soonest an
 * order can be ready until closing; after the last one, tomorrow's. `YYYY-MM-DD HH:MM`.
 */
export function pickupTimes(now = Date.now()) {
  const here = moment(new Date(now), shop.timeZone);
  const soonest = minutes(here.time) + shop.leadMinutes;
  const day = (date, from) => {
    const times = [];
    for (let at = minutes(shop.opens); at < minutes(shop.closes); at += shop.slotMinutes) if (at >= from) times.push(`${date} ${hhmm(at)}`);
    return times;
  };
  const today = day(here.date, soonest);
  return today.length ? today : day(moment(new Date(now + 86_400_000), shop.timeZone).date, 0);
}
/** "today" or "tomorrow" for a pickup time. */
export const dayWord = (slot, now = Date.now()) => (slot.slice(0, 10) === moment(new Date(now), shop.timeZone).date ? 'today' : 'tomorrow');
/** "9:15 am" for a pickup time. */
export const timeLabel = (slot) => {
  const [hours, mins] = slot.slice(11).split(':').map(Number);
  return `${((hours + 11) % 12) + 1}:${String(mins).padStart(2, '0')} ${hours < 12 ? 'am' : 'pm'}`;
};
const slotKey = (slot) => slot.replace(/[^0-9]/g, '');

export async function createCounter({ db = ':memory:', now = Date.now, holdMs = 2 * 60_000 } = {}) {
  let who = () => null;
  const ordersOf = (pub) => store.under('orders').filter((order) => order.owner === pub).map((order) => order.key);
  const sync = createSyncServer({
    log: await sqliteLog(db),
    // Pages write nothing: every collection here is the server's.
    authorize: serverOnly([...SERVER_ONLY, 'orders', 'slots', 'slot-holds', 'pickups', 'notes'], ({ kind }) => kind === 'read'),
    // A page reads the menu and the note, and its own orders: nobody else's name or basket.
    scope({ request }) {
      const guest = who(request);
      const keys = guest ? ordersOf(guest.pub) : [];
      return { items: true, notes: true, ...(keys.length ? { orders: keys } : {}) };
    },
  });
  const store = await syncStore(sync);

  // Today's bake, the first time the bakery opens on this log.
  if (!store.under('items').length) for (const { key, ...item } of menu) await store.write('items', key, item);

  const catalog = createCatalog({ store });
  const cart = createCart({ store, catalog, max: 24 });
  const kitchen = createStages({ store, collection: 'orders', steps: STEPS, may: () => true, now });
  const checkout = createCheckout({ store, catalog, cart, pay: createPay({ provider: testProvider(), store, now }), stages: kitchen, now });
  // Each pickup time has `perSlot` places; a guest holds one while paying, and keeps it once paid.
  const places = Array.from({ length: shop.perSlot }, (_, i) => `o${i + 1}`);
  const slots = createHolds({ store, holdMs, max: 1, names: { units: 'slots', holders: 'slot-holds' }, now });

  const WORDS = {
    gone: () => 'That isn’t on the menu any more.',
    'sold-out': (answer) => (answer.left ? `Only ${answer.left} left.` : 'Sold out.'),
    'too-many': (answer) => `That’s more than we can bag for one order (${answer.max}).`,
    'bad-qty': () => 'Choose how many.',
    empty: () => 'Your order is empty.',
    'not-ready': () => 'Something in your order just sold out. Check it and try again.',
    declined: () => 'That card was declined. Try another.',
    'in-progress': () => 'Your order is already going through.',
    'not-yours': () => 'That checkout has expired. Try again.',
  };
  const words = (answer) => ({ error: (WORDS[answer.error] ?? (() => 'That didn’t go through. Try again.'))(answer) });

  /** How many orders are already set for a pickup time. */
  const booked = (slot) => [...slots.taken(`slots/${slotKey(slot)}`).values()].filter((place) => place.state === 'taken' || place.state === 'held').length;

  return {
    sync,
    store,
    shop,
    sections: SECTIONS,
    identify(fn) {
      who = fn;
    },

    /** The menu as the guest sees it now, by section, sold-out items included. */
    menu: () =>
      SECTIONS.map((section) => ({
        section,
        items: catalog
          .items('', {}, { all: true })
          .filter((item) => store.get('items', item.key)?.section === section)
          .sort((a, b) => menu.findIndex((one) => one.key === a.key) - menu.findIndex((one) => one.key === b.key)),
      })),

    /** Add to the guest's order. Nothing is taken off the shelf until they pay. */
    async add(guest, form) {
      if (!guest) return { error: 'Open the menu again.' };
      const qty = Number(form.get('qty') ?? 1);
      const answer = await cart.add(guest.pub, String(form.get('item') ?? ''), qty);
      return answer.ok ? answer : words(answer);
    },
    async change(guest, form) {
      if (!guest) return { error: 'Open the menu again.' };
      const answer = await cart.set(guest.pub, String(form.get('item') ?? ''), Number(form.get('qty')));
      return answer.ok ? answer : words(answer);
    },
    cart: (guest) => cart.view(guest?.pub ?? ''),

    /** Pickup times still open today, each with whether it's full. */
    times: () => pickupTimes(now()).map((slot) => ({ slot, label: timeLabel(slot), full: booked(slot) >= shop.perSlot })),
    pickup: (guest) => (guest ? (store.get('pickups', guest.pub)?.slot ?? '') : ''),
    async choose(guest, form) {
      const slot = String(form.get('slot') ?? '');
      if (!guest || !pickupTimes(now()).includes(slot)) return { error: 'Choose one of the times shown.' };
      await store.write('pickups', guest.pub, { slot });
      return { ok: true };
    },

    /** A new checkout's key, made when the checkout page is: a second press is the same checkout. */
    checkoutKey: newKey,

    /**
     * Pay for the guest's order and set it for their pickup time. The time's place is held before
     * paying (the last place goes to one guest), kept once paid, let go if the card is declined.
     */
    async place(guest, form) {
      const key = String(form.get('checkout') ?? '');
      if (!guest || !KEY.test(key)) return { error: 'That checkout has expired. Try again.' };
      const before = store.get('checkouts', key);
      if (before?.state === 'paid' && before.owner === guest.pub) return { ok: true, key };
      const slot = store.get('pickups', guest.pub)?.slot ?? '';
      if (!pickupTimes(now()).includes(slot)) return { error: 'Choose a pickup time first.', back: '/order' };
      const pool = `slots/${slotKey(slot)}`;
      const mine = slots.held(guest.pub, pool).units;
      const place = mine[0] ?? places.find((one) => !slots.taken(pool).has(one));
      if (!place) return { error: `${timeLabel(slot)} just filled up. Choose another time.`, back: '/order' };
      const held = await slots.choose(guest.pub, pool, { units: [place] });
      if (held.error) return { error: `${timeLabel(slot)} just filled up. Choose another time.`, back: '/order' };
      const done = await checkout.place(guest.pub, {
        key,
        method: { card: String(form.get('card') ?? '') },
        fields: { name: String(form.get('name') ?? '').trim().slice(0, 80), phone: String(form.get('phone') ?? '').trim().slice(0, 40), slot, placedAt: now() },
        description: `${shop.name} order (test mode)`,
      });
      if (!done.ok) {
        await slots.choose(guest.pub, pool, { units: [] });
        return words(done);
      }
      await slots.confirm(guest.pub, pool, [place]);
      return { ok: true, key };
    },

    /** A paid order the guest owns, or null. */
    order(guest, key) {
      const order = KEY.test(key) && store.get('orders', key);
      return order && guest && order.owner === guest.pub ? { key, ...order } : null;
    },
    ordersFor: (guest) => (guest ? store.under('orders').filter((order) => order.owner === guest.pub).sort((a, b) => (a.slot < b.slot ? -1 : 1)) : []),

    /** The kitchen's list: orders not picked up, soonest pickup first. */
    kitchen: () => store.under('orders').filter((order) => order.status !== 'picked-up').sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.placedAt - b.placedAt)),
    steps: STEPS,

    /** The kitchen moves an order to the stage its button showed; a second press is refused. */
    async advance(key, to) {
      const order = KEY.test(key ?? '') ? store.get('orders', key) : null;
      if (!order) return { error: 'That isn’t one of our orders.' };
      const next = STEPS[STEPS.indexOf(order.status) + 1];
      if (!next || to !== next) return { error: `${order.name || 'That order'}’s order is already ${order.status.replace('-', ' ')}.` };
      const done = await kitchen.advance(key, next);
      return done.ok ? { ok: true, order: { key, ...store.get('orders', key) }, to: next } : { error: 'Someone just moved that order. Look again.' };
    },

    /** The kitchen sets how many of an item are left: 0 is sold out. */
    async stock(form) {
      const key = String(form.get('item') ?? '');
      const item = store.get('items', key);
      if (!item) return { error: 'That isn’t on the menu.' };
      if (item.left === null) return { error: `${item.name} doesn’t run out.` };
      const left = Number(form.get('left'));
      if (!Number.isInteger(left) || left < 0 || left > 500) return { error: 'Give a number from 0 to 500.' };
      await store.write('items', key, { left });
      return { ok: true, item: { ...item, left } };
    },

    async setNote(text) {
      await store.write('notes', 'today', { text: String(text ?? '').trim().slice(0, 200), at: now() });
      return { ok: true };
    },
    note: () => store.get('notes', 'today') ?? { text: '', at: 0 },
  };
}
