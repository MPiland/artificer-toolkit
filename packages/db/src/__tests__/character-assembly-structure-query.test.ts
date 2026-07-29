import { describe, expect, it } from 'vitest'

import { getCharacterAssemblyStructureQuery } from '../domains/subjects/queries/getCharacterAssemblyStructureQuery.js'
import type { DBLike } from '../types/index.js'

type QueryRows = Record<string, unknown>[]

interface QueryTrace {
  table: string
  filters: unknown[][]
}

function createStructureQueryDb(
  rowsByTable: Record<string, QueryRows>,
  traces: QueryTrace[]
): DBLike {
  return {
    selectFrom(table: string) {
      const trace: QueryTrace = { table, filters: [] }
      traces.push(trace)

      const builder = {
        innerJoin(..._arguments: unknown[]) {
          return builder
        },
        leftJoin(..._arguments: unknown[]) {
          return builder
        },
        select(..._arguments: unknown[]) {
          return builder
        },
        where(...filter: unknown[]) {
          trace.filters.push(filter)
          return builder
        },
        orderBy(..._arguments: unknown[]) {
          return builder
        },
        async execute(): Promise<QueryRows> {
          return rowsByTable[table] ?? []
        }
      }

      return builder
    }
  } as unknown as DBLike
}

describe('getCharacterAssemblyStructureQuery', () => {
  it('returns selected root, ancestry-option, feature-option, and choice structure only', async () => {
    const traces: QueryTrace[] = []
    const db = createStructureQueryDb(
      {
        class_features: [
          {
            ownerId: 'class-fighter',
            featureId: 'feature-extra-attack',
            order: 2,
            availableAtLevel: 5
          }
        ],
        feat_features: [
          {
            ownerId: 'feat-martial-adept',
            featureId: 'feature-maneuver',
            order: 1,
            availableAtLevel: 1
          }
        ],
        equipment_features: [
          {
            ownerId: 'equipment-flame-tongue',
            featureId: 'feature-flame-blade',
            order: 3,
            availableAtLevel: null
          }
        ],
        race_ancestries: [
          {
            raceId: 'race-dragonborn',
            ancestryOptionId: 'ancestry-red',
            ancestryOptionOrder: 4,
            featureId: 'feature-fire-breath',
            featureOrder: 1,
            availableAtLevel: 1
          }
        ],
        feature_options: [
          {
            featureId: 'feature-maneuver',
            optionId: 'option-trip-attack',
            order: 2
          }
        ],
        feature_option_levels: [
          {
            featureId: 'feature-maneuver',
            level: 1,
            count: 2,
            order: 1
          }
        ]
      },
      traces
    )

    const result = await getCharacterAssemblyStructureQuery(db, {
      raceIds: ['race-dragonborn'],
      classIds: ['class-fighter'],
      backgroundIds: ['background-soldier'],
      featIds: ['feat-martial-adept'],
      equipmentIds: ['equipment-flame-tongue'],
      featureIds: []
    })

    expect(result.rootFeatureLinks).toEqual([
      {
        ownerKind: 'CLASS',
        ownerId: 'class-fighter',
        featureId: 'feature-extra-attack',
        order: 2,
        availableAtLevel: 5
      },
      {
        ownerKind: 'FEAT',
        ownerId: 'feat-martial-adept',
        featureId: 'feature-maneuver',
        order: 1,
        availableAtLevel: 1
      },
      {
        ownerKind: 'EQUIPMENT',
        ownerId: 'equipment-flame-tongue',
        featureId: 'feature-flame-blade',
        order: 3,
        availableAtLevel: null
      }
    ])
    expect(result.ancestryOptions).toEqual([
      {
        raceId: 'race-dragonborn',
        ancestryOptionId: 'ancestry-red',
        order: 4,
        featureLinks: [
          {
            featureId: 'feature-fire-breath',
            order: 1,
            availableAtLevel: 1
          }
        ]
      }
    ])
    expect(result.featureOptions).toEqual([
      {
        featureId: 'feature-maneuver',
        optionId: 'option-trip-attack',
        order: 2
      }
    ])
    expect(result.featureOptionChoices).toEqual([
      {
        featureId: 'feature-maneuver',
        level: 1,
        count: 2,
        order: 1
      }
    ])
    expect(traces).toHaveLength(8)
    expect(traces.find((trace) => trace.table === 'class_features')?.filters).toContainEqual([
      'class_features.class_id',
      'in',
      ['class-fighter']
    ])
    expect(traces.find((trace) => trace.table === 'feature_options')?.filters).toContainEqual([
      'feature_id',
      'in',
      ['feature-extra-attack', 'feature-maneuver', 'feature-flame-blade', 'feature-fire-breath']
    ])
  })

  it('executes the same eight set queries for empty and multi-id selections', async () => {
    const emptyTraces: QueryTrace[] = []
    const multiTraces: QueryTrace[] = []

    await getCharacterAssemblyStructureQuery(createStructureQueryDb({}, emptyTraces), {
      raceIds: [],
      classIds: [],
      backgroundIds: [],
      featIds: [],
      equipmentIds: [],
      featureIds: []
    })
    await getCharacterAssemblyStructureQuery(createStructureQueryDb({}, multiTraces), {
      raceIds: ['race-1', 'race-2'],
      classIds: ['class-1', 'class-2'],
      backgroundIds: ['background-1', 'background-2'],
      featIds: ['feat-1', 'feat-2'],
      equipmentIds: ['equipment-1', 'equipment-2'],
      featureIds: ['feature-direct-1', 'feature-direct-2']
    })

    expect(emptyTraces).toHaveLength(8)
    expect(multiTraces).toHaveLength(8)
  })
})
