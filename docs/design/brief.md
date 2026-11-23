# Counter: design brief

Hickory Hollow Bakehouse is a made-up bakery in Oakland, Maryland. This is the brief the design
pass works from: who the pages are for, what they should feel like, and what the audit found.

## Who lands here, and what they want in ten seconds

Someone on a phone, usually in a car or at a desk, who already knows the bakery. They want to know
three things: **is the thing I want still there, when can I get it, and how fast can I pay.**
A second group has never ordered ahead and needs to see that it takes a minute and no account.

## The one action

**Add something to the bag from today's menu.** The primary button in the hero goes to the menu;
on a phone the hero's text, the next pickup time and that button fit in the first screen. Once
there is something in the bag, a bar along the bottom of the phone keeps checkout in reach.

The live fact above the fold is the **next pickup time with room**, and beside it a shelf board of
what is running low, read from the same live documents as the menu.

## Identity

| | |
| --- | --- |
| Headings | Fraunces 600, and 500 italic for the soft second line. A warm, slightly old-fashioned serif: a bakery's painted sign. |
| Body | Figtree 400, 600, 700. Round and plain; easy to read small on a phone. |
| Colour | The app's existing hues, named: paper `#fbf6ef`, ink `#2d2017`, crust `#6b3f22`, rust `#b4532a`, plus butter `#f3c456` for highlights and oven `#24160d` for dark bands. |
| Shape | Pill buttons, 1rem cards, a dashed inner border on the shelf board like a stitched label. |
| Drawing | Inline SVG line drawings in butter on oven: loaves on a shelf, the shop front. No photos. |
| Motion | A pulse on the "next pickup" dot and a message that floats up after adding. Both off under reduced motion. |

Fonts are self-hosted from `@fontsource`, Latin only, five files, 74 KB in all, none over 23 KB.

## The landing page, in order

1. **Hero**: where and what, the next pickup time, the button to the menu.
2. **Shelf board**: what is running low and what has sold out, live.
3. **Your orders**: only when this browser or account has one on the way.
4. **Today's note** from the kitchen, live.
5. **Four facts**: how soon, how often, pay once, name on the bag. Filled from the shop's own numbers.
6. **The menu**, by section, each item with a line about it, its price, what is left and Add.
7. **How it works** in three steps.
8. **The bakehouse**: a short story, on a dark band, with the shop-front drawing.
9. **Questions people ask**, including "Is this a real bakery?" (no).
10. **Visit**: hours, the side window, the phone number.
11. **A last nudge** with the next pickup time, then the footer.

Every word is in `src/shop.js` (`site`). `src/site.js` only lays it out.

## Audit findings, worst first

**Landing page (fixed in this pass)**
- The page was a single card of copy over a list. Nothing said why to order ahead.
- Adding an item reloaded the page at the top; the reader lost their place and the confirmation.
- Header, hero and note all repeated the hours. The made-up notice was the loudest thing on the page.
- One system typeface, no drawing, no favicon, no description for a shared link.

**Customer side (next)**
- `/account` and its tables scroll sideways on a phone (17px at 375, 20px at 320).
- Choosing a pickup time is a select and a second button, then back up the page to check out.
- The order page has no sense of time: no "ready in about", no map of the steps beyond pills.
- Sign-in, sign-up and reset are bare forms with no way back to the bag.

**Staff and admin (after that)**
- The kitchen reloads itself every 20 seconds instead of updating live, and loses scroll position.
- Staff pages sit inside the public site's header and footer. "Sign in" shows while signed in as staff.
- `/staff/people` scrolls sideways on a phone (71px at 320); `/admin/reports` by 19px.
- The admin navigation becomes a sideways-scrolling strip on a phone.
- No dark theme for a kitchen tablet; no keyboard shortcuts; destructive actions don't confirm.

## Open questions

1. **Hours against pickup times.** The hours say Wednesday to Sunday, but pickup times are offered
   every day, and the demo seeds orders for today whatever the day. I left the rule alone and used
   "next pickup" as the live fact instead of "open now". Should closed days be closed for ordering?
2. **Search engines.** The page asks not to be listed (`shop.listed` is off), because it is a
   made-up shop in a real town. With it on, the page gets a canonical link, `Bakery` structured
   data, a sitemap and a `robots.txt` that hides only the private areas.
3. **No street address.** A made-up shop gets a made-up phone number (a 555 one) and no street or
   directions link, so nobody is sent to a real door.
4. **No compression.** Pages and scripts go out uncompressed (297 KB for the landing page, 26
   requests). That is the platform's to fix once, not each app's.
