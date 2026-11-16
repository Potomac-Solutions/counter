# How Counter is compared with other frameworks

These rules are fixed before any clone is built. They are written once and
copied into each app's repository. A result that wasn't measured by these
rules is not reported as a result.

## What is compared

The **host layer**: how pages are routed, rendered, made interactive and
updated live. The business logic is the kit (`@potomac-solutions/kit`), a
plain Node library with no framework in it. Every clone calls the same kit
modules with the same data, so a difference in the numbers comes from the
framework and not from a rewrite of the shop.

Counter as it stands on `main` (Zubra, served by `@zubra/server`) is the
**baseline**. It is frozen at a tagged commit before the first clone starts
and is not tuned afterwards.

## Competitors

Chosen from the host list in the Enterprise Emulation Roadmap, one per branch:

| Branch | Framework | Notes |
| --- | --- | --- |
| `compare/nextjs` | Next.js, App Router, React | Server components and server actions as its docs recommend |
| `compare/sveltekit` | SvelteKit | Form actions and `load`, as its docs recommend |
| `compare/nuxt` | Nuxt, Vue | Server routes and `useAsyncData`, as its docs recommend |

Added since, the same way: Lit, Enhance, Stencil, FAST and WebUI (web component libraries,
each on a plain Node server), a Zubra build on the same event stream as the others, and tuned
builds of Next.js and Nuxt beside their defaults. The work moved from whole-app clones to one
slice of Counter, built in `compare/slice/` on these rules. More are added the same way. A clone uses no Zubra code. (An app that is *not*
built on Zubra gets a Zubra clone instead, so the comparison runs both ways.)

## The parity contract

`compare/contract/` holds one browser test suite (Playwright) that runs against
a base URL, and so against every implementation, baseline included. A clone is
compared only after it passes the whole contract:

1. Menu shows what's left, and a sold-out item can't be added.
2. Bag: add, change quantity, remove, pick a pickup time.
3. Checkout in test mode makes an order and shows its page.
4. The order page follows the kitchen without a reload (live update).
5. Sign up, sign in, lockout after repeated failures, reset by emailed link, sign out.
6. Kitchen board moves an order along and updates stock.
7. Admin: orders, customers, reports with the CSV download, settings. Owner-only parts answer 403 to staff.
8. Every page works with JavaScript off, except the live update (#4), which may fall back to a reload link.

The same seed (`bin/seed.js`) fills every implementation.

## Measured

Each is the median of 9 runs on one machine, production builds, the seeded
shop, and the machine's model, Node version and date written beside the result.

| # | Measure | How |
| --- | --- | --- |
| 1 | JavaScript sent for the menu page | Transfer size of every script on first load, compressed, from Playwright |
| 2 | Time until usable | Lighthouse LCP and total blocking time, mobile profile, same throttling for all |
| 3 | Works without JavaScript | Contract tests passing with JavaScript off |
| 4 | Size of the framework layer | Non-blank, non-comment lines outside the kit, the seed and the shared stylesheet |
| 5 | Dependencies | Direct and total packages installed, and `node_modules` size |
| 6 | Build and start | Cold build time; start to first 200; resident memory idle and under 50 concurrent menu requests |
| 7 | Requests per second and p95 | `autocannon` against the menu page, 30 seconds, 50 connections |
| 8 | Accessibility | axe violations on the menu, bag, checkout, order, sign-in and admin pages |

Added later, once two or more clones exist: the **upgrade drill**, one minor
and one major framework upgrade, with time spent and what broke.

## Fairness

- **Idiomatic code.** Each clone follows its framework's own documentation and
  starter template. A reviewer checks each against those docs, and the check is
  recorded in the branch.
- **Same look.** All implementations share one stylesheet, so CSS is not a
  variable. It is left out of the line counts.
- **Same features, same effort.** Nothing is dropped from a clone to look
  smaller. Time spent on each clone is logged in `docs/compare/LOG.md`.
- **Versions pinned** to the latest stable release on the day a clone starts,
  with that date recorded.
- **No tuning after seeing results.** The baseline and each clone are frozen at
  a tagged commit before measuring. A fix after measuring restarts measuring.
- **Everything is published,** including results where Zubra loses and tests a
  clone failed. The report says what each framework is good at.
- **Anyone can rerun it.** `docs/compare/README.md` has the commands.
- The author builds both sides. That is a limit, and the report says so. The
  contract tests and the pinned code are there so others can check.

## Findings

A problem found in Zubra goes upstream with the `found-by: potomac` label and a
link to the branch that hit it. It is not worked around inside the app.
