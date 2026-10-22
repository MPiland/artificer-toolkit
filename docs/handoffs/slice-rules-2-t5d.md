# RULES-2.T5d: zone interactions through the event table

Slice workbook. Rules: [slice-workbook-rules.md](slice-workbook-rules.md). Ledger: `RULES-2.T5d` in [08-phase-ledger.json](../roadmap/08-phase-ledger.json). Follows T5a, T5b and T5c (ADR 0039).

## Brief

The last task of RULES-2.5 adds generic event hooks for zone interactions: entering, leaving, and starting or ending a turn in a zone. They go through the ADR 0039 event table, with no per-spell or per-zone branch and no new plan shape. Every hook is authorable from core options (ADR 0038). The special-case zone matching is moved onto the table and the old path deleted. It unblocks RULES-2.T12.

Before T5d, the shared Scene collectors (`collectSpatialMovementCandidates`, `collectSpatialTurnCandidates`, `collectSpatialMeleeRetaliationCandidates`) also decided which zones act, by reading `triggerModes`, `turnTriggers` and `retaliatesMeleeHits` inline. The code-to-trigger vocabulary (`zoneTriggers`) lived in neutral rules-runtime.

Rulings (orchestrator, 2026-10-21):

- R1, one matcher: the collector-level tests that depended on the filtering move to rules-runtime tests of the composed raise path, with inputs and expectations unchanged. A collector test asserts the contact facts on their own.
- R2: `LEAVE_SPACE` (compiles to `EXIT`) joins the manifest enum and the authoring options, with an ADR 0038 parity proof.
- R3: the `endsOnLeavingArea` `EXIT` injection stays in the dnd5e adapter (`effectActionZones.ts`); its match runs through the event table.

## Design

- Event table (`events/encounterEventTable.ts`): `ZONE_MOVEMENT` (`movement`: `ENTER | EXIT | CROSS`), `ZONE_TURN` (`boundary`: a spatial turn trigger), `ZONE_SOURCE_MELEE_HIT`. `ZoneEventSubscription` is the persisted placement fields, unchanged.
- Discovery (`events/encounterEventHooks.ts`): takes `zones` and returns the zones the events set off, in the order given (`zoneHookMet`).
- Vocabulary: `EventVocabularyCapabilityAdapter.zoneSubscription`, 5e in `systems/dnd5e/eventVocabulary.ts`. The neutral `zoneTriggers` and its maps in `encounterZonePlacement.ts` are deleted.
- Shared collectors report contact facts only. `encounterZoneContacts.ts` composes each collector with discovery, and all five raise sites call it: movement settlement plus its held-condition release distances (`encounterSpatialMovementRuleService.ts`), Worker forced movement (`roomActionForcedMovement.ts`), turn-boundary zones (`encounterTurnZoneEffects.ts`) and melee retaliation (`encounterMeleeRetaliation.ts`).
- The collectors still treat a zone with no subscription at all as invalid (`validSpatialEffect`). That is a structural fail-closed check, not event matching.

## ACs closed or advanced

| AC        | Part closed here                                                                                                 | Proof         |
| --------- | ---------------------------------------------------------------------------------------------------------------- | ------------- |
| RULES-2.5 | Zone enter, leave, start-of-turn and end-of-turn hooks run through the event table, authorable from core options | see checklist |

## Moved tests (R1)

All moved from `packages/shared/src/__tests__/vtt-spatial.test.ts` to `packages/rules-runtime/src/__tests__/encounterZoneContacts.test.ts`, with inputs and expectations unchanged. They now call the composed functions instead of the collectors.

| Test                                                                                        | Old describe                                | New describe                                |
| ------------------------------------------------------------------------------------------- | ------------------------------------------- | ------------------------------------------- |
| "fails closed for a missing source token and filters unsupported movement or trigger kinds" | spatial movement candidates                 | zone movement contacts                      |
| `it.each` row "catches nothing: at a boundary the effect lacks"                             | spatial turn candidates                     | zone turn contacts                          |
| `it.each` row "catches nothing: for an effect without turn triggers"                        | spatial turn candidates                     | zone turn contacts                          |
| "raises no movement or turn candidate for a zone that only retaliates"                      | spatial melee retaliation candidates (D153) | zone melee retaliation contacts (D153)      |
| "raises nothing for a teleport, or for a component that does not act on entering"           | spatial candidates per distance moved       | zone movement contacts › per distance moved |

New collector contact-fact tests in `vtt-spatial.test.ts`: "reports how the mover meets a zone whatever the zone subscribes to", "reports a creature in a zone at any boundary, whatever the zone subscribes to", and "reports the attacker in a zone on the hit creature whatever the zone subscribes to".

## Red-first checklist

The recorded red proof comes from CI's "Red proof against the phase branch" job on `ci/rules-2-t5d`.

| Test                                                                                                                       | Proves                                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `encounterZoneEventHooks.test.ts` "zone event hooks"                                                                       | discovery matches each `ZONE_*` event to its subscription, and only that one                                    |
| `encounterZoneEventHooks.test.ts` "the dnd5e zone subscription vocabulary"                                                 | each interaction kind's subscription, including `LEAVE_SPACE` → `EXIT`                                          |
| `encounterZonePlacementCompilation.test.ts` "compiles leaving the space to an EXIT trigger"                                | a `LEAVE_SPACE` zone compiles to `triggerModes: ['ENTER', 'EXIT']`                                              |
| `creatureZoneAuthoringParity.test.ts` "keeps a zone acting on entering, leaving and each turn boundary inside"             | ADR 0038 parity: the node map keeps `LEAVE_SPACE` as authored                                                   |
| `nativeRoomTurnZoneEffects.test.ts` "acts on a creature that enters the zone, ends and starts its turn in it, then leaves" | room journey: one zone acts on entering, at the end and the start of the creature's turn inside, and on leaving |
| `encounterZoneContacts.test.ts` (moved tests)                                                                              | the composed raise path keeps the old filtering behavior                                                        |

## Golden flips

None expected: compile output of every SRD record is unchanged, and no SRD record authors `LEAVE_SPACE`.

## Status log

- 2026-10-21: branched `slice/rules-2-t5d` from `codex/phase-08-2-convex-cutover` (71b17fec5). Design note and rulings R1–R3.
- 2026-10-22: implementation, tests, docs ([rules-runtime.md](../architecture/rules-runtime.md) "Event hooks").
- 2026-10-22: the `LEAVE_SPACE` option put `effects/maps/path.ts` one line over its size cap. By ruling (a), the summon option lists became literal lists keyed by their enum constants, with the same labels and order. Merged the phase tip with T9b (m341), and the cap is now the measured 4018. On `404c32928`, Tests 39818681414 and Live 39818685397 are green. Red proof: RED for the worker journey, the parity, event-hook, compilation and `vtt-spatial` contact-fact tests. `encounterZoneContacts.test.ts` is RED-IMPORT, because the moved tests keep behavior that already existed and now run through the new module.
