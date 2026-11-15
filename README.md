# Counter

Order ahead, for a shop people pick food up from: a bakery, a café, a pizza or sub shop, a deli counter. The menu shows what's left, live. A guest fills a bag, picks a pickup time and pays once; the kitchen moves the order along and the guest's phone follows. A Potomac Solutions platform, built on the [kit](https://github.com/Potomac-Solutions/kit) and [Zubra](https://github.com/journey-to-code-org/zubra).

The shop it starts with, Hickory Hollow Bakehouse in Oakland, Maryland, is made up. Nothing here is really for sale, and payments are in test mode.

## Try it

`npm install`, then `npm run demo`: it fills the bakery with four months of made-up orders and forty customers, puts this morning's orders in the kitchen, and starts it on http://localhost:3000. It prints three demo sign-ins, for this machine only:

| Who | Email | Password | Where |
| --- | --- | --- | --- |
| Owner | `owner@example.com` | `hickory-owner-demo` | `/admin`: everything |
| Staff | `counter@example.com` | `hickory-staff-demo` | `/admin` (overview, orders, customers), `/kitchen` |
| Customer | `riley@example.com` | `hickory-guest-demo` | `/account` |

`npm start` alone keeps what's there; with no data it prints a setup link for the first owner instead. `npm run seed` fills an empty shop, and `npm run seed -- --fresh` starts over.

**The public side**
1. **The landing page** (`/`): what the bakery does, today's note, the menu with what's left (live), how ordering works, and where and when.
2. **Order.** Add a few things, open **Your order**, choose a pickup time, and **Check out** with any card number (`4000 0000 0000 0002` is declined). A confirmation email lands in the owner's **Outbox**.
3. **An account** (`/account`): sign up, and orders from this browser join it; signed in elsewhere, they're there too, and checkout fills in your name and email. **Forgot your password?** sends a one-time link (to the Outbox, and the server's log).
4. **Watch it live.** In another window, buy the rye: the first window's menu counts down. Each pickup time takes three orders.

**The admin** (`/admin`, staff sign-in)
5. **Overview**: takings and orders for the last 30 days against the 30 before, today's pickups, what's sold out, new accounts, takings by day, what's in the kitchen, and what the staff did.
6. **Orders**: search by name, email, phone or code; filter by pickup day and status; CSV. An order's page moves it along a step at a time.
7. **Customers**: every account with its orders and spend, as CSV; an owner can turn one off or email a reset link.
8. **Reports** (owners): takings and orders by day, week or month in the shop's time zone, by item and by section, the busiest pickup hours, how many account holders came back, and CSV.
9. **Settings** (owners): each item's name and price, the hours and the pickup words. New orders pay the new price; paid ones keep theirs.
10. **The kitchen** (`/kitchen`): orders by pickup time, **Start making**, **Ready**, **Picked up**, with the guest's phone following each step; **Stock and today's note** marks things sold out and posts the note to every open menu.
11. **Without JavaScript** (turn it off in the browser's settings), all of it works the same.

## How it is put together

| Piece | Job |
| --- | --- |
| [Potomac kit](https://github.com/Potomac-Solutions/kit) (private) | `catalog` (what's left, taken all or nothing), `cart` (the bag), `checkout` (pay once, then the order), `pay` (its test provider), `hold` (each pickup time's places), `stages` (placed, making, ready, picked up), `staff` and `staff/pages` (the owner and staff: passwords, sessions, invites, roles, and their pages), `auth` (guest and kitchen cookies), `store` (the Sync log). The kit's `cart-panel` and `checkout-form`, from its package |
| `@zubra/server` | Renders every page before any JavaScript runs |
| `@zubra/sync` | The log (one SQLite file). Each menu item, the note and each order are documents only the server writes; pages follow them live, and read only the menu, the note and their own orders |
| `src/shop.js` | The bakery: hours, pickup spacing and places, today's menu, as data |
| `src/counter.js` | The bakery's side: the menu by section, pickup times, the kitchen, stock, the note, what follows a customer account, the owner's settings, the staff activity, and the words |
| `kit/customers`, `kit/reports`, `kit/charts` | Customer accounts; the numbers by day, week or month, and CSV; charts drawn on the server as SVG, with a table under each |
| `src/account.js`, `src/admin.js` | The account pages; the admin |
| `bin/seed.js` | The demo data |

## Run it

```sh
npm install      # needs read access to the private Potomac-Solutions/kit repository
npm start        # http://localhost:3000
npm test         # needs Chrome or Playwright's Chromium
```

Node 22.13 or later. `SESSION_SECRET` is required in production; `DATA_DIR` says where the database file goes. Behind a proxy (Railway, Fly, a load balancer), set `TRUST_PROXIES` to how many add to `X-Forwarded-For` (usually `1`), so a wrong-password lockout falls on the device guessing and not on everyone; left unset, no header is trusted and every sign-in counts as the proxy's address.

## What the tests prove

1. Without JavaScript: the menu in the bakery's order; a bag; no checkout before a pickup time; one payment; the order page; stock taken when paid (coffee never runs out); the bag empty again.
2. The menu is live: what someone else buys, a sold-out mark and a restock reach an open menu at once, and so does the note; a sold-out item can't be added. Stock must be a number, and coffee doesn't run out.
3. The last hand pies go to one guest even when two pay at once; the other is told and keeps the bag.
4. A pickup time takes three orders; the fourth is told it filled up, even at the same moment, and has to choose again.
5. A paid order keeps its place after holds run out; a made-up pickup time is refused.
6. A declined card takes nothing: the stock, the pickup place and the bag stay as they were. Checking out with no time goes back to choose one.
7. The kitchen needs a staff sign-in; it moves an order one step per press (two presses at once move it once); the guest follows live; picked-up orders leave the list.
8. A page reads the menu, the note and its own orders, nothing else, even when it asks; it writes nothing; another site's post is refused; another guest's order page isn't theirs.

The admin, customer accounts and reports (`test/admin.test.js`, over plain HTTP):

9. The landing page leads with ordering ahead, then the menu; a guest sees no admin link.
10. A sign-up takes in the order from that browser and sends its confirmation to the outbox; signed in elsewhere the order follows and checkout is filled in; signed out, it doesn't.
11. A forgotten password gets the same page whether or not the account exists; the emailed link works once.
12. The admin needs a staff sign-in; staff get no reports, settings or outbox (403), and their settings posts change nothing; owners get them all.
13. Staff find an order and move it along from its page, once per step; it shows in the activity.
14. A new name and price show on the menu and new orders pay it; paid orders keep theirs; a bad price is refused; the hours change.
15. The report's takings match the orders and its CSV adds up to them; a name starting with `=` opens in a spreadsheet as text.
16. A turned-off customer is signed out; only an owner can turn them back on.

Every behaviour was broken on purpose once to check a test fails (19 of 20 caught). The one that can't be: a guest's place at a pickup time is picked from those free with no wait in between, so holding it can't fail; the check stays as a safety belt.

## Not yet

- More of the owner's admin: adding items and sections, the opening hours and pickup spacing are still in `src/shop.js` (names, prices and the words are editable). Options on an item (oat milk, extra shot).
- A kitchen list that updates itself without the 20-second refresh.
- Texts when an order is ready, real email (the confirmations and reset links go to the outbox), and a real payment provider.
