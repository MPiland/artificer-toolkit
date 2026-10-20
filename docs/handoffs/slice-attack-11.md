# Slice ATTACK-11: Authored Multiattack with auto-sequence

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Scope

- T1 (m210, done): the slot-set contract and the offering end to end ([D93](phase-08-2-decisions.md)).
- T3 (this session, closes AC ATTACK-11.1): the Creature editor authors a Multiattack's slot set. T2 (the action drawer and slot filter) runs in another session; this slice touches none of its files.
- Contract reused unchanged: `packages/schema/src/features/attackSlots.ts` with the Creature filler validation in `packages/schema` and `packages/shared`.

Base: `origin/codex/phase-08-2-convex-cutover`. CI branch `ci/attack-11-t3`.

## Design

- No new form stack. `attackSlots` is a Creature-only object group on the Creature Feature node map (`CREATURE_FEATURE_NODE_MAP`, `packages/shared/src/domains/features/maps/feature.ts`), shown in the Effects section and opened through `AuthoringEditorModal` like every other resolved group. The nested maps live in `packages/shared/src/domains/features/maps/attackSlots.ts`: alternatives, slots (count, optional, comes first, condition) and fillers.
- A filler is "One of this Creature's actions" (a `LOCAL_COLLECTION` select over the Creature's own `features`) or "Any attack of the Attack action". A condition is "Earlier attacks of this action hit the same target" or "The target is no larger than" a size. `featureId` and `size` are `showIf` fields that clear when hidden, so a stored set never carries a stale value.
- Swaps are further alternatives; there is no separate swap node.
- `packages/shared` cannot import `packages/schema`, so the slot count bounds (1 to 10) are written in the map and a schema-package test asserts them against `MAX_ATTACK_SLOT_COUNT`.
- Publication refusal is the existing `creaturePublicationDtoSchema` validator: a slot filled by an unknown action, a passive Feature or the Multiattack itself, and every structural limit, fail with a path and a message.
- Web defaults for new rows: `authoringNodeDefaults.ts` (`attackSlotSet`, `attackSlotAlternative`, `attackSlot`, `attackSlotFiller`, `attackSlotCondition`).

## Proofs

- `packages/schema/src/__tests__/creature-attack-slots.test.ts`: the real validator publishes a Brown Bear-style set, alternatives, a swap, optional and comes-first slots and both conditions, and refuses the invalid sets; the node-map count bounds match the contract.
- `packages/shared/src/__tests__/creature-feature-node-maps.test.ts`: the node-map structure, Creature-only.
- `packages/authoring/src/nodeRuntime/creatureAttackSlotsAuthoring.test.ts`: the resolver keeps the Brown Bear set exactly as authored and clears a stale `featureId` or `size`.
- `apps/web/src/forms/rendering/authoringNodeDefaults.test.ts`: a freshly added set parses against the contract.
- `apps/web/src/forms/tests/AttackSlotAuthoring.test.tsx`: authors the Brown Bear set (Bite, Claws) through the rendered editor against the real resolver and normalizer, saves, and gets the SRD set back.

## Findings

- The structural-change guard verifies every `showIf`-clearing edit with the native normalizer against the root subject. A Feature editor resolved without its Creature ancestor would clear `featureId` (the local collection is empty), so the web test supplies the Creature as the ancestor, as the server does for a Feature nested in a Creature.

## Progress

- 2026-10-20: T3 built and tested locally; pushed to CI.
