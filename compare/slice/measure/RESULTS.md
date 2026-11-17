# Slice results

Measured 2026-11-17 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1, the server pinned to one CPU and the load generator and browsers to the other.
Medians of 3 builds, 5 starts, 3 Lighthouse runs, 3 load runs of 10 s at 50 connections, 12 menu updates and 12 order updates, and 5 slow-device runs.
Raw figures: `results.json`. What each measure means and how it's taken: `measure.mjs`.

## Zubra

| | zubra | zubra-stream |
| --- | ---: | ---: |
| Contract (of 11) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 17.4 | 14 |
| Script files on the menu | 5 | 4 |
| Menu HTML, gzip (KB) | 1.2 | 1.1 |
| Update shows on the menu, median / p90 (ms) | 9 / 12 | 7 / 9 |
| Update shows on the order page, median / p90 (ms) | 7.5 / 11 | 10 / 12 |
| Lighthouse, CPU 6× slower | 92 | 99 |
| Total blocking time, CPU 6× slower (ms) | 360 | 123 |
| Menu load event, CPU 6× slower (ms) | 350 | 402 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 241 | 281 |
| Lines of own code | 178 | 206 |
| Direct dependencies | 4 | 3 |
| Packages installed | 5 | 4 |
| node_modules (MB) | 7 | 7 |
| What runs in production (MB) | 7 | 7 |
| Build (s) | none | none |
| Start to first page (ms) | 195 | 189 |
| Memory idle (MB) | 88 | 87 |
| Memory under load (MB) | 215 | 184 |
| Menu pages per second | 4532 | 4456 |
| Latency p50 / p97.5 (ms) | 10 / 20 | 9 / 20 |
| Failed requests under load | 0 | 0 |
| Accessibility violations (menu, bag) | none | none |

## Web component libraries, each on a plain Node server

| | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 11 | 11 | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 8.5 | 5.2 | 10 | 28.5 | 30.7 |
| Script files on the menu | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 0.9 | 1.3 | 1.7 | 2 |
| Update shows on the menu, median / p90 (ms) | 7 / 8 | 7 / 14 | 7 / 8 | 7 / 9 | 7 / 8 |
| Update shows on the order page, median / p90 (ms) | 10 / 13 | 9 / 13 | 10 / 14 | 10.5 / 15 | 10.5 / 13 |
| Lighthouse, CPU 6× slower | 99 | 97 | 100 | 99 | 93 |
| Total blocking time, CPU 6× slower (ms) | 126 | 186 | 52 | 137 | 313 |
| Menu load event, CPU 6× slower (ms) | 280 | 302 | 316 | 366 | 313 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 529 | 515 | 488 | 557 | 610 |
| Lines of own code | 203 | 204 | 299 | 276 | 265 |
| Direct dependencies | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 30 | 14 | 27 | 44 | 41 |
| What runs in production (MB) | 30 | 1 | 2 | 29 | 29 |
| Build (s) | 0.0 | 0.0 | 5.6 | 0.1 | 0.1 |
| Start to first page (ms) | 172 | 142 | 165 | 139 | 134 |
| Memory idle (MB) | 82 | 75 | 82 | 67 | 68 |
| Memory under load (MB) | 165 | 172 | 229 | 125 | 121 |
| Menu pages per second | 1366 | 2001 | 311 | 3492 | 3532 |
| Latency p50 / p97.5 (ms) | 32 / 62 | 22 / 42 | 143 / 214 | 12 / 24 | 12 / 24 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |

## App frameworks (tuned: set up for production by the author, not yet reviewed)

| | sveltekit | nextjs | nextjs-tuned | nuxt | nuxt-tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 10 (fails S7) | 10 (fails S8) | 10 (fails S8) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 38.3 | 132.4 | 132.4 | 73 | 73 |
| Script files on the menu | 12 | 6 | 6 | 3 | 3 |
| Menu HTML, gzip (KB) | 1.5 | 2.2 | 2.2 | 2.1 | 1.6 |
| Update shows on the menu, median / p90 (ms) | 7.5 / 9 | 8 / 10 | 8 / 9 | 7 / 9 | 7.5 / 11 |
| Update shows on the order page, median / p90 (ms) | 10 / 11 | 10 / 11 | 10 / 11 | 10 / 13 | 10 / 12 |
| Lighthouse, CPU 6× slower | 94 | 89 | 87 | 87 | 86 |
| Total blocking time, CPU 6× slower (ms) | 296 | 452 | 515 | 516 | 551 |
| Menu load event, CPU 6× slower (ms) | 314 | 577 | 680 | 344 | 399 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 315 | 477 | 507 | 695 | 782 |
| Lines of own code | 313 | 334 | 339 | 246 | 237 |
| Direct dependencies | 4 | 4 | 4 | 2 | 2 |
| Packages installed | 79 | 55 | 55 | 605 | 605 |
| node_modules (MB) | 76 | 463 | 463 | 228 | 228 |
| What runs in production (MB) | 2 | 494 | 68 | 3 | 3 |
| Build (s) | 2.6 | 10.9 | 12.0 | 8.4 | 8.0 |
| Start to first page (ms) | 148 | 553 | 558 | 344 | 286 |
| Memory idle (MB) | 69 | 105 | 106 | 93 | 86 |
| Memory under load (MB) | 253 | 346 | 350 | 300 | 259 |
| Menu pages per second | 1334 | 370 | 339 | 171 | 447 |
| Latency p50 / p97.5 (ms) | 32 / 74 | 124 / 216 | 128 / 268 | 273 / 388 | 100 / 168 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |
