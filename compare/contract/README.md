# The parity contract

One browser test suite that every implementation of Counter has to pass before
it is measured. See `docs/compare/RULES.md` for why.

```sh
# 1. start the implementation on a freshly seeded shop
DATA_DIR=/tmp/counter-run npm run seed -- --fresh
DATA_DIR=/tmp/counter-run PORT=3100 npm start

# 2. run the contract against it
BASE=http://localhost:3100 node --test compare/contract/guest.contract.mjs
```

**Seed fresh before every run.** The contract places real (test-mode) orders,
and the shop only has so much stock and so many pickup times. A second run on
the same data can fail for that reason alone.

Passwords default to the demo ones the seed prints. Override them with
`OWNER_PASSWORD`, `STAFF_PASSWORD` and `GUEST_PASSWORD` when a deployment's seed
used others.

Selectors are visible text, labels and roles. A clone meets the contract by
having the same words and the same behaviour, not the same markup.

## Part 1 (here): the guest's walk

| Id | What it checks |
| --- | --- |
| C1-C3 | Menu, bag, pickup time, checkout, the order page; with JavaScript on and off |
| C3 | An empty bag is answered, not crashed |
| C4 | Stock changes on one phone show on another without a reload |
| C5 | Sign in, a wrong password, sign out, make an account, no second account on one email |
| C7 | Guests, staff and the owner each see only what they should of reports and settings |

## Still to write (part 2)

Kitchen board moving an order along and stock; the admin's orders, customers,
reports CSV and settings; reset by emailed link; lockout after repeated
failures. The baseline already passes its own tests for these in
`test/admin.test.js`.
