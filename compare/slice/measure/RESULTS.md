# Slice results

Measured 2026-11-17 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1, the server pinned to one CPU and the load generator and browsers to the other.
Medians of 3 builds, 5 starts, 3 Lighthouse runs, 3 load runs of 10 s at 50 connections, 12 menu updates and 12 order updates, and 5 slow-device runs.
Raw figures: `results.json`. What each measure means and how it's taken: `measure.mjs`.

## Zubra

| | zubra | zubra-stream |
| --- | ---: | ---: |
| Contract (of 11) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 19.9 | 16.5 |
| Script files on the menu | 5 | 4 |
| Menu HTML, gzip (KB) | 1.2 | 1.1 |
| Update shows on the menu, median / p90 (ms) | 7.5 / 13 | 7 / 8 |
| Update shows on the order page, median / p90 (ms) | 7.5 / 10 | 8 / 10 |
| Lighthouse, CPU 6× slower | 97 | 97 |
| Total blocking time, CPU 6× slower (ms) | 200 | 203 |
| Menu load event, CPU 6× slower (ms) | 325 | 342 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 237 | 233 |
| Lines of own code | 178 | 206 |
| Direct dependencies | 4 | 3 |
| Packages installed | 5 | 4 |
| node_modules (MB) | 7 | 6 |
| What runs in production (MB) | 7 | 6 |
| Build (s) | none | none |
| Start to first page (ms) | 216 | 180 |
| Memory idle (MB) | 88 | 88 |
| Memory under load (MB) | 185 | 184 |
| Menu pages per second | 4658 | 4719 |
| Latency p50 / p97.5 (ms) | 9 / 19 | 9 / 19 |
| Failed requests under load | 0 | 0 |
| Accessibility violations (menu, bag) | none | none |

## Web component libraries, each on a plain Node server

| | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 11 | 11 | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 8.5 | 5.2 | 10 | 28.5 | 30.7 |
| Script files on the menu | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 0.9 | 1.3 | 1.7 | 2 |
| Update shows on the menu, median / p90 (ms) | 8 / 9 | 7 / 9 | 7 / 9 | 7 / 9 | 7 / 8 |
| Update shows on the order page, median / p90 (ms) | 7.5 / 13 | 7 / 11 | 7 / 12 | 7 / 11 | 8.5 / 12 |
| Lighthouse, CPU 6× slower | 98 | 100 | 97 | 96 | 96 |
| Total blocking time, CPU 6× slower (ms) | 162 | 59 | 190 | 232 | 237 |
| Menu load event, CPU 6× slower (ms) | 283 | 286 | 353 | 428 | 326 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 567 | 597 | 550 | 695 | 557 |
| Lines of own code | 203 | 204 | 299 | 276 | 265 |
| Direct dependencies | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 30 | 14 | 27 | 44 | 41 |
| What runs in production (MB) | 30 | 1 | 2 | 29 | 29 |
| Build (s) | 0.0 | 0.0 | 6.0 | 0.1 | 0.1 |
| Start to first page (ms) | 160 | 140 | 174 | 117 | 129 |
| Memory idle (MB) | 83 | 75 | 77 | 67 | 68 |
| Memory under load (MB) | 161 | 165 | 312 | 121 | 122 |
| Menu pages per second | 1254 | 1817 | 305 | 3286 | 3754 |
| Latency p50 / p97.5 (ms) | 35 / 68 | 23 / 49 | 147 / 233 | 13 / 25 | 12 / 23 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |

## App frameworks (tuned: set up for production by the author, not yet reviewed)

| | sveltekit | nextjs | nextjs-tuned | nuxt | nuxt-tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 10 (fails S7) | 10 (fails S8) | 10 (fails S8) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 38.3 | 132.4 | 132.4 | 73 | 73 |
| Script files on the menu | 12 | 6 | 6 | 3 | 3 |
| Menu HTML, gzip (KB) | 1.5 | 2.2 | 2.2 | 1.8 | 1.6 |
| Update shows on the menu, median / p90 (ms) | 8 / 8 | 8 / 10 | 7 / 13 | 7.5 / 10 | 8 / 11 |
| Update shows on the order page, median / p90 (ms) | 8.5 / 11 | 6 / 8 | 6.5 / 8 | 8 / 12 | 8 / 14 |
| Lighthouse, CPU 6× slower | 95 | 87 | 88 | 84 | 84 |
| Total blocking time, CPU 6× slower (ms) | 269 | 526 | 469 | 654 | 650 |
| Menu load event, CPU 6× slower (ms) | 332 | 556 | 606 | 429 | 403 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 333 | 426 | 489 | 766 | 748 |
| Lines of own code | 313 | 334 | 339 | 246 | 237 |
| Direct dependencies | 4 | 4 | 4 | 2 | 2 |
| Packages installed | 79 | 55 | 55 | 605 | 605 |
| node_modules (MB) | 76 | 463 | 463 | 228 | 228 |
| What runs in production (MB) | 2 | 494 | 68 | 3 | 3 |
| Build (s) | 2.7 | 11.1 | 12.6 | 8.5 | 10.1 |
| Start to first page (ms) | 156 | 595 | 534 | 328 | 319 |
| Memory idle (MB) | 69 | 105 | 106 | 92 | 86 |
| Memory under load (MB) | 260 | 346 | 344 | 284 | 257 |
| Menu pages per second | 1112 | 336 | 342 | 210 | 480 |
| Latency p50 / p97.5 (ms) | 39 / 74 | 135 / 262 | 133 / 243 | 215 / 327 | 97 / 158 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |
