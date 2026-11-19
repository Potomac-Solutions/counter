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

Measured again on 2026-11-18 with Zubra 5.23.0, every build on one machine. The other eleven
builds are on the versions they had. Both Zubra builds use what 5.21 added (the Add form names the
parts of the page it updates, so its post doesn't reload the page; the sync build's pages follow
the log read-only) and now what 5.23.0 added: the runtime is built for the app when the server
starts (`buildRuntime()`, which needs esbuild, one more dependency for each build), so it holds
only what the app's components use. The machine's speed moves between runs (the same build has
differed by up to a third within a day), so compare builds within a run, not across runs.

- **Download size.** Without sync Zubra sends 12.5 KB in 4 files; with sync 16 KB in 5. Release by
  release: 5.20.0 15.5 and 20.2 KB, 5.21.1 16.5 and 19.9 (the form script, 1 KB, came onto the
  page), 5.22.0 14 and 17.4, 5.23.0 12.5 and 16. Enhance (5.2 KB), Lit (8.5) and Stencil (10) send
  less. FAST (28.5), WebUI (30.7), SvelteKit (38.3), Nuxt (73) and Next.js (132.4) send more.
- **A slow phone (CPU 6× slower): Zubra answers the Add button fastest.** Zubra on the stream
  takes 243 ms and with sync 288, then SvelteKit (383). The rest take 544 to 806. On 5.20.0 Zubra
  was behind SvelteKit, Next.js tuned and Enhance.
- **Update speed is a tie.** An update shows on an open page in 6 to 10 ms (median) in all twelve.
- **Menu load.** Enhance (292 ms), WebUI (338) and Lit (363) load the menu fastest; Zubra takes
  438 to 450, beside SvelteKit (388), FAST (397) and Stencil (402). Next.js is slowest (597 to
  677). Zubra's figure was 325 to 342 on the 5.21.1 run and 350 to 402 on the 5.22.0 one, each
  with a larger runtime file than this, so the movement is the machine. Zubra runs about 20 ms
  more script than Lit or Enhance while loading (a CPU profile on 5.21: about 67 ms against 47,
  spread across the runtime with no one slow function); the rest of the gap is inside the
  run-to-run noise of this measure.
- **Blocking time still isn't ranked.** It has moved too much between runs of the same build: in
  this run Zubra with sync gave 399 ms and Zubra on the stream 166, from nearly the same runtime.
- **Pages served.** On one pinned CPU, both Zubra builds served the most menu pages a second
  (4,494 to 4,823), then WebUI (3,806) and FAST (3,741), Enhance (2,020), Lit (1,318) and SvelteKit
  (1,245). Nuxt tuned (400), Next.js (358 to 364), Stencil (332) and Nuxt untuned (171) were well
  behind.
- **5.20.0 didn't slow the server.** The audit of Zubra's `main` (`AUDIT-2026-11-16.md`) saw up to
  20% fewer pages a second. On this machine 5.19.0 served 6,139 (sync) and 5,836 (stream), and
  5.20.0 served 6,006 and 6,147, then 5,991 and 5,840 on a second run: no difference outside the
  noise. Raw figures: `zubra-5.19-same-machine.json` and `zubra-5.20-rerun.json`.
- **Tuning matters for Nuxt, not for Next.js's speed.** One data call per page gave Nuxt 2.8 times
  the pages per second. Standalone output shrinks Next.js's deployment from 494 MB to 68 MB but
  doesn't change its speed, which is what it's for.
- **Memory under load.** FAST and WebUI (139 MB) used the least, then Lit (179), Enhance (180) and
  Zubra (193 to 199). Next.js used the most (351 to 369).
- **Install and deploy size.** Zubra installs the fewest packages (3 or 4) and runs from 6 MB with
  no build step. After building, Enhance (1 MB), SvelteKit, Stencil (2 MB) and Nuxt (3 MB) deploy
  smaller. Lit, FAST and WebUI run from about 30 MB, and Next.js standalone from 68.
- **Upgrades.** Moving each build up one minor release went through with no code changes in all
  twelve (`UPGRADE.md`, run on 5.19.0), and so did Zubra's move from 5.19.0 to 5.20.0: both builds
  pass 11 of 11 with only the version numbers changed. Zubra 5.18's two failures in that drill
  were a 5.19.0 compiler installed beside a 5.18.0 runtime (journey-to-code-org/zubra#324), not a
  change in how properties update. From 5.20.0, npm refuses that pairing.
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
- **Blocking time needs more runs.** See above: it isn't ranked in this round.
- **Zubra 5.20.0's fallback for components compiled by an older release wasn't exercised:** these
  builds compile with the matching compiler.
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
3. Zubra: nothing raised here is open. The read-only connection (journey-to-code-org/zubra#319)
   shipped in 5.21.0, the minified form script in 5.21.1, the smaller runtime file in 5.22.0 and
   the runtime built for the app in 5.23.0. What is left between Zubra and Lit or Enhance on size
   is the Signals implementation and the element's core, which run on every page.
4. Report Next.js's empty 404 page upstream with a minimal reproduction, if it reproduces in a fresh
   app.
5. Measure the cost of growth: add pages and components, and compare what each one adds.
