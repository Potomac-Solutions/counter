# Upgrade drill

Each build was copied, moved back to the previous minor release of its main packages, built and run
against the contract, then upgraded to the version the slice uses and checked again. No code was
changed by hand. Run 2026-11-16; raw figures in `upgrade.json`.

| Build | From | To | Contract on the old version | Upgrade install (s) | Contract after upgrading |
| --- | --- | --- | --- | ---: | --- |
| zubra | @zubra/runtime 5.18.0, @zubra/server 5.18.0, @zubra/sync 5.18.0 | 5.19.0, 5.19.0, 5.19.0 | 9 of 11 (fails S8, S6) | 0.9 | 11 of 11 |
| zubra-stream | @zubra/runtime 5.18.0, @zubra/server 5.18.0 | 5.19.0, 5.19.0 | 9 of 11 (fails S8, S6) | 0.9 | 11 of 11 |
| nextjs | next 16.3.8 | 16.4.6 | 10 of 11 (fails S8) | 7.7 | 10 of 11 (fails S8) |
| nextjs-tuned | next 16.3.8 | 16.4.6 | 10 of 11 (fails S8) | 7.3 | 10 of 11 (fails S8) |
| nuxt-tuned | nuxt 4.5.2 | 4.6.4 | 11 of 11 | 7.5 | 11 of 11 |
| sveltekit | @sveltejs/kit 3.1.1, svelte 5.57.1 | 3.2.0, 5.57.3 | 11 of 11 | 2.3 | 11 of 11 |
| nuxt | nuxt 4.5.2 | 4.6.4 | 11 of 11 | 6.6 | 11 of 11 |
| lit | lit 3.2.1, @lit-labs/ssr 4.0.0 | 3.3.3, 4.1.0 | 11 of 11 | 1.0 | 11 of 11 |
| enhance | @enhance/ssr 3.5.2, @enhance/element 1.4.5 | 4.0.3, 1.4.6 | 11 of 11 | 0.4 | 11 of 11 |
| stencil | @stencil/core 4.44.2 | 4.45.3 | 11 of 11 | 0.8 | 11 of 11 |
| fast | @microsoft/fast-element 3.0.4, @microsoft/webui 3.0.5 | 3.1.4, 3.1.2 | 11 of 11 | 1.1 | 11 of 11 |
| webui | @microsoft/webui 3.0.5, @microsoft/webui-framework 3.0.5 | 3.1.2, 3.1.2 | build failed | 1.0 | 11 of 11 |

## Reading this table

- **The "old version" column runs today's code on an older release.** A failure there means the code
  relies on something the newer release added or fixed. It is not proof that upgrading an app
  written for the old release would break. A truer drill would write each build against the old
  release first, and the rules plan for that once builds are reviewed.
- **Every upgrade went through with no code changes.** All twelve builds pass the same tests after
  upgrading as they did before this drill.
- **Zubra 5.18:** today's code fails both live-update tests (S6, S8) on 5.18. That includes the build
  without `@zubra/sync`, so the difference is in `@zubra/runtime` or `@zubra/server`, not the sync. Not
  investigated further here.
- **WebUI 3.0.5:** doesn't build, because `@microsoft/webui-framework/runtime.js`, the entry point
  WebUI's 3.1 docs say to use, doesn't exist in 3.0.
- **Next.js:** S8 (the 404 page without JavaScript) fails on both 16.3.8 and 16.4.6.
- **Enhance:** `@enhance/ssr` 4.0 has no earlier 4.x minor, so its drill crosses a major (3.5.2 to 4.0.3).
- **SvelteKit:** kit 3.1.1 needs svelte 5.57.1 or later, so svelte goes back only to 5.57.1.
- **Install times** are one run each, on a warm npm cache. They mostly show download size.
