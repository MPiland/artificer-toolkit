# ADR 0038: Rules mechanics are authored from core options

- **Status:** transitional (user rulings 2026-10-14; 195 SRD closed rules remain until SPELLS-4 converts them)
- **Date:** 2026-10-14
- **Scope:** authored mechanics, `CLOSED_RULE`, Authoring Schema node maps, and Encounter zones (hazards and traps)
- **Update when:** a new authored discriminant is added (the `reactionTrigger` union, decision 7), a closed rule is kept on purpose, or zone placement or concealment changes
- **Supersedes:** the `CLOSED_RULE` guidance in [the engine guide](../architecture/engine.md) that a closed rule kind is "preserved unchanged for a future resolver"
- **Verification:** authoring-parity tests for each converted mechanic (an author-built record through the real form and publication equals the SRD record and resolves the same); the SRD corpus tests; the [Phase 8 ledger](../roadmap/08-phase-ledger.json) items SPELLS-4, SPELLS-25 and MOVE-3

## Context

Homebrew parity is the product promise: anything the SRD does, an author can build. Two shapes break it.

- **`CLOSED_RULE`** dispatches a whole SRD mechanic (Spike Growth, Wall of Fire, Moonbeam) to a named resolver. An author cannot build a variant, because the behavior lives in code, not content. The 2026-10-14 scan found 195 closed rules in the SRD corpus (154 spell, 41 equipment). SPELLS-4 had planned to give each a resolver, which would have hardened the gap.
- **Feature-specific engine shapes** (a Rage executor, a trap subject, an item category that switches rules) have the same effect.

The hazards and traps design (MOVE-3) tested the rule: caltrops, Blade Barrier and an environmental pit had to share one model without a trap-specific contract.

## Decision

1. **Core options only.** Every rules mechanic (class features, spells, items, hazards) is expressed with generic authored options that the Authoring Schema node map exposes. When an SRD mechanic cannot be expressed, add a generic option, never a feature-named kind, executor or SRD-only helper. Each such change carries an authoring-parity proof.
2. **`CLOSED_RULE` is retired.** No new closed rule kinds are added. Existing kinds are converted to core options and their kinds and resolvers deleted (SPELLS-4). Until then they stay fail-closed and manual, as today.
3. **Hazards come from content.** A `ZONE` manifest with an entry interaction is a hazard, whichever item, spell or feature places it. No item category or property marks a hazard, because one item can carry both a hazard effect and an unrelated one (ball bearings as sling ammunition).
4. **Every zone states where it is placed.** `attachmentKind` is required on `ZONE` (SPELLS-25). The runtime never infers placement from range or shape.
5. **Concealment is placement state, except authored camouflage.** A placed zone's optional spot DC and disarm DC belong to its Scene record and are set by the GM (MOVE-3.3). Content authors concealment only when its own rules camouflage it, through an existing DC method (MOVE-3.4). A concealed zone is redacted per viewer on the server.
6. **Environmental traps are Scene zones.** The GM zone tool renders the same zone node map as authored content (MOVE-3.2). There is no trap subject.
7. **A reaction names its trigger with a generic discriminated option.** `reactionTrigger` on an invocation is a union (`MOVEMENT`, `ATTACKED_SELF`, `DAMAGE_TAKEN` with its chosen damage types, `SPELL_CAST`; REACTION-4 adds more) that replaced the movement-only `reactionMovementTrigger`. It is a node-map group, so an author builds Shield, Opportunity Attack or a homebrew ward from the same options, and the engine never names a spell or feature. A reaction cast as an action is refused (`REACTION_TRIGGER_ONLY`). Authoring-parity proof for `ATTACKED_SELF`: `nativeRoomReaction.test.ts` runs the real SRD Shield and a homebrew +3 clone through the same pipeline. For `DAMAGE_TAKEN` it runs a user-authored Absorb Elements (`absorbElementsSpell`, not seeded content). A `DAMAGE_RESISTANCE` grant payload may name the triggering damage type (`damageTypeSource: 'TRIGGER'`) instead of a fixed one; the room binds it to the types the hit dealt when it plans the reaction's effect, so the authored shape carries no spell id and no per-spell rule. A hit offers every eligible reaction as a menu (one reaction a round, so one choice). The Counterspell rule is `SPELL_CAST` plus the `CANCEL_TRIGGERING_EVENT` outcome; the `COUNTERSPELL` closed-rule kind is deleted.

## Consequences

- SPELLS-4 changes from "add resolvers" to "convert to core options", and grows by the generic options the conversions need (for example damage per distance moved, for Spike Growth).
- Workbooks for rules features require an authoring-parity proof, and reviews reject feature-named shapes.
- Node maps and schemas grow generic options instead of the closed-rule enum growing.
- Hazard behavior, half-speed bypass (`bypassAtHalfSpeed`, Q2's Move carefully) and save-on-entry are already core options (SRD Caltrops proves it). Placing spell zones waits on SPELLS-25.
- The 2024 rule variants (for example caltrops without a half-speed bypass) become System options later, not new kinds.
- Hide and Search (ATTACK-10.T1) are built from generic options: the `CONCEAL_FROM_OBSERVERS` and `DETECT_CONCEALED` effects, the `PASSIVE` and `CONCEALMENT` check DC kinds, and the `LOCATION_CONCEALMENT` state contribution. The parity proof is `packages/authoring/src/nodeRuntime/concealmentAuthoringParity.test.ts` (the SRD effects and a variant that checks another skill pass the effect node map unchanged) plus `packages/rules-runtime/src/__tests__/concealCompile.test.ts` (the SRD action compiles from the catalogue through the same options). See [the rules-runtime guide](../architecture/rules-runtime.md).
