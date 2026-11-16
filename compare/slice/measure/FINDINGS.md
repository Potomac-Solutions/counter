# What the slice's numbers say, and what they don't

Read with `RESULTS.md`. All four builds pass the same contract, with
JavaScript on and off, and none has an accessibility violation on the menu or
the bag.

## What the numbers show

- **What the browser downloads.** Zubra sends the least JavaScript for the
  menu: 27.5 KB gzipped, against SvelteKit's 37.9, Nuxt's 79.3 and Next.js's
  132.4.
- **Main-thread work.** Next.js has the most blocking time (210 ms in
  Lighthouse's mobile profile), then Nuxt (101). SvelteKit (0) and Zubra (15)
  have almost none. All four score 97 or more, because the page is small.
- **Pages served.** On this 2-CPU machine Zubra served about 3 times as many
  menu pages per second as SvelteKit, 12 times as many as Next.js and 26 times
  as many as Nuxt.
- **Install and deploy size.** Zubra installs 4 packages (6 MB). The others
  install 55 to 605 packages for the build (46 to 463 MB). After building,
  SvelteKit (2 MB) and Nuxt (3 MB) deploy smaller than Zubra, which has no build
  step and runs its `node_modules`. Next.js without `output: 'standalone'` runs
  from 493 MB.

## Caveats

- **Zubra's JavaScript is mostly its live feed.** 12.6 of its 27.5 KB is
  `@zubra/sync` (`index.js`, `connect.js` and `webrtc.js`). The others get the
  feed from the browser's built-in `EventSource`, which costs nothing to
  download. The menu never uses WebRTC, so loading `webrtc.js` here is worth
  raising upstream.
- **The live feeds differ.** Zubra's sync pushes a write when it happens. The
  other three read a shared feed that checks the store every 250 ms. The
  contract only checks that the update arrives, not how fast.
- **Nuxt's throughput depends on how its pages fetch.** Each Nuxt page makes
  three `useFetch` calls to its own API routes (bag, menu, message). That's the
  usual Nuxt pattern, but one combined call per page would likely be faster. A
  Nuxt reviewer should check it.
- **Throughput is a pilot measurement.** The rules call for 9 load runs of
  30 s. This used 3 runs of 10 s, with the load generator on the same 2 CPUs as
  the server. The ratios are more meaningful than the absolute numbers.
- **Lines of code is a weak measure.** The Zubra build is one dense
  `server.js`. The others split into the files their frameworks expect.
- **The same person wrote every build,** and wrote Zubra's first. None of the
  four has had a review from someone who knows that framework well. Until one
  has, these are a first look, not a verdict.

## Next steps

1. Get each build reviewed against its framework's docs, and record the review
   in the branch.
2. Rerun at full length (9 runs of 30 s) with the load generator on another
   machine.
3. Ask Zubra why `connect()` loads `webrtc.js` on a page with no peer-to-peer
   use.
4. Do the same slice in the other six apps, choosing for each the part that
   shows something new.
