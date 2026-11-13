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
