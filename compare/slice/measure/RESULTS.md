# Slice results

Measured 2026-11-16 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1, the server pinned to one CPU and the load generator and browsers to the other.
Medians of 3 builds, 5 starts, 3 Lighthouse runs, 3 load runs of 10 s at 50 connections, 12 menu updates and 12 order updates, and 5 slow-device runs.
Raw figures: `results.json`. What each measure means and how it's taken: `measure.mjs`.

## Zubra

| | zubra | zubra-stream |
| --- | ---: | ---: |
| Contract (of 11) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 27.5 | 15.1 |
| Script files on the menu | 5 | 3 |
| Menu HTML, gzip (KB) | 1.1 | 1.1 |
| Update shows on the menu, median / p90 (ms) | 9 / 11 | 7.5 / 9 |
| Update shows on the order page, median / p90 (ms) | 9 / 11 | 8 / 11 |
| Lighthouse, CPU 6× slower | 94 | 99 |
| Total blocking time, CPU 6× slower (ms) | 288 | 132 |
| Menu load event, CPU 6× slower (ms) | 433 | 324 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 532 | 490 |
| Lines of own code | 174 | 202 |
| Direct dependencies | 3 | 2 |
| Packages installed | 4 | 3 |
| node_modules (MB) | 6 | 6 |
| What runs in production (MB) | 6 | 6 |
| Build (s) | none | none |
| Start to first page (ms) | 174 | 167 |
| Memory idle (MB) | 87 | 87 |
| Memory under load (MB) | 187 | 189 |
| Menu pages per second | 5139 | 5137 |
| Latency p50 / p97.5 (ms) | 8 / 19 | 8 / 18 |
| Failed requests under load | 0 | 0 |
| Accessibility violations (menu, bag) | none | none |

## Web component libraries, each on a plain Node server

| | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 11 | 11 | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 8.5 | 5.2 | 10 | 28.5 | 30.7 |
| Script files on the menu | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 0.9 | 1.3 | 1.7 | 2 |
| Update shows on the menu, median / p90 (ms) | 7 / 9 | 7 / 9 | 7 / 9 | 7 / 8 | 8 / 10 |
| Update shows on the order page, median / p90 (ms) | 8 / 10 | 9 / 13 | 10 / 11 | 10.5 / 12 | 11 / 12 |
| Lighthouse, CPU 6× slower | 98 | 100 | 100 | 93 | 99 |
| Total blocking time, CPU 6× slower (ms) | 150 | 51 | 0 | 306 | 135 |
| Menu load event, CPU 6× slower (ms) | 329 | 218 | 327 | 380 | 274 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 471 | 411 | 492 | 537 | 499 |
| Lines of own code | 203 | 204 | 299 | 276 | 265 |
| Direct dependencies | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 30 | 14 | 25 | 44 | 41 |
| What runs in production (MB) | 30 | 1 | 2 | 29 | 29 |
| Build (s) | 0.0 | 0.0 | 4.7 | 0.1 | 0.1 |
| Start to first page (ms) | 154 | 120 | 140 | 106 | 95 |
| Memory idle (MB) | 82 | 74 | 83 | 67 | 67 |
| Memory under load (MB) | 167 | 182 | 257 | 124 | 121 |
| Menu pages per second | 1465 | 2280 | 354 | 4252 | 3814 |
| Latency p50 / p97.5 (ms) | 31 / 59 | 20 / 40 | 125 / 230 | 11 / 20 | 11 / 26 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |

## App frameworks (tuned: set up for production by the author, not yet reviewed)

| | sveltekit | nextjs | nextjs-tuned | nuxt | nuxt-tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 10 (fails S8) | 10 (fails S8) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 38.3 | 132.4 | 132.4 | 73 | 73 |
| Script files on the menu | 12 | 6 | 6 | 3 | 3 |
| Menu HTML, gzip (KB) | 1.5 | 2.2 | 2.2 | 2.1 | 1.6 |
| Update shows on the menu, median / p90 (ms) | 9 / 10 | 9.5 / 13 | 8 / 12 | 8.5 / 11 | 9.5 / 11 |
| Update shows on the order page, median / p90 (ms) | 10 / 11 | 9.5 / 12 | 10.5 / 12 | 10 / 11 | 11 / 16 |
| Lighthouse, CPU 6× slower | 95 | 92 | 89 | 85 | 86 |
| Total blocking time, CPU 6× slower (ms) | 257 | 364 | 453 | 594 | 572 |
| Menu load event, CPU 6× slower (ms) | 375 | 607 | 652 | 323 | 345 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 321 | 565 | 477 | 830 | 819 |
| Lines of own code | 313 | 334 | 339 | 246 | 237 |
| Direct dependencies | 4 | 4 | 4 | 2 | 2 |
| Packages installed | 79 | 55 | 55 | 605 | 605 |
| node_modules (MB) | 46 | 463 | 463 | 197 | 228 |
| What runs in production (MB) | 2 | 494 | 68 | 3 | 3 |
| Build (s) | 2.4 | 10.5 | 11.8 | 8.1 | 7.5 |
| Start to first page (ms) | 150 | 527 | 540 | 280 | 261 |
| Memory idle (MB) | 69 | 107 | 106 | 94 | 86 |
| Memory under load (MB) | 255 | 363 | 349 | 296 | 267 |
| Menu pages per second | 1250 | 393 | 346 | 165 | 463 |
| Latency p50 / p97.5 (ms) | 35 / 72 | 115 / 224 | 132 / 249 | 269 / 427 | 98 / 158 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |
