# Phase 00 implementation ledger

> **Status:** active
> **Integration branch:** `feature/character-overrides`
> **Integration base:** `35f22cf6`
> **Roadmap:** [Character Sheet play depth and overrides](00-character-sheet-play-depth-and-overrides.md)

## Goal

Deliver Phase 00 through seven sequential local child branches. A child branch moves from `PLANNED` to `ACTIVE`, `HANDOFF_READY`, and `INTEGRATED`; the final branch ends at `FINAL_VALIDATED`. A failed technical or visual gate keeps the active branch unmerged.

## Assumptions

- Sheet edits persist immediately except for rest configuration, which remains a preview until the player takes the rest.
- The TanStack Query cache is the web Sheet's server-state holder. Safe command-specific optimistic projections use snapshot, rollback, and authoritative-response replacement; the web app does not add a parallel Zustand Sheet store or recalculate engine-owned totals.
- UI branches run Impeccable just in time and lock desktop/mobile mockups before implementation.
- Backend-only branches mark mockup and visual gates `N/A`.
- Branch-head SHAs recorded below identify the delivery commit; the ledger-only handoff commit is resolved from Git history.

## Branch ledger

| Branch                                           | Scope                                                                           | Status       | Base SHA       | Delivery SHA   | Mockup gate | Technical gate | Visual gate |
| ------------------------------------------------ | ------------------------------------------------------------------------------- | ------------ | -------------- | -------------- | ----------- | -------------- | ----------- |
| `codex/character-overrides-01-foundation`        | Taxonomy, persistence, identities, structured hit dice, HP migration, ADRs      | `INTEGRATED` | `35f22cf6`     | `75c44e1ed343` | N/A         | green          | N/A         |
| `codex/character-overrides-02-engine`            | Precedence, propagation, provenance, breakdowns, movement/passives, RNG         | `INTEGRATED` | `7454f314adcf` | `0ebc81bf2a8e` | N/A         | green          | N/A         |
| `codex/character-overrides-03-core-panels`       | Inspector shell and core-stat panels                                            | `INTEGRATED` | `f92cc6946541` | `11fa57750faa` | green       | green          | green       |
| `codex/character-overrides-04-content-resources` | Spells, features, items, backgrounds, resources                                 | `INTEGRATED` | `3492e0bdea49` | `e61821775834` | green       | green          | green       |
| `codex/character-overrides-05-companions`        | Extras lifecycle and play panels: companions, mounts, owned creatures, vehicles | `INTEGRATED` | `3485aef1`     | `0bd47e4b1011` | green       | green          | green       |
| `codex/character-overrides-06-vitals-rests`      | HP, status, exhaustion, short/long rest                                         | `PLANNED`    | pending        | pending        | pending     | pending        | pending     |
| `codex/character-overrides-07-integration`       | Consistency, regression, roadmap completion, hosted smoke test                  | `PLANNED`    | pending        | pending        | as needed   | pending        | pending     |

## Branch 01 — Foundation and persistence

### Entry verification

- Integration branch was clean at `35f22cf6`; unrelated untracked `docs/notes.md` is user-owned and excluded.
- Builder/Sheet, engine, transport, and persistence seams were reverified against the canonical guides and ADRs.
- Existing HP state, events, inventory instances, owned creatures, feature acquisitions, spell selections, and resource grants were traced through shared, schema, functions, DB, and API boundaries.

### Delivered scope

- Closed adjustment, calculation-source, resource-owner, rest, movement-preference, and dice-result primitives.
- Constrained adjustment subtype tables, owner RLS, provenance metadata, timestamps/actors, movement preferences, repository operations, and event-transaction integration.
- Every adjustment family retains only an optional `sourceNote` as manual Sheet metadata; only typed mechanical value intent may enter engine assembly, while authored provenance remains in calculation breakdowns.
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
- `sourceNote` remains outside pure mechanical engine inputs; authored provenance remains in calculation breakdowns.
- Manual adjustments never clear during rest.
- `sourceNote` is optional and has a 240-character maximum.
- D&D 5e 2014 size overrides use closed size codes; alignment and creature type use reference UUIDs.

### Acceptance and validation

| Gate                                         | Result                                                                                              |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Migration replay                             | green — local `supabase db reset`                                                                   |
| Generated DB types/bootstrap                 | green                                                                                               |
| Structured SRD conversion                    | green — 311 structured records, zero legacy strings, and local seed completed                       |
| Focused shared/schema/DB/Sheet tests         | green — 6 files and 112 tests                                                                       |
| Character Sheet transaction/repository proof | green — round-trip, clear, movement, backfill, atomicity, rollback, and stale-version checks        |
| RLS policy proof                             | green — all 13 owner-scoped Sheet tables verified                                                   |
| Affected typecheck                           | green — 8 tasks                                                                                     |
| Focused type-aware lint                      | green — every changed TypeScript file, including all converted creature records                     |
| Roadmap links                                | green — all relative links across 14 roadmap files resolve                                          |
| `git diff --check`                           | green                                                                                               |
| Full SRD integration audit                   | timed out twice without reporting a data failure; local seed and focused corpus checks remain green |

### Handoff

**Status:** `INTEGRATED`
**Delivery SHA:** `75c44e1ed343`

All non-timeout technical gates are green. The full working tree was backed up before formatter recovery; formatter-only churn was removed while preserving the 311 hit-die conversions and the 38 intentional tracked foundation files.

- Migration order: the structured creature columns are part of the canonical creature table; `20260724190000_character_sheet_adjustment_foundation.sql` creates the adjustment aggregate and idempotently backfills legacy HP overrides.
- Deprecated HP status: `characters.max_override` remains nullable for rollback compatibility but is neither hydrated nor written as authoritative Sheet state.
- Repository entry point: `characterSheetAdjustmentRepository` is exported from the subject repository index and owns list/upsert/remove plus movement-preference operations.
- Identity rule: item and companion targets use owned-instance UUIDs; repeated definition-owned sources use source kind plus persisted acquisition/source-record identity.
- Validation evidence: 112 focused tests, 12 Character Sheet integration assertions, 8 affected typecheck tasks, changed-file type-aware lint, 311 structured SRD records, zero legacy hit-die strings, and clean diff/link checks.

Branch 02 must consume the closed taxonomy and identity format here; it may not introduce a second precedence model, persist derived totals, or pass Sheet labels/notes into the engine. Its entry points are the adjustment repository exports, the typed schema API, and the pure shared calculation/source primitives delivered here.

## Branch 02 — Rules engine and calculation provenance

**Entry:** Branch 01 is `INTEGRATED`; all adjustment fields and identity rules round-trip.

**Exit:** Every family has precedence/clearing tests; upstream propagation, suppressed contributions, movement `AUTO`, per-source spell/item isolation, companion context, and deterministic injected RNG are green. Handoff records resolver interfaces, precedence matrix, breakdown shape, and fixtures.

### Entry verification

- Branch 01 was integrated at `7454f314adcf`; its adjustment taxonomy, source identities, persistence contracts, and handoff were reverified before engine changes.
- The engine receives only the mechanical projection of each adjustment. Sheet labels, notes, actors, timestamps, authorization, and presentation remain outside the snapshot.
- The checked-in deployed bootstrap migration was brought back into parity with the canonical generated bootstrap after the Branch 01 adjustment tables were found missing from that artifact.

### Delivered scope

- Pure numeric and selection resolvers now produce effective values and calculation breakdowns from the same calculation.
- Authored, equipment, and feature contributions retain stable source provenance through grant application and modifier resolution.
- Manual additions participate in normal rules calculation; absolute target overrides apply last and retain suppressed contributions for inspection.
- Adjusted abilities and proficiency levels propagate into saving throws, skills, passive checks, spell attacks/DCs, HP maximums, and resource maximums unless the downstream target has its own absolute override.
- Passive checks and movement selection are rules-system policies. D&D 5e 2014 `AUTO` selects walking when available and otherwise the first backend-ordered available movement.
- Spell mechanics resolve by persisted spell-source identity; item mechanics resolve by owned-item instance; companion calculations use an isolated companion context.
- Dice-based recovery uses an injected random source and returns canonical die results from a pure resolver.
- Sheet services hydrate adjustments and movement preferences, delegate totals to the engine, and return engine-authored breakdowns instead of repeating proficiency or passive arithmetic.

### Deferred scope

- Panel-facing DTO variants and commands: Branches 03–06.
- Item authored-attack projection, resource recovery commands, and Sheet-authorized spell management: Branch 04.
- Companion lifecycle and persistence orchestration: Branch 05.
- Rest preview/apply orchestration and transactional recovery: Branch 06.

### Decisions and invariants

- The pure precedence order is authored/equipment/feature contributions, manual additions, then one absolute target override.
- A hard target override suppresses target contributions for display but does not delete them or their stored manual additions.
- Governing ability and proficiency adjustments resolve before their dependent total.
- Every calculation contribution carries a typed source identity and applied or suppressed state.
- Spell definition IDs, item definition IDs, and creature definition IDs are not sufficient runtime identities for repeated owned sources.
- HP maximum starts from the authored engine maximum; an adjusted Constitution contributes its level-scaled delta before an HP maximum adjustment or override.
- Randomness is an injected boundary. Engine tests never depend on ambient `Math.random`.
- No derived total is written to Sheet persistence.

### Acceptance and validation

| Gate                                | Result                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| Adjustment precedence/clearing      | green — focused engine suite, 10 tests                                            |
| Shared package test/build           | green — 23 files, 164 tests; build green                                          |
| Functions orchestration tests       | green — 4 focused files, 21 tests                                                 |
| Web regression tests                | green — 103 files, 613 tests                                                      |
| Bootstrap artifact parity           | green — 6 tests                                                                   |
| Affected typecheck                  | green — 8 tasks                                                                   |
| Affected tests                      | green — 8 tasks across web, functions, DB, shared, schema, and dependent packages |
| Type-aware lint                     | green — complete repository type-aware lint gate                                  |
| Engine metadata-boundary inspection | green — no Sheet label, note, actor, or timestamp enters engine code              |
| `git diff --check`                  | green                                                                             |

### Handoff

**Status:** `INTEGRATED`

**Delivery SHA:** `0ebc81bf2a8e`

- Resolver entry points: `resolveNumericCalculation`, `resolveSelectionCalculation`, `calculateAdjustedDerivedStats`, `resolveSheetSubjectMechanics`, and the existing engine kernel.
- Breakdown shape: typed calculation identity, effective value, ordered contributions, applied/suppressed state, and typed mechanical source reference.
- Provenance rule: authored acquisitions and grants use source kind plus stable persisted source record; owned items and companions use instance UUIDs.
- Deterministic RNG fixture: a sequence-backed `CharacterDiceRandomSource` verifies canonical rolls and results without ambient randomness.
- Panel-facing gap: Branch 03 must project these engine outputs into explicit panel DTO variants and must not recalculate totals in functions, APIs, or web.

## Branch 03 — Inspector shell and core-stat panels

**Entry:** Branch 02 engine output is stable. Run Impeccable before each panel family.

**Exit:** Locked desktop/mobile mockups, Storybook fixtures, explicit panel DTOs/commands, backend orchestration, one responsive inspector shell, exhaustive adapters, immediate persistence, accessibility, screenshots, and focused tests are green. Handoff records discriminators, commands, shell boundaries, evidence, and rejected abstractions.

### Entry verification

- Branch 02 was integrated at `f92cc6946541`; the engine breakdown, adjustment precedence, and stable source identities were reverified before panel work.
- The current route-backed `CharacterSheetView` Storybook fixture is the visual baseline. Reference screenshots remain a functional inventory only.
- The inspector is a Mantine portal overlay. It never changes the underlying Sheet layout or reserves adjacent page width.

### Delivered scope

- Closed panel targets and explicit DTO variants for abilities, saving throws, individual and all skills, senses, movement, defenses, and proficiencies.
- Backend panel resolution, authenticated owner-only queries, target validation, immediate versioned commands, transaction history, and authoritative affected-panel responses.
- One focused inspector shell: a right-side drawer on desktop/tablet and a bottom/full-screen sheet on mobile.
- Exhaustive web adapters for every Branch 03 panel kind, including calculation sources, suppressed sources, validation, allowed actions, pending state, errors, and reset behavior.
- Existing Sheet values are inspect triggers; panel presentation does not duplicate engine calculation.
- Route-backed Storybook fixtures cover default, adjusted, overridden, desktop, tablet, mobile, and light states using the production Character Sheet fixture.

### Deferred scope

- Spell, feature, item, background, and resource panels remain Branch 04 work.
- Companions remain Branch 05 work. HP/status/rest mutation flows remain Branch 06 work.
- Custom-skill CRUD remains outside Phase 00.

### Decisions

- Panel DTOs carry semantic facts, editors, editability, validation, and allowed commands only. They do not carry section-order layout instructions, CSS, Mantine props, callbacks, or platform identifiers.
- The client owns section composition and responsive drawer geometry while exhaustively rendering the backend-authored panel variant.
- Commands restore authoritative server state on failure. Successful responses replace returned panel cache entries and invalidate related cached panels without duplicating totals client-side.
- Ability score overrides reject negative values; ordinary signed ability changes use the additive modifier field.
- UI controls are gated by both panel editability and explicit allowed commands.

### Visual evidence

All evidence is captured from the route-backed Character Sheet story with the production fixture under `docs/mockups/character-sheet-overrides/`.

- Ability: default, adjusted, overridden, light, tablet, and mobile.
- Saving throw, individual skill, all skills, senses, movement, defenses, and proficiencies: desktop.
- Every capture waits for the named inspector dialog before taking the screenshot; the 13 evidence files have distinct content hashes.

### Acceptance and validation

| Gate                                              | Result                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Schema and command contracts                      | green — 14 focused assertions                                                                                               |
| Character Sheet regression and inspector behavior | green — 2 files, 42 tests                                                                                                   |
| Storybook interaction states                      | green — 15 route-backed stories                                                                                             |
| Storybook typecheck                               | green                                                                                                                       |
| Affected typecheck                                | green — 8 tasks                                                                                                             |
| Type-aware lint                                   | green — complete repository type-aware lint gate                                                                            |
| Responsive visual evidence                        | green — 13 real Sheet-overlay captures                                                                                      |
| Impeccable review                                 | green after negative-score, cache-coherence, in-drawer status/error, ready-state capture, and semantic-contract corrections |
| `git diff --check`                                | green                                                                                                                       |

### Handoff

**Status:** `INTEGRATED`

**Delivery SHA:** `11fa57750faa`

- Panel discriminators: `ABILITY`, `SAVING_THROW`, `SKILL`, `SKILLS`, `SENSES`, `MOVEMENT`, `DEFENSES`, and `PROFICIENCIES`.
- Command variants: upsert adjustment, remove adjustment, reset target adjustments, and set movement preference.
- Shell boundary: `CharacterSheetInspector` owns query/loading/error/pending overlay behavior; `CharacterSheetInspectorContent` exhaustively adapts semantic panel DTOs.
- Reused primitives are limited to panel metadata, status, breakdown, adjustment editor, list, and section components that are shared by current panel variants.
- Rejected abstractions: a panel section-order DSL, arbitrary component node map, parallel standalone mockup surface, and adjacent desktop inspector layout.

## Branch 04 — Content and resources

**Entry:** Branch 03 shell/command behavior is reusable unchanged; stable source/instance identities exist.

**Exit:** Spell, feature, item, background, and resource panels preserve Sheet/Builder ownership, per-source/per-instance isolation, recovery semantics, immediate persistence, mockup parity, and focused tests. Handoff records owner mappings, recovery rules, action matrix, and evidence.

### Entry verification

- Branch 03 was integrated at `3492e0bdea49`; its semantic inspector shell, portal-overlay behavior, immediate command boundary, and source/instance identity rules were reverified before content-panel work.
- The route-backed `CharacterSheetView` Storybook fixture remains the visual baseline. D&D Beyond captures remain a capability inventory only.
- Zustand is neither installed nor referenced. Sheet DTOs and panels remain TanStack Query server state; local React state is limited to transient interaction state and pre-commit field drafts. TanStack Form remains confined to Builder and authored-content forms.

### Delivered scope

- Typed spell, spell-management, feature, owned-item, background, and resource panel contracts are delivered.
- Spell and resource persistence uses stable spell-source and resource-owner identities.
- Backend Sheet projection emits ordered active spell groups only. Authored `SPELL_CAST_LEVEL` scaling is the intersection of each spell's legal cast levels and its source's owned slot levels; `TO_HIT` and `SAVE_DC` adjustments are contextual and mutually exclusive, while `DAMAGE` adjustments are bonus-only.
- Route-backed Spell detail and Manage Spells Storybook fixtures compose the production Character Sheet with the existing inspector as a portal overlay.
- Optimistic Sheet commands snapshot the affected Query cache, apply only safe command-specific direct-value projections, roll back immediately on failure, refetch server truth after failure, and reconcile from the authoritative Sheet and affected-panel response on success.
- Current optimistic projections cover spell-source customizations, prepared spells, spell-slot use, typed/legacy resource use, direct inventory updates, equipment/attunement state, inspiration, exhaustion, and condition removal. Derived adjustments, dice recovery, HP clamping, additions requiring server-assigned identity, and other mechanically resolved values remain backend-only.
- Spell-slot pips are immediate Sheet commands for using or restoring one slot. Individual spell panels do not expose preparation controls; preparation remains centralized in Manage Spells.
- Structural known-spell acquisition remains Builder-owned. Manage Spells provides an explicit Builder handoff instead of introducing a second Sheet acquisition model.
- Cast and Info remain always-visible spell sections. Authored description and Customize use flat, transparent disclosures separated by rules; source references use the same treatment when reference data is available.
- Actions are a play-time scan surface: attack rows show one backend-resolved primary mechanic, while feature actions and feature-backed resources retain at most two lines of authored description beside their immediate controls. Equipment properties and equipment descriptions remain in their owning detail surfaces.
- The frontend trusts explicit backend action membership. Description-only actions such as Trance remain visible instead of being discarded by a second client-side playability policy.
- Action activation and tracked uses are orthogonal. The backend links an unambiguous one-action/one-resource feature pair with `resourceGrantId`; the Sheet renders one linked action row instead of inventing a second resource row. Multi-action or multi-resource features require an explicit authored relation and remain unlinked rather than relying on display-label matching.
- `ATTACK`, `ACTION`, `BONUS_ACTION`, `REACTION`, and `OTHER` are the only action activation groups. `LIMITED_USE` is a cross-cutting filter: it selects resource-backed actions while preserving their activation group, and it never creates a `Limited Use` section in All.
- Resource-backed attacks remain in the same four-column Attack table in All and Attack, with remaining uses shown as quiet identity metadata beneath the name. Interactive use controls appear only in the Limited Use filter's descriptive row and the owning detail panel, so charge management cannot distort the play-scan columns.
- A standalone resource without an authored action is omitted from All and activation filters. It appears only through the Limited Use filter under Other/Special until its source provides an authoritative activation.
- Resource ownership remains a typed backend linkage for limits, charges, recovery, and atomic commands, but the Sheet does not expose a generic Resources destination. Class pools, feature uses, spell uses, and owned-item charges remain attached to their owning play rows or inspectors; hit dice remain in HP/rest workflows. A later tranche may introduce a more intentional cross-owner management surface.
- The desktop lower workspace uses one 690px play-surface height. Saving Throws and Senses remain intrinsic; Proficiencies fills the remaining rail; Skills and the active tab fill their columns. Proficiencies, Skills, and the active tab scroll internally when their content exceeds that shared height.
- Main Sheet proficiency facts use the closed `ARMOR`, `WEAPON`, `TOOL`, and `LANGUAGE` groups. Skills and saving throws remain in their dedicated projections and are not duplicated in Proficiencies. Broad equipment-property grants resolve to player-facing labels such as `Light Armor` and `Martial Weapons`.
- Skills render one proficiency indicator under the labeled proficiency column. The closed `NONE`, `HALF`, `FULL`, and `DOUBLE` values render as hollow, half-filled, filled, and filled-with-ring indicators with explicit accessible labels.
- Desktop Defenses is grouped under the combat facts as Resistances, Immunities, and Vulnerabilities. The left-rail Defenses card remains available outside desktop, and Long Rest uses the outlined treatment at every breakpoint.
- Mobile retains the locked swipe pager and icon-only section launcher. Its shared play header is now a compact identity, four-fact combat rail, HP summary, collapsed HP/recovery controls, and cross-page Conditions/Exhaustion/Inspiration summary. Ancestry, background, authored description, and level badges remain available through the character edit/detail flow rather than consuming every play page.
- Mobile Overview uses a three-by-two ability grid at regular phone widths, a two-column saving-throw block, and compact defense/sense entries. The dedicated Proficiencies page reuses the same typed Armor, Weapons, Tools, and Languages grouping as desktop instead of repeating generic proficiency cards.
- The mobile shared header exposes Defenses and Conditions as management actions. Exhaustion is managed with Conditions in the same bottom drawer, while the duplicate Overview status block is removed. The pager owns vertical scrolling below the header and positions the icon-only section launcher absolutely within that pager rather than against the browser viewport.
- HP uses one compact hierarchy without a progress meter: current/max, Temp HP, and Hit Dice are aligned as primary facts, with recovery actions beneath them on desktop. Mobile presents the same facts and Manage in one row. Manage never expands the Sheet: HP settings use a 420px anchored popover on desktop/tablet and a compact bottom drawer on mobile; mobile recovery actions live in that drawer.
- HP settings use the canonical Artificer input treatment. Damage, amount, and healing share one equal-width compact row; damage uses the danger treatment. Temp HP and Max HP override share an equal-width full row, commit immediately on blur or Enter, and there is no Sheet Save action.
- Dark-mode primary actions use the shared transparent orange-outline treatment; light-mode primary actions retain the filled orange treatment. Custom danger colors remain independent of the primary token mapping.
- Route-backed Sheet fixtures use currently seeded content. The primary Wizard fixture is a High Elf Acolyte from the School of Evocation, and the Short Rest fixture reuses the proven Human Acolyte Fighter 2 / Rogue 1 lifecycle shape with separate d10 and d8 pools.
- Desktop tab content fills the bordered workspace panel. That bordered panel owns overflow scrolling; the outer tab panel no longer reserves a scrollbar gutter, so its left and right workspace insets remain equal.
- The shared tab panel compensates its thin desktop scrollbar so every row keeps the same
  visible 18px inset on both sides. The mobile pager preserves touch/wheel scrolling while
  hiding the platform scrollbar, allowing every page panel to fill the Sheet's equal outer
  gutters.
- Owned-item detail includes authored description in its own collapsible section; instance customization remains separate and cannot suppress authored traits or properties.
- Actions, active spells, and inventory now share a compact play-list grammar: ordered groups, aligned facts, divider-separated rows, quiet source text, and no row cards or redundant panel descriptions.
- Active spell rows expose damage expressions and damage type only when the backend has typed damage mechanics. Rich effect categories remain deferred until a closed backend taxonomy is approved; clients do not infer tags from prose.
- Attack is the only tabular action group and uses Name, Range, Hit/DC, and Damage.
  Non-attack groups are descriptive rows: the title and compact tracked-use controls share
  one line, followed by the authored play description. `OTHER` entries render `(Special)`.
  Limited Use is a filter over those activation groups, not an additional action kind or
  section; resource-backed entries remain in their Action, Bonus Action, Reaction, or
  Other group in All and in the Limited Use result.
  Spells enter Actions only when their exact source instance is explicitly configured with
  `Display in Actions`; other spell action-economy categories remain in the Spells filters.
- Resource steppers use compact fixed geometry: 30px on pointer layouts and 34px on
  touch/narrow layouts. Their title-row placement is independent of optional description
  content, so labels and controls cannot drift into separate columns or cross row borders.
- Spell rows vertically center the name/source block with their backend facts and compact
  Cast action. At the narrow 320px boundary the source and Use fact progressively hide,
  preserving Name, Range, Hit/DC, Effect, and Cast without horizontal overflow.
- Mobile Spells places Spell Attack, Save DC, and Manage Spells on one compact summary row.
  The mobile pager is the sole vertical scroll owner; the ordered spell list expands inside
  that page and never introduces a nested scrollbar. Desktop and tablet retain the bounded
  internal play-list scroll needed by their fixed-height workspace.
- Tablet is a dedicated hybrid layout from 761px through 1199px rather than a scaled phone
  or compressed desktop. Portrait stacks identity over combat facts, keeps all six abilities
  in one compact rail, places the status strip beneath it, and uses a two-column Overview.
  Landscape keeps identity and combat facts on one row, aligns abilities beside the status
  strip, then keeps Skills persistent in a bounded left rail beside the tabbed play workspace.
- Tablet tabs omit Skills and Proficiencies because both remain directly available from
  Overview. In portrait, Overview owns Skills, saving throws, senses, defenses, proficiencies,
  and the current play summary. In landscape, the right-side Overview tab owns saving throws,
  senses, defenses, and proficiencies while Skills remains visible beside every play tab.
- Every tablet detail surface remains a 480px right inspector; only phone layouts use bottom
  drawers. One explicit tablet-landscape composition branch prevents duplicated hidden content
  and preserves the persistent Skills rail. Existing component classes and simple media-query
  selectors own the responsive geometry; no general layout abstraction was introduced.
- Sheet and inventory tabs use one active-state signal: the orange bottom rule. Keyboard
  focus preserves that rule instead of drawing a competing outline around the full tab.
- `Display in Actions` remains a per-source user preference for this tranche. Its current `displayAsAttack` name is transitional: action economy and resolution method require separate backend semantics before broader automatic inclusion or multi-filter membership is introduced.
- Inventory owner totals aggregate the flattened balance list once, including container-assigned balances. Campaign-defined denominations and versioned exchange policy are owned by Phases 03 and 04 rather than this Sheet tranche.

### Current visual evidence

**Tablet responsive visual status:** `LOCKED`. The approved portrait and landscape
compositions, right-side inspector behavior, complete passive-sense state, and supporting
desktop/mobile play-surface direction require no further design iteration in Branch 04.

Current-state and in-progress route-backed captures live under `docs/mockups/character-sheet-overrides/`:

- Character Sheet baseline: `04-character-sheet-baseline-desktop.png`, `04-character-sheet-baseline-mobile.png`.
- Existing Spells surface: `04-spells-current-desktop.png`, `04-spells-current-mobile.png`.
- Existing Manage Spells drawer: `04-manage-spells-current-drawer-desktop.png`, `04-manage-spells-current-drawer-mobile.png`.
- Spell inspector mock: `04-spell-inspector-mock-desktop.png`, `04-spell-inspector-mock-mobile.png`.
- Manage Spells inspector mock: `04-manage-spells-inspector-mock-desktop.png`, `04-manage-spells-inspector-mock-mobile.png`.
- Flat spell inspector: `04-spell-inspector-flat-desktop.png`, `04-spell-inspector-flat-mobile.png`.
- Expanded flat spell Customize state: `04-spell-inspector-customize-flat-desktop.png`, `04-spell-inspector-customize-flat-mobile.png`.
- Flat Manage Spells inspector: `04-manage-spells-inspector-flat-desktop.png`, `04-manage-spells-inspector-flat-mobile.png`.
- Corrected active-spell groups: `04-spell-states-corrected-desktop.png`, `04-spell-states-corrected-mobile.png`.
- Corrected configured spell customization: `04-spell-inspector-customize-corrected-desktop.png`, `04-spell-inspector-customize-corrected-mobile.png`.
- Corrected ability-card geometry: `04-ability-cards-corrected-desktop.png`, `04-ability-cards-corrected-mobile.png`.
- Seed-backed fixture and proficiency states:
  `04-character-sheet-seeded-fixture-desktop.png`,
  `04-proficiency-states-single-indicator-desktop.png`,
  `04-saving-throws-right-proficiency-desktop.png`, and
  `06-multiclass-hit-dice-sheet-mobile.png`.
- Coordinated header, saving-throw, status, and proficiency polish:
  `04-coordinated-sheet-polish-desktop.png`,
  `04-coordinated-sheet-polish-tablet.png`, and
  `04-coordinated-sheet-polish-mobile.png`.
- Unified readiness header: `04-readiness-header-polished-desktop.png`, `04-readiness-header-polished-mobile.png`.
- Final compact Actions/resource controls: `04-actions-compact-final-desktop.png`,
  `04-mobile-pager-restored-actions.png`, and the narrow-width containment check
  `04-mobile-pager-restored-actions-320.png`.
- Explicit action coverage: `04-action-types-descriptive-desktop.png` and
  `04-action-types-descriptive-mobile.png` verify Attack, Action, Bonus Action, Reaction,
  and Other grouping. Resource-backed attacks retain the same aligned four-column play row,
  with their use count folded into quiet source metadata. `04-limited-use-filter-desktop.png`
  and `04-limited-use-filter-mobile.png` verify that Limited Use is the cross-cutting
  management view with compact controls and descriptive rows.
- Final aligned desktop play surface: `04-desktop-aligned-play-surface.png`; the
  1200px internal-scroll and containment check is
  `04-desktop-aligned-play-surface-1200.png`.
- Restored locked mobile pager: `04-mobile-pager-restored-overview.png`; the swipeable
  main-section model and icon-only floating dot-grid launcher remain governed by
  `docs/mockups/character-sheet-play-surface-direction.md`.
- Compact mobile play surface: `04-mobile-compact-overview-final.png`,
  `04-mobile-compact-actions.png`, `04-mobile-compact-spells.png`, and
  `04-mobile-compact-proficiencies-final.png`; the narrow-width checks are
  `04-mobile-compact-overview-320.png` and `04-mobile-compact-proficiencies-320.png`.
- Superseded inline mobile HP exploration: `04-mobile-hp-rest-expanded.png`.
- Final full-Shell HP treatment: `04-hp-vitals-shell-desktop.png`,
  `04-hp-vitals-shell-mobile.png`, and
  `04-hp-vitals-shell-mobile-expanded.png`. The mobile captures include the
  production app header and footer.
- Final responsive HP management:
  `04-hp-management-popover-desktop.png`,
  `04-hp-management-drawer-shell-mobile.png`, and the 320px containment check
  `04-hp-management-drawer-shell-mobile-320.png`. The earlier
  `04-hp-management-drawer-shell-desktop.png` is superseded.
- Final shared Actions insets: `04-actions-insets-shell-desktop.png` and
  `04-actions-insets-shell-mobile.png`.
- Short Rest direction:
  `06-short-rest-preview-popover-desktop.png`,
  `06-short-rest-preview-drawer-mobile.png`,
  `06-short-rest-preview-drawer-mobile-320.png`, and
  `06-short-rest-rolled-popover-desktop.png`.
- Final mobile scroll ownership: `04-mobile-actions-scroll-owner-final.png`. The app shell
  has no residual scroll range at 390px or 320px; the active pager owns only its actual
  content overflow, and its final dock clearance keeps the section launcher clear of the
  last action row.
- Mobile feedback corrections: `04-mobile-feedback-overview-final.png`,
  `04-mobile-feedback-overview-scrolled.png`,
  `04-mobile-feedback-overview-320.png`, and
  `04-mobile-feedback-conditions-drawer.png`.
- Desktop internal-scroll correction: `04-desktop-feedback-workspace-fill-final.png`.
- The earlier `04-actions-charges-polished-*` captures are superseded by the compact Actions evidence.
- Final authored equipment labels: `04-equipment-labels-polished-desktop.png`, `04-equipment-labels-polished-mobile.png`.
- Final compact spell list: `04-spell-list-final-desktop.png`, `04-spell-list-final-mobile.png`, `04-spell-list-final-tablet.png`.
- Final divider-row play-surface review: route-backed desktop Actions, Spells, Inventory,
  and owned-item inspector captures; mobile Overview, Actions, Spells, and Equipment
  captures; and tablet portrait/landscape Spells captures were saved in the Codex app
  visualization artifact set for direct review. The captures verify contained tab focus,
  aligned table facts, unclipped Cast controls, tap-to-inspect inventory rows, and the
  existing mobile pager/launcher model.
- Final action-column placement regression check:
  `character-sheet-actions-alignment-desktop.png`,
  `character-sheet-actions-alignment-tablet.png`, and
  `character-sheet-actions-alignment-mobile.png` in the Codex app visualization artifact
  set.
- Locked tablet adaptation:
  `04-tablet-portrait-locked-shell.png`,
  `04-tablet-landscape-locked-shell.png`,
  `04-tablet-portrait-locked-overview.png`,
  `04-tablet-landscape-locked-overview.png`,
  `04-tablet-portrait-locked-actions.png`,
  `04-tablet-landscape-locked-actions.png`,
  `04-tablet-portrait-locked-spells.png`,
  `04-tablet-landscape-locked-spells.png`,
  `04-tablet-portrait-locked-equipment.png`,
  `04-tablet-landscape-locked-equipment.png`,
  `04-tablet-portrait-right-inspector.png`, and
  `04-tablet-landscape-right-inspector.png`.
- The earlier `04-spell-list-polished-*` captures are superseded by the final spell-list evidence.
- The earlier `*-refined-*` and `*-customize-expanded-*` captures are superseded visual experiments and are not implementation references.

### Status

**Status:** `INTEGRATED`

**Integration base SHA:** `3492e0bdea49`

**Delivery SHA:** `e61821775834bd976dcdf292111a99c0cfe85387`

**Integrated child head SHA:** `b5a4899499cbab5944c2396b115ae00df2703a8d`

Spell, feature, owned-item, background, resource, optimistic-command, and responsive
play-surface scope is integrated into `feature/character-overrides`. Branch 05 may consume
the resource-owner and inspector contracts without redefining source identity, recovery
semantics, or Sheet-versus-Builder ownership.

Current corrective validation:

- Multiclass rest and proficiency correction: green — the focused Sheet suite remains 44/44; Storybook typecheck, Turbo Web app/test typecheck, design-system token tests (6/6), scoped Web/design-system type-aware Oxlint, Oxfmt, and `git diff --check` pass.
- Browser evidence is green at 1440px, 390px, and 320px. The Sheet displays both d10 and d8 pools, the rest overlay resolves `1d10 + 1d8 + 4`, the 390px drawer keeps its action row visible, and the 320px drawer owns its required overflow without horizontal page overflow.
- Theme evidence is green: dark primary buttons compute to transparent with the orange border and warm accent text; light primary buttons remain filled; custom red danger buttons remain red.

- Final correction-specific web tests: green — 44 tests across Sheet sections and optimistic reconciliation.
- Character Sheet Storybook project: green — 27 stories.
- Focused schema, shared-engine, and DB contracts: green — 50 tests.
- Focused Sheet services, command execution, audit, and mechanics projection: green — 84 tests.
- Turbo affected typecheck: green — eight package tasks.
- Web app/test typecheck: green — two Turbo tasks.
- Repository type-aware Oxlint: green across every package; the four Web, two Functions, and two DB failures discovered during final validation were corrected.
- Oxfmt is the canonical formatting process. With explicit approval, `yarn format` normalized all 2,462 matched files once; `yarn format:check` is green and remains the required gate for future changes.
- Focused Builder regression tests: green — 13 tests across selection-option and starting-equipment behavior.
- Responsive visual review: green — the corrected desktop/mobile captures preserve the incumbent Character Sheet and use an overlay inspector.
- Readiness and spell-density polish: green — 44 focused web tests, 27 Character Sheet browser stories, two web typecheck tasks, scoped type-aware Oxlint, scoped Oxfmt, and `git diff --check`.
- Compact Actions correction: green — recovery-only duplicates are suppressed; Trance and feature descriptions are preserved; attacks remain mechanic-only; mobile Resources is separate; 42 focused Sheet-section tests and 27 Storybook browser tests pass; and the exact Sheet service suite passes 68 tests.
- Desktop alignment and reference correction: green — Skills, Proficiencies, and the tabbed play workspace share an exact 690px bottom edge at 1440px and 1200px; overflow is contained in the intended nested scroll regions; Proficiencies excludes skills/saves and groups only armor, weapons, tools, and languages; Defenses appears once in the desktop header; Long Rest is secondary at every breakpoint. Focused Sheet-section tests pass 43/43, focused proficiency/schema service tests pass 77/77, the Functions suite passes 224/224, Turbo affected typecheck passes eight tasks, and scoped Web/Functions/Schema type-aware Oxlint is green.
- Mobile pager restoration: green — the original swipe navigation and icon-only floating
  launcher are restored; the focused Sheet suite exercises the Overview-to-Actions swipe;
  390px and 320px browser geometry keeps both charge steppers fully inside their owning
  rows with no document-level horizontal overflow.
- Compact mobile play surface: green — the shared header is 255px at 390px with no
  horizontal overflow or browser errors, all nine pager pages were exercised, the grouped
  Proficiencies page fits in one 844px viewport, the 320px Overview and Proficiencies states
  remain contained, Turbo web app/test typecheck passes both tasks, and the focused Sheet
  suite passes 43/43.
- Mobile/desktop feedback correction: green — the 390px and 320px Sheet documents fit
  their 844px viewports, the pager is the vertical scroll owner, the launcher is absolute to
  that pager, Wisdom and Charisma have no trailing save separator, Conditions and Exhaustion
  share one manager drawer, and the duplicate mobile status block is absent. The desktop
  bordered tab panel fills its 596px content area, owns scrolling, and has equal 13px
  workspace insets.
- HP vitals correction: green — the progress meter is removed at every breakpoint; current/max,
  Temp HP, Hit Dice, and recovery actions form one aligned cluster. Manage causes no Sheet
  reflow: it opens a 420px anchored popover on desktop/tablet and a 336px bottom drawer on
  mobile. Damage, amount, and healing are equal thirds; Temp HP and Max HP override are
  equal halves. The 390px and 320px captures have no horizontal overflow or clipped labels.
  HP settings commit on blur or Enter without a Save action; the focused Sheet suite passes
  43/43 and the route-backed Storybook console has no runtime errors. Turbo web app/test
  typecheck, type-aware Web Oxlint, repository Oxfmt, and `git diff --check` are green.
- Shared content-inset correction: green — desktop and mobile Action rows measure 18.67px
  from both panel edges; the shared desktop tab panel and mobile pager own the correction,
  so Spells, Inventory, Features, Resources, and Notes inherit it without per-row overrides.
- Mobile scroll-boundary correction: green — the obsolete 82px footer allowance was removed
  from shell content because the footer is already a non-overlapping flex sibling. The mobile
  Sheet now fills the shell content box and flexes its pager beneath the static Sheet header.
  At 390px the app main measures 733/733 client-to-scroll height; at 320px it measures
  689/689 with no horizontal overflow. The pager remains the only vertical scroll owner.
- Impeccable critique/polish/audit: final Actions design score is 40/40 with no findings; the broader technical audit is 45/50 and the deterministic detector returns `[]`. The stale combined pre-polish critique was replaced by the single current snapshot under `.impeccable/critique/`.
- `git diff --check`: green.
- Live Storybook MCP remains unavailable because its configured HTTP transport rejects tool POST requests with HTTP 501. The repository Storybook browser-test project is green; no connector or product configuration workaround was added.
- Final compact play-list correction: green — Sheet sections pass 42/42, Inspector tests
  pass 8/8, focused Sheet panel/projection services pass 70/70, command audit passes 3/3,
  Turbo Web typecheck passes both tasks, schema build passes all three tasks, Functions
  typecheck passes, Oxfmt check covers 2,462 files, and `git diff --check` passes.
- Limited-use action correction: green — the Sheet action contract exposes only activation
  kinds and links actions to authored resources by ID. All and activation filters keep
  limited-use entries in their real groups; the Limited Use filter selects those same rows
  without introducing a redundant section. Focused schema tests pass 9/9, Sheet services
  pass 69/69, Sheet sections pass 43/43, the schema build passes three tasks, the Storybook
  typecheck passes, and Turbo affected typecheck passes all eight package tasks.
- Resource-backed attack alignment refinement: green — All and Attack keep the exact
  Name, Range, Hit/DC, and Damage grid, with the source and remaining uses sharing one quiet
  identity line. Limited Use switches those attacks to the same descriptive management row
  as other tracked actions. Focused Sheet sections pass 43/43; Turbo Web app/test and
  Storybook typechecks pass. Browser geometry at 1440px, 390px, and 320px confirms exact
  vertical centering, contained controls, zero page overflow, and no console errors.
- Final in-app browser review is green at 1440×1000, 1180×820, 820×1180, and
  390×844. Actions remain grouped by action kind in All; attack rows share Range,
  Hit/DC, and Damage columns; Spells use backend facts with quiet source text and
  damage-only effects; Inventory uses Carried terminology and divider rows; and the
  owned-item inspector exposes instance facts, charges, description, and customization.
- Locked tablet validation is green at 820×1180 portrait and 1180×820 landscape. All six
  tablet tabs were exercised with zero document-level horizontal overflow; the Overview,
  Actions, Spells, and Equipment captures have no console or page errors. In landscape, the
  Skills rail and tabbed workspace share a 492px bounded height and independent internal
  scrolling. Boundary checks at 1024×768 and 960×720 have no horizontal overflow or console
  errors; the narrower 960px composition uses normal document scrolling when the header wraps.
  Both inspector stories measure exactly 480px wide, attach to the right viewport edge, and
  fill the viewport height. Focused Sheet and inspector tests, Storybook typecheck, scoped
  type-aware lint, Oxfmt, and diff validation are recorded with the Branch 04 handoff.
- The final tablet lock includes Passive Perception, Passive Investigation, and Passive Insight
  in both Overview and the Senses inspector. Their earlier visual omission was fixture-only;
  the engine-backed Sheet projection and generic passive-fact renderer already supported all
  three standard checks.

### Handoff

**Status:** `INTEGRATED`

**Delivery SHA:** `e61821775834bd976dcdf292111a99c0cfe85387`

**Integrated child head SHA:** `b5a4899499cbab5944c2396b115ae00df2703a8d`

#### Contract and ownership decisions

- Panel discriminators added in this branch are `SPELL`, `SPELLS`, `FEATURE`, `ITEM`,
  `BACKGROUND`, and `RESOURCE`. They extend the Branch 03 semantic inspector contract and
  do not introduce layout nodes, platform identifiers, CSS, callbacks, or a general UI DSL.
- Resource owners remain closed and typed: `AUTHORED_GRANT`, `SPELL_SOURCE`,
  `ITEM_INSTANCE`, `SENSE_GRANT`, and the prepared `COMPANION_FEATURE` owner. Persisted
  resource state stores used amount; maximum, remaining, and recovery behavior are resolved
  from authored and engine state.
- Recovery triggers are `SHORT_REST`, `LONG_REST`, `DAWN`, `DUSK`, `DAILY`, and `MANUAL`.
  Recovery supports all, fixed, and dice-based amounts. Dawn, dusk, daily, and manual
  recovery remain explicit player commands; no scheduled recovery service was added.
- Spell customization is isolated by exact spell-source identity. To Hit and Save DC use
  mutually exclusive bonus/override modes; Damage is bonus-only. Custom name, general notes,
  and Display in Actions remain independent per-source customizations.
- Owned-item state and customization are isolated by owned-item instance UUID. Authored item
  properties and descriptions remain inspectable and cannot be suppressed by Sheet changes.
- Manage Spells owns legal prepare/unprepare play actions. Structural spell acquisition and
  known-spell changes remain Builder-owned. The Sheet provides a Builder handoff instead of
  duplicating acquisition.
- PostgreSQL UUID-shaped deterministic authored IDs are validated with the database-compatible
  GUID contract. Generated command IDs remain strict RFC UUIDs.
- Manual adjustment provenance is note-only. Source category and source label were removed
  from commands, DTOs, persistence, fixtures, history payloads, and manual UI.

#### Persistence and migration order

1. `20260720190535_add_creature_speed_order.sql` is idempotent when replayed against an
   already-partially-migrated database.
2. `20260724230000_character_sheet_content_resources.sql` adds source customization,
   resource, owned-item state, and command-event persistence. Deterministic
   `resource_grant_id` values are stored as text; owned instances remain UUIDs.
3. `20260725010000_character_sheet_adjustment_note_only.sql` preserves existing manual
   provenance in Source notes, removes source-category/source-label persistence, and leaves
   new databases on the same note-only baseline.

The migrations were replayed from a local reset, followed by the local SRD seed. The
Character Sheet integration script then verified adjustment clear/round-trip, HP backfill,
class-spell state, event atomicity, movement preference, note lifecycle, RLS, rollback,
stale-version rejection, and touched play state.

#### Validation evidence

- Local Supabase reset and migration replay: green.
- Local SRD seed: green.
- DB package tests: green — 46 files, 395 tests.
- Character Sheet database integration: green, including all 15 owner-only RLS policies.
- Schema package tests: green — 11 files, 119 tests.
- Focused optimistic Sheet projection: green — 4 tests.
- `yarn turbo:affected:test`: green — 8 tasks; Web reports 105 files and 633 tests.
- `yarn test:web:storybook`: green — Chromium reports 30 files and 114 tests.
- `yarn turbo:affected:typecheck`: green — 8 tasks.
- `yarn lint:ox:type-aware`: green.
- `yarn format:check`: green — 2,460 matched files.
- `git diff --check`: green.

Full command output is retained locally under the ignored `tmp/verification/` directory.
The locked visual evidence is indexed in the preceding section, including desktop, mobile,
tablet portrait/landscape, narrow overflow, inspector, HP, action, spell, inventory, and
limited-use states.

#### Deferred scope and Branch 05 prerequisites

- Companion creation, lifecycle, state persistence, equipment assignment, and companion
  play panels remain Branch 05. Branch 05 must use the prepared `COMPANION_FEATURE`
  resource-owner contract and the existing right-inspector/mobile-drawer seam.
- Complete HP, condition, exhaustion, and atomic short/long-rest workflows remain Branch 06.
  Branch 04 includes their locked layout direction and reusable recovery primitives only.
- Custom-skill CRUD, campaign currency/exchange policy, scheduled time recovery, automatic
  spell action classification, and a generic Resources destination remain deferred.
- Safe removal of the deprecated HP compatibility column remains an integration follow-up
  after the complete Phase 00 migration and rollback window is validated.

## Branch 05 — Extras

> **Status:** integrated into `feature/character-overrides`. Delivery remains locked at `0bd47e4b1011`; the ledger-only child head is `0da94343`.

**Entry:** Generic resource owners, the `COMPANION_FEATURE` owner, companion calculation context, persisted creature/vehicle instances, and the existing right-inspector/mobile-drawer seam are available.

**Exit:** Authorized add/remove for companions, mounts, owned creatures, and vehicles; independent instance state; typed creature adjustments; creature HP/temp HP/hit dice/resources/equipment; vehicle current HP/equipment; inspection-only authored actions/features; transactional cascade/history; responsive Extras surfaces; and focused validation are green. Handoff records the exact contracts, migration, evidence, and deferred work.

### Locked delivery contract

- **Extra kind** is a shared core option with `{ code, label }`: `COMPANION`, `MOUNT`, `OWNED`, and `VEHICLE`. UI renders backend-provided labels, never enum-derived presentation.
- A creature instance has exactly one relationship role: `COMPANION`, `MOUNT`, or `OWNED`. `originKind` is a separate character-instance property with the shared core options `WORLD` and `SUMMONED`; it is not authored creature metadata and does not bind lifecycle to a spell or feature.
- Existing persisted `SUMMONED` relationships migrate to `relationshipKind = COMPANION`, `originKind = SUMMONED`; all other existing creature instances receive `originKind = WORLD`.
- `customName` remains the persisted player name. Responses expose `displayName = customName ?? authoredName` alongside immutable `authoredName`; a custom-name row renders, for example, `Ferdinand (Owl)`.
- Creature instances expose active state, name/notes, current and temporary HP, structured hit dice, equipment, `COMPANION_FEATURE` resources, typed companion adjustments, and authored actions/features for inspection only. Vehicle instances expose active state, name/notes, current HP, authored operational data, equipment assignment, and inspection-only actions/features; vehicles do not gain temp HP, hit dice, adjustments, or resources in this branch.
- The Sheet owns versioned, retry-idempotent immediate commands. Add/remove and mutations authorize the character, use the existing command/event transaction, and removal cascades instance state, resources, adjustments, and assignments while preserving inventory and history.
- The Sheet adds one responsive **Extras** destination. The Add Extra flow selects kind, an authorized creature or vehicle, and creature origin before immediate creation and inspector opening. Rows are explicit companion, mount, owned-creature, and vehicle presentations; the existing inspector handles detailed management.

### Explicitly deferred

- Source bindings, spell/feature enforcement, dismiss/re-summon flows, and automatic removal when a summoning source changes.
- Automated creature/vehicle attack, damage, saving throw, or action resolution.
- Vehicle temporary HP, hit dice, typed adjustments, and feature resources.
- Rest recovery policy beyond the existing prepared resource contracts; complete rests remain Branch 06.

### Checkpoints

| Checkpoint      | Required evidence                                                                                                                              | Status  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| 1. Contract     | Core option registries; role/origin migration; DTO, command, and panel contracts; character/persistence guide review                           | `GREEN` |
| 2. Persistence  | Migration, RLS, hydration, instance isolation, vehicle current-HP, removal/history coverage                                                    | `GREEN` |
| 3. Service      | Authorization, calculation context, panel resolution, immediate commands, concurrency/idempotency, optimistic boundaries                       | `GREEN` |
| 4. Play surface | Add Extra flow; rows and inspectors; custom naming; desktop/mobile/tablet/theme/a11y/overflow evidence                                         | `GREEN` |
| 5. Handoff      | Green validation; ledger delivery SHA; delivered/deferred, migration/contracts/commands/panels/visual evidence, risks, Branch 06 prerequisites | `GREEN` |

### Progress log

- `2026-07-27`: Branch activated from `3485aef1`; contract and documentation checkpoint opened.
- `2026-07-27`: Checkpoints 1–3 are green. Shared core registries, subject/API contracts, the role-to-origin migration, atomic Extras persistence, sheet command/event integration, and semantic panel resolution are delivered. `yarn build:shared`, `yarn build:schema`, and `yarn build:db` passed; DB tests passed (46 files, 398 tests) and functions tests passed (23 files, 226 tests).
- `2026-07-27`: The responsive Extras code path is green: Turbo web typecheck passed (2 tasks), focused Sheet sections passed (45 tests), scoped type-aware Oxlint passed for shared/schema/db/functions/web, Oxfmt and `git diff --check` passed, and the Storybook build passed (7 tasks). Checkpoint 4 still needs interactive desktop/tablet/mobile visual and accessibility evidence; checkpoint 5 cannot be marked handoff-ready until that evidence and the delivery SHA are recorded.
- `2026-07-28`: Persistence and source-data validation are green. A clean local Supabase reset replayed the canonical migration bundle; rollback-only Postgres probes rejected every invalid HP/hit-die case and confirmed the explicit hit-die RLS deny policy. The repository-native `yarn seed:srd:local` completed with 1 system and 1,032 domain roots, and `yarn audit:srd` reported no differences or validation failures. SRD seeding is intentionally command-driven rather than sourced from `supabase/seed.sql`.
- `2026-07-28`: Final technical validation is green: focused schema (37), functions (86), and Extras inspector (12) tests passed; affected typecheck passed 8/8 tasks; affected tests passed 8/8 tasks, including 105 web files and 637 tests; the browser-backed Storybook suite passed 116/116 stories and interactions; type-aware Oxlint, Oxfmt, `git diff --check`, and the seven-task Storybook production build passed. One unrelated form test reached its five-second timeout only while test, typecheck, and lint graphs competed in parallel; the isolated repository-native affected-test rerun passed cleanly.
- `2026-07-28`: Checkpoint 4 is green. Live Storybook inspection covered 1440×1000 desktop, 1180×820 landscape tablet, 820×1180 portrait tablet, 390×844 phone, and 320×700 narrow phone in dark mode plus desktop light mode. All viewports had zero horizontal overflow; the narrow phone retained complete content through its intended internal scroll area. Companion and vehicle rows/panels, custom/authored naming, high-level per-kind metrics, Add success/pending/error states, retained selections after failure, semantic dialog controls, and trigger-focus restoration were verified. Checkpoint 5 remains pending only until the delivery SHA and final handoff ledger entry are recorded.
- `2026-07-28`: Extras presentation was distilled to the Sheet's established flat-row language: title-first rows, divider-separated stat blocks, no redundant kind badge, and creature Origin hidden at the mobile breakpoint. Creature summaries now show the first authored non-walking movement mode and fall back to walking only when no other mode exists. Replacement evidence is green: focused functions tests passed 17/17, focused Extras/inspector tests passed 12/12, functions and both web TypeScript projects passed, scoped type-aware lint and formatting passed, and a clean Storybook interaction completed without console warnings. Live 1440×1000, 820×1180, 390×844, and 320×700 checks showed flat 0px-radius rows, the intended Origin breakpoint behavior, one `Flying 60 feet` summary, and zero horizontal overflow.
- `2026-07-28`: Branch 05 is handoff ready and locked. Delivery commit `0bd47e4b1011` contains the complete Extras lifecycle and play-surface implementation; all five checkpoints are green.
- `2026-07-28`: Branch 05 child head `0da94343` was fast-forwarded into `feature/character-overrides`; Branch 05 is integrated and Branch 06 is next.

### Handoff

**Status:** `INTEGRATED`

**Delivery SHA:** `0bd47e4b1011cbfc3de6b451faf0ffd3af6c95a6`

**Integrated child head SHA:** `0da94343cc2019f9518fa514e7cb568844ab1392`

#### Delivered contracts and ownership

- The locked delivery contract above is authoritative. Extras are Sheet-owned instances; authored creature and vehicle definitions remain immutable source records.
- Shared core registries own `{ code, label }` options for extra kind and creature origin. Relationship role and origin are separate persisted properties.
- `ADD_SHEET_EXTRA`, `UPDATE_SHEET_EXTRA`, and `REMOVE_SHEET_EXTRA` are versioned Sheet commands. Creature and vehicle panels use explicit instance targets and the existing inspector seam.
- Creature overrides enter the existing companion calculation context. Instance state, adjustments, resources, and equipment remain isolated by persisted instance identity.
- Extras rows are flat play-surface summaries. Creature rows show one authored non-walking speed, falling back to walking, and suppress Origin at the mobile breakpoint; detailed actions and features remain inspector content.

#### Persistence and migration order

1. The canonical character tables, generated bootstrap bundle, deployed bootstrap migration, repositories, upserts, and generated database types include creature origin plus independent creature and vehicle play state.
2. `20260727090000_character_creature_origin_kind.sql` converts legacy `SUMMONED` relationships to `relationship_kind = COMPANION` with `origin_kind = SUMMONED`; other creature instances receive `origin_kind = WORLD`.
3. Add, update, and removal use the existing character event transaction. Removal cascades instance-scoped resources, adjustments, and assignments while preserving inventory ownership and history.

#### Validation evidence

- Local Supabase reset and canonical migration replay: green.
- Repository-native local SRD seed and `yarn audit:srd`: green; 1 system and 1,032 domain roots with no differences or validation failures.
- DB tests: green — 46 files and 398 tests.
- Final focused schema, functions, and Extras inspector tests: green — 37, 86, and 12 tests.
- `yarn turbo:affected:test`: green — 8 tasks; web reports 105 files and 637 tests.
- `yarn test:web:storybook`: green — 116 stories and interactions.
- `yarn turbo:affected:typecheck`: green — 8 tasks.
- Type-aware Oxlint, Oxfmt, Storybook production build, and `git diff --check`: green.
- Desktop, tablet portrait/landscape, 390px phone, and 320px narrow-phone visual, theme, accessibility, focus-restoration, and overflow checks: green.

#### Deferred scope and Branch 06 prerequisites

- Source-bound summons, dismiss/re-summon behavior, and automatic removal when a spell or feature source changes remain deferred.
- Automated creature and vehicle attacks, saves, damage, and authored action resolution remain deferred.
- Vehicle temporary HP, hit dice, typed adjustments, and feature resources remain deferred.
- Branch 06 may recover selected eligible companion hit dice and `COMPANION_FEATURE` resources through its atomic rest transaction. It must reuse the existing owner identities and command/event boundary rather than introducing a parallel companion recovery path.
- Create `codex/character-overrides-06-vitals-rests` from the integration head after this ledger commit, then activate the Branch 06 checkpoints before implementation.

## Branch 06 — Vitals and complete rests

> **Status:** active on `codex/character-overrides-06-vitals-rests` from integration SHA `0b9d37574ae7a1da35c699a1fd5c37cfcc9054f4`.

**Entry:** Character/companion resources share recovery contracts and deterministic dice results.

**Locked short-rest direction:** Short Rest uses a 420px anchored popover on desktop/tablet and a
responsive bottom drawer up to 48rem on mobile. The staged preview shows current, temporary, and
missing HP; every backend-authorized class hit-die pool with independent selected counts and
per-die Constitution modifiers; one canonical mixed-die roll expression; roll/healing status;
automatic recoveries; and one atomic **Take Short Rest** action. A multiclass Fighter 2 / Rogue 1
fixture proves separate d10 and d8 pools on both the Sheet and the rest surface.

The preview includes **Reset Maximum HP changes during this rest** and **Automatically apply healing
with dice result**. Reset Maximum HP removes only the current additive maximum-HP change selected
for the rest; it does not clear an absolute maximum-HP override or unrelated manual adjustments.
When automatic healing is enabled, the canonical result stages healing immediately. When disabled,
the result remains available for an explicit apply-healing choice before rest completion. The dice
expression opens the product dice interaction; the accepted roll evidence, healing, recoveries, and
rest completion remain one versioned transaction. Temporary HP is unchanged.

The current immediate `USE_HIT_DIE` and `APPLY_REST` commands remain transitional and must not power
this production UI: hit-die rolls, healing, resource recovery, and rest completion require the
planned versioned preview/apply contract and one transaction.

Mockup evidence:

- `docs/mockups/character-sheet-overrides/06-short-rest-preview-popover-desktop.png`
- `docs/mockups/character-sheet-overrides/06-short-rest-preview-drawer-mobile.png`
- `docs/mockups/character-sheet-overrides/06-short-rest-rolled-popover-desktop.png`
- `docs/mockups/character-sheet-overrides/06-multiclass-hit-dice-sheet-mobile.png`

**Exit:** HP clamping, conditions/exhaustion, backend previews, atomic short/long rest, stale-preview safety, exact result evidence, selected eligible companion recovery, mockup parity, and focused tests are green. Handoff records transaction/order/roll contracts and evidence.

### Locked delivery contract

- The backend owns hit-die randomization. The frontend only animates and reveals the returned faces; completed-rest history stores the accepted expression, faces, total, healing, and recoveries.
- Rest preview is read-only and ephemeral. `COMPLETE_REST` re-resolves the preview and commits through the existing Sheet command/event transaction; no rest table, preview table, migration, or new RLS policy is planned.
- A zero-die short rest is valid only when another authoritative recovery changes state. Classes sharing a hit-die denomination use the existing aggregated pool with combined class labels.
- Companion participation is explicit and initially unselected. Selected eligible companions reuse the Branch 05 hit-die and `COMPANION_FEATURE` owner seams.
- Long Rest reuses the Short Rest responsive shell. The existing immediate `USE_HIT_DIE` and `APPLY_REST` commands remain transitional and do not power production rest UI.

### Checkpoints

| Checkpoint      | Required evidence                                                                                                                    | Status   |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 1. Contract     | Strict mixed-die evidence; preview/result DTOs; ruleset rest/exhaustion policy; HP floor/clamping invariants                         | `GREEN`  |
| 2. Persistence  | Existing-schema transaction; exact event result; stale/no-partial writes; duplicate convergence; selected typed companion recovery   | `GREEN`  |
| 3. Service/API  | Authorized preview and backend roll; production `COMPLETE_REST`; thin tRPC/REST adapters; authoritative response/history hydration   | `GREEN`  |
| 4. Play surface | HP/status completion; 420px popover and 48rem drawer; staged healing; responsive/theme/a11y/overflow/mockup evidence                 | `GREEN`  |
| 5. Handoff      | Focused technical and browser validation; transaction/roll contract; migration N/A; delivery SHA; delivered/deferred scope and risks | `ACTIVE` |

### Progress log

- `2026-07-27`: Branch activated from clean integration SHA `0b9d37574ae7a1da35c699a1fd5c37cfcc9054f4`. Checkpoint 1 opened. Existing persistence was audited as sufficient, so migration and new-RLS work are explicitly N/A unless implementation proves a material conflict.
- `2026-07-27`: Checkpoint 1 is green. Strict rest preview/result and `COMPLETE_REST` contracts, mixed-die roll validation, effective-maximum HP clamping primitives, D&D 5e 2014 rest/exhaustion policy, and typed event/history results are delivered. Shared and Schema typechecks passed; focused Shared rest tests passed 5/5 and Schema command-contract tests passed 20/20. Checkpoint 2 opened on the existing Sheet transaction.
- `2026-07-28`: Checkpoints 2 and 3 are green. Rest preview uses the backend random source and deterministic fingerprints; `COMPLETE_REST` re-resolves inside the existing locked Sheet transaction and atomically persists HP, character and selected-companion hit dice, slots, exhaustion, typed resources, selected maximum-HP modifier removal, and the exact completed-rest event. Sequential and concurrent duplicate commands replay that stored result. Focused Functions tests passed 93/93, the final execute suite passed 23/23, Functions/API typechecks passed, and API routing tests passed 5/5.
- `2026-07-28`: Checkpoint 4 is green. The production Sheet now owns the shared Short/Long Rest control, condition and exhaustion definitions/notes, and corrected HP reset semantics; the marketing capture reuses that production component. Storybook and browser review covered desktop, tablet portrait/landscape, the exact 48rem boundary, 390px, and 320px in both Forge themes with keyboard Escape/focus return, reduced motion, increased text, coarse-pointer targets, manual-healing staging, roll invalidation, and zero horizontal overflow. The focused Sheet suite passed 50/50 and the two rest-bearing Storybook files passed 46/46 browser tests.
- `2026-07-28`: The mandatory Impeccable finish review is resolved. Preview fingerprints now bind the rules identity plus resolved long-rest exhaustion and character hit-die effects; stale policy previews reject before writes. Exhaustion retains 10px visual pips inside 44px coarse-pointer targets, and the public exhaustion command defers the maximum to the active rules policy. The post-review focused Schema/Functions suite passed 116/116 tests, and final browser measurements confirmed 44px exhaustion and close targets, reachable landscape actions, no horizontal overflow, and an enabled no-roll Long Rest.
- `2026-07-28`: Initial delivery commit `57483cc09032373041b132b5ebd9d0c32090fda4` passed the focused, affected, formatting, lint, browser, and Character Sheet Postgres gates. The broader seeded lifecycle runner still exposed pre-rest fixture and performance failures, so its completed-rest proof remained an open Checkpoint 5 correction rather than an accepted validation gap.
- `2026-07-28`: The seeded lifecycle correction is green at `08bcccdbfe12ff92f24f9f600f7d6b0f55db7853`. Builder HP normalization now uses rules-engine effective abilities; disabled grant options survive application-view projection; seeded choices avoid disabled and duplicate full-proficiency targets; the Dragonborn fixture uses its canonical Constitution result; inspiration clearing persists `false`; resource commands no longer request a nonexistent panel; and Sheet extra options use one bounded catalog query instead of fully hydrating every creature and vehicle. The Prepared Caster lifecycle fell from 307 seconds to 25 seconds, and the unfiltered runner now passes all four Martial, Prepared Caster, Choice-Heavy, and Multiclass HP fixtures through completed-rest retry, stale-write, persistence-reload, and rollback assertions.
- `2026-07-28`: Deterministic Sheet commands now project optimistically for HP damage/healing, direct HP/temp changes without a maximum override, condition add/remove, exhaustion levels/notes, inspiration, spell slots, and typed resource use/recovery. Maximum-HP adjustment calculations and `COMPLETE_REST` remain authoritative because they depend on engine policy or backend roll evidence. The shared mutation boundary still snapshots, rolls back on failure, and reconciles every success with the returned authoritative Sheet.
- `2026-07-28`: Checkpoint 5 reopened for the approved pre-Branch-07 Character frontend structural cleanup. The prior delivery SHA is superseded while Builder, Sheet, page, fixture, story, test, and style ownership move into feature-owned modules and the Exhaustion disclosure adopts Mantine Accordion. This cleanup preserves the existing optimistic Sheet boundary and introduces no transport contract, migration, RLS, or backend integration change.

### Handoff

**Status:** `ACTIVE`

**Delivery SHA:** `PENDING` — supersedes `08bcccdbfe12ff92f24f9f600f7d6b0f55db7853`

#### Delivered contracts and ownership

- Rest preview is an authenticated, read-only request with rest kind, expected version, exact selections, healing decision, companion IDs, optional evidence, and an explicit backend-roll request. Its response carries authoritative HP, labelled aggregated pools, per-die Constitution modifiers, canonical mixed expression, exact evidence, staged healing, recoveries, eligibility, `canApply`, and a deterministic fingerprint.
- `COMPLETE_REST` is the only production rest command. Completed-rest results hydrate command responses, immutable events, history, and exact retries. Transitional `USE_HIT_DIE` and `APPLY_REST` remain compatibility-only and have no active production Web callers.
- `RulesSystem` owns the closed rest/exhaustion policy. The D&D 5e 2014 implementation recovers half total hit dice with a minimum of one, reduces exhaustion by one, and exposes the active exhaustion definition and limits.
- Builder save, Sheet adjustment changes, rest-selected modifier removal, and Sheet projection share the effective-maximum HP floor and current-HP clamp. Reset Maximum HP targets only `HIT_POINTS/MAXIMUM_MODIFIER`.
- Deterministic Sheet commands project optimistically through the existing command mutation with rollback and authoritative success reconciliation. Engine-derived maximum-HP changes and completed rests intentionally wait for the backend response.

#### Transaction and roll contract

1. Authorize the character, resolve prior `commandId`, and compare the expected stream version.
2. Rebuild the preview from current character, typed play state, adjustments, companion instances, and rules-policy outcomes; compare the fingerprint before persistence.
3. Validate denomination selections, companion eligibility, exact roll count/faces/modifiers/total, healing decision, and maximum-HP modifier reset.
4. Use the existing locked `patchSheetState(...afterPersist)` transaction for HP, character/companion hit dice, spell slots, exhaustion, typed resource usage, and the selected adjustment removal.
5. Append the typed completed-rest event last and increment the stream exactly once. Sequential and lock-time concurrent duplicates reread the stored event; mismatched `commandId` reuse fails.
6. Production rolls use the backend random source. Tests inject deterministic values. The UI only reveals returned faces and never manufactures accepted evidence.

#### Persistence and migration

- Migration: N/A. Existing Sheet state tables, typed resource ownership, companion state, stream version, and event JSONB cover the complete transaction.
- New RLS policy: N/A. The existing Character Sheet owner-only application boundary remains the only persistence path.
- No preview table, pending-roll table, signed token, cache, queue, or parallel rest repository was introduced.
- Sheet creature/vehicle options use a bounded set-based read query. Only attached extras receive full authored hydration, avoiding the previous whole-catalog N+1 projection cost without changing persistence.

#### Validation evidence

- `yarn test:character:integration`: green — all four seeded lifecycle fixtures, including atomic completed-rest retry/stale/rollback and persisted reload equality.
- `yarn turbo:affected:test`: green — 8 tasks; Functions reports 24 files and 248 tests, and Web reports 105 files and 644 tests.
- `yarn turbo:affected:typecheck`: green — 8 tasks.
- Focused lifecycle correction tests: green — 3 service files and 61 tests; affected-suite mock regressions pass 14/14.
- Focused optimistic Sheet projections: green — 6 tests.
- Post-review focused Schema/Functions policy, contract, and service tests: green — 116 tests.
- Focused production Sheet tests: green — 50 tests.
- Focused Storybook interactions: green — 46 tests across the production Sheet and reused marketing capture.
- `yarn test:character-sheet:integration`: green — event atomicity, rollback, stale-version protection, touched-state isolation, and owner RLS verified against local Postgres.
- Repository type-aware Oxlint, repository Oxfmt, and `git diff --check`: green.
- Browser evidence: desktop, tablet portrait/landscape, exact 48rem boundary, 390px, and 320px; both Forge themes; keyboard/focus, reduced motion, increased text, touch targets, overflow, staged healing, roll invalidation, and Long Rest verified. Captures remain in ignored `output/playwright/branch06-short-rest-*.png`.

#### Deferred scope and residual risk

- Signed roll evidence or persisted previews remain intentionally deferred because direct manual Sheet adjustment already permits equivalent outcomes.
- Per-class hit-die persistence for classes sharing a denomination, generic dice history, schedulers, source-bound summons, rest timestamps, and new companion models remain deferred.

## Branch 07 — Integration and completion

**Entry:** Branches 01–06 are `INTEGRATED` with no known failed gate.

**Exit:** Screenshot inventory coverage, Impeccable distillation, abstraction cleanup, exhaustive commands/adapters, end-to-end workflows, accessibility/theme/overflow states, roadmap renumbering, dice roadmap, full required validation, hosted Netlify smoke test, and one PR are green. Mark this ledger `FINAL_VALIDATED`.
