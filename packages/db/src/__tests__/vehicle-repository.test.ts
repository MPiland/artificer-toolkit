import { describe, expect, it } from 'vitest'
import { createVehicleRepository } from '../domains/subjects/repositories/vehicle.js'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  return {
    selectFrom(table: string) {
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, _op: string, value: string) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            return record[column] === value
          })
          return builder
        },
        orderBy(column: string) {
          state.filtered = [...state.filtered].sort((left, right) => {
            const leftValue = (left as Record<string, number | string>)[column]
            const rightValue = (right as Record<string, number | string>)[column]
            return leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0
          })
          return builder
        },
        async execute() {
          return state.filtered
        },
        async executeTakeFirst() {
          return state.filtered[0] ?? undefined
        }
      }

      return builder
    }
  }
}

describe('createVehicleRepository', () => {
  it('hydrates a minimal vehicle with optional fields omitted', async () => {
    const repo = createVehicleRepository(createFakeDb({
      vehicles: [
        {
          id: 'vehicle-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Wagon',
          description: 'A sturdy wagon.',
          category: 'LAND',
          size_code: 'LARGE',
          armor_class: 11,
          hit_points: 30,
          speed: null,
          speed_note: null,
          crew_min: null,
          crew_max: null,
          passenger_capacity: null,
          cargo_capacity: null,
          cost: null,
          properties: null
        }
      ],
      vehicle_details: [],
      vehicle_features: [],
      details: [],
      features: [],
      feature_effects: [],
      feature_attributes: [],
      feature_feat_grants: [],
      feature_modifier_grants: [],
      feature_proficiency_grants: [],
      feature_sense_grants: [],
      feature_spell_grants: [],
      feature_options: [],
      feature_option_levels: []
    }) as never)

    await expect(repo.findById('vehicle-1')).resolves.toEqual({
      id: 'vehicle-1',
      label: 'Wagon',
      description: 'A sturdy wagon.',
      details: undefined,
      userId: 'user-1',
      systemId: 'system-1',
      category: 'LAND',
      size: 'LARGE',
      armorClass: 11,
      hitPoints: 30,
      speed: undefined,
      speedNote: undefined,
      crewMin: undefined,
      crewMax: undefined,
      passengerCapacity: undefined,
      cargoCapacity: undefined,
      cost: undefined,
      properties: undefined,
      features: undefined
    })
  })

  it('hydrates a spelljammer with details, features, and optional fields', async () => {
    const repo = createVehicleRepository(createFakeDb({
      vehicles: [
        {
          id: 'vehicle-2',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Nautiloid',
          description: 'A psionic vessel.',
          category: 'SPELLJAMMER',
          size_code: 'GARGANTUAN',
          armor_class: 17,
          hit_points: 400,
          speed: 12,
          speed_note: 'Spelljamming speed',
          crew_min: 8,
          crew_max: 20,
          passenger_capacity: 40,
          cargo_capacity: '20 tons',
          cost: { amount: 100000, currencyId: 'gp' },
          properties: ['ARMORED', 'SIEGE']
        }
      ],
      vehicle_details: [
        {
          vehicle_id: 'vehicle-2',
          detail_id: 'detail-1',
          sort_order: 0
        }
      ],
      vehicle_features: [
        {
          vehicle_id: 'vehicle-2',
          feature_id: 'feature-1',
          sort_order: 0
        }
      ],
      details: [
        {
          id: 'detail-1',
          label: 'Crew Stations',
          description: 'Multiple specialized stations.',
          order: 0
        }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Psionic Helm',
          description: 'Allows spelljamming travel.',
          detail: null,
          charge_id: null,
          restriction_id: null,
          sort_order: 0,
          available_at_level: null
        }
      ],
      feature_effects: [],
      feature_attributes: [],
      feature_feat_grants: [],
      feature_modifier_grants: [],
      feature_proficiency_grants: [],
      feature_sense_grants: [],
      feature_spell_grants: [],
      feature_options: [],
      feature_option_levels: []
    }) as never)

    const result = await repo.findById('vehicle-2')
    expect(result).toMatchObject({
      id: 'vehicle-2',
      category: 'SPELLJAMMER',
      size: 'GARGANTUAN',
      armorClass: 17,
      hitPoints: 400,
      speed: 12,
      speedNote: 'Spelljamming speed',
      crewMin: 8,
      crewMax: 20,
      passengerCapacity: 40,
      cargoCapacity: '20 tons',
      cost: { amount: 100000, currencyId: 'gp' },
      properties: ['ARMORED', 'SIEGE']
    })

    expect(result?.details).toHaveLength(1)
    expect(result?.features).toHaveLength(1)
    expect(result?.features?.[0]).toMatchObject({
      id: 'feature-1',
      label: 'Psionic Helm'
    })
  })

  it('returns null for unknown vehicle id', async () => {
    const repo = createVehicleRepository(createFakeDb({ vehicles: [] }) as never)
    await expect(repo.findById('unknown')).resolves.toBeNull()
  })
})
