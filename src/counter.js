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
//   settings/shop     what the owner changed from the admin: hours, pickup words
//   audit/<key>       who on the staff did what, and when
//   customers, customer-sessions, customer-tokens   customer accounts (kit customers)
//
// An order carries `owner` (the browser) and, signed in, `customer` (the account): either makes it theirs.
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
/** Minutes from now until a pickup time, on the bakery's clock: negative once it has passed. */
export const minutesUntil = (slot, now = Date.now()) => {
  const here = moment(new Date(now), shop.timeZone);
  const days = Math.round((Date.parse(`${slot.slice(0, 10)}T00:00:00Z`) - Date.parse(`${here.date}T00:00:00Z`)) / 86_400_000);
  return days * 1440 + minutes(slot.slice(11)) - minutes(here.time);
};
const slotKey = (slot) => slot.replace(/[^0-9]/g, '');

export async function createCounter({ db = ':memory:', now = Date.now, holdMs = 2 * 60_000, provider = testProvider(), payingMs = 30 * 60_000 } = {}) {
  let who = () => null;
  let onShift = () => false;
  const owns = (guest, order) => Boolean(guest && order && (order.owner === guest.pub || (guest.customer && order.customer === guest.customer)));
  const ordersOf = (guest) => store.under('orders').filter((order) => owns(guest, order)).map((order) => order.key);
  const log = await sqliteLog(db);
  const sync = createSyncServer({
    log,
    // Pages write nothing: every collection here is the server's.
    authorize: serverOnly([...SERVER_ONLY, 'orders', 'slots', 'slot-holds', 'pickups', 'notes', 'settings', 'audit', 'boards'], ({ kind }) => kind === 'read'),
    // A page reads the menu and the note, and its own orders: nobody else's name or basket.
    scope({ request }) {
      const guest = who(request);
      const keys = guest ? ordersOf(guest) : [];
      // The kitchen's board (a number that moves when an order does) goes to staff only.
      return { items: true, notes: true, ...(keys.length ? { orders: keys } : {}), ...(onShift(request) ? { boards: true } : {}) };
    },
  });
  const store = await syncStore(sync);

  // What the owner changed, over the defaults in shop.js.
  const defaults = { hours: shop.hours, pickup: shop.pickup };
  const applySettings = () => Object.assign(shop, defaults, Object.fromEntries(Object.entries(store.get('settings', 'shop') ?? {}).filter(([name]) => name in defaults)));
  applySettings();

  // Today's bake, the first time the bakery opens on this log.
  if (!store.under('items').length) for (const { key, ...item } of menu) await store.write('items', key, item);

  const catalog = createCatalog({ store });
  const cart = createCart({ store, catalog, max: 24 });
  const kitchen = createStages({ store, collection: 'orders', steps: STEPS, may: () => true, now });
  // A new order is a new document, which no open page was made for. One document the server keeps
  // says "the board changed"; the kitchen's page follows it and fetches the board again.
  const touch = () => store.write('boards', 'kitchen', { rev: (store.get('boards', 'kitchen')?.rev ?? 0) + 1 });
  // Paid on the platform's page (Square, for this shop): `wanted` keeps a let-go checkout from being taken.
  let checkout;
  const pay = createPay({ provider, store, now, wanted: (id) => checkout.wanted(id) });
  checkout = createCheckout({ store, catalog, cart, pay, stages: kitchen, now, payingMs });
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
    'not-paid': () => 'That payment didn’t go through, so nothing was charged. Your order is still here.',
    cancelled: () => 'Nothing was charged. Your order is still here.',
    'not-set-up': () => 'Paying online isn’t working right now. Call us and we’ll take your order.',
    'provider-failed': () => 'The payment service didn’t answer. Try again in a minute.',
    'paid-after-cancel': () => 'That payment came through after the order was let go. We’ll refund it; call us if you’d like the order.',
  };
  const words = (answer) => ({ error: (WORDS[answer.error] ?? (() => 'That didn’t go through. Try again.'))(answer) });

  /** How many orders are already set for a pickup time. */
  const booked = (slot) => [...slots.taken(`slots/${slotKey(slot)}`).values()].filter((place) => place.state === 'taken' || place.state === 'held').length;

  /** A paid checkout's pickup place, kept for good, and the kitchen told. */
  async function afterPaid(key) {
    const doc = store.get('checkouts', key);
    const slot = doc?.fields?.slot;
    if (slot) {
      const pool = `slots/${slotKey(slot)}`;
      const mine = slots.held(doc.owner, pool).units;
      // The hold ran out while they paid: take a free place if there is one; the order stands either way.
      const place = mine[0] ?? places.find((one) => !slots.taken(pool).has(one));
      if (place && !mine.length) await slots.choose(doc.owner, pool, { units: [place] });
      if (place) await slots.confirm(doc.owner, pool, [place]);
    }
    await touch();
  }

  return {
    sync,
    store,
    shop,
    // node:sqlite keeps the file until this runs; Windows won't delete it otherwise.
    close() {
      log.close();
    },
    sections: SECTIONS,
    identify(fn) {
      who = fn;
    },
    /** `fn(request)`: is this a member of staff? They are sent the kitchen's board. */
    staffed(fn) {
      onShift = fn;
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
    async place(guest, form, { back = '', cancel = '' } = {}) {
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
      // Paying on the platform's page takes longer than a typed card: the place is kept as long as the checkout.
      const held = back ? await slots.chooseAcross(guest.pub, [{ pool, units: [place] }], { ms: payingMs }) : await slots.choose(guest.pub, pool, { units: [place] });
      if (held.error) return { error: `${timeLabel(slot)} just filled up. Choose another time.`, back: '/order' };
      const done = await checkout.place(guest.pub, {
        key,
        method: { card: String(form.get('card') ?? '') },
        fields: { name: String(form.get('name') ?? '').trim().slice(0, 80), email: String(form.get('email') ?? '').trim().slice(0, 200), phone: String(form.get('phone') ?? '').trim().slice(0, 40), slot, placedAt: now(), customer: guest.customer ?? '' },
        description: `${shop.name} order`,
        back,
        cancel,
      });
      if (!done.ok) {
        await slots.choose(guest.pub, pool, { units: [] });
        return words(done);
      }
      if (done.paying) return done.paid ? this.finish(key) : { ok: true, key, paying: true, pay: done.pay };
      await slots.confirm(guest.pub, pool, [place]);
      await touch();
      return { ok: true, key };
    },

    /**
     * Back from the platform's page, or its webhook: once it's paid, the order goes to the
     * kitchen and the pickup place is kept. Not paid: the stock and place go back (unless the
     * platform says it was paid after all), and the bag stays.
     */
    async finish(key, { told } = {}) {
      const before = store.get('checkouts', key);
      if (!before) return { error: 'That checkout has expired. Try again.' };
      const done = await checkout.finish(key, { told });
      if (done.error === 'not-paid') return this.cancel(before.owner, key, 'not-paid');
      if (!done.ok) return { ...words(done), key };
      if (!done.again) await afterPaid(key);
      return { ok: true, key, again: Boolean(done.again) };
    },

    /** The webhook from the platform: `{ headers, body, url }`. */
    async heard(request) {
      const done = await checkout.heard(request);
      if (done.ok && !done.again) await afterPaid(done.key);
      return done;
    },

    /** Backed out of the platform's page: the stock and the pickup place go back. */
    async cancel(owner, key, why = 'cancelled') {
      const before = store.get('checkouts', key);
      if (!before || before.owner !== owner) return { error: 'That checkout has expired. Try again.' };
      const done = await checkout.cancel(owner, key);
      if (done.ok && done.orders) {
        if (!done.again) await afterPaid(key);
        return { ok: true, key };
      }
      const slot = before.fields?.slot;
      if (slot) await slots.choose(owner, `slots/${slotKey(slot)}`, { units: [] });
      return { ...words({ error: why }), key };
    },

    /** Checkouts left on the platform's page: run every few minutes. */
    async sweep() {
      for (const one of await checkout.sweep()) {
        if (one.orders) await afterPaid(one.key);
        else {
          const slot = store.get('checkouts', one.key)?.fields?.slot;
          const owner = store.get('checkouts', one.key)?.owner;
          if (slot && owner) await slots.choose(owner, `slots/${slotKey(slot)}`, { units: [] });
        }
      }
    },

    /** A paid order by its key, whoever owns it (for the email once it's paid). */
    orderByKey: (key) => (KEY.test(key) ? store.get('orders', key) : null),

    /** A paid order the guest owns, or null. */
    order(guest, key) {
      const order = KEY.test(key) && store.get('orders', key);
      return order && owns(guest, order) ? { key, ...order } : null;
    },
    ordersFor: (guest) => (guest ? store.under('orders').filter((order) => owns(guest, order)).sort((a, b) => (a.slot < b.slot ? -1 : 1)) : []),

    /** The kitchen's list: orders not picked up, soonest pickup first. */
    kitchen: () => store.under('orders').filter((order) => order.status !== 'picked-up').sort((a, b) => (a.slot < b.slot ? -1 : a.slot > b.slot ? 1 : a.placedAt - b.placedAt)),
    steps: STEPS,
    /** How many times the board has changed: open kitchen pages follow it (`boards/kitchen`). */
    board: () => store.get('boards', 'kitchen')?.rev ?? 0,

    /** The kitchen moves an order to the stage its button showed; a second press is refused. */
    async advance(key, to) {
      const order = KEY.test(key ?? '') ? store.get('orders', key) : null;
      if (!order) return { error: 'That isn’t one of our orders.' };
      const next = STEPS[STEPS.indexOf(order.status) + 1];
      if (!next || to !== next) return { error: `${order.name || 'That order'}’s order is already ${order.status.replace('-', ' ')}.` };
      const done = await kitchen.advance(key, next);
      if (done.ok) await touch();
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

    // ---- Accounts, the admin and the owner's settings -----------------------------------------
    /** On signing in or up: this browser's orders join the account. */
    async claim(guest, customer) {
      let claimed = 0;
      for (const order of store.under('orders')) {
        if (order.owner === guest?.pub && !order.customer) {
          await store.write('orders', order.key, { customer });
          claimed++;
        }
      }
      return claimed;
    },
    /** Every order, newest first, for the admin. */
    allOrders: () => store.under('orders').sort((a, b) => (b.placedAt ?? 0) - (a.placedAt ?? 0)),
    staffOrder(key) {
      const order = KEY.test(key ?? '') ? store.get('orders', key) : null;
      return order ? { key, ...order } : null;
    },

    /** Something someone on the staff did, for the activity list. */
    async audit(by, what, ref = '') {
      await store.write('audit', `l${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`, { by: by?.name ?? 'System', what: String(what).slice(0, 200), ref, at: now() });
    },
    activity: (limit = 20) => store.under('audit').sort((a, b) => b.at - a.at).slice(0, limit),

    /** The owner changes an item's name and price. Orders already paid keep theirs. */
    async setItem(form) {
      const key = String(form.get('item') ?? '');
      const item = store.get('items', key);
      if (!item) return { error: 'That isn’t on the menu.' };
      const name = String(form.get('name') ?? '').trim().slice(0, 80);
      const match = /^\$?\s*(\d{1,4})(?:\.(\d{1,2}))?$/.exec(String(form.get('price') ?? '').trim());
      if (!name) return { error: 'Give the item a name.' };
      if (!match) return { error: `Give ${name} a price, like 4.75.` };
      const cents = Number(match[1]) * 100 + Number((match[2] ?? '0').padEnd(2, '0'));
      if (cents < 25) return { error: `Give ${name} a price of at least $0.25.` };
      await store.write('items', key, { name, cents });
      return { ok: true, item: { ...item, name, cents } };
    },

    /** The owner changes the hours and pickup words. */
    async setShop(form) {
      const hours = String(form.get('hours') ?? '').trim().slice(0, 120);
      const pickup = String(form.get('pickup') ?? '').trim().slice(0, 240);
      if (!hours || !pickup) return { error: 'Give the hours and the pickup words.' };
      await store.write('settings', 'shop', { hours, pickup });
      applySettings();
      return { ok: true };
    },
  };
}
