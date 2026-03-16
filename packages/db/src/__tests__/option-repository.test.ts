import { describe, expect, it } from 'vitest'
import { createOptionRepository } from '../repositories/index.js'
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

describe('createOptionRepository', () => {
  it('hydrates an option with supported owned charge and grants', async () => {
    const repository = createOptionRepository(createFakeDb({
      options: [
        {
          id: 'option-1',
          label: 'Quickened',
          description: 'Cast faster.',
          detail: 'Costs a charge.',
          sort_order: 2,
          charge_id: 'charge-1',
          restriction_id: null
        }
      ],
      option_effects: [],
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
      charges: [
        { id: 'charge-1', scaling_kind: 'NONE', reset_kind: 'SHORT_REST' }
      ],
      charge_limits: [
        {
          charge_id: 'charge-1',
          limit_kind: 'FIXED_AMOUNT',
          class_id: null,
          amount: 2,
          multiplier: null,
          min: null,
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
      spell_grant_spells: [
        { spell_grant_id: 'spell-grant-1', spell_id: 'misty-step' }
      ],
      spell_grant_scaling_levels: [],
      spell_grant_scaling_level_spells: []
    }) as never)

    await expect(repository.findById('option-1')).resolves.toEqual({
      id: 'option-1',
      label: 'Quickened',
      description: 'Cast faster.',
      attributes: ['LIMITED_USE'],
      detail: 'Costs a charge.',
      effects: undefined,
      charges: {
        id: 'charge-1',
        resetKind: 'SHORT_REST',
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'NONE',
        amount: 2,
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
          moments: [
            {
              id: 'option-effect-direct-1',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 7
            }
          ]
        }
      ]
    })

    await expect(repository.findById('option-effects')).resolves.toEqual({
      id: 'option-effects',
      label: 'Explosive Choice',
      description: 'Carries an authored effect.',
      attributes: undefined,
      detail: undefined,
      effects: [
        {
          id: 'option-effect-standalone-1',
          order: 1,
          invocation: {
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
            },
            shape: undefined
          },
          moments: [
            {
              id: 'option-effect-direct-1',
              moment: 'ON_HIT',
              groupType: 'SINGLE',
              resolutionKind: 'DIRECT',
              duration: undefined,
              effectKind: 'DAMAGE',
              damageTypeId: 'fire',
              valueKind: 'FIXED',
              scalingKind: 'NONE',
              amount: 7,
              bonuses: undefined
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
