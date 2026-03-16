import { describe, expect, it } from 'vitest'
import { createModifierGrantRepository } from '../repositories/index.js'

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

describe('createModifierGrantRepository', () => {
  it('hydrates a modifier grant with domain, payload, and optional abilities', async () => {
    const repository = createModifierGrantRepository(createFakeDb({
      modifier_grants: [{
        id: 'modifier-1',
        sort_order: 2,
        selection_kind: 'CHOSEN',
        count: 1,
        value_domain_code: 'ATTACK_ROLL_BONUS',
        modifier_kind: 'OPTIONAL_ABILITY_MODIFIER',
        scope: 'SOURCE',
        restriction_id: null
      }],
      modifier_grant_domain_params: [{
        modifier_grant_id: 'modifier-1',
        value_domain_code: 'ATTACK_ROLL_BONUS',
        attack_domain_code: 'MELEE',
        ability_code: null,
        skill_id: null,
        speed_id: null,
        sense_code: null,
        spell_level: null
      }],
      modifier_grant_payloads: [{
        modifier_grant_id: 'modifier-1',
        modifier_kind: 'OPTIONAL_ABILITY_MODIFIER',
        value_domain_code: 'ATTACK_ROLL_BONUS',
        numeric_value_kind: null,
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: null,
        numeric_skill_id: null,
        numeric_class_id: null,
        set_amount: null,
        charge_limit_kind: null,
        charge_scaling_kind: null,
        charge_amount: null,
        charge_multiplier: null,
        charge_min: null,
        charge_max: null,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }],
      modifier_grant_charge_levels: [],
      modifier_grant_optional_abilities: [
        { modifier_grant_id: 'modifier-1', ability_code: 'DEXTERITY' },
        { modifier_grant_id: 'modifier-1', ability_code: 'WISDOM' }
      ]
    }) as never)

    await expect(repository.findById('modifier-1')).resolves.toEqual({
      id: 'modifier-1',
      grantKind: 'MODIFIER_GRANT',
      order: 2,
      selectionKind: 'CHOSEN',
      count: 1,
      valueDomainCode: 'ATTACK_ROLL_BONUS',
      domain: {
        attackDomain: 'MELEE'
      },
      modifierKind: 'OPTIONAL_ABILITY_MODIFIER',
      scope: 'SOURCE',
      payload: {
        abilities: ['DEXTERITY', 'WISDOM']
      }
    })
  })

  it('hydrates a charge-limit modifier with per-level scaling', async () => {
    const repository = createModifierGrantRepository(createFakeDb({
      modifier_grants: [{
        id: 'modifier-charge-1',
        sort_order: 1,
        selection_kind: 'GRANTED',
        count: null,
        value_domain_code: 'CHARGE_LIMIT',
        modifier_kind: 'MODIFY_CHARGE_LIMIT',
        scope: 'GLOBAL',
        restriction_id: null
      }],
      modifier_grant_domain_params: [],
      modifier_grant_payloads: [{
        modifier_grant_id: 'modifier-charge-1',
        modifier_kind: 'MODIFY_CHARGE_LIMIT',
        value_domain_code: 'CHARGE_LIMIT',
        numeric_value_kind: null,
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: null,
        numeric_skill_id: null,
        numeric_class_id: null,
        set_amount: null,
        charge_limit_kind: 'FIXED_AMOUNT',
        charge_scaling_kind: 'PER_LEVEL',
        charge_amount: null,
        charge_multiplier: null,
        charge_min: null,
        charge_max: null,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }],
      modifier_grant_charge_levels: [
        { id: 'level-1', modifier_grant_id: 'modifier-charge-1', level: 3, amount: 2, sort_order: 1 },
        { id: 'level-2', modifier_grant_id: 'modifier-charge-1', level: 5, amount: 3, sort_order: 2 }
      ],
      modifier_grant_optional_abilities: []
    }) as never)

    await expect(repository.findById('modifier-charge-1')).resolves.toEqual({
      id: 'modifier-charge-1',
      grantKind: 'MODIFIER_GRANT',
      order: 1,
      selectionKind: 'GRANTED',
      count: undefined,
      valueDomainCode: 'CHARGE_LIMIT',
      domain: {},
      modifierKind: 'MODIFY_CHARGE_LIMIT',
      scope: 'GLOBAL',
      payload: {
        limitKind: 'FIXED_AMOUNT',
        scalingKind: 'PER_LEVEL',
        levels: [
          { id: 'level-1', level: 3, amount: 2 },
          { id: 'level-2', level: 5, amount: 3 }
        ]
      }
    })
  })

  it('fails loudly when a granted modifier grant persists count', async () => {
    const repository = createModifierGrantRepository(createFakeDb({
      modifier_grants: [{
        id: 'modifier-unexpected-count',
        sort_order: 1,
        selection_kind: 'GRANTED',
        count: 1,
        value_domain_code: 'SAVE_DC',
        modifier_kind: 'ADVANTAGE',
        scope: 'GLOBAL',
        restriction_id: null
      }],
      modifier_grant_domain_params: [],
      modifier_grant_payloads: [],
      modifier_grant_charge_levels: [],
      modifier_grant_optional_abilities: []
    }) as never)

    await expect(repository.findById('modifier-unexpected-count')).rejects.toThrow(
      'cannot hydrate count for GRANTED payload'
    )
  })

  it('fails loudly when persisted numeric ability codes are invalid', async () => {
    const repository = createModifierGrantRepository(createFakeDb({
      modifier_grants: [{
        id: 'modifier-bad-ability',
        sort_order: 1,
        selection_kind: 'GRANTED',
        count: null,
        value_domain_code: 'SAVE_DC',
        modifier_kind: 'BONUS',
        scope: 'GLOBAL',
        restriction_id: null
      }],
      modifier_grant_domain_params: [],
      modifier_grant_payloads: [{
        modifier_grant_id: 'modifier-bad-ability',
        modifier_kind: 'BONUS',
        value_domain_code: 'SAVE_DC',
        numeric_value_kind: 'ABILITY_MODIFIER',
        numeric_amount: null,
        numeric_multiplier: null,
        numeric_ability_code: 'LUCK',
        numeric_skill_id: null,
        numeric_class_id: null,
        set_amount: null,
        charge_limit_kind: null,
        charge_scaling_kind: null,
        charge_amount: null,
        charge_multiplier: null,
        charge_min: null,
        charge_max: null,
        dice: null,
        damage_type_id: null,
        condition_type_id: null,
        movement_mode_id: null,
        attribute_id: null,
        range_kind: null,
        duration_kind: null,
        shape_kind: null,
        reset_kind: null
      }],
      modifier_grant_charge_levels: [],
      modifier_grant_optional_abilities: []
    }) as never)

    await expect(repository.findById('modifier-bad-ability')).rejects.toThrow(
      'invalid numeric_ability_code'
    )
  })
})
