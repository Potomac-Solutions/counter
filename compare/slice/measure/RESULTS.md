# Slice results

Measured 2026-11-16 on 2 × Intel(R) Xeon(R) Processor @ 2.30GHz, 8 GB, Node v26.13.1, the server pinned to one CPU and the load generator and browsers to the other.
Medians of 3 builds, 5 starts, 3 Lighthouse runs, 3 load runs of 10 s at 50 connections, 12 menu updates and 12 order updates, and 5 slow-device runs.
Raw figures: `results.json`. What each measure means and how it's taken: `measure.mjs`.

## Zubra

| | zubra | zubra-stream |
| --- | ---: | ---: |
| Contract (of 11) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 20.2 | 15.5 |
| Script files on the menu | 4 | 3 |
| Menu HTML, gzip (KB) | 1.1 | 1.1 |
| Update shows on the menu, median / p90 (ms) | 8 / 9 | 6 / 8 |
| Update shows on the order page, median / p90 (ms) | 10 / 12 | 10 / 11 |
| Lighthouse, CPU 6× slower | 89 | 100 |
| Total blocking time, CPU 6× slower (ms) | 436 | 19 |
| Menu load event, CPU 6× slower (ms) | 358 | 249 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 470 | 444 |
| Lines of own code | 174 | 202 |
| Direct dependencies | 3 | 2 |
| Packages installed | 4 | 3 |
| node_modules (MB) | 6 | 6 |
| What runs in production (MB) | 6 | 6 |
| Build (s) | none | none |
| Start to first page (ms) | 165 | 130 |
| Memory idle (MB) | 89 | 89 |
| Memory under load (MB) | 199 | 193 |
| Menu pages per second | 6006 | 6147 |
| Latency p50 / p97.5 (ms) | 7 / 13 | 7 / 14 |
| Failed requests under load | 0 | 0 |
| Accessibility violations (menu, bag) | none | none |

## Web component libraries, each on a plain Node server

| | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 11 | 11 | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 8.5 | 5.2 | 10 | 28.5 | 30.7 |
| Script files on the menu | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 0.9 | 1.3 | 1.7 | 2 |
| Update shows on the menu, median / p90 (ms) | 6 / 7 | 6 / 8 | 6 / 8 | 6 / 7 | 6 / 8 |
| Update shows on the order page, median / p90 (ms) | 8 / 10 | 7 / 11 | 7 / 10 | 11 / 12 | 10 / 11 |
| Lighthouse, CPU 6× slower | 98 | 99 | 100 | 100 | 100 |
| Total blocking time, CPU 6× slower (ms) | 156 | 128 | 90 | 58 | 67 |
| Menu load event, CPU 6× slower (ms) | 263 | 221 | 339 | 399 | 323 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 499 | 437 | 519 | 579 | 545 |
| Lines of own code | 203 | 204 | 299 | 276 | 265 |
| Direct dependencies | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 30 | 14 | 27 | 44 | 41 |
| What runs in production (MB) | 30 | 1 | 2 | 29 | 29 |
| Build (s) | 0.0 | 0.0 | 4.2 | 0.1 | 0.1 |
| Start to first page (ms) | 133 | 102 | 124 | 94 | 87 |
| Memory idle (MB) | 84 | 76 | 85 | 69 | 69 |
| Memory under load (MB) | 179 | 180 | 268 | 139 | 139 |
| Menu pages per second | 1728 | 2658 | 357 | 5561 | 4628 |
| Latency p50 / p97.5 (ms) | 26 / 47 | 16 / 31 | 126 / 195 | 8 / 9 | 10 / 17 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |

## App frameworks (tuned: set up for production by the author, not yet reviewed)

| | sveltekit | nextjs | nextjs-tuned | nuxt | nuxt-tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 10 (fails S8) | 10 (fails S8) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 38.3 | 132.4 | 132.4 | 73 | 73 |
| Script files on the menu | 12 | 6 | 6 | 3 | 3 |
| Menu HTML, gzip (KB) | 1.5 | 2.2 | 2.2 | 2.1 | 1.6 |
| Update shows on the menu, median / p90 (ms) | 8 / 11 | 8 / 10 | 6.5 / 8 | 6 / 8 | 8 / 11 |
| Update shows on the order page, median / p90 (ms) | 8 / 10 | 7.5 / 12 | 7 / 10 | 8 / 12 | 8.5 / 10 |
| Lighthouse, CPU 6× slower | 93 | 92 | 94 | 93 | 92 |
| Total blocking time, CPU 6× slower (ms) | 304 | 362 | 276 | 331 | 362 |
| Menu load event, CPU 6× slower (ms) | 245 | 494 | 426 | 308 | 286 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 298 | 395 | 358 | 522 | 526 |
| Lines of own code | 313 | 334 | 339 | 246 | 237 |
| Direct dependencies | 4 | 4 | 4 | 2 | 2 |
| Packages installed | 79 | 55 | 55 | 605 | 605 |
| node_modules (MB) | 76 | 463 | 463 | 228 | 228 |
| What runs in production (MB) | 2 | 494 | 68 | 3 | 3 |
| Build (s) | 1.9 | 8.8 | 9.0 | 5.5 | 6.0 |
| Start to first page (ms) | 109 | 441 | 442 | 212 | 184 |
| Memory idle (MB) | 70 | 107 | 108 | 95 | 87 |
| Memory under load (MB) | 263 | 369 | 351 | 308 | 277 |
| Menu pages per second | 1865 | 504 | 385 | 190 | 535 |
| Latency p50 / p97.5 (ms) | 24 / 51 | 88 / 185 | 119 / 221 | 247 / 366 | 89 / 149 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |
