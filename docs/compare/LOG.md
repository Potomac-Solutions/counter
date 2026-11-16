# Comparison log: developer experience

What adding checkout and the live order page took in each build: the files and lines it touched,
and every build error or surprise along the way. One author wrote all of them, in this order: Zubra,
Next.js, SvelteKit, Nuxt, Lit, Enhance, Stencil, WebUI, FAST. Later builds benefit from what the
earlier ones taught, which favours the ones done last. Time per build wasn't recorded separately.

## The checkout change, per build

Counted from the commit before the change (`47719f4`: spec, backend and contract) to each build's
checkout commit, lockfiles left out.

| Build | Files touched | Lines added | Lines removed | Passed the contract first time |
| --- | ---: | ---: | ---: | --- |
| Zubra | 2 | 60 | 1 | no: the contract's bad email was blocked by the browser (a contract fix, not Zubra's) |
| Next.js | 7 | 124 | 0 | no, and still fails one check (below) |
| SvelteKit | 7 | 116 | 0 | yes |
| Nuxt | 8 | 95 | 0 | yes |
| Lit | 3 | 90 | 20 | yes |
| Enhance | 3 | 89 | 22 | yes |
| Stencil | 3 | 95 | 22 | yes |
| WebUI | 5 | 94 | 13 | no: my own missing state key (below) |
| FAST | 5 | 99 | 13 | no: the same missing key |

The app frameworks spread a feature across more files (a page, a server file, a route for the
stream, an error page), as their file-based routing expects. The single-server builds change their
one server file and add one component.

## Notes, per build

### zubra
- Live order page: reused Counter's sync scope (a guest reads only their own orders); one new .zb component.
- Gotchas: none in the build itself.
### zubra-stream
- Swapping @zubra/sync for event streams: components take plain props; a 15-line page script sets them.
### nextjs
- Fails one contract check: `notFound()` answers 404 but the HTML is an empty `__next_error__` shell; "We can't find that order." is drawn by JavaScript. Same with a bare `notFound()` page, a route-level not-found.js, and a static root layout. Unknown addresses render the not-found page in HTML. Next.js 16.4.6, `next start`.
- An old `next-server` process outlived `pkill -f "next start"` (its process title is `next-server`), so two checks ran against a stale build before I noticed.
### sveltekit
- Passed all 11 first time. `error(404)` in `load` plus `+error.svelte` renders the 404 page in HTML.
### nuxt
- Passed all 11 first time. `createError({ fatal: true })` in the page plus `error.vue` renders the 404 page in HTML; `error.vue` replaces the app shell, so it links the stylesheet itself.
- A redirect from a page (empty bag) is `navigateTo(…, { redirectCode: 303 })` after `useFetch`; the page has to guard its own template while the redirect is pending.
### lit
- Passed all 11 first time. One more element (slice-steps), hydrated like the item.

### enhance
- Passed all 11 first time. One more pure-function element; the page sets its `status` attribute.

### stencil
- Passed all 11 first time. One more component; needs a rebuild of both the browser and hydrate outputs.

### webui
- Templates can't compare positions, so the steps component spells out each of the four statuses (16 list items).
- A state key I forgot (`live`) rendered nothing and raised nothing: the page silently lost its script tag and the live menu stopped. WebUI's docs say missing paths render empty by design.
- Carried over from the first round: legacy decorators needed a tsconfig; a value set before hydration is a mismatch, so "no limit" is `left = -1`.

### fast
- Same templates and gotchas as WebUI (it renders through WebUI's fast-v3 plugin), in FAST's `<f-when>` syntax.

### nextjs, nextjs-tuned (from the upgrade drill)
- The default build only finds the shared backend because Next.js guesses the repo's root from the
  outer lockfile (it warns about this on every start). Copied without that lockfile, it fails to
  build. The tuned build sets `outputFileTracingRoot` and doesn't depend on the guess.
