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
  description: 'Bread, pastry and coffee baked before sunrise in Oakland, Maryland. Order ahead and pick it up warm at the side window.',
  order: 'Order now',
  hero: {
    kicker: 'Oakland, Maryland',
    title: 'Baked before sunrise.',
    titleSoft: 'Gone by two.',
    lede: 'Bread, pastry and coffee from the ovens on the hill.',
    secondary: 'Find us',
  },
  carryout: {
    kicker: 'Carryout',
    heading: 'Skip the line. It’s already bagged.',
    text: 'Order from your phone, pick a time, and grab it at the side window. Your name’s on the bag.',
    button: 'See today’s menu',
  },
  menu: {
    kicker: 'Today’s bake',
    heading: 'Fresh this morning. Going fast.',
    lede: 'What’s left is counted live. When it’s gone, it’s gone.',
    sections: {
      Bread: 'Long-fermented, baked dark.',
      Pastry: 'Laminated by hand; out of the oven by seven.',
      Coffee: 'Roasted in Garrett County.',
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
  story: {
    kicker: 'The bakehouse',
    heading: 'Up at four. Every morning.',
    paragraphs: [
      'Hickory Hollow started as a farm-stand table with six loaves on it. It sold out in twenty minutes.',
      'Two bakers still light the ovens at four. Everything is made that morning, by hand, and nothing is held over.',
    ],
  },
  steps: {
    heading: 'How it works',
    list: [
      ['Fill your bag', 'Pick from what’s left today.'],
      ['Choose a time', 'Every {slot} minutes, as soon as {lead} from now.'],
      ['Grab it warm', 'Side window. Give your name.'],
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
