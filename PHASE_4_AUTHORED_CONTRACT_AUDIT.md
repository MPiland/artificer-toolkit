# Phase 4 Authored Contract Audit

## Summary

This audit is a hard gate before further Phase 4 persistence-shape decisions.

Phase 2 proved the current authored contracts compile and are serviceable, but it did not fully answer the larger authored-design question:

- are these the right content-creation shapes for D&D-first authoring
- do they leave enough room for homebrew flexibility
- would they still make sense when exposed through a real authoring UI
- do they map cleanly to long-lived persisted content

This audit exists so persistence does not keep hardening around temporary or philosophically weak authored contracts.

## Decision Standard

Every authored contract group should be reviewed using these three standards:

- `SRD fit`
  - does the shape model actual D&D 5e 2014 SRD mechanics cleanly
- `homebrew headroom`
  - can an author express non-SRD but coherent mechanics without awkward hacks
- `authoring ergonomics`
  - would this shape make sense in a real UI form and persisted content workflow

Each reviewed group must receive one of these verdicts:

- `Keep`
- `Keep with reshape`
- `Split into domain-local helpers`
- `Remove shared abstraction`

## Scope and Order

Audit in this order so shared abstractions are settled before root contracts depend on them.

### 1. Shared helper authored contracts

- `shared/authored/scaling.ts`
- shared charge contracts
- shared starting-equipment contracts
- shared facet/restriction contracts
- shared characteristics such as range, duration, and shape
- saving-throw and other reused helper payloads

### 2. Effects and grants

- damage/effect/moment authored payloads
- feat/modifier/proficiency/sense/spell grant authored contracts
- any discriminated payloads currently depending on shared scaling helpers

### 3. Feature and subject roots

- features/options
- classes
- spells
- races
- backgrounds
- feats
- equipment

### 4. Character authored contracts

- `subjects/authored/character/intent.ts`
- `subjects/authored/character/state.ts`

This character pass must explicitly revalidate the `intent` vs `state` split philosophically, not just structurally.

## Scaling Sub-Audit

Scaling is a first-class sub-audit, but it is not the only topic.

Default direction unless the audit proves otherwise:

- keep `SCALING_SOURCE` and `ScalingSourcePayload` as shared core concepts
- keep `SCALING` / `ScalingKind` only if they still describe multiple domains cleanly
- do not keep `LevelScaledValue` or `PoolScaledValue` just because they are generic helpers
- prefer domain-local scaling unions when the payload semantics differ materially by domain

Current likely direction:

- `LevelScaledValue` may survive only if grants and damage truly want the same authored shape
- `PoolScaledValue` is the most likely candidate to remove from `shared/authored/scaling.ts`
- `ChargeAuthored` already being separate is strong evidence that one broad shared scaling-helper file may be too generic

Design rule:

- shared scaling should express what level source drives a mechanic
- domain contracts should express how that mechanic changes

## Required Audit Output

For each authored contract group, record:

- current problem
- target authored shape
- why the target is better for SRD fit, homebrew flexibility, and authoring UI clarity
- persistence impact
- compiler impact
- map impact
- schema impact

This file should become the source of truth before more Phase 4 table changes are made.

## Implementation Order After Audit

After this audit is decision-complete, implementation must proceed in this order:

1. update authored TypeScript contracts
2. update node maps to match the new authoring shapes
3. update compilers to match
4. update `packages/schema`
5. then resume Phase 4 SQL normalization against the revised authored contracts
6. recreate the database
7. regenerate DB types
8. then write the real Kysely upserts, queries, and assemblers

## Acceptance Criteria

This audit is complete only when:

- every major authored helper and root contract has a written verdict
- scaling has an explicit final decision on:
  - shared source concepts
  - shared kind concepts
  - fate of `LevelScaledValue`
  - fate of `PoolScaledValue`
- character `intent` / `state` has been revalidated philosophically
- persistence-impact notes exist for every reshaped contract
- the implementer could update maps, compilers, schema, and DB without making fresh design decisions

## Current Status

- audit populated with contract-by-contract verdicts for shared helpers, effects/grants, root authored content, and character contracts
- this hard gate is now closed at the decision level
- the next implementation work is to apply the documented authored reshapes through `packages/shared`, `packages/schema`, and then resume Phase 4 persistence normalization against those settled contracts

## Final Scaling Decisions

These are the locked scaling decisions for the next implementation pass.

- Keep shared level-source concepts only where they express a real cross-domain mechanic.
- Remove vague `SOURCE_LEVEL`.
- Do not introduce a generic `OWNER_LEVEL`.
- Use explicit scaling references instead:
  - `CHARACTER_LEVEL`
  - `CLASS_LEVEL { classId }`
  - `SPELL_CAST_LEVEL`
  - a parent-scoped class progression alias for class-owned and subclass-owned nested content
- Parent-scoped class progression resolves to the owning class level, including subclass-owned content.
- `CLASS_LEVEL` outside class-owned content must identify exactly one class.
- `SPELL_CAST_LEVEL` means the actual cast or upcast level, not the spell's printed base level.
- Scaling answers magnitude only.
- Restrictions and filters answer applicability only.
- Payloads answer what is granted or changed.
- Default authoring posture is global unless narrowed.

## Shared Helpers

### `shared/authored/scaling.ts`

- Verdict: `Split into domain-local helpers`
- Current problem:
  - `LevelScaledValue` and `PoolScaledValue` are generic helper types that help TypeScript correlate payloads, but they do not read like first-class authoring concepts.
  - They blur the line between "what level source drives this" and "how this specific mechanic changes."
  - `SOURCE_LEVEL` emerged as a compensating abstraction because the shared helper was too generic for class-owned content.
- Target authored shape:
  - Keep a small shared scaling-reference concept only:
    - `CHARACTER_LEVEL`
    - `CLASS_LEVEL { classId }`
    - `SPELL_CAST_LEVEL`
    - `PARENT_CLASS_LEVEL`
  - Move mechanic-specific scaling payloads into the domain that owns them.
  - Replace `PoolScaledValue` with domain-local pool-style payloads wherever pool mechanics remain.
  - Keep a shared leveled-entry helper only if multiple domains still want the exact same `[{ id, level, order, ...payload }]` authoring shape after the refactor.
- SRD fit:
  - Better matches cantrip scaling, class progression, and upcast behavior without inventing a vague owner/source level concept.
- Homebrew rationale:
  - Authors can still choose explicit level sources, but mechanic-specific payloads remain open to future custom progression shapes.
- Authoring-UI rationale:
  - Authors pick a concrete progression source first, then configure the mechanic's growth in a domain-specific form.
- Persistence impact:
  - DB columns should model an explicit scaling reference plus domain-local scaling rows.
- Compiler impact:
  - Compilers become simpler because source resolution and payload interpretation are separated.
- Map impact:
  - Maps should expose an explicit scaling-reference union and then a domain-local scaling payload editor.
- Schema impact:
  - `packages/schema` should validate shared scaling references and domain-local scaling payloads separately.

### `shared/authored/charge.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - `SOURCE_LEVEL` is philosophically weak.
  - `limitKind` currently mixes source identity and amount strategy in one discriminator family.
  - Charge limits and charge bonuses are legitimate shared concepts, but the current limit model does not express explicit progression sources cleanly.
- Target authored shape:
  - Keep `ChargeAuthored` as a shared authored contract.
  - Replace `limitKind: 'SOURCE_LEVEL'` with an explicit scaling reference.
  - Model the charge limit in two layers:
    - amount strategy: fixed vs derived from level progression
    - progression source: character, class, spell cast level, or parent class level where legal
  - Keep bonuses as a shared ordered list because they map to real D&D and homebrew thought patterns.
- SRD fit:
  - Supports class feature uses tied to class level, can support item or feature uses tied to character level, and allows spell-related use scaling where that is actually intended.
- Homebrew rationale:
  - Leaves room for charges on items, features, and subclass content without inventing a fake universal owner-level rule.
- Authoring-UI rationale:
  - Authors should answer:
    1. is this a fixed pool or a progression-based pool
    2. what progression source drives it
    3. what bonuses modify it
- Persistence impact:
  - Charge tables should store source reference explicitly instead of overloading a generic source-level branch.
- Compiler impact:
  - Charge compilers should resolve a concrete scaling reference, not infer one from ownership.
- Map impact:
  - Charge forms should use explicit source selectors and hide narrowing unless needed.
- Schema impact:
  - Shared charge DTOs should validate source reference and limit strategy independently.

### `shared/authored/startingEquipment.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - The current set/group/option/item hierarchy is directionally correct but still reads like an implementation tree more than an authoring decision tree.
  - `selectionKind`, `authoringModeKind`, category/property filters, and explicit equipment IDs are all packed into the item layer, which is harder to reason about for a form-driven UI.
- Target authored shape:
  - Keep starting equipment as an owned authored subtree.
  - Preserve the set/group/option structure because it matches how class/background starting equipment is authored and later chosen by players.
  - Move choice semantics higher in the tree where possible:
    - group/option expresses the player's choice structure
    - item expresses the concrete granted payload
  - Keep "global unless narrowed" behavior for equipment candidates:
    - only specify category/property/id filters when narrowing is intended
- SRD fit:
  - Matches class/background starting equipment choices well.
- Homebrew rationale:
  - Still supports curated option lists, filtered equipment families, and granted currency.
- Authoring-UI rationale:
  - This must read like the same decision tree the character creator will later present.
- Persistence impact:
  - Starting-equipment tables should remain owned by the parent subject and mirror decision-tree ownership clearly.
- Compiler impact:
  - Little direct compiler impact.
- Map impact:
  - Maps should emphasize the decision-tree structure rather than item-level flags first.
- Schema impact:
  - DTOs should validate the owned tree with clearer choice-vs-payload semantics.

### `shared/authored/facet.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - The current facet model is powerful but abstract.
  - It encodes a general-purpose logical query language, which is more expressive than many authors need most of the time.
- Target authored shape:
  - Keep facets as the shared applicability language.
  - Preserve OR-of-AND semantics and correlated predicate typing.
  - Introduce a clearer bias in downstream authoring surfaces:
    - simple common filters first
    - advanced facet editing second
  - Keep facets responsible for applicability and filtering only, not for magnitude/scaling.
- SRD fit:
  - Necessary for restrictions, option filtering, and spell/equipment narrowing.
- Homebrew rationale:
  - Gives enough expressive headroom without forcing every domain to invent its own filter language.
- Authoring-UI rationale:
  - The raw model is too abstract for casual authors, so the UI should front-load simpler structured filters.
- Persistence impact:
  - No philosophical blocker; persistence just needs to preserve owned logical structure cleanly.
- Compiler impact:
  - No major conceptual change beyond keeping filtering separate from scaling/payload logic.
- Map impact:
  - Maps should continue to support advanced facet trees, but simple forms should likely wrap them.
- Schema impact:
  - Current recursive schema direction remains valid.

### `shared/authored/range.ts`

- Verdict: `Keep`
- Current problem:
  - Minimal.
- Target authored shape:
  - Keep the current discriminated union.
- SRD fit:
  - Cleanly models self, touch, sight, unlimited, and measured distance patterns.
- Homebrew rationale:
  - Generic enough without being vague.
- Authoring-UI rationale:
  - Easy to render in a form.
- Persistence impact:
  - Stable.
- Compiler impact:
  - Stable.
- Map impact:
  - Stable.
- Schema impact:
  - Stable.

### `shared/authored/duration.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - It is clean, but some non-instantaneous durations may eventually need richer semantics than just `amount`.
- Target authored shape:
  - Keep the current discriminator approach.
  - Allow duration-specific payload growth only if a concrete domain requires it later.
- SRD fit:
  - Works for current SRD-style duration patterns.
- Homebrew rationale:
  - Leaves a clean extension point without prematurely generalizing.
- Authoring-UI rationale:
  - Clear for normal authors.
- Persistence impact:
  - Stable.
- Compiler impact:
  - Stable.
- Map impact:
  - Stable.
- Schema impact:
  - Stable with room for later extension.

### `shared/authored/shape.ts`

- Verdict: `Keep`
- Current problem:
  - Minimal.
- Target authored shape:
  - Keep the correlated shape union.
- SRD fit:
  - Matches area-of-effect modeling.
- Homebrew rationale:
  - Extensible via explicit shape kinds.
- Authoring-UI rationale:
  - Shape-first editing is intuitive.
- Persistence impact:
  - Stable.
- Compiler impact:
  - Stable.
- Map impact:
  - Stable.
- Schema impact:
  - Stable.

### `shared/authored/savingThrow.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - The current two-way union is correct directionally, but it hides the conceptual difference between "use caster or feature save DC" and "use explicit fixed DC."
- Target authored shape:
  - Keep the shared saving-throw concept.
  - Make the source of the DC explicit:
    - fixed value
    - spell/feature save DC
  - Keep the rolled ability only on fixed-value style branches if that remains the real rule.
- SRD fit:
  - Matches current usage and avoids leaking save-DC resolution into unrelated payloads.
- Homebrew rationale:
  - Leaves room for future non-spell save sources without making today’s contract vague.
- Authoring-UI rationale:
  - Authors can answer "what kind of DC is this?" first.
- Persistence impact:
  - Stable with clearer discriminator semantics.
- Compiler impact:
  - Slightly clearer DC resolution path.
- Map impact:
  - Better top-level branching.
- Schema impact:
  - Small discriminator refinement.

## Effects And Grants

### Damage / Effect / Moment authored payloads

- Verdict: `Keep with reshape`
- Current problem:
  - Damage currently reuses both `LevelScaledValue` and `PoolScaledValue`, which makes the scaling story feel shared-helper-driven instead of mechanic-driven.
  - Effect and moment nesting is conceptually good, but authored scaling decisions should become domain-local.
- Target authored shape:
  - Keep effect and moment as the authored composition model.
  - Keep damage as a distinct effect payload.
  - Replace generic shared pool scaling with damage-local scaling payloads.
  - Keep damage bonuses as a shared-ish local pattern only if they remain structurally identical to charge bonuses after the scaling refactor.
- SRD fit:
  - Supports fixed damage, dice damage, cantrip scaling, and upcast scaling cleanly.
- Homebrew rationale:
  - Leaves room for custom damage growth models without forcing all effects to use the same helper.
- Authoring-UI rationale:
  - Authors should configure damage as damage, not as a generic scaled value with a payload slot.
- Persistence impact:
  - Damage tables should model explicit source refs and damage-local scaling entries.
- Compiler impact:
  - Damage compilation becomes more legible because scaling source and payload growth are explicit.
- Map impact:
  - Damage forms should become easier to branch.
- Schema impact:
  - Effect schemas stay, but damage scaling schemas become local.

### Grant base and grant scaling helpers

- Verdict: `Keep with reshape`
- Current problem:
  - The grant helper layer is valuable, but `GrantScaling` currently leans too hard on a generic `LevelScaledValue` abstraction.
  - Grant selection and authoring mode are meaningful shared concepts; grant scaling payload shape is less universally shared.
- Target authored shape:
  - Keep shared grant concepts:
    - restrictions
    - order
    - selection kind
    - authoring mode
  - Replace generic grant scaling payload helpers with a shared scaling-reference plus grant-local leveled entries where needed.
  - Keep count on chosen grants as part of grant choice semantics, not as part of the scaling-reference model.
- SRD fit:
  - Better reflects class feature progression and spell/feat grants without vague owner-driven scaling.
- Homebrew rationale:
  - Still supports granted-vs-chosen flows and level-based acquisition.
- Authoring-UI rationale:
  - Authors think about:
    - is this granted or chosen
    - when does it show up
    - how many are granted or chosen
    - what content does it grant
- Persistence impact:
  - Grant persistence should separate scaling source, acquisition schedule, and payload rows more cleanly.
- Compiler impact:
  - Shared grant compilers should shrink to true shared semantics.
- Map impact:
  - Shared grant editors stay useful.
- Schema impact:
  - Shared grant DTOs stay, but scaling payload schemas become less generic.

### `SpellGrantAuthored`

- Verdict: `Keep with reshape`
- Current problem:
  - This is close, but `castAtLevel` and spell filters need clearer separation from progression source and grant schedule.
- Target authored shape:
  - Keep spell grants as grants of spell identities plus optional casting metadata, optional charges, and optional spell filters.
  - Treat `castAtLevel` as a spell-behavior field.
  - Treat spell applicability narrowing as filters.
  - Treat any scaling source as acquisition or magnitude logic, not as spell filter logic.
- SRD fit:
  - Matches granted spell lists, always-known spells, and cast-with-charges item or feature patterns.
- Homebrew rationale:
  - Supports curated spell lists and filtered spell grants.
- Authoring-UI rationale:
  - Spell grants should read like "what spells are involved" plus optional casting behavior.
- Persistence impact:
  - Stable with clearer boundaries.
- Compiler impact:
  - Cleaner spell-grant compile path.
- Map impact:
  - Better separation of "what spells" vs "how they behave."
- Schema impact:
  - Moderate refinement only.

### Feat / Modifier / Proficiency / Sense grants

- Verdict: `Keep with reshape`
- Current problem:
  - Modifier grants especially are carrying too much mechanically distinct shape under one broad shared surface.
  - Proficiency grants need clearer thought around source schedule vs payload target vs choice count.
- Target authored shape:
  - Keep these grant families as domain-specific grants over the shared grant base.
  - Push their unique mechanic payloads further into local unions.
  - Keep restrictions and filters outside the scaling reference.
- SRD fit:
  - Matches feats, proficiencies, senses, and modifier-style adjustments.
- Homebrew rationale:
  - Still broad enough for homebrew without turning every grant into a generic payload bucket.
- Authoring-UI rationale:
  - Each grant type should read like its own authoring form, not like a common payload editor with type switches.
- Persistence impact:
  - Grant tables should continue moving toward concrete domain columns.
- Compiler impact:
  - More local compile branches, less generic helper indirection.
- Map impact:
  - Existing map direction remains valid but should become more domain-led.
- Schema impact:
  - Stronger local discriminated unions.

## Feature And Subject Roots

### Features and options

- Verdict: `Keep with reshape`
- Current problem:
  - Features and options are fundamentally the right authoring roots, but scheduling, nested selections, and later character-sheet interaction should be made more explicit.
  - `optionsPerLevel` reads like a storage helper rather than a more general acquisition-choice schedule.
- Target authored shape:
  - Keep feature and option as the primary authoring roots for player-facing choice structures.
  - Preserve nested grants/effects/options.
  - Reshape progression/choice schedule fields so they read like author intent and later character-sheet prompts.
- SRD fit:
  - Features/options are the right model for feats, classes, racial choices, and similar content.
- Homebrew rationale:
  - This is the main extensibility point for custom choice trees.
- Authoring-UI rationale:
  - Features/options should map directly to what a player later sees and selects inside the sheet.
- Persistence impact:
  - Feature persistence should stay owned and tree-shaped.
- Compiler impact:
  - Mostly stable.
- Map impact:
  - Scheduling and prompt-oriented fields should be clearer.
- Schema impact:
  - Mostly stable with schedule-field reshapes.

### Classes

- Verdict: `Keep with reshape`
- Current problem:
  - Class-owned nested content is the primary place where "parent-scoped class progression" needs to exist explicitly.
- Target authored shape:
  - Keep classes as authored roots with owned spellcasting/resources/proficiencies/features.
  - Nested class and subclass content should be allowed to reference parent class progression without repeating `classId` everywhere.
- SRD fit:
  - Matches class tables and subclass feature progression.
- Homebrew rationale:
  - Still supports alternate or custom class progressions.
- Authoring-UI rationale:
  - Class authors should not repeatedly restate the owning class in every nested branch.
- Persistence impact:
  - DB should model class-owned progression sources explicitly enough to hydrate cleanly.
- Compiler impact:
  - Compilers should resolve parent-scoped class progression deterministically.
- Map impact:
  - Nested maps can simplify around class-owned progression.
- Schema impact:
  - Add a parent-class progression alias where needed.

### Spells

- Verdict: `Keep with reshape`
- Current problem:
  - Spell-related scaling semantics need to explicitly distinguish printed spell level from actual cast level.
- Target authored shape:
  - Keep spells as authored roots with owned casting/effect structure.
  - Use `SPELL_CAST_LEVEL` when a mechanic scales with actual cast level.
- SRD fit:
  - Matches upcasting and "at higher levels" behavior.
- Homebrew rationale:
  - Supports custom upcast progressions cleanly.
- Authoring-UI rationale:
  - Authors should not need to guess whether "spell level" means printed level or cast level.
- Persistence impact:
  - Spell tables should separate base spell level from cast-level-driven mechanics.
- Compiler impact:
  - Cleaner spell compile semantics.
- Map impact:
  - Clearer labels and branching.
- Schema impact:
  - Mostly naming and discriminator refinements.

### Races and backgrounds

- Verdict: `Keep with reshape`
- Current problem:
  - Philosophically sound, but future feature/option integration should continue to treat them as major sources of character choices, not just static bundles.
- Target authored shape:
  - Keep them as roots with owned details, proficiencies, features, ancestry, and starting-equipment subtrees where relevant.
- SRD fit:
  - Matches current domain.
- Homebrew rationale:
  - Good extension points.
- Authoring-UI rationale:
  - These should surface later as immediate character-creation choice providers.
- Persistence impact:
  - Stable.
- Compiler impact:
  - Stable.
- Map impact:
  - Stable.
- Schema impact:
  - Stable.

### Feats

- Verdict: `Keep with reshape`
- Current problem:
  - Feats are conceptually feature bundles, but they still need to remain first-class subject roots for content browsing, acquisition, and later sheet flows.
- Target authored shape:
  - Keep feats as roots that own features/grants.
  - Continue to model feat internals using feature-like subtrees instead of ad hoc special rules.
- SRD fit:
  - Matches modern feat design patterns.
- Homebrew rationale:
  - Strong fit for custom feats.
- Authoring-UI rationale:
  - Feat acquisition and feat-internal choices should remain sheet-friendly.
- Persistence impact:
  - Stable.
- Compiler impact:
  - Stable.
- Map impact:
  - Stable.
- Schema impact:
  - Stable.

### Equipment

- Verdict: `Keep with reshape`
- Current problem:
  - Equipment is one of the most overloaded roots because it can act as inventory content, grant source, effect source, and later interactive sheet object.
- Target authored shape:
  - Keep equipment as a root with owned abilities, modifiers, effects, contains/capacity, and features where relevant.
  - Make any scaling on equipment explicit through the same level-source model, not vague ownership.
- SRD fit:
  - Supports weapons, armor, tools, packs, containers, and magical/homebrew item behavior.
- Homebrew rationale:
  - High-value extension point.
- Authoring-UI rationale:
  - Equipment authoring must align with later in-sheet interactions like equip, attune, add, consume, or invoke.
- Persistence impact:
  - Equipment tables should preserve owned interactive substructures clearly.
- Compiler impact:
  - Explicit scaling sources help avoid equipment-specific compile hacks.
- Map impact:
  - Equipment maps should continue to be rich and owned-tree based.
- Schema impact:
  - Stable with explicit scaling-reference adoption.

## Character Authored Contracts

### `subjects/authored/character/intent.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - Philosophically strong, but some records still mix "why this exists" with convenience duplication that later state or engine layers could infer.
- Target authored shape:
  - Keep `CharacterIntent` as the authoritative persisted record of:
    - creation decisions
    - progression decisions
    - player-authored acquisitions and selections
  - Continue treating feature acquisitions, spell selections, resource grants, and starting-equipment decisions as intent-side records.
  - Favor stable selection keys and source/timing records because they map cleanly to later interactive sheet prompts and replayable progression history.
- SRD fit:
  - Matches how a D&D character is built over time.
- Homebrew rationale:
  - Supports custom creation and advancement flows.
- Authoring-UI rationale:
  - This is the backbone for a D&D Beyond-style but more in-sheet-friendly character history.
- Persistence impact:
  - Intent tables should persist choice history, not derived engine outputs.
- Compiler impact:
  - Indirect only.
- Map impact:
  - N/A for content maps, but later character authoring UI should mirror this contract.
- Schema impact:
  - Should remain a first-class validated transport/persistence DTO.

### `subjects/authored/character/state.ts`

- Verdict: `Keep with reshape`
- Current problem:
  - The philosophical split is correct, but `state` must stay narrowly focused on mutable play state and avoid duplicating intent or engine-derived results.
  - `classes?: CharacterClassState[]` currently risks duplicating class progression truth already stored in intent unless it is treated purely as class runtime usage state.
- Target authored shape:
  - Keep `CharacterState` as the authoritative persisted record of mutable sheet state only:
    - inventory and equipment state
    - currency state
    - current HP / temp HP / hit-dice usage
    - learned/prepared usage state where it is genuinely mutable at play time
    - resource usage
  - Avoid persisting derived engine outputs by default.
  - Narrow class state toward runtime usage concerns rather than duplicating progression facts already stored in intent.
- SRD fit:
  - Matches actual mutable character-sheet behavior.
- Homebrew rationale:
  - Still works for alternative resource systems and mutable class mechanics.
- Authoring-UI rationale:
  - Supports an interactive in-sheet experience without forcing the engine to become the persistence layer.
- Persistence impact:
  - Character state tables should stay focused on mutable runtime state.
- Compiler impact:
  - None directly.
- Map impact:
  - N/A.
- Schema impact:
  - Character state DTOs remain, but should preserve the intent-vs-state separation strictly.

## Implementation Notes

Apply these reshapes in this order:

1. update authored TypeScript contracts
2. update node maps
3. update compilers
4. update `packages/schema`
5. resume Phase 4 SQL normalization against the revised authored contracts
6. recreate the database
7. regenerate DB types
8. continue Kysely writes, queries, repositories, and assemblers

Immediate authored refactor priorities:

1. replace shared `SOURCE_LEVEL` usage with explicit scaling references
2. split `PoolScaledValue` out of `shared/authored/scaling.ts`
3. decide whether `LevelScaledValue` survives as a small shared leveled-entry helper or is localized into grants and damage
4. reshape `ChargeAuthored` around explicit progression sources
5. reshape starting-equipment choice semantics toward authoring-decision clarity
6. keep character `intent` and `state` split, but narrow `state` to mutable play concerns only

## Handoff Note

Treat this audit as a contract-stability gate, not optional cleanup.

Do not continue reshaping persistence because a table change looks locally correct if the underlying authored contract is still philosophically unsettled. Shared authored abstractions are allowed to shrink, split, or disappear if they are too generic to serve SRD-first and homebrew-flexible authoring well.
