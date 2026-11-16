# Slice results

Measured 2026-11-16 on 2 × Intel(R) Xeon(R) Processor @ 2.10GHz, 8 GB, Node v26.13.1.
Medians of 3 builds, 5 starts, 3 Lighthouse runs (mobile profile) and 3 load runs of 10 s at 50 connections.
Raw figures: `results.json`.

| | zubra | nextjs | sveltekit | nuxt | lit | enhance | stencil | fast | webui |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| JavaScript on the menu, gzip (KB) | 27.5 | 132.4 | 37.9 | 79.3 | 8.2 | 5 | 9.9 | 28.3 | 30.6 |
| JavaScript on the menu, raw (KB) | 75.1 | 447.6 | 96.7 | 208.4 | 21.6 | 13 | 22.3 | 90.4 | 92.6 |
| Script files on the menu | 5 | 6 | 12 | 5 | 1 | 1 | 5 | 1 | 1 |
| Menu HTML, gzip (KB) | 1.1 | 2.7 | 1.5 | 2.2 | 1.1 | 0.9 | 1.3 | 1.6 | 1.8 |
| Lighthouse performance | 100 | 99 | 100 | 100 | 100 | 100 | 100 | 100 | 100 |
| Largest contentful paint (ms) | 753 | 615 | 759 | 758 | 752 | 751 | 810 | 751 | 752 |
| Total blocking time (ms) | 13 | 132 | 0 | 72 | 0 | 2 | 0 | 12 | 21 |
| Works without JavaScript | yes (contract) | yes (contract) | yes (contract) | yes (contract) | yes (contract) | yes (contract) | yes (contract) | yes (contract) | yes (contract) |
| Lines of own code | 123 | 221 | 210 | 157 | 141 | 144 | 216 | 197 | 192 |
| Direct dependencies | 3 | 4 | 4 | 2 | 4 | 3 | 1 | 3 | 3 |
| Packages installed | 4 | 55 | 79 | 605 | 47 | 40 | 9 | 35 | 35 |
| node_modules (MB) | 6 | 463 | 46 | 196 | 30 | 14 | 25 | 44 | 41 |
| What runs in production (MB) | 6 | 493 | 2 | 3 | 30 | 1 | 2 | 29 | 29 |
| Build (s) | none | 5.5 | 1.8 | 5.4 | 0.0 | 0.0 | 3.0 | 0.1 | 0.1 |
| Start to first page (ms) | 148 | 421 | 126 | 242 | 132 | 106 | 136 | 98 | 95 |
| Memory idle (MB) | 87 | 104 | 69 | 95 | 86 | 75 | 83 | 67 | 67 |
| Memory under load (MB) | 193 | 418 | 267 | 330 | 166 | 174 | 326 | 141 | 128 |
| Menu requests per second | 5402 | 424 | 1548 | 196 | 1568 | 2313 | 423 | 4279 | 4263 |
| Latency p50 / p97.5 (ms) | 8 / 16 | 108 / 192 | 30 / 51 | 237 / 322 | 29 / 50 | 19 / 38 | 110 / 168 | 10 / 21 | 10 / 21 |
| Failed requests under load | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| Accessibility violations, menu | none | none | none | none | none | none | none | none | none |
| Accessibility violations, bag | none | none | none | none | none | none | none | none | none |
