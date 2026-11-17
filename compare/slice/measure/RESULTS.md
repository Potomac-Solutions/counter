# Slice results

Measured 2026-11-17 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1, the server pinned to one CPU and the load generator and browsers to the other.
Medians of 3 builds, 5 starts, 3 Lighthouse runs, 3 load runs of 10 s at 50 connections, 12 menu updates and 12 order updates, and 5 slow-device runs.
Raw figures: `results.json`. What each measure means and how it's taken: `measure.mjs`.

## Zubra

| | zubra | zubra-stream |
| --- | ---: | ---: |
| Contract (of 11) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 20.7 | 17.3 |
| Script files on the menu | 5 | 4 |
| Menu HTML, gzip (KB) | 1.2 | 1.1 |
| Update shows on the menu, median / p90 (ms) | 9 / 11 | 7.5 / 8 |
| Update shows on the order page, median / p90 (ms) | 7.5 / 13 | 10 / 19 |
| Lighthouse, CPU 6× slower | 90 | 90 |
| Total blocking time, CPU 6× slower (ms) | 393 | 400 |
| Menu load event, CPU 6× slower (ms) | 445 | 433 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 329 | 306 |
| Lines of own code | 178 | 206 |
| Direct dependencies | 4 | 3 |
| Packages installed | 5 | 4 |
| node_modules (MB) | 7 | 6 |
| What runs in production (MB) | 7 | 6 |
| Build (s) | none | none |
| Start to first page (ms) | 229 | 207 |
| Memory idle (MB) | 88 | 88 |
| Memory under load (MB) | 200 | 184 |
| Menu pages per second | 4074 | 3722 |
| Latency p50 / p97.5 (ms) | 10 / 21 | 11 / 23 |
| Failed requests under load | 0 | 0 |
| Accessibility violations (menu, bag) | none | none |

## Web component libraries, each on a plain Node server

| | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 11 | 11 | 11 | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 8.5 | 5.2 | 10 | 28.5 | 30.7 |
| Script files on the menu | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 0.9 | 1.3 | 1.7 | 2 |
| Update shows on the menu, median / p90 (ms) | 6 / 9 | 6.5 / 11 | 7 / 11 | 7 / 11 | 7 / 9 |
| Update shows on the order page, median / p90 (ms) | 8.5 / 12 | 10 / 14 | 10 / 12 | 10 / 14 | 9 / 14 |
| Lighthouse, CPU 6× slower | 98 | 94 | 99 | 96 | 98 |
| Total blocking time, CPU 6× slower (ms) | 172 | 278 | 133 | 244 | 152 |
| Menu load event, CPU 6× slower (ms) | 316 | 314 | 371 | 479 | 327 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 538 | 578 | 610 | 699 | 557 |
| Lines of own code | 203 | 204 | 299 | 276 | 265 |
| Direct dependencies | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 30 | 14 | 27 | 44 | 41 |
| What runs in production (MB) | 30 | 1 | 2 | 29 | 29 |
| Build (s) | 0.0 | 0.0 | 5.8 | 0.1 | 0.1 |
| Start to first page (ms) | 171 | 138 | 163 | 117 | 104 |
| Memory idle (MB) | 83 | 75 | 83 | 67 | 67 |
| Memory under load (MB) | 164 | 174 | 231 | 122 | 124 |
| Menu pages per second | 1308 | 2033 | 289 | 3836 | 3510 |
| Latency p50 / p97.5 (ms) | 34 / 62 | 21 / 41 | 144 / 255 | 12 / 21 | 12 / 25 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |

## App frameworks (tuned: set up for production by the author, not yet reviewed)

| | sveltekit | nextjs | nextjs-tuned | nuxt | nuxt-tuned |
| --- | ---: | ---: | ---: | ---: | ---: |
| Contract (of 11) | 10 (fails S7) | 10 (fails S8) | 10 (fails S8) | 11 | 11 |
| JavaScript on the menu, gzip (KB) | 38.3 | 132.4 | 132.4 | 73 | 73 |
| Script files on the menu | 12 | 6 | 6 | 3 | 3 |
| Menu HTML, gzip (KB) | 1.5 | 2.2 | 2.2 | 2 | 1.6 |
| Update shows on the menu, median / p90 (ms) | 7 / 10 | 8 / 10 | 9 / 12 | 7 / 9 | 8 / 11 |
| Update shows on the order page, median / p90 (ms) | 8.5 / 11 | 8 / 10 | 10 / 11 | 10 / 14 | 9 / 13 |
| Lighthouse, CPU 6× slower | 95 | 87 | 85 | 86 | 86 |
| Total blocking time, CPU 6× slower (ms) | 269 | 522 | 610 | 558 | 557 |
| Menu load event, CPU 6× slower (ms) | 337 | 644 | 669 | 386 | 472 |
| Add to bag until the notice shows, CPU 6× slower (ms) | 363 | 430 | 542 | 695 | 835 |
| Lines of own code | 313 | 334 | 339 | 246 | 237 |
| Direct dependencies | 4 | 4 | 4 | 2 | 2 |
| Packages installed | 79 | 55 | 55 | 605 | 605 |
| node_modules (MB) | 76 | 463 | 463 | 228 | 228 |
| What runs in production (MB) | 2 | 494 | 68 | 3 | 3 |
| Build (s) | 3.0 | 12.0 | 13.5 | 8.9 | 7.9 |
| Start to first page (ms) | 161 | 632 | 546 | 320 | 298 |
| Memory idle (MB) | 69 | 104 | 105 | 93 | 86 |
| Memory under load (MB) | 256 | 352 | 340 | 285 | 264 |
| Menu pages per second | 1228 | 311 | 336 | 176 | 427 |
| Latency p50 / p97.5 (ms) | 36 / 75 | 151 / 308 | 136 / 243 | 259 / 384 | 107 / 170 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations (menu, bag) | none | none | none | none | none |
