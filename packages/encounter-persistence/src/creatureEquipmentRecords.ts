import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { resolveEquipmentSourceRecord } from '@artificer-toolkit/rules-runtime/encounterCreatureEquipmentSources'
import type { EncounterAuthoredSource } from './ports.js'

/**
 * Reads the Equipment a Creature loadout binds, as the records an Encounter pins. A variant is
 * pinned as its resolved Equipment, so its parent chain is read here and folded into the record.
 */
export async function readCreatureEquipmentRecords(
  readEquipment: (id: string) => Promise<EncounterAuthoredSource>,
  equipmentIds: Iterable<string>
): Promise<Map<string, { authored: EncounterAuthoredSource }>> {
  const records = new Map<string, { authored: EncounterAuthoredSource }>()
  for (const id of new Set(equipmentIds)) {
    const source = await readEquipment(id)
    const parents = new Map<string, unknown>()
    let current = equipmentAuthoredDtoSchema.parse(source.document)
    // A cycle ends here as a repeated parent; resolution then reports it.
    while (current.category === 'VARIANT' && !parents.has(current.parentEquipmentId)) {
      const parent = await readEquipment(current.parentEquipmentId)
      parents.set(current.parentEquipmentId, parent.document)
      current = equipmentAuthoredDtoSchema.parse(parent.document)
    }
    records.set(id, {
      authored: resolveEquipmentSourceRecord(source, (parentId) => parents.get(parentId))
    })
  }
  return records
}
