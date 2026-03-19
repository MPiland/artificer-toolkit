import { describe, expect, it } from 'vitest'
import { createSpellRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'

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

describe('createSpellRepository', () => {
  it('hydrates a spell with supported class and attribute rows', async () => {
    const repository = createSpellRepository(createFakeDb({
      spells: [
        {
          id: 'spell-1',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Magic Missile',
          description: 'Bolts of force.',
          level: 1,
          magic_school_id: 'evocation',
          casting_time_unit: 'ROUND',
          casting_time_amount: 1,
          range_id: null,
          duration_id: null,
          at_higher_levels: null,
          material_description: 'A sliver of glass.'
        }
      ],
      spell_effects: [],
      spell_attributes: [
        { spell_id: 'spell-1', attribute_code: 'RITUAL', sort_order: 2 },
        { spell_id: 'spell-1', attribute_code: 'CONCENTRATION', sort_order: 1 }
      ],
      spell_classes: [
        { spell_id: 'spell-1', class_id: 'wizard' },
        { spell_id: 'spell-1', class_id: 'sorcerer' }
      ]
    }) as never)

    await expect(repository.findById('spell-1')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-1',
      label: 'Magic Missile',
      description: 'Bolts of force.',
      attributes: ['CONCENTRATION', 'RITUAL'],
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      range: undefined,
      duration: undefined,
      level: 1,
      classIds: ['sorcerer', 'wizard'],
      magicSchoolId: 'evocation',
      effects: undefined,
      atHigherLevels: undefined,
      materialDescription: 'A sliver of glass.',
      userId: 'user-1',
      systemId: 'system-1'
    })
  })

  it('omits optional spell fields when the row graph does not contain them', async () => {
    const repository = createSpellRepository(createFakeDb({
      spells: [
        {
          id: 'spell-2',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Shout',
          description: 'A loud shout.',
          level: 0,
          magic_school_id: 'evocation',
          casting_time_unit: 'ROUND',
          casting_time_amount: 1,
          range_id: null,
          duration_id: null,
          at_higher_levels: null,
          material_description: null
        }
      ],
      spell_effects: [],
      spell_attributes: [],
      spell_classes: []
    }) as never)

    await expect(repository.findById('spell-2')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-2',
      label: 'Shout',
      description: 'A loud shout.',
      attributes: undefined,
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      range: undefined,
      duration: undefined,
      level: 0,
      classIds: [],
      magicSchoolId: 'evocation',
      effects: undefined,
      atHigherLevels: undefined,
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })
  })

  it('round-trips supported spell effects through the typed effect repository', async () => {
    const db = new InMemoryDb()
    const repository = createSpellRepository(db as never)

    await repository.upsert({
      kind: 'SPELL',
      id: 'spell-effects-1',
      label: 'Flame Lash',
      description: 'A spell with an effect.',
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      range: {
        id: 'spell-range-root-1',
        rangeKind: 'DISTANCE',
        amount: 150,
        unit: 'FEET'
      },
      duration: {
        id: 'spell-duration-root-1',
        durationKind: 'ROUND',
        amount: 10
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      atHigherLevels: 'When you cast this spell using a spell slot of 2nd level or higher, the damage increases.',
      effects: [
        {
          id: 'spell-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'spell-range-1',
              rangeKind: 'DISTANCE',
              amount: 90,
              unit: 'FEET'
            }
          },
          branches: [
            {
              id: 'spell-BRANCH-1',
              branch: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                {
                  id: 'spell-BRANCH-1-level-1',
                  level: 1,
                  order: 1,
                  diceConfig: '3d6'
                },
                {
                  id: 'spell-BRANCH-1-level-2',
                  level: 2,
                  order: 2,
                  diceConfig: '4d6'
                }
              ]
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('spell-effects-1')).resolves.toEqual({
      kind: 'SPELL',
      id: 'spell-effects-1',
      label: 'Flame Lash',
      description: 'A spell with an effect.',
      attributes: undefined,
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      range: {
        id: 'spell-range-root-1',
        rangeKind: 'DISTANCE',
        amount: 150,
        unit: 'FEET'
      },
      duration: {
        id: 'spell-duration-root-1',
        durationKind: 'ROUND',
        amount: 10
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      atHigherLevels: 'When you cast this spell using a spell slot of 2nd level or higher, the damage increases.',
      effects: [
        {
          id: 'spell-effect-1',
          order: 1,
          invocation: {
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'ACTION',
              amount: 1
            },
            range: {
              id: 'spell-range-1',
              rangeKind: 'DISTANCE',
              amount: 90,
              unit: 'FEET'
            },
            shape: undefined
          },
          branches: [
            {
              id: 'spell-BRANCH-1',
              branch: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: undefined,
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'DICE',
              scalingKind: 'PER_LEVEL',
              scalingSource: 'SPELL_CAST_LEVEL',
              levels: [
                {
                  id: 'spell-BRANCH-1-level-1',
                  level: 1,
                  order: 1,
                  diceConfig: '3d6'
                },
                {
                  id: 'spell-BRANCH-1-level-2',
                  level: 2,
                  order: 2,
                  diceConfig: '4d6'
                }
              ],
              bonuses: undefined
            }
          ]
        }
      ],
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })
  })

  it('fails loudly on invalid persisted casting time units', async () => {
    const repository = createSpellRepository(createFakeDb({
      spells: [
        {
          id: 'spell-invalid-unit',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Spell',
          description: 'Oops.',
          level: 1,
          magic_school_id: 'evocation',
          casting_time_unit: 'DAY',
          casting_time_amount: 1,
          range_id: null,
          duration_id: null,
          at_higher_levels: null,
          material_description: null
        }
      ],
      spell_effects: [],
      spell_attributes: [],
      spell_classes: []
    }) as never)

    await expect(repository.findById('spell-invalid-unit')).rejects.toThrow('invalid casting_time_unit')
  })
})
