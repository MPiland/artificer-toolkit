import type { CreatureAuthored, VehicleAuthored } from '@artificer-toolkit/shared/subjects/authored'

import type { DBLike } from '#types'

export type CharacterSheetCreatureCatalogRecord = Pick<
  CreatureAuthored,
  | 'id'
  | 'label'
  | 'description'
  | 'status'
  | 'creatureTypeId'
  | 'size'
  | 'armorClass'
  | 'hitPoints'
  | 'speeds'
>

export type CharacterSheetVehicleCatalogRecord = Pick<
  VehicleAuthored,
  'id' | 'label' | 'description' | 'status' | 'category' | 'hitPoints' | 'speed'
>

export interface CharacterSheetExtraCatalogQueryResult {
  creatures: CharacterSheetCreatureCatalogRecord[]
  vehicles: CharacterSheetVehicleCatalogRecord[]
}

export async function getCharacterSheetExtraCatalogQuery(
  db: DBLike,
  input: { systemId: string; userId: string }
): Promise<CharacterSheetExtraCatalogQueryResult> {
  const [creatureRows, creatureSpeedRows, vehicleRows] = await Promise.all([
    db
      .selectFrom('creatures')
      .select([
        'id',
        'label',
        'description',
        'status',
        'creature_type_id',
        'size_code',
        'armor_class',
        'hit_points'
      ])
      .where('system_id', '=', input.systemId)
      .where((eb) => eb.or([eb('user_id', '=', input.userId), eb('is_master', '=', true)]))
      .orderBy('label')
      .execute(),
    db
      .selectFrom('creature_speeds')
      .innerJoin('creatures', 'creatures.id', 'creature_speeds.creature_id')
      .select([
        'creature_speeds.creature_id',
        'creature_speeds.speed_id',
        'creature_speeds.amount',
        'creature_speeds.unit_code'
      ])
      .where('creatures.system_id', '=', input.systemId)
      .where((eb) =>
        eb.or([eb('creatures.user_id', '=', input.userId), eb('creatures.is_master', '=', true)])
      )
      .orderBy('creature_speeds.creature_id')
      .orderBy('creature_speeds.sort_order')
      .execute(),
    db
      .selectFrom('vehicles')
      .select(['id', 'label', 'description', 'status', 'category', 'hit_points', 'speed'])
      .where('system_id', '=', input.systemId)
      .where((eb) => eb.or([eb('user_id', '=', input.userId), eb('is_master', '=', true)]))
      .orderBy('label')
      .execute()
  ])

  const speedsByCreatureId = new Map<
    string,
    NonNullable<CharacterSheetCreatureCatalogRecord['speeds']>
  >()
  for (const row of creatureSpeedRows) {
    const speeds = speedsByCreatureId.get(row.creature_id) ?? []
    speeds.push({
      speedId: row.speed_id,
      amount: row.amount,
      unit: row.unit_code as NonNullable<
        CharacterSheetCreatureCatalogRecord['speeds']
      >[number]['unit']
    })
    speedsByCreatureId.set(row.creature_id, speeds)
  }

  return {
    creatures: creatureRows.map((row) => ({
      id: row.id,
      label: row.label,
      ...(row.description ? { description: row.description } : {}),
      status: row.status as CharacterSheetCreatureCatalogRecord['status'],
      creatureTypeId: row.creature_type_id ?? '',
      size: (row.size_code ?? 'MEDIUM') as CharacterSheetCreatureCatalogRecord['size'],
      armorClass: Number(row.armor_class ?? 0),
      hitPoints: Number(row.hit_points ?? 0),
      speeds: speedsByCreatureId.get(row.id) ?? []
    })),
    vehicles: vehicleRows.map((row) => ({
      id: row.id,
      label: row.label,
      ...(row.description ? { description: row.description } : {}),
      status: row.status as CharacterSheetVehicleCatalogRecord['status'],
      category: row.category as CharacterSheetVehicleCatalogRecord['category'],
      ...(row.hit_points === null ? {} : { hitPoints: Number(row.hit_points) }),
      ...(row.speed === null ? {} : { speed: row.speed })
    }))
  }
}
