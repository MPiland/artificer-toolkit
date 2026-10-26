# Slice workbook: ATTACK-6

Owned by the ATTACK-6 slice session. Design notes, rulings and proofs go here.

## ATTACK-6.T2 (AC ATTACK-6.1)

- Seam trace: authoring (`creatureAuthoredDtoSchema.equipmentLoadout`, `packages/schema/src/subjects/creature.ts`) and Encounters (`snapshotCreatureEquipmentLoadout`, including the GM `equipmentLoadoutOverride`, `packages/rules-runtime/src/encounterCreatureEquipmentSources.ts`) both parse `creatureEquipmentLoadoutDtoSchema`. The web authoring defaults type against `CreatureEquipmentLoadoutEntryDto`.
- The only local shape was the Encounter loadout pin (`SerializedEncounterCreatureEquipmentSource` plus its local Zod schema in rules-runtime). It moved to `encounterCreatureEquipmentSourceSchema` in `packages/schema/src/projections/encounterCreatureEquipment.ts`; the replacement provenance schema now derives from it (the pin without `compilation`, plus `actorId`).
- Proof: `packages/rules-runtime/src/__tests__/creatureLoadoutContract.test.ts` (SRD goblin): the authored loadout reads unchanged in an Encounter; four invalid loadouts are refused by authoring, the Creature snapshot and a GM override alike; pins parse with the shared pin contract and bind back by loadout identity; provenance is the pin without its compilation; the `packages/shared` domain entry and the contract entry are mutually assignable.

## ATTACK-6.T3 (AC ATTACK-6.2)

- Seam trace: the SRD source audit is `auditSrdSourceSemantics` (`packages/source-data/src/srd/audit.ts`), run by `audit.test.ts` and by the SRD manifest generator (`apps/apis/scripts/generateSrdManifest.ts`), which fails on any issue. The Creature schema (`creatureEquipmentLoadoutDtoSchema`, `validateCreatureEquipmentLoadout`) checks entry identity, quantity, action bindings and hand conflicts without Equipment, so it cannot know two-handed weapons or categories.
- The audit now runs `auditCreatureEquipmentLoadouts` over every SRD Creature, under the `creature-equipment` domain, with five named checks (D107 and its AUTHORING-17 addendum): `loadout binds missing Equipment`; `loadout hand conflict` (the shared `resolveHandOccupancy` with `TWO_HANDED` read from the bound Equipment); `loadout holds an item that is not a weapon or shield, or wears one that is` (the shared `isHeldEquipmentCategory`); `loadout armor binds an action Feature`; `loadout wears more than one armor`. Carried items are not category-checked, and a shield may bind an action (the spiked shield attack).
- Proof: `packages/source-data/src/srd/creatureEquipmentLoadoutAudit.test.ts`: every SRD loadout passes; the SRD Goblin with one fault per check yields exactly that named issue on the faulty entries.
