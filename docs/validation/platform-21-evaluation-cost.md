# PLATFORM-21 evaluation cost (D163)

Before-and-after measurements for PLATFORM-21.T1b: read paths hydrate the stored `subject-compiler-v2`
compilation and never compile. Raw logs live under the ignored `local-validation/platform-21-t1/`
(`t1b-budget.log`, and the Encounter measurement logs). All numbers come from convex-test in plain Node on this
machine, using SRD content. They are not production timings.

## Builder commit read budget (D84)

Source: `apps/apis/convex/characters/commitReadBudget.test.ts`, the commit read and write counter, level-5
Characters. Each case makes every authored payload unreadable before it commits, so commit
reads root rows, catalogue facts and stored compilations only. KB = 1024 bytes.

| Case                  | Before (phase tip, compiled at runtime) | D163 forecast (full swap) | After T1b | Budget (D84) |
| --------------------- | --------------------------------------- | ------------------------- | --------- | ------------ |
| Fighter 5 / Champion  | 361.6                                   | 324.1                     | 313.8     | 450          |
| Wizard 5 / Evocation  | 416.3                                   | 404.5                     | 385.9     | 450          |
| Fighter 3 / Wizard 2  | 580.9                                   | 524.8                     | 509.3     | 650          |

The after column includes the catalogue facts T1b adds to roots (below). Rulings #1 and #3 replaced the payload
reads with these facts, so every case comes in under its forecast.

## Root catalogue fact growth

The `catalogue` facts T1b adds are `publishedActive`, the RACE/CLASS/BACKGROUND picker facts and
`equipment.quote`. These are their bytes over the commit-budget fixture's corpus, measured as JSON of those
fields only:

| Kind       | Roots | Bytes  | Per root |
| ---------- | ----- | ------ | -------- |
| CLASS      | 24    | 36,308 | ~1.5 KB  |
| EQUIPMENT  | 371   | 14,469 | ~39 B    |
| SPELL      | 319   | 7,656  | ~24 B    |
| RACE       | 13    | 5,369  | ~413 B   |
| BACKGROUND | 1     | 2,992  | ~2.9 KB  |

## Encounter Creature pins (ruling #2)

Each `equipmentSources[]` pin now holds the Equipment version's stored compilation. The room and blueprint
snapshots hydrate that compilation and do not compile it. Sizes are serialized JSON bytes from the SRD Goblin
fixtures. Room load reads the same documents, so it grows by the same bytes.

| Measure                                | Before | After  | Change |
| -------------------------------------- | ------ | ------ | ------ |
| Goblin `equipmentSources` (4 pins)     | 10,549 | 12,186 | +15.5% |
| Goblin with a Shield +1 variant        | 11,169 | 12,948 | +15.9% |
| Goblin blueprint snapshot              | 18,084 | 19,721 | +9.1%  |
| Goblin Encounter actor                 | 18,807 | 20,444 | +8.7%  |
| Five actors (room load)                | 94,661 | 102,988 | +8.8% |

Creating a blueprint reads one extra compilation row per loadout entry.
