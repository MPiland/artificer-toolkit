# Slice SPELLS-4: SRD hazard zones from core options

Workbook rules: [slice-workbook-rules.md](slice-workbook-rules.md).

## Resume here

- T1 (audit) is done: the zone table is in [slice-spells-20.md](slice-spells-20.md#zone-table-srd-zones-with-turn-startend-text-static-audit-2026-10-17).
- T1a (Cloudkill and Insect Plague as full zones) is on `ci/spells-4-t1a`. Next: T1b (wall geometry), T1c (Moonbeam, Incendiary Cloud), T1d (Restrained and Prone outcomes).

## Scope

- AC SPELLS-4.2: every SRD hazard zone spell places a zone whose entry and turn rules are authored from core options and resolve in Encounters.
- No spell-specific code: each zone is authored data compiled by the generic placed-zone compiler (`placedSpaceZone`, `zonePlacementPlan`). A rule the compiler does not model stays unauthored and is named below, never partly honored.

## Log

### T1a (Cloudkill and Insect Plague)

- Authoring only, no product code: each spell's `PLACED_SPACE` `ZONE` gains its label, the 20-foot sphere, one component and one PASSIVE Constitution save against `SOURCE_SAVE_DC`. Damage is a `PER_LEVEL` `SPELL_CAST_LEVEL` row (Cloudkill 5d8 poison, Insect Plague 4d10 piercing at the 5th level, one die more per slot level up to the 9th) on the failed save, halved on a made save. Triggers: Cloudkill `ENTER_SPACE` + `START_TURN_IN_SPACE`, Insect Plague `ENTER_SPACE` + `END_TURN_IN_SPACE`, both `maxApplicationsPerTurn: 1` ("for the first time on a turn"), the same options Spirit Guardians uses.
- Proofs:
  - `apps/session-worker/test/nativeRoomHazardZoneSpells.test.ts`: a real cast in the local room places the fixed zone (label, triggers, per-turn limit, Constitution and the caster's pinned DC); entering it at 5th and 6th level deals the rolled dice; the turn boundary each spell names (Cloudkill start, Insect Plague end) runs the save and damage, and the other boundary does nothing.
  - `packages/authoring/src/nodeRuntime/sourceZoneAuthoringParity.test.ts`: both zones pass the equipment node map exactly as authored (ADR 0038 parity).
  - `packages/source-data/src/srd/zoneInteractionKinds.test.ts`: both components author their entry and turn triggers; the named gaps below are recorded. Both spells now also join the turn-trigger corpus check.
  - `packages/source-data/src/srd/saveForHalfDamage.test.ts`: both left the damage-not-authored list (its rule: a spell leaves the moment its damage is authored) and now carry the halved success path.
- Named gaps (not authored, because the zone compiler refuses an option it does not model; recorded in `zoneInteractionKinds.test.ts`):

| Spell         | SRD rule                                                                         | Authoring option                           | Owner                         |
| ------------- | -------------------------------------------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Cloudkill     | Heavily obscured area                                                            | `obscurementKind: 'HEAVY'`                 | none registered               |
| Cloudkill     | Spreads around corners                                                           | `spreadsAroundCorners`                     | none registered               |
| Cloudkill     | Drift: moves 10 ft away from the caster at the start of each of its turns        | none (new core option)                     | none registered               |
| Cloudkill     | Sinks to the lowest ground; strong wind disperses it                             | none (new core option)                     | none registered               |
| Insect Plague | Lightly obscured area                                                            | `obscurementKind: 'LIGHT'`                 | none registered               |
| Insect Plague | Spreads around corners                                                           | `spreadsAroundCorners`                     | none registered               |
| Insect Plague | Difficult terrain                                                                | component `movementCostMultiplier`         | SPELLS-20.T4d (movement cost) |
| Insect Plague | Each creature in the area saves when it appears                                  | none: a zone-placing cast has no area save | none registered               |
| Insect Plague | A creature that enters and ends the same turn in it saves twice (SRD); once here | per-turn limit counts every application    | orchestrator decision         |

- The last row is a semantic question for the orchestrator: `maxApplicationsPerTurn` counts entry and turn-boundary applications together (T4b1 ruling), while the SRD "for the first time on a turn" limits only entries. Options: (a) keep it (one save on enter-then-end; Spirit Guardians has the same shape on start-then-re-enter); (b) count only movement triggers against the limit, which changes T4b1 for Spirit Guardians too; (c) drop the limit on Insect Plague (two saves, but repeated entries in one turn each trigger).
