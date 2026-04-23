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
          material_description: 'A sliver of glass.'
        }
      ],
      spell_effects: [],
      spell_attributes: [
        { spell_id: 'spell-1', attribute_code: 'RITUAL', sort_order: 2 },
        { spell_id: 'spell-1', attribute_code: 'CONCENTRATION', sort_order: 1 },
        { spell_id: 'spell-1', attribute_code: 'VERBAL', sort_order: 3 },
        { spell_id: 'spell-1', attribute_code: 'MATERIAL', sort_order: 4 }
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
      components: ['VERBAL', 'MATERIAL'],
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['sorcerer', 'wizard'],
      magicSchoolId: 'evocation',
      effects: undefined,
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
      components: undefined,
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 0,
      classIds: [],
      magicSchoolId: 'evocation',
      effects: undefined,
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
      components: ['VERBAL', 'SOMATIC'],
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-effect-1',
          order: 1,
          invocation: {
            kind: 'ACTION',
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
          paths: [
            {
              id: 'spell-PATH_CODE-1',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'spell-PATH_CODE-1__result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'spell-PATH_CODE-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'DICE',
                    scalingKind: 'PER_LEVEL',
                    scalingSource: 'SPELL_CAST_LEVEL',
                    levels: [
                      {
                        id: 'spell-PATH_CODE-1-level-1',
                        level: 1,
                        order: 1,
                        diceConfig: '3d6'
                      },
                      {
                        id: 'spell-PATH_CODE-1-level-2',
                        level: 2,
                        order: 2,
                        diceConfig: '4d6'
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      userId: 'user-1',
      systemId: 'system-1'
    })

    await expect(repository.findById('spell-effects-1')).resolves.toMatchObject({
      kind: 'SPELL',
      id: 'spell-effects-1',
      label: 'Flame Lash',
      description: 'A spell with an effect.',
      attributes: undefined,
      components: ['VERBAL', 'SOMATIC'],
      castingTime: {
        unit: 'ROUND',
        amount: 1
      },
      level: 1,
      classIds: ['wizard'],
      magicSchoolId: 'evocation',
      effects: [
        {
          id: 'spell-effect-1',
          order: 1,
          invocation: {
            kind: 'ACTION',
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
          paths: [
            {
              id: 'spell-PATH_CODE-1',
              pathCode: 'ON_HIT',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'spell-PATH_CODE-1__result',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'spell-PATH_CODE-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'DICE',
                    scalingKind: 'PER_LEVEL',
                    scalingSource: 'SPELL_CAST_LEVEL',
                    levels: [
                      {
                        id: 'spell-PATH_CODE-1-level-1',
                        level: 1,
                        order: 1,
                        diceConfig: '3d6'
                      },
                      {
                        id: 'spell-PATH_CODE-1-level-2',
                        level: 2,
                        order: 2,
                        diceConfig: '4d6'
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      materialDescription: undefined,
      userId: 'user-1',
      systemId: 'system-1'
    })

    expect(db.snapshot('spell_attributes')).toEqual([
      {
        spell_id: 'spell-effects-1',
        attribute_code: 'VERBAL',
        sort_order: 1
      },
      {
        spell_id: 'spell-effects-1',
        attribute_code: 'SOMATIC',
        sort_order: 2
      }
    ])
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
          material_description: null
        }
      ],
      spell_effects: [],
      spell_attributes: [],
      spell_classes: []
    }) as never)

    await expect(repository.findById('spell-invalid-unit')).rejects.toThrow('invalid casting_time_unit')
  })

  it('fails loudly on unknown persisted spell attribute/component codes', async () => {
    const repository = createSpellRepository(createFakeDb({
      spells: [
        {
          id: 'spell-invalid-attribute',
          system_id: 'system-1',
          user_id: 'user-1',
          label: 'Broken Spell',
          description: 'Oops.',
          level: 1,
          magic_school_id: 'evocation',
          casting_time_unit: 'ROUND',
          casting_time_amount: 1,
          material_description: null
        }
      ],
      spell_effects: [],
      spell_attributes: [
        { spell_id: 'spell-invalid-attribute', attribute_code: 'NOT_A_REAL_CODE', sort_order: 1 }
      ],
      spell_classes: []
    }) as never)

    await expect(repository.findById('spell-invalid-attribute')).rejects.toThrow('invalid spell_attributes codes')
  })
})


