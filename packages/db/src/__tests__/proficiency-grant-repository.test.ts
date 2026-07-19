import { describe, expect, it, vi } from 'vitest'

vi.mock('../domains/grants/upserts/proficiency.js', () => ({
  upsertProficiencyGrant: vi.fn(async () => {})
}))

import { createProficiencyGrantRepository } from '../repositories/index.js'
import type { DBLike } from '#types'

type RowMap = Record<string, unknown[]>

function createFakeDb(rowsByTable: RowMap) {
  const queryCounts = new Map<string, number>()
  return {
    queryCounts,
    selectFrom(table: string) {
      queryCounts.set(table, (queryCounts.get(table) ?? 0) + 1)
      const state = {
        filtered: [...(rowsByTable[table] ?? [])]
      }

      const builder = {
        select() {
          return builder
        },
        where(column: string, _op: string, value: string | string[]) {
          state.filtered = state.filtered.filter((row) => {
            const record = row as Record<string, unknown>
            if (_op === 'in') {
              return Array.isArray(value) && value.includes(record[column] as string)
            }
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

describe('createProficiencyGrantRepository', () => {
  it('batches findByIds while preserving requested order and omitting inaccessible rows', async () => {
    const db = createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-1',
          sort_order: 1,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null,
          restriction_id: null
        },
        {
          id: 'grant-2',
          sort_order: 2,
          proficiency_kind: 'LANGUAGE',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null,
          restriction_id: null
        },
        {
          id: 'grant-unrequested',
          sort_order: 3,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null,
          restriction_id: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-1', skill_id: 'arcana' },
        { proficiency_grant_id: 'grant-unrequested', skill_id: 'stealth' }
      ],
      proficiency_grant_save_abilities: [],
      proficiency_grant_languages: [
        { proficiency_grant_id: 'grant-2', language_id: 'elvish' }
      ],
      proficiency_grant_equipment: [],
      proficiency_grant_equipment_filters: [],
      proficiency_grant_equipment_filter_properties: [],
      proficiency_grant_equipment_properties: [],
      proficiency_grant_equipment_property_filters: []
    })
    const repository = createProficiencyGrantRepository(db as unknown as DBLike)

    const results = await repository.findByIds(['grant-2', 'grant-missing', 'grant-1', 'grant-2'])

    expect(Array.from(results.keys())).toEqual(['grant-2', 'grant-1'])
    expect(results.get('grant-2')).toMatchObject({ languageIds: ['elvish'] })
    expect(results.get('grant-1')).toMatchObject({ skillIds: ['arcana'] })
    expect(results.has('grant-missing')).toBe(false)
    expect(results.has('grant-unrequested')).toBe(false)
    expect(db.queryCounts.get('proficiency_grants')).toBe(1)
    expect(db.queryCounts.get('proficiency_grant_skills')).toBe(1)
  })

  it('hydrates an equipment proficiency grant with filters', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-1',
          sort_order: 1,
          proficiency_kind: 'EQUIPMENT',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_equipment: [
        { proficiency_grant_id: 'grant-1', equipment_id: 'equipment-1' }
      ],
      proficiency_grant_equipment_filters: [
        { proficiency_grant_id: 'grant-1', category_code: 'WEAPON' }
      ],
      proficiency_grant_equipment_filter_properties: [
        { proficiency_grant_id: 'grant-1', property_code: 'LIGHT' }
      ]
    }) as never)

    await expect(repository.findById('grant-1')).resolves.toEqual({
      id: 'grant-1',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT',
      order: 1,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      level: 'FULL',
      rounding: undefined,
      count: undefined,
      selectionDuplicatePolicy: undefined,
      equipmentIds: ['equipment-1'],
      category: 'WEAPON',
      properties: ['LIGHT'],
      restrictions: undefined
    })
  })

  it('hydrates an equipment-property proficiency grant from the selected path shape', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-2',
          sort_order: 2,
          proficiency_kind: 'EQUIPMENT_PROPERTY',
          selection_kind: 'CHOSEN',
          authoring_mode_kind: 'SELECTED',
          count: 1,
          selection_duplicate_policy: 'UNIQUE',
          level: 'HALF',
          rounding: 'UP'
        }
      ],
      proficiency_grant_equipment_properties: [
        { proficiency_grant_id: 'grant-2', property_code: 'LIGHT' },
        { proficiency_grant_id: 'grant-2', property_code: 'FINESSE' }
      ],
      proficiency_grant_equipment_property_filters: [
        { proficiency_grant_id: 'grant-2', category_code: 'WEAPON' }
      ]
    }) as never)

    await expect(repository.findById('grant-2')).resolves.toEqual({
      id: 'grant-2',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT_PROPERTY',
      order: 2,
      selectionKind: 'CHOSEN',
      scalingKind: 'NONE',
      authoringModeKind: 'SELECTED',
      level: 'HALF',
      rounding: 'UP',
      count: 1,
      selectionDuplicatePolicy: 'UNIQUE',
      properties: ['LIGHT', 'FINESSE'],
      category: 'WEAPON',
      restrictions: undefined
    })
  })

  it('fails loudly when a chosen proficiency grant is missing its persisted count', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-count',
          sort_order: 3,
          proficiency_kind: 'SKILL',
          selection_kind: 'CHOSEN',
          authoring_mode_kind: 'SELECTED',
          count: null,
          selection_duplicate_policy: 'UNIQUE',
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-bad-count', skill_id: 'skill-1' }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-count')).rejects.toThrow('missing count')
  })

  it('fails loudly when a granted proficiency grant persists count', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-unexpected-count',
          sort_order: 4,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: 1,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-unexpected-count', skill_id: 'skill-1' }
      ]
    }) as never)

    await expect(repository.findById('grant-unexpected-count')).rejects.toThrow('cannot hydrate count for GRANTED payload')
  })

  it('fails loudly when a half proficiency grant is missing rounding', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-rounding',
          sort_order: 4,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'HALF',
          rounding: null
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-bad-rounding', skill_id: 'skill-1' }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-rounding')).rejects.toThrow('missing rounding')
  })

  it('fails loudly when a non-half proficiency grant persists rounding', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-unexpected-rounding',
          sort_order: 5,
          proficiency_kind: 'SKILL',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: 'UP'
        }
      ],
      proficiency_grant_skills: [
        { proficiency_grant_id: 'grant-unexpected-rounding', skill_id: 'skill-1' }
      ]
    }) as never)

    await expect(repository.findById('grant-unexpected-rounding')).rejects.toThrow('cannot hydrate rounding for FULL level')
  })

  it('fails loudly when a proficiency grant has an invalid persisted proficiency kind', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-kind',
          sort_order: 5,
          proficiency_kind: 'TOOLS',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'ALL',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-kind')).rejects.toThrow('invalid proficiency_kind')
  })

  it('fails loudly when a save-ability proficiency grant has an invalid ability code', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-ability',
          sort_order: 6,
          proficiency_kind: 'SAVE_ABILITY',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_save_abilities: [
        { proficiency_grant_id: 'grant-bad-ability', ability_code: 'LUCK' }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-ability')).rejects.toThrow('invalid ability_code')
  })

  it('fails loudly when an equipment proficiency grant has an invalid property code', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-property',
          sort_order: 7,
          proficiency_kind: 'EQUIPMENT',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'SELECTED',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_equipment: [
        { proficiency_grant_id: 'grant-bad-property', equipment_id: 'equipment-1' }
      ],
      proficiency_grant_equipment_filter_properties: [
        { proficiency_grant_id: 'grant-bad-property', property_code: 'SHINY' }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-property')).rejects.toThrow('invalid property_code')
  })

  it('hydrates an all-mode equipment proficiency grant with a category filter (TExtra field valid on ALL)', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-all-equipment-with-category',
          sort_order: 8,
          proficiency_kind: 'EQUIPMENT',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'ALL',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_equipment_filters: [
        { proficiency_grant_id: 'grant-all-equipment-with-category', category_code: 'WEAPON' }
      ],
      proficiency_grant_equipment_filter_properties: [
        { proficiency_grant_id: 'grant-all-equipment-with-category', property_code: 'LIGHT' }
      ]
    }) as never)

    await expect(repository.findById('grant-all-equipment-with-category')).resolves.toEqual({
      id: 'grant-all-equipment-with-category',
      grantKind: 'PROFICIENCY_GRANT',
      proficiencyKind: 'EQUIPMENT',
      order: 8,
      selectionKind: 'GRANTED',
      scalingKind: 'NONE',
      authoringModeKind: 'ALL',
      level: 'FULL',
      rounding: undefined,
      count: undefined,
      selectionDuplicatePolicy: undefined,
      equipmentIds: undefined,
      category: 'WEAPON',
      properties: ['LIGHT'],
      restrictions: undefined
    })
  })

  it('fails loudly when an all-mode equipment-property proficiency grant has persisted selected properties', async () => {
    const repository = createProficiencyGrantRepository(createFakeDb({
      proficiency_grants: [
        {
          id: 'grant-bad-all-equipment-property',
          sort_order: 9,
          proficiency_kind: 'EQUIPMENT_PROPERTY',
          selection_kind: 'GRANTED',
          authoring_mode_kind: 'ALL',
          count: null,
          level: 'FULL',
          rounding: null
        }
      ],
      proficiency_grant_equipment_properties: [
        { proficiency_grant_id: 'grant-bad-all-equipment-property', property_code: 'LIGHT' }
      ]
    }) as never)

    await expect(repository.findById('grant-bad-all-equipment-property')).rejects.toThrow(
      'cannot hydrate properties when authoring_mode_kind is ALL'
    )
  })
})
