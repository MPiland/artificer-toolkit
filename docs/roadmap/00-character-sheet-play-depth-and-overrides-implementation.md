# Phase 00 implementation ledger

> **Status:** active
> **Integration branch:** `feature/character-overrides`
> **Integration base:** `35f22cf6`
> **Roadmap:** [Character Sheet play depth and overrides](00-character-sheet-play-depth-and-overrides.md)

## Goal

Deliver Phase 00 through seven sequential local child branches. A child branch moves from `PLANNED` to `ACTIVE`, `HANDOFF_READY`, and `INTEGRATED`; the final branch ends at `FINAL_VALIDATED`. A failed technical or visual gate keeps the active branch unmerged.

## Assumptions

- Sheet edits persist immediately except for rest configuration, which remains a preview until the player takes the rest.
- UI branches run Impeccable just in time and lock desktop/mobile mockups before implementation.
- Backend-only branches mark mockup and visual gates `N/A`.
- Branch-head SHAs recorded below identify the delivery commit; the ledger-only handoff commit is resolved from Git history.

## Branch ledger

| Branch                                           | Scope                                                                      | Status    | Base SHA   | Delivery SHA | Mockup gate | Technical gate | Visual gate |
| ------------------------------------------------ | -------------------------------------------------------------------------- | --------- | ---------- | ------------ | ----------- | -------------- | ----------- |
| `codex/character-overrides-01-foundation`        | Taxonomy, persistence, identities, structured hit dice, HP migration, ADRs | `ACTIVE`  | `35f22cf6` | pending      | N/A         | green          | N/A         |
| `codex/character-overrides-02-engine`            | Precedence, propagation, provenance, breakdowns, movement/passives, RNG    | `PLANNED` | pending    | pending      | N/A         | pending        | N/A         |
| `codex/character-overrides-03-core-panels`       | Inspector shell and core-stat panels                                       | `PLANNED` | pending    | pending      | pending     | pending        | pending     |
| `codex/character-overrides-04-content-resources` | Spells, features, items, backgrounds, resources                            | `PLANNED` | pending    | pending      | pending     | pending        | pending     |
| `codex/character-overrides-05-companions`        | Companion lifecycle and play panels                                        | `PLANNED` | pending    | pending      | pending     | pending        | pending     |
| `codex/character-overrides-06-vitals-rests`      | HP, status, exhaustion, short/long rest                                    | `PLANNED` | pending    | pending      | pending     | pending        | pending     |
| `codex/character-overrides-07-integration`       | Consistency, regression, roadmap completion, hosted smoke test             | `PLANNED` | pending    | pending      | as needed   | pending        | pending     |

## Branch 01 — Foundation and persistence

### Entry verification

- Integration branch was clean at `35f22cf6`; unrelated untracked `docs/notes.md` is user-owned and excluded.
- Builder/Sheet, engine, transport, and persistence seams were reverified against the canonical guides and ADRs.
- Existing HP state, events, inventory instances, owned creatures, feature acquisitions, spell selections, and resource grants were traced through shared, schema, functions, DB, and API boundaries.

### Delivered scope

- Closed adjustment, calculation-source, resource-owner, rest, movement-preference, and dice-result primitives.
- Constrained adjustment subtype tables, owner RLS, provenance metadata, timestamps/actors, movement preferences, repository operations, and event-transaction integration.
- Adjustment provenance retains source category, label, and notes as Sheet metadata; only typed mechanical value intent may enter engine assembly.
- Owned item and companion targets use persisted instance UUIDs. Repeated definition-owned sources use source kind plus persisted acquisition/source-record identity.
- Provisional HP `max_override` is backfilled once, retained only as a deprecated rollback column, and no longer hydrated or written as authoritative character state.
- Creature hit dice are structured as count, die size, and modifier across authored contracts, SRD sources, persistence, hydration, and projections.
- ADR 0005, ADR 0006, and the owning character/engine/persistence guides are updated.

### Deferred scope

- Engine precedence and calculation provenance: Branch 02.
- Panel DTO variants and all UI: Branches 03–06.
- Custom-skill CRUD and automated companion rolls: outside Phase 00.
- Deprecated HP column removal: after deployed backfill confidence, tracked by Branch 07.

### Decisions and invariants

- No arbitrary target path, EAV value, or unvalidated adjustment JSON exists.
- Derived totals are never persisted.
- Adjustment removal restores current authored/derived behavior and never rewrites Builder intent.
- Source label/category/notes remain outside pure mechanical engine inputs.
- Manual adjustments never clear during rest.
- Source note maximum is 240 characters; source labels are single-line, nonblank, and at most 80 characters.
- D&D 5e 2014 size overrides use closed size codes; alignment and creature type use reference UUIDs.

### Acceptance and validation

| Gate                                         | Result                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Migration replay                             | green — local `supabase db reset`                                                                   |
| Generated DB types/bootstrap                 | green                                                                                               |
| Structured SRD conversion                    | green — 311 structured records, zero legacy strings, and local seed completed                       |
| Focused shared/schema/DB/Sheet tests         | green — 6 files and 112 tests                                                                       |
| Character Sheet transaction/repository proof | green — round-trip, clear, movement, backfill, atomicity, rollback, and stale-version checks         |
| RLS policy proof                             | green — all 13 owner-scoped Sheet tables verified                                                   |
| Affected typecheck                           | green — 8 tasks                                                                                     |
| Focused type-aware lint                      | green — every changed TypeScript file, including all converted creature records                     |
| Roadmap links                                | green — all relative links across 14 roadmap files resolve                                          |
| `git diff --check`                           | green                                                                                               |
| Full SRD integration audit                   | timed out twice without reporting a data failure; local seed and focused corpus checks remain green |

### Handoff

All non-timeout technical gates are green. The full working tree was backed up before formatter recovery; formatter-only churn was removed while preserving the 311 hit-die conversions and the 38 intentional tracked foundation files. Status remains `ACTIVE` only until the delivery SHA is recorded.

Branch 02 must consume the closed taxonomy and identity format here; it may not introduce a second precedence model, persist derived totals, or pass Sheet labels/notes into the engine. Its entry points are the adjustment repository exports, the typed schema API, and the pure shared calculation/source primitives delivered here.

## Branch 02 — Rules engine and calculation provenance

**Entry:** Branch 01 is `INTEGRATED`; all adjustment fields and identity rules round-trip.

**Exit:** Every family has precedence/clearing tests; upstream propagation, suppressed contributions, movement `AUTO`, per-source spell/item isolation, companion context, and deterministic injected RNG are green. Handoff records resolver interfaces, precedence matrix, breakdown shape, and fixtures.

## Branch 03 — Inspector shell and core-stat panels

**Entry:** Branch 02 engine output is stable. Run Impeccable before each panel family.

**Exit:** Locked desktop/mobile mockups, Storybook fixtures, explicit panel DTOs/commands, backend orchestration, one responsive inspector shell, exhaustive adapters, immediate persistence, accessibility, screenshots, and focused tests are green. Handoff records discriminators, commands, shell boundaries, evidence, and rejected abstractions.

## Branch 04 — Content and resources

**Entry:** Branch 03 shell/command behavior is reusable unchanged; stable source/instance identities exist.

**Exit:** Spell, feature, item, background, and resource panels preserve Sheet/Builder ownership, per-source/per-instance isolation, recovery semantics, immediate persistence, mockup parity, and focused tests. Handoff records owner mappings, recovery rules, action matrix, and evidence.

## Branch 05 — Companions

**Entry:** Generic resource owners and companion calculation context are available.

**Exit:** Authorized add/remove, independent instances, typed adjustments, HP/hit dice/resources/equipment, inspection-only attacks, transactional cascade/history, rest policy, visual states, and focused tests are green. Handoff records relationship/state/cascade contracts and evidence.

## Branch 06 — Vitals and complete rests

**Entry:** Character/companion resources share recovery contracts and deterministic dice results.

**Exit:** HP clamping, conditions/exhaustion, backend previews, atomic short/long rest, stale-preview safety, exact result evidence, selected eligible companion recovery, mockup parity, and focused tests are green. Handoff records transaction/order/roll contracts and evidence.

## Branch 07 — Integration and completion

**Entry:** Branches 01–06 are `INTEGRATED` with no known failed gate.

**Exit:** Screenshot inventory coverage, Impeccable distillation, abstraction cleanup, exhaustive commands/adapters, end-to-end workflows, accessibility/theme/overflow states, roadmap renumbering, dice roadmap, full required validation, hosted Netlify smoke test, and one PR are green. Mark this ledger `FINAL_VALIDATED`.
