# Slice results

Measured 2026-11-16 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1.
Medians of 3 builds, 5 starts, 3 Lighthouse runs (mobile profile) and 3 load runs of 10 s at 50 connections.
Raw figures: `results.json`.

| | zubra | nextjs | sveltekit | nuxt |
| --- | ---: | ---: | ---: | ---: |
| JavaScript on the menu, gzip (KB) | 27.5 | 132.4 | 37.9 | 79.3 |
| JavaScript on the menu, raw (KB) | 75.1 | 447.6 | 96.7 | 208.4 |
| Script files on the menu | 5 | 6 | 12 | 5 |
| Menu HTML, gzip (KB) | 1.1 | 2.7 | 1.5 | 2.2 |
| Lighthouse performance | 100 | 97 | 100 | 99 |
| Largest contentful paint (ms) | 751 | 631 | 753 | 773 |
| Total blocking time (ms) | 15 | 210 | 0 | 101 |
| Works without JavaScript | yes (contract) | yes (contract) | yes (contract) | yes (contract) |
| Lines of own code | 123 | 221 | 210 | 157 |
| Direct dependencies | 3 | 4 | 4 | 2 |
| Packages installed | 4 | 55 | 79 | 605 |
| node_modules (MB) | 6 | 463 | 46 | 196 |
| What runs in production (MB) | 6 | 493 | 2 | 3 |
| Build (s) | none | 5.9 | 1.9 | 6.1 |
| Start to first page (ms) | 156 | 555 | 166 | 225 |
| Memory idle (MB) | 87 | 105 | 69 | 95 |
| Memory under load (MB) | 189 | 406 | 263 | 314 |
| Menu requests per second | 5063 | 404 | 1571 | 189 |
| Latency p50 / p97.5 (ms) | 8 / 19 | 115 / 195 | 28 / 54 | 246 / 371 |
| Failed requests under load | 0 | 0 | 0 | 0 |
| Accessibility violations, menu | none | none | none | none |
| Accessibility violations, bag | none | none | none | none |
