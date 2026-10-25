# Slice workbook: ATTACK-6

Owned by the ATTACK-6 slice session. Design notes, rulings and proofs go here.

## ATTACK-6.T2 (AC ATTACK-6.1)

- Seam trace: authoring (`creatureAuthoredDtoSchema.equipmentLoadout`, `packages/schema/src/subjects/creature.ts`) and Encounters (`snapshotCreatureEquipmentLoadout`, including the GM `equipmentLoadoutOverride`, `packages/rules-runtime/src/encounterCreatureEquipmentSources.ts`) both parse `creatureEquipmentLoadoutDtoSchema`. The web authoring defaults type against `CreatureEquipmentLoadoutEntryDto`.
- The only local shape was the Encounter loadout pin (`SerializedEncounterCreatureEquipmentSource` plus its local Zod schema in rules-runtime). It moved to `encounterCreatureEquipmentSourceSchema` in `packages/schema/src/projections/encounterCreatureEquipment.ts`; the replacement provenance schema now derives from it (the pin without `compilation`, plus `actorId`).
- Proof: `packages/rules-runtime/src/__tests__/creatureLoadoutContract.test.ts` (SRD goblin): the authored loadout reads unchanged in an Encounter; four invalid loadouts are refused by authoring, the Creature snapshot and a GM override alike; pins parse with the shared pin contract and bind back by loadout identity; provenance is the pin without its compilation; the `packages/shared` domain entry and the contract entry are mutually assignable.
