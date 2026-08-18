import { createAuthoredVersionRepository, type DBLike } from '@artificer-toolkit/db'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { vehicleAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/vehicle'
import type { CreatureAuthored, VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'

interface ActiveCharacterSourceInput {
  characterId: string
  db: DBLike
  systemId: string
  userId: string
}

function requireMatchingSystem(input: {
  characterId: string
  sourceId: string
  sourceKind: 'Creature' | 'Vehicle'
  sourceSystemId: string
  systemId: string
}): void {
  if (input.sourceSystemId !== input.systemId) {
    throw new Error(
      `Character "${input.characterId}" requires an active ${input.sourceKind} "${input.sourceId}" version.`
    )
  }
}

export async function loadActiveCharacterCreatures(
  input: ActiveCharacterSourceInput & { creatureIds: readonly string[] }
): Promise<Map<string, CreatureAuthored>> {
  const creatureIds = [...new Set(input.creatureIds)]
  if (creatureIds.length === 0) return new Map()
  const records = await createAuthoredVersionRepository(input.db).findActiveByIds({
    subjectKind: 'CREATURE',
    subjectIds: creatureIds,
    systemId: input.systemId,
    userId: input.userId,
    includeMaster: true
  })
  const creatures = new Map<string, CreatureAuthored>()
  for (const creatureId of creatureIds) {
    const record = records.get(creatureId)
    if (!record) continue
    const creature = creatureAuthoredDtoSchema.parse(
      record.authored.document
    ) as unknown as CreatureAuthored
    requireMatchingSystem({
      characterId: input.characterId,
      sourceId: creatureId,
      sourceKind: 'Creature',
      sourceSystemId: creature.systemId,
      systemId: input.systemId
    })
    creatures.set(creatureId, creature)
  }
  return creatures
}

export async function loadActiveCharacterVehicles(
  input: ActiveCharacterSourceInput & { vehicleIds: readonly string[] }
): Promise<Map<string, VehicleAuthored>> {
  const vehicleIds = [...new Set(input.vehicleIds)]
  if (vehicleIds.length === 0) return new Map()
  const records = await createAuthoredVersionRepository(input.db).findActiveByIds({
    subjectKind: 'VEHICLE',
    subjectIds: vehicleIds,
    systemId: input.systemId,
    userId: input.userId,
    includeMaster: true
  })
  const vehicles = new Map<string, VehicleAuthored>()
  for (const vehicleId of vehicleIds) {
    const record = records.get(vehicleId)
    if (!record) continue
    const vehicle = vehicleAuthoredDtoSchema.parse(
      record.authored.document
    ) as unknown as VehicleAuthored
    requireMatchingSystem({
      characterId: input.characterId,
      sourceId: vehicleId,
      sourceKind: 'Vehicle',
      sourceSystemId: vehicle.systemId,
      systemId: input.systemId
    })
    vehicles.set(vehicleId, vehicle)
  }
  return vehicles
}
