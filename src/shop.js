// The shop Counter starts with. Everything here is data the owner will edit from an admin page
// (a later step); nothing else in the app knows what a cinnamon roll is.
//
// A made-up bakery, so the demo reads like the trade without being anyone's.

export const shop = {
  id: 'hickory',
  name: 'Hickory Hollow Bakehouse',
  town: 'Oakland, Maryland',
  timeZone: 'America/New_York',
  opens: '07:00',
  closes: '14:00',
  hours: 'Open 7 am to 2 pm, Wednesday to Sunday',
  concept: 'Concept by Potomac Solutions. Hickory Hollow Bakehouse is a made-up bakery; nothing here is really for sale.',
  pickup: 'Pick up at the side window; your name will be on the bag.',
  /** Minutes between pickup times, and how many orders each can take. */
  slotMinutes: 15,
  perSlot: 3,
  /** The soonest an order can be ready, in minutes. */
  leadMinutes: 20,
  /** A made-up number (555 numbers aren't given out). */
  phone: '301-555-0142',
  /** Listed in search engines? Off for a made-up shop; a real one turns it on. */
  listed: false,
};

/**
 * Today's menu. `left` is how many the bakers made today (`null`: as many as you like, like
 * coffee); the kitchen marks things sold out or adds more. Prices in whole cents.
 */
export const menu = [
  { key: 'sourdough', section: 'Bread', name: 'Country sourdough', unit: 'loaf', cents: 900, left: 12 },
  { key: 'rye', section: 'Bread', name: 'Seeded rye', unit: 'loaf', cents: 1000, left: 6 },
  { key: 'baguette', section: 'Bread', name: 'Baguette', unit: 'piece', cents: 450, left: 15 },
  { key: 'cinnamon', section: 'Pastry', name: 'Cinnamon roll', unit: 'piece', cents: 475, left: 18 },
  { key: 'croissant', section: 'Pastry', name: 'Butter croissant', unit: 'piece', cents: 425, left: 20 },
  { key: 'apple-hand-pie', section: 'Pastry', name: 'Apple hand pie', unit: 'piece', cents: 550, left: 4 },
  { key: 'drip', section: 'Coffee', name: 'Drip coffee', unit: '12 oz', cents: 300, left: null },
  { key: 'latte', section: 'Coffee', name: 'Maple latte', unit: '12 oz', cents: 550, left: null },
];

export const SECTIONS = ['Bread', 'Pastry', 'Coffee'];

/**
 * Every word on the landing page that isn't the menu. Change the page here, not in src/site.js.
 * `{lead}`, `{slot}` and `{perSlot}` are filled from the numbers above, so the words can't drift.
 * `about` is keyed by menu item, so an owner renaming an item keeps its description.
 */
export const site = {
  description: 'Bread, pastry and coffee baked this morning in Oakland, Maryland. Order ahead, choose a pickup time, and it’s bagged at the side window with your name on it.',
  hero: {
    kicker: 'Oakland, Maryland · baked this morning',
    title: 'Order ahead.',
    titleSoft: 'Pick it up warm.',
    lede: 'Bread, pastry and coffee from our ovens on the hill. Choose a pickup time, pay once, and it’s bagged at the side window with your name on it.',
    primary: 'See today’s menu',
    secondary: 'How it works',
  },
  board: { heading: 'On the shelf now', all: 'Plenty', none: 'Sold out', foot: 'Counts change as people order.' },
  facts: [
    ['{lead} minutes', 'from order to the window, at the soonest'],
    ['Every {slot} minutes', 'a pickup time, {perSlot} orders each'],
    ['Pay once', 'online; nothing to settle at the window'],
    ['Your name', 'on the bag, so you’re in and out'],
  ],
  menu: {
    kicker: 'Today’s bake',
    heading: 'The menu, with what’s left',
    lede: 'These counts are live. When the last one goes, you’ll see it here before you get to the window.',
    sections: {
      Bread: 'Long-fermented, baked dark.',
      Pastry: 'Laminated by hand; out of the oven by 7.',
      Coffee: 'Roasted in Garrett County. Never runs out.',
    },
  },
  about: {
    sourdough: 'Two-day ferment, a crackling crust, an open crumb.',
    rye: 'Caraway, sunflower and flax; dense and good for a week.',
    baguette: 'Baked twice a morning. Best the day you buy it.',
    cinnamon: 'Brioche dough, brown butter, a thin maple glaze.',
    croissant: 'Three days in the making, eighty-one layers.',
    'apple-hand-pie': 'Local apples, a flaky lard-and-butter crust.',
    drip: 'A medium roast, brewed fresh every half hour.',
    latte: 'Espresso, steamed milk and maple syrup from up the road.',
  },
  steps: {
    kicker: 'Three steps',
    heading: 'How it works',
    list: [
      ['Fill your bag', 'Add what you’d like. Nothing is taken off the shelf until you pay, and the menu shows what’s left as it changes.'],
      ['Choose a pickup time', 'Times run every {slot} minutes until we close. Each one takes {perSlot} orders, so yours isn’t stuck behind a rush.'],
      ['Follow it to the window', 'Your order page moves on its own: placed, being made, ready. Come to the side window and give your name.'],
    ],
  },
  story: {
    kicker: 'The bakehouse',
    heading: 'Up at four, sold out by two',
    paragraphs: [
      'Hickory Hollow started as a farm-stand table with six loaves on it. The table sold out in twenty minutes, so the next week there were twelve.',
      'These days two bakers start the ovens at four. Everything on the menu is made that morning, and when it’s gone it’s gone. Ordering ahead is how regulars make sure the rye is still there at noon.',
    ],
    sign: 'Wednesday to Sunday, in the brick building with the brown awning.',
  },
  questions: {
    kicker: 'Good to know',
    heading: 'Questions people ask',
    list: [
      ['How soon can I pick up?', '{lead} minutes after you order, at the soonest. After the last pickup time of the day, the times shown are tomorrow’s.'],
      ['What if something sells out while I’m ordering?', 'Your bag will say so before you pay, and you won’t be charged for it. Nothing is held until the payment goes through.'],
      ['Do I need an account?', 'No. Order as a guest and follow it from the same phone. An account keeps your orders together on any device and fills in your name at checkout.'],
      ['Can someone else pick it up?', 'Yes. Give the name on the order at the side window.'],
      ['Is this a real bakery?', 'No. Hickory Hollow Bakehouse is a made-up shop that shows what Potomac Solutions builds. Payments are in test mode and nothing is really for sale.'],
    ],
  },
  visit: {
    kicker: 'Find us',
    heading: 'Visit',
    where: 'The side window faces the alley, under the brown awning. Park on the street; you’ll be a minute.',
    call: 'Call the counter',
  },
  foot: {
    line: 'Bread, pastry and coffee, baked every morning we’re open.',
    built: 'Built by Potomac Solutions',
    builtHref: 'https://potomac.solutions',
  },
};
