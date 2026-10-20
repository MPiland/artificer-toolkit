import type { EncounterAuthoredSource } from './ports.js'

/**
 * Reads the Equipment a Creature loadout binds, as the sources an Encounter pins. A variant is read
 * as itself: its stored compilation already holds the rules resolved against its parents.
 */
export async function readCreatureEquipmentRecords(
  readEquipment: (id: string) => Promise<EncounterAuthoredSource>,
  equipmentIds: Iterable<string>
): Promise<Map<string, EncounterAuthoredSource>> {
  const records = new Map<string, EncounterAuthoredSource>()
  for (const id of new Set(equipmentIds)) records.set(id, await readEquipment(id))
  return records
}
