# What the slice's numbers say, and what they don't

Read with `RESULTS.md`. All nine builds pass the same contract, with JavaScript
on and off. None has an accessibility violation on the menu or the bag, and
all score 99 or 100 in Lighthouse, because the page is small.

## What the numbers show

- **What the browser downloads.** Enhance (5 KB gzipped), Lit (8.2) and
  Stencil (9.9) send the least JavaScript. Zubra (27.5), FAST (28.3) and
  WebUI (30.6) come next, then SvelteKit (37.9), Nuxt (79.3) and
  Next.js (132.4). Against the app frameworks Zubra is the smallest; against
  the web component libraries it isn't.
- **Main-thread work.** Next.js (132 ms of blocking time) and Nuxt (72) are the
  only builds with much. The rest are 21 ms or less.
- **Pages served.** On this 2-CPU machine Zubra served the most menu pages per
  second (5,402). FAST (4,279) and WebUI (4,263) were close, on WebUI's native
  renderer. Then came Enhance (2,313), Lit (1,568), SvelteKit (1,548),
  Next.js (424), Stencil (423) and Nuxt (196).
- **Memory under load.** WebUI (128 MB) and FAST (141) used the least, then
  Lit (166), Enhance (174) and Zubra (193). Next.js used the most (418).
- **Install and deploy size.** Zubra installs the fewest packages (4). Stencil
  installs 9 and everything else 35 to 605. After building, Enhance (1 MB),
  SvelteKit, Stencil (2 MB each) and Nuxt (3 MB) deploy smaller than Zubra
  (6 MB). Next.js without `output: 'standalone'` runs from 493 MB.
- **Build.** Zubra has no build step. Lit, Enhance, FAST and WebUI build in a
  tenth of a second or less, Stencil and SvelteKit in 2 to 3 seconds, and
  Next.js and Nuxt in about 5.5.

## Caveats

- **Zubra's JavaScript is mostly its live feed.** 12.6 of its 27.5 KB is
  `@zubra/sync` (`index.js`, `connect.js` and `webrtc.js`), plus a 13.9 KB
  runtime. Every other build gets live updates from the browser's built-in
  `EventSource` for nothing. That gap is most of why Lit, Enhance and Stencil
  send less. The menu never uses WebRTC, so loading `webrtc.js` here is worth
  raising upstream.
- **The live feeds differ.** Zubra's sync pushes a write when it happens. The
  other eight read a shared feed that checks the store every 250 ms. The
  contract only checks that the update arrives, not how fast.
- **Stencil's throughput** comes from its hydrate script parsing and
  serializing the whole document on every request. A build that rendered only
  the components would likely be faster. A Stencil reviewer should check it.
- **Nuxt's throughput depends on how its pages fetch.** Each Nuxt page makes
  three `useFetch` calls to its own API routes (bag, menu, message). That's the
  usual Nuxt pattern, but one combined call per page would likely be faster. A
  Nuxt reviewer should check it.
- **FAST and WebUI share a renderer.** FAST's own docs recommend WebUI for
  production server rendering, so their server numbers are WebUI's, not
  something FAST does on its own.
- **Throughput is a pilot measurement.** The rules call for 9 load runs of
  30 s. This used 3 runs of 10 s, with the load generator on the same 2 CPUs as
  the server. The ratios are more meaningful than the absolute numbers.
- **Lines of code is a weak measure.** The single-server builds (Zubra, Lit,
  Enhance, Stencil, FAST, WebUI) put their pages in one dense file. The app
  frameworks split into the files they expect.
- **The same person wrote every build,** and wrote Zubra's first. None of the
  nine has had a review from someone who knows that framework or library well.
  Until one has, these are a first look, not a verdict.

## Next steps

1. Get each build reviewed against its framework's docs, and record the review
   in the branch.
2. Rerun at full length (9 runs of 30 s) with the load generator on another
   machine.
3. Ask Zubra why `connect()` loads `webrtc.js` on a page with no peer-to-peer
   use, and whether a read-only page can skip most of `@zubra/sync`.
4. Do the same slice in the other six apps, choosing for each the part that
   shows something new.
