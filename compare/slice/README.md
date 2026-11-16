# Counter's slice, nine ways

The same slice of Counter (menu with live stock, bag, pickup time) built in
Zubra, three app frameworks (Next.js, SvelteKit, Nuxt) and five web component
libraries (Lit, Enhance, Stencil, FAST, WebUI), on the same backend, stylesheet
and contract. `SPEC.md` says what the slice is; `docs/compare/RULES.md` says how
it's compared; `measure/RESULTS.md` has the numbers.

| Build | Framework | Live updates through |
| --- | --- | --- |
| `zubra/` | `@zubra/server` 5.19.0, plain Node | `@zubra/sync`: each menu item is a sync document |
| `nextjs/` | Next.js 16.4.6, App Router, React 19.3.1 | A route handler streaming server-sent events, a client component |
| `sveltekit/` | SvelteKit 3.2.0, Svelte 5.57.3, adapter-node | A `+server.js` streaming server-sent events, runes |
| `nuxt/` | Nuxt 4.6.4, Vue 3.5.45 | An h3 event stream, a ref |
| `lit/` | Lit 3.3.3, `@lit-labs/ssr` 4.1.0, plain Node | Server-sent events, a hydrated Lit element |
| `enhance/` | `@enhance/ssr` 4.0.3, `@enhance/element` 1.4.6, plain Node | Server-sent events, the same render function re-run in the browser |
| `stencil/` | Stencil 4.45.3 hydrate script, plain Node | Server-sent events, a hydrated Stencil component |
| `fast/` | FAST 3.1.4 declarative templates, rendered by WebUI 3.1.2's `fast-v3` plugin | Server-sent events, a hydrated FAST element |
| `webui/` | WebUI 3.1.2 and its framework, plain Node | Server-sent events, a hydrated WebUI component |

The web component builds each run on a plain Node server like the Zubra build,
using their own server renderer so they work without JavaScript. FAST's own
docs recommend WebUI for production server rendering, so the FAST build is
FAST components rendered by WebUI. The WebUI build uses WebUI's own components.

`shared/` is Counter's own backend (`src/counter.js` on the kit) behind one
small interface, plus the stylesheet. It's a local package every build depends
on and none counts in its lines.

## Rerun it

Needs Node 26 and Counter's own `npm install` at the repo root.

```sh
cd compare/slice
for build in zubra nextjs sveltekit nuxt lit enhance stencil fast webui; do (cd $build && npm install && npm run build --if-present); done

# the contract, against one build
(cd nextjs && SLICE_CONTROL_PORT=3199 PORT=3101 npm start) &
BASE=http://localhost:3101 CONTROL=3199 node --test contract/

# the measurements, all nine (about 30 minutes)
cd measure && npm install && LOAD_SECONDS=10 node measure.mjs
```

## What each build needed that the others didn't

- **SvelteKit** refuses every form post as cross-site unless it's told its
  public address (`ORIGIN`). Its 3.0 release also moved the config into the
  Vite plugin and replaced `$lib` with Node's `#lib` subpath imports.
- **Next.js** server components can't set cookies, so a guest's cookie is set
  by the first server action. The SvelteKit and Nuxt builds do the same, to
  match. The Zubra build sets it on the first page.
- **Nuxt** has no form actions. Its forms post to server routes, and with
  JavaScript on the page still reloads after a post. Nitro bundled the shared
  backend into its server output even when told to leave it external.
- **Lit** can't bind inside `<title>` on the server, so the document head is
  plain text and Lit renders the body.
- **Enhance**'s `bodyContent` option keeps only the body's first element, so it
  expands `<main>` alone. Its templates are plain strings: escaping is the
  author's job.
- **Stencil** builds twice, once for the browser and once as a hydrate script
  for the server. Rendering a page parses and serializes the whole document.
- **WebUI** templates can't do arithmetic, so the server works out every value
  (prices, "one more" and "one fewer"). Its components need TypeScript's legacy
  decorators, and a value set before hydration is a mismatch, so "no limit" is
  `left = -1` rather than a separate flag.
- **FAST** is WebUI's renderer with FAST's declarative templates. Its item lives
  in a shadow root, so the item links the shared stylesheet itself (as Lit's does).
- **Zubra** keeps the menu live with its own sync, not the shared feed the
  others use. The shared feed checks the store every 250 ms; Zubra's sync pushes
  a write when it happens.
