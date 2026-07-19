import { describe, expect, it } from 'vitest'
import {
  createBackgroundRepository,
  createClassRepository,
  createFeatRepository,
  createRaceRepository,
  createSpellRepository
} from '../repositories/index.js'

type RowMap = Record<string, unknown[]>

function createCountingDb(rowsByTable: RowMap, onSelect: () => void) {
  return {
    selectFrom(table: string) {
      onSelect()
      const state = { filtered: [...(rowsByTable[table] ?? [])] }
      const builder = {
        select() {
          return builder
        },
        where(column: string, op: string, value: string | readonly string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            return op === 'in' && Array.isArray(value)
              ? value.includes(record[column] as string)
              : record[column] === value
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
        }
      }
      return builder
    }
  }
}

async function compareQueryCounts(
  createRows: (count: number) => RowMap,
  read: (rows: RowMap, onSelect: () => void) => Promise<unknown[]>
) {
  const run = async (count: number) => {
    let queryCount = 0
    const records = await read(createRows(count), () => queryCount++)
    return { records, queryCount }
  }
  const single = await run(1)
  const many = await run(5)

  expect(single.records).toHaveLength(1)
  expect(many.records).toHaveLength(5)
  expect(many.queryCount).toBe(single.queryCount)
}

describe('unlinked subject repository batch hydration', () => {
  it('keeps spell findAll query count constant as root count grows', async () => {
    await compareQueryCounts(
      (count) => ({
        spells: Array.from({ length: count }, (_, index) => ({
          id: `spell-${index}`,
          system_id: 'system-1',
          user_id: 'user-1',
          label: `Spell ${index}`,
          description: 'A spell.',
          status: 'DRAFT',
          level: 1,
          magic_school_id: 'evocation',
          casting_time_unit: 'ROUND',
          casting_time_amount: 1,
          material_description: null
        })),
        spell_effects: [],
        spell_attributes: [],
        spell_classes: []
      }),
      async (rows, onSelect) => createSpellRepository(createCountingDb(rows, onSelect) as never).findAll()
    )
  })

  it('keeps background findAll query count constant as root count grows', async () => {
    await compareQueryCounts(
      (count) => ({
        backgrounds: Array.from({ length: count }, (_, index) => ({
          id: `background-${index}`,
          system_id: 'system-1',
          user_id: 'user-1',
          label: `Background ${index}`,
          description: null,
          status: 'DRAFT',
          starting_equipment_id: null
        })),
        background_details: [],
        background_features: [],
        background_proficiency_grants: []
      }),
      async (rows, onSelect) => createBackgroundRepository(createCountingDb(rows, onSelect) as never).findAll()
    )
  })

  it('keeps feat findAll query count constant as root count grows', async () => {
    await compareQueryCounts(
      (count) => ({
        feats: Array.from({ length: count }, (_, index) => ({
          id: `feat-${index}`,
          system_id: 'system-1',
          user_id: 'user-1',
          label: `Feat ${index}`,
          description: 'A feat.',
          status: 'DRAFT',
          prerequisite_id: null,
          charge_id: null
        })),
        feat_effects: [],
        feat_details: [],
        feat_features: [],
        feat_feat_grants: [],
        feat_proficiency_grants: [],
        feat_sense_grants: [],
        feat_spell_grants: [],
        feat_modifier_grants: []
      }),
      async (rows, onSelect) => createFeatRepository(createCountingDb(rows, onSelect) as never).findAll()
    )
  })

  it('keeps class findAll query count constant as root count grows', async () => {
    await compareQueryCounts(
      (count) => ({
        classes: Array.from({ length: count }, (_, index) => ({
          id: `class-${index}`,
          system_id: 'system-1',
          user_id: 'user-1',
          category: 'SUBCLASS',
          parent_class_id: 'class-parent',
          subclass_selection_level: null,
          label: `Subclass ${index}`,
          description: null,
          status: 'DRAFT',
          starting_equipment_id: null
        })),
        class_features: [],
        class_details: [],
        class_proficiency_grants: [],
        class_attributes: [],
        class_specializations: [],
        class_starting_gold: [],
        class_hitpoints: [],
        class_multiclass: [],
        class_resources: [],
        class_spellcasting: []
      }),
      async (rows, onSelect) => createClassRepository(createCountingDb(rows, onSelect) as never).findAll()
    )
  })

  it('keeps race findAll query count constant as root count grows', async () => {
    await compareQueryCounts(
      (count) => ({
        races: Array.from({ length: count }, (_, index) => ({
          id: `race-${index}`,
          system_id: 'system-1',
          user_id: 'user-1',
          label: `Race ${index}`,
          quote: null,
          description: null,
          status: 'DRAFT',
          category: 'BASE',
          selection_mode: 'DIRECT',
          parent_race_id: null,
          size_code: 'MEDIUM'
        })),
        race_features: [],
        race_ancestries: [],
        race_details: [],
        race_speeds: [],
        race_heritages: []
      }),
      async (rows, onSelect) => createRaceRepository(createCountingDb(rows, onSelect) as never).findAll()
    )
  })

  it('batch loads a filtered subrace collection with its unfiltered parent lineage', async () => {
    const rows: RowMap = {
      races: [
        {
          id: 'race-parent',
          system_id: 'system-1',
          user_id: 'parent-owner',
          label: 'Parent Race',
          quote: null,
          description: 'Inherited description.',
          status: 'DRAFT',
          category: 'BASE',
          selection_mode: 'REQUIRES_SUBRACE',
          parent_race_id: null,
          size_code: 'MEDIUM'
        },
        ...Array.from({ length: 5 }, (_, index) => ({
          id: `subrace-${index}`,
          system_id: 'system-1',
          user_id: 'child-owner',
          label: `Subrace ${index}`,
          quote: null,
          description: null,
          status: 'DRAFT',
          category: 'SUBRACE',
          selection_mode: null,
          parent_race_id: 'race-parent',
          size_code: null
        }))
      ],
      race_features: [],
      race_ancestries: [],
      race_details: [],
      race_speeds: [{ race_id: 'race-parent', speed_id: 'walk', amount: 30, unit_code: 'FEET' }],
      race_heritages: []
    }
    const repository = createRaceRepository(createCountingDb(rows, () => undefined) as never)
    const resolved = await repository.findResolvedAll({ userId: 'child-owner' })

    expect(resolved).toHaveLength(5)
    expect(resolved).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'subrace-0',
        parentRaceId: 'race-parent',
        size: 'MEDIUM',
        speeds: [{ speedId: 'walk', amount: 30, unit: 'FEET' }]
      })
    ]))
  })
})
