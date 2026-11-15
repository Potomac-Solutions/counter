# The slice: Counter's menu, bag and pickup time

One slice of Counter, built once per framework. Each build is a small app of its
own in `compare/slice/<framework>/`. Every build:

- calls `shared/slice.js`, which is Counter's own backend on the kit, with no
  framework in it
- serves `shared/slice.css` unchanged
- passes `contract/slice.contract.mjs` before it is measured

What's measured, and the fairness rules, are in `docs/compare/RULES.md`. The
slice uses the same measures, with the menu page as the measured page.

## Pages and posts

Every build has these addresses. A post answers with a 303 back to the page,
carrying the message. The form posts can have any address the framework likes;
the contract only follows the forms.

| What | Where | Does |
| --- | --- | --- |
| Menu | `GET /` | The sections and items, with what's left |
| Add | form on the menu | `slice.add`, then the menu with "Added to your order." or the problem |
| Bag | `GET /order` | The lines, total, and the pickup time form |
| Change | forms on the bag | `slice.change` with the new quantity (0 removes) |
| Time | form on the bag | `slice.choose`, then the bag |
| Live | the framework's choice | Pushes what's left to an open menu, which updates without a reload |

## Markup

Text, roles and these class names are the contract. Anything else is up to the
framework.

```
header.site-head
  a "Hickory Hollow Bakehouse" → /
  nav: a "Menu" → /, a "Your order (2)" → /order     (count when the bag has any)
main
  p.notice "Added to your order."   or   p.notice.problem "Sold out."
  -- menu --
  h1 "Order ahead"
  section (each of Bread, Pastry, Coffee)
    h2 section name
    ul.items > li.item[.out when sold out]
      h3 name
      p.meta "$9.00 · loaf · " span.left "5 left" | "Sold out" (nothing when unlimited)
      form (post): hidden item; input number qty, aria-label "How many <name>",
                   min 1 max 24; button "Add" (both disabled when sold out)
  -- bag --
  h1 "Your order"
  section: h2 "In your bag"
    p "Your bag is empty."   or
    ul.lines > li.line: name, "$9.00 each", line total "$18.00",
                        .qty: forms with buttons "−" (qty−1), the qty, "+" (qty+1), "Remove" (0)
    p.total "Total $18.00"
  section: h2 "Pickup time"
    form (post): label "When you’ll come by" select slot
                 options "tomorrow 7:15 am" ("… (full)" and disabled when full)
                 button "Set the time"
    p "Pickup: tomorrow at 7:15 am" when one is set
```

Page titles are `<page> · Hickory Hollow Bakehouse`.

## Running a build

```sh
SLICE_CONTROL_PORT=3199 PORT=3101 npm start        # in compare/slice/<framework>
BASE=http://localhost:3101 CONTROL=3199 node --test compare/slice/contract/
```
