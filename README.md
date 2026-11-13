# Counter

Order ahead, for a shop people pick food up from: a bakery, a café, a pizza or sub shop, a deli counter. The menu shows what's left, live. A guest fills a bag, picks a pickup time and pays once; the kitchen moves the order along and the guest's phone follows. A Potomac Solutions platform, built on the [kit](https://github.com/Potomac-Solutions/kit) and [Zubra](https://github.com/journey-to-code-org/zubra).

The shop it starts with, Hickory Hollow Bakehouse in Oakland, Maryland, is made up. Nothing here is really for sale, and payments are in test mode.

## Try it

`npm install`, then `npm start`, and open http://localhost:3000. Two browser windows side by side (one private, so it's another person) show the live parts best.

**Staff sign in with their own accounts.** The first time, nobody has one, so the server prints a setup link: open it to make the owner (your email, name and a password). The owner's **People** page invites the rest of the staff (an invite is a link to send them), resets passwords and turns people off.

1. **Order.** Add a few things from the menu, open **Your order**, choose a pickup time (after closing, tomorrow's), and **Check out** with any card number (`4000 0000 0000 0002` is declined, to see that).
2. **Watch the menu.** In the other window, buy the rye. The first window's menu shows how many are left, without a reload.
3. **The kitchen.** Open **The kitchen (staff)** from the footer and sign in. Press **Start making**, then **Ready**: the guest's order page follows each step. The list refreshes itself every 20 seconds.
4. **Sold out.** Under **Stock and today's note**, set the rye to 0: every open menu shows it sold out at once. Post a note ("Pumpkin scones at 9"), and it's on every menu too.
5. **A full pickup time.** Each time takes three orders; a fourth is told to choose another, even when they pay at the same moment.
6. **Without JavaScript** (turn it off in the browser's settings), all of it works the same.

## How it is put together

| Piece | Job |
| --- | --- |
| [Potomac kit](https://github.com/Potomac-Solutions/kit) (private) | `catalog` (what's left, taken all or nothing), `cart` (the bag), `checkout` (pay once, then the order), `pay` (its test provider), `hold` (each pickup time's places), `stages` (placed, making, ready, picked up), `staff` and `staff/pages` (the owner and staff: passwords, sessions, invites, roles, and their pages), `auth` (guest and kitchen cookies), `store` (the Sync log). The kit's `cart-panel` and `checkout-form`, from its package |
| `@zubra/server` | Renders every page before any JavaScript runs |
| `@zubra/sync` | The log (one SQLite file). Each menu item, the note and each order are documents only the server writes; pages follow them live, and read only the menu, the note and their own orders |
| `src/shop.js` | The bakery: hours, pickup spacing and places, today's menu, as data |
| `src/counter.js` | The bakery's side: the menu by section, pickup times, the kitchen, stock, the note, and the words |

## Run it

```sh
npm install      # needs read access to the private Potomac-Solutions/kit repository
npm start        # http://localhost:3000
npm test         # needs Chrome or Playwright's Chromium
```

Node 22.13 or later. `SESSION_SECRET` is required in production; `DATA_DIR` says where the database file goes.

## What the tests prove

1. Without JavaScript: the menu in the bakery's order; a bag; no checkout before a pickup time; one payment; the order page; stock taken when paid (coffee never runs out); the bag empty again.
2. The menu is live: what someone else buys, a sold-out mark and a restock reach an open menu at once, and so does the note; a sold-out item can't be added. Stock must be a number, and coffee doesn't run out.
3. The last hand pies go to one guest even when two pay at once; the other is told and keeps the bag.
4. A pickup time takes three orders; the fourth is told it filled up, even at the same moment, and has to choose again.
5. A paid order keeps its place after holds run out; a made-up pickup time is refused.
6. A declined card takes nothing: the stock, the pickup place and the bag stay as they were. Checking out with no time goes back to choose one.
7. The kitchen needs a staff sign-in; it moves an order one step per press (two presses at once move it once); the guest follows live; picked-up orders leave the list.
8. A page reads the menu, the note and its own orders, nothing else, even when it asks; it writes nothing; another site's post is refused; another guest's order page isn't theirs.

Every behaviour was broken on purpose once to check a test fails (19 of 20 caught). The one that can't be: a guest's place at a pickup time is picked from those free with no wait in between, so holding it can't fail; the check stays as a safety belt.

## Not yet

- The owner's admin: the menu, sections, hours and pickup spacing, now in `src/shop.js`. Options on an item (oat milk, extra shot).
- A kitchen list that updates itself without the 20-second refresh.
- Texts when an order is ready (the kit's `notify`, as Work Ticket uses), and a real payment provider.
