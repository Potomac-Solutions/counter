# Counter: design pass report

Three pull requests, stacked, each into `main` and none merged:

1. `design/landing`: the brief, the identity, the landing page, what search engines and shared links see, and `npm run design-check`.
2. `design/customer`: the bag, pickup time, checkout, the live order page, the account and sign-in.
3. `design/admin`: the staff's page frame, the kitchen board, stock, and every admin page.

## Done

- **Landing page**: rebuilt around the next pickup time and a live shelf board. Words in `src/shop.js`.
- **Customer side**: pickup times to tap, a live order card, a receipt that prints, an account that fits a phone.
- **Staff side**: its own frame with a sidebar (a sheet and bottom tabs on a phone), light and dark, keyboard shortcuts.
- **The kitchen**: three lanes (to make, making, ready), each ticket with how long until pickup, late ones outlined.
- **Stock**: one card per item with Set and a one-press Sold out.
- **Overview**: right now first (to make, ready, today, sold out and low), then the next orders to hand over, then 30 days against the 30 before.
- **Lists**: search, a day filter and sorting that stay in the address; a table at a desk, cards on a phone.
- **Turning a customer's account off** asks first, and says what will happen.
- **Checks**: 30 pages at five widths, light and dark, with no sideways scrolling, headings in order, every input labelled and text contrast of at least 4.5:1. `npm test` passes, 16 of 16.

## Tests changed

Two assertions in `test/counter.test.js`, both because pickup times went from a dropdown to radio buttons. Nothing else.

## Not done, and why

- **The kitchen still reloads every 20 seconds** to pick up new orders. Sync follows one document at a time; a board is a list. It needs a way to follow a collection, which is Zubra's to add. Each guest's order page is live, as before.
- **"Open now"**. The hours are words an owner types, and pickup times are offered every day. The pages show the next pickup time instead. See question 1 in the brief.
- **No screen reader pass.** The checks are structural (headings, labels, landmarks, contrast, keyboard order by reading the markup). Nobody has listened to it.
- **No "order again".** It needs a rule for sold-out and repriced items.
- **The kit's own pages** (staff sign-in, people, passwords) are styled from outside. Their markup is the kit's.
- **Compression and caching of Zubra's own modules** are the platform's: the landing page is 297 KB uncompressed in 26 requests.

## Found on the way

- **The app's `button` rule beat the kit's `action-button`**, so outline and ghost buttons in the bag rendered as solid primary ones. Fixed here by leaving `.action-button` out of the app's rule. Every app that styles bare `button` will have this; the kit could guard against it (higher specificity, or a layer).
- **The kit's People table has no small-screen layout**; it scrolled sideways under 400px. Worked around in `app.css`. Worth fixing in the kit.

Neither is filed upstream yet.

## To carry to the next app

- Start with `src/assets.js`, `public/base.css` and `scripts/design-check.js`: they are not bakery-specific beyond the tokens and the demo sign-ins.
- Keep the kit's variable names (`--primary`, `--card`, `--border`, `--font-heading`) so its components take the identity.
- Put the live thing in the hero. Here it is a shelf board; for a cinema it is tonight's showings.
- Put every word in one file, and fill numbers from the shop's own settings.
