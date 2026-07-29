import { describe, expect, it } from 'vitest'
import { createOptionRepository } from '../repositories/index.js'
import { InMemoryDb } from './helpers/in-memory-db.js'
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
describe('createOptionRepository', () => {
  it('batches findByIds while preserving requested order and omitting inaccessible rows', async () => {
    const db = createFakeDb({
      options: [
        {
          id: 'option-1',
          label: 'First',
          description: 'Visible option.',
          sort_order: 1,
          charge_id: null,
          restriction_id: null
        },
        {
          id: 'option-2',
          label: 'Second',
          description: 'Visible option.',
          sort_order: 2,
          charge_id: null,
          restriction_id: null
        },
        {
          id: 'option-unrequested',
          label: 'Unrequested',
          description: 'Should not hydrate.',
          sort_order: 3,
          charge_id: null,
          restriction_id: null
        }
      ],
      option_effects: [],
      option_details: [],
      details: [],
      option_attributes: [
        { option_id: 'option-1', attribute_code: 'LIMITED_USE', sort_order: 1 },
        { option_id: 'option-2', attribute_code: 'HIDDEN_ON_SHEET', sort_order: 1 },
        { option_id: 'option-unrequested', attribute_code: 'SUPPRESSED_IN_BUILDER', sort_order: 1 }
      ],
      option_feat_grants: [],
      option_modifier_grants: [],
      option_proficiency_grants: [],
      option_sense_grants: [],
      option_spell_grants: []
    })
    const repository = createOptionRepository(db as unknown as DBLike)

    const results = await repository.findByIds([
      'option-2',
      'option-missing',
      'option-1',
      'option-2'
    ])

    expect(Array.from(results.keys())).toEqual(['option-2', 'option-1'])
    expect(results.get('option-2')?.attributes).toEqual(['HIDDEN_ON_SHEET'])
    expect(results.get('option-1')?.attributes).toEqual(['LIMITED_USE'])
    expect(results.has('option-missing')).toBe(false)
    expect(results.has('option-unrequested')).toBe(false)
    expect(db.queryCounts.get('options')).toBe(1)
    expect(db.queryCounts.get('option_attributes')).toBe(1)
  })

  it('hydrates an option with supported owned charge and grants', async () => {
    const repository = createOptionRepository(
      createFakeDb({
        options: [
          {
            id: 'option-1',
            label: 'Quickened',
            description: 'Cast faster.',
            sort_order: 2,
            charge_id: 'charge-1',
            restriction_id: null
          }
        ],
        option_effects: [],
        option_details: [{ option_id: 'option-1', detail_id: 'option-detail-1', sort_order: 1 }],
        details: [
          { id: 'option-detail-1', label: 'Detail', description: 'Costs a charge.', sort_order: 1 }
        ],
        option_attributes: [
          { option_id: 'option-1', attribute_code: 'LIMITED_USE', sort_order: 1 }
        ],
        option_feat_grants: [],
        option_modifier_grants: [],
        option_proficiency_grants: [],
        option_sense_grants: [],
        option_spell_grants: [
          { option_id: 'option-1', spell_grant_id: 'spell-grant-1', sort_order: 1 }
        ],
        charges: [{ id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'SHORT_REST' }],
        charge_limits: [
          {
            charge_id: 'charge-1',
            limit_kind: 'ABILITY_MODIFIER',
            class_id: null,
            ability_code: 'CHARISMA',
            amount: null,
            multiplier: 1,
            min: 1,
            max: null
          }
        ],
        charge_scaling_levels: [],
        charge_bonuses: [],
        spell_grants: [
          {
            id: 'spell-grant-1',
            sort_order: 1,
            selection_kind: 'GRANTED',
            scaling_kind: 'NONE',
            authoring_mode_kind: 'SELECTED',
            selection_count: null,
            scaling_source: null,
            class_id: null,
            charge_id: null,
            restriction_id: null,
            filter_id: null,
            cast_at_level: 2
          }
        ],
        spell_grant_attributes: [
          { spell_grant_id: 'spell-grant-1', attribute_code: 'CAST_AT_LEVEL', sort_order: 1 }
        ],
        spell_grant_spells: [{ spell_grant_id: 'spell-grant-1', spell_id: 'misty-step' }],
        spell_grant_scaling_levels: [],
        spell_grant_scaling_level_spells: []
      }) as never
    )
    await expect(repository.findById('option-1')).resolves.toEqual({
      id: 'option-1',
      label: 'Quickened',
      description: 'Cast faster.',
      attributes: ['LIMITED_USE'],
      details: [
        {
          id: 'option-detail-1',
          label: 'Detail',
          description: 'Costs a charge.',
          order: 1
        }
      ],
      effects: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'SHORT_REST',
        limitKind: 'ABILITY_MODIFIER',
        scalingKind: 'NONE',
        ability: 'CHARISMA',
        multiplier: 1,
        min: 1,
        max: undefined,
        bonuses: undefined
      },
      grants: {
        feats: undefined,
        modifiers: undefined,
        proficiencies: undefined,
        senses: undefined,
        spells: [
          {
            id: 'spell-grant-1',
            grantKind: 'SPELL_GRANT',
            order: 1,
            attributes: ['CAST_AT_LEVEL'],
            selectionKind: 'GRANTED',
            scalingKind: 'NONE',
            authoringModeKind: 'SELECTED',
            count: undefined,
            spellIds: ['misty-step'],
            castAtLevel: 2,
            charges: undefined,
            filters: undefined,
            restrictions: undefined
          }
        ]
      },
      restrictions: undefined,
      order: 2
    })
  })
  it('round-trips supported option effects through the typed effect repository', async () => {
    const db = new InMemoryDb()
    const repository = createOptionRepository(db as never, 'system-1')
    await repository.upsert({
      id: 'option-effects',
      label: 'Explosive Choice',
      description: 'Carries an authored effect.',
      order: 1,
      effects: [
        {
          id: 'option-effect-standalone-1',
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'option-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 20,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'option-effect-direct-1',
              order: 1,
              pathCode: 'ON_HIT',
              groupType: 'SINGLE',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'option-effect-direct-1',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'option-effect-direct-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 7
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    await expect(repository.findById('option-effects')).resolves.toMatchObject({
      id: 'option-effects',
      label: 'Explosive Choice',
      description: 'Carries an authored effect.',
      attributes: undefined,
      details: undefined,
      effects: [
        {
          id: 'option-effect-standalone-1',
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: 'SPELL_ATTACK',
            activation: {
              code: 'BONUS_ACTION',
              amount: 1
            },
            range: {
              id: 'option-effect-range-1',
              rangeKind: 'DISTANCE',
              amount: 20,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'option-effect-direct-1',
              pathCode: 'ON_HIT',
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'option-effect-direct-1',
                resultKind: 'SINGLE',
                outcomes: [
                  {
                    id: 'option-effect-direct-1',
                    effectKind: 'DAMAGE',
                    damageTypeId: 'fire',
                    valueKind: 'FIXED',
                    scalingKind: 'NONE',
                    amount: 7
                  }
                ]
              }
            }
          ]
        }
      ],
      charges: undefined,
      grants: undefined,
      restrictions: undefined,
      order: 1
    })
  })
})
