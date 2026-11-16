# What the slice's numbers say, and what they don't

Read with `RESULTS.md` (performance and size), `UPGRADE.md` (the upgrade drill) and
`docs/compare/LOG.md` (developer experience). The slice is Counter's menu with live stock, the bag,
the pickup time, checkout and an order page that follows the kitchen live.

Twelve builds, in three groups, because they aren't the same kind of tool:

- **Zubra** twice: as built (its own `@zubra/sync` for live updates) and on the same event stream
  every other build uses, so download size compares like for like.
- **Web component libraries** on a plain Node server, like Zubra: Lit, Enhance, Stencil, FAST and
  WebUI. FAST is rendered by WebUI, as FAST's docs recommend.
- **App frameworks**: SvelteKit, Next.js and Nuxt, each with its documented defaults. Next.js and
  Nuxt also have a tuned build: standalone output for Next.js, and one data call per page for Nuxt.
  I tuned them, and nobody has reviewed the tuning yet.

## Correctness

All twelve pass the same 11 tests, with JavaScript on and off, except **Next.js**. With JavaScript
off, `notFound()` answers 404 with an empty page. The "We can't find that order." message only
appears when JavaScript draws it. It happens with a bare one-line `notFound()` page too, and on
16.3.8 as well as 16.4.6. No build has an accessibility violation on the menu or the bag.

## What the numbers show

- **Download size, like for like.** Without its sync, Zubra sends 15.1 KB of JavaScript for the
  menu, almost all of it the 13.9 KB runtime. Enhance (5.2 KB), Lit (8.5) and Stencil (10) send
  less. FAST (28.5), WebUI (30.7), SvelteKit (38.3), Nuxt (73) and Next.js (132.4) send more.
  Zubra's sync adds 12.4 KB on top, for abilities this page doesn't use.
- **Update speed is a tie.** Once every build is told about a write as it happens, an update shows
  on an open page in 7 to 11 ms (median) in all twelve. An earlier run showed Zubra far ahead; that
  was my shared feed checking for changes every 250 ms, and it's fixed.
- **A slow phone (CPU 6× slower).**
  - Enhance loads the menu fastest (218 ms) and Next.js slowest (607 to 652).
  - SvelteKit answers the Add button fastest (321 ms), because its form updates the page without a
    full reload. Nuxt is slowest (about 820), because it reloads the page and runs its startup code
    again.
  - Blocking time is lowest in Stencil (0 ms), Enhance (51) and Zubra on the stream (132). It's
    highest in Nuxt (572 to 594) and Next.js (364 to 453).
  - Zubra's sync costs about 150 ms of extra blocking time here (288 against 132 without it).
- **Pages served.** On one pinned CPU, both Zubra builds served about 5,100 menu pages a second, the
  most. FAST (4,252) and WebUI (3,814) were next, on WebUI's native renderer, then Enhance (2,280),
  Lit (1,465) and SvelteKit (1,250). Nuxt tuned (463), Next.js (346 to 393), Stencil (354) and Nuxt
  untuned (165) were well behind.
- **Tuning matters for Nuxt, not for Next.js's speed.** One data call per page gave Nuxt 2.8 times
  the pages per second. Standalone output shrinks Next.js's deployment from 494 MB to 68 MB but
  doesn't change its speed, which is what it's for.
- **Memory under load.** WebUI (121 MB) and FAST (124) used the least, then Lit (167), Enhance
  (182) and Zubra (about 188). Next.js used the most (349 to 363).
- **Install and deploy size.** Zubra installs the fewest packages (3 or 4) and runs from 6 MB with
  no build step. After building, Enhance (1 MB), SvelteKit, Stencil (2 MB) and Nuxt (3 MB) deploy
  smaller. Lit, FAST and WebUI run from about 30 MB, and Next.js standalone from 68.
- **Upgrades.** Moving each build up one minor release went through with no code changes in all
  twelve. Running today's code on the older release failed in three places: Zubra 5.18 (the two
  live-update tests), WebUI 3.0.5 (an entry point that didn't exist yet) and Next.js (its known 404
  check, on both versions).
- **Developer experience.** Adding checkout touched 2 to 3 files in the single-server builds, and 5
  to 8 in the app frameworks, as their file-based routing expects. Each added 89 to 124 lines.
  SvelteKit, Nuxt, Lit, Enhance and Stencil passed all 11 tests on the first try. The notable
  surprises, all in `docs/compare/LOG.md`:
  - Next.js's 404 page.
  - WebUI and FAST templates silently rendering nothing for a missing state key, and needing every
    derived value worked out on the server.
  - SvelteKit 3 and Lit each needing a setting I didn't expect.

## Caveats

- **One author wrote all twelve,** Zubra first, and the order of work favors the later builds.
  Nobody who knows each framework well has reviewed them yet, including the tuned ones. Until they
  have, treat this as a well-documented first look, not a verdict.
- **Throughput is still a short run:** 3 runs of 10 s where the rules call for 9 of 30. The server is
  pinned to its own CPU, but the load generator shares this 2-CPU machine with the browsers. Trust
  the ratios more than the exact numbers.
- **Stencil's throughput** comes from its hydrate script parsing and serializing the whole document
  on every request. A Stencil reviewer may know a faster way.
- **FAST and WebUI share a renderer,** so their server numbers are WebUI's.
- **Lines of code is a weak measure.** The single-server builds keep their pages in one dense file;
  the app frameworks split them into the files they expect.
- **The page is still small.** The cost of growth (what each extra page or component adds) wasn't
  measured, and that's where the app frameworks' routing and bundling would pay off.

## Next steps

1. Get each build and each tuned setting reviewed against its framework's docs, and record the
   review in the branch.
2. Rerun throughput at full length with the load generator on its own machine.
3. Raise with Zubra: what its sync costs a page that only reads, why `webrtc.js` loads, and what
   changed between 5.18 and 5.19 for property updates.
4. Report Next.js's empty 404 page upstream with a minimal reproduction, if it reproduces in a fresh
   app.
5. Measure the cost of growth: add pages and components, and compare what each one adds.
