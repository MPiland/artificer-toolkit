import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  VALUE_DOMAIN_CODE,
  type AuthoringConstraintCode,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode
} from '@artificer-toolkit/shared/core'
import type {
  FacetAuthored,
  ModifierGrantAuthored,
  OptionAuthored
} from '@artificer-toolkit/shared/authored'

export { closedRuleEffect } from '../closed-rule-effect.js'

/** SRD equipment indexes of the artisan's tools (alchemist's supplies through woodcarver's tools). */
export const ARTISAN_TOOL_EQUIPMENT_INDEXES = [
  51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67
] as const
/** SRD equipment indexes of the musical instruments (bagpipes through viol). */
export const MUSICAL_INSTRUMENT_EQUIPMENT_INDEXES = [
  68, 69, 70, 71, 72, 73, 74, 75, 76, 77
] as const

/**
 * Character-wide gate on worn equipment: with INCLUDE the character wears an item of every listed
 * category; with EXCLUDE they wear none. Uses ids `makeId(0..2 + categories.length)`.
 */
export function equippedCategoryRestriction(
  makeId: (entry: number) => string,
  constraint: AuthoringConstraintCode,
  categories: readonly EquipmentCategoryCode[]
): FacetAuthored {
  return {
    id: makeId(0),
    groups: [
      {
        id: makeId(1),
        order: 0,
        contexts: [
          {
            id: makeId(2),
            order: 0,
            subject: 'CHARACTER',
            conditions: categories.map((category, index) => ({
              id: makeId(3 + index),
              order: index,
              kind: 'PREDICATE' as const,
              constraint,
              predicateCode: 'EQUIPMENT_EQUIPPED' as const,
              authoringModeKind: 'ALL' as const,
              category
            }))
          }
        ]
      }
    ]
  }
}

/**
 * Gate evaluated against the attacking item: every listed property check must hold (EXCLUDE
 * negates one). Uses ids `makeId(0..2 + checks.length)`.
 */
export function attackingItemPropertyRestriction(
  makeId: (entry: number) => string,
  checks: readonly {
    constraint: AuthoringConstraintCode
    properties: readonly EquipmentPropertyCode[]
  }[]
): FacetAuthored {
  return {
    id: makeId(0),
    groups: [
      {
        id: makeId(1),
        order: 0,
        contexts: [
          {
            id: makeId(2),
            order: 0,
            subject: 'EQUIPMENT',
            authoringModeKind: 'ALL',
            conditions: checks.map(({ constraint, properties }, index) => ({
              id: makeId(3 + index),
              order: index,
              kind: 'PREDICATE' as const,
              constraint,
              predicateCode: 'EQUIPMENT_PROPERTY' as const,
              authoringModeKind: 'SELECTED' as const,
              properties: [...properties]
            }))
          }
        ]
      }
    ]
  }
}

/** "You can attack N times whenever you take the Attack action": the highest source applies. */
export function attacksPerAttackActionGrant(id: string, amount: number): ModifierGrantAuthored {
  return {
    id,
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACKS_PER_ATTACK_ACTION,
    domain: {},
    modifierKind: MODIFIER_KIND.SET_VALUE,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { amount },
    order: 0
  }
}

/**
 * Dueling: "wielding a melee weapon in one hand and no other weapons". The attacking item is a
 * melee weapon, not wielded two-handed, and no other weapon is equipped. Uses ids `makeId(0..5)`.
 */
export function duelingRestriction(makeId: (entry: number) => string): FacetAuthored {
  return {
    id: makeId(0),
    groups: [
      {
        id: makeId(1),
        order: 0,
        contexts: [
          {
            id: makeId(2),
            order: 0,
            subject: 'EQUIPMENT',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: makeId(3),
                order: 0,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'EQUIPMENT_PROPERTY',
                authoringModeKind: 'SELECTED',
                properties: ['MELEE']
              },
              {
                id: makeId(4),
                order: 1,
                kind: 'PREDICATE',
                constraint: 'EXCLUDE',
                predicateCode: 'EQUIPMENT_PROPERTY',
                authoringModeKind: 'SELECTED',
                properties: ['TWO_HANDED']
              },
              {
                id: makeId(5),
                order: 2,
                kind: 'PREDICATE',
                constraint: 'INCLUDE',
                predicateCode: 'SOLE_WIELDED_WEAPON'
              }
            ]
          }
        ]
      }
    ]
  }
}

/**
 * Two-Weapon Fighting: "add your ability modifier to the damage of the second attack". One grant
 * per ability restores the positive modifier (`min: 0`) to a Light weapon's bonus-action attack
 * made with that ability. `makeGrantId(0..1)` names the grants and `makeId(g * 8 + 0..5)` the
 * restriction of grant `g`.
 */
export function twoWeaponFightingGrants(
  makeGrantId: (entry: number) => string,
  makeId: (entry: number) => string
): ModifierGrantAuthored[] {
  return [ABILITY_CODE.STRENGTH, ABILITY_CODE.DEXTERITY].map((ability, index) => {
    const id = (entry: number) => makeId(index * 8 + entry)
    return {
      id: makeGrantId(index),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: 'MELEE' as const },
      modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { ability, min: 0 },
      order: index,
      restrictions: {
        id: id(0),
        groups: [
          {
            id: id(1),
            order: 0,
            contexts: [
              {
                id: id(2),
                order: 0,
                subject: 'EQUIPMENT' as const,
                authoringModeKind: 'ALL' as const,
                conditions: [
                  {
                    id: id(3),
                    order: 0,
                    kind: 'PREDICATE' as const,
                    constraint: 'INCLUDE' as const,
                    predicateCode: 'EQUIPMENT_PROPERTY' as const,
                    authoringModeKind: 'SELECTED' as const,
                    properties: ['LIGHT' as const]
                  },
                  {
                    id: id(4),
                    order: 1,
                    kind: 'PREDICATE' as const,
                    constraint: 'INCLUDE' as const,
                    predicateCode: 'ATTACK_ACTIVATION' as const,
                    activation: ACTIVATION_CODE.BONUS_ACTION
                  },
                  {
                    id: id(5),
                    order: 2,
                    kind: 'PREDICATE' as const,
                    constraint: 'INCLUDE' as const,
                    predicateCode: 'ATTACK_ABILITY' as const,
                    ability
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  })
}

const ABILITY_SCORE_IMPROVEMENT_ABILITIES = [
  { ability: ABILITY_CODE.STRENGTH, label: 'Strength' },
  { ability: ABILITY_CODE.DEXTERITY, label: 'Dexterity' },
  { ability: ABILITY_CODE.CONSTITUTION, label: 'Constitution' },
  { ability: ABILITY_CODE.INTELLIGENCE, label: 'Intelligence' },
  { ability: ABILITY_CODE.WISDOM, label: 'Wisdom' },
  { ability: ABILITY_CODE.CHARISMA, label: 'Charisma' }
] as const

export function abilityScoreImprovementOptions(
  makeId: (entry: number) => string,
  description: string
): OptionAuthored[] {
  const modifier = (
    entry: number,
    ability: (typeof ABILITY_SCORE_IMPROVEMENT_ABILITIES)[number]['ability'],
    amount: number,
    order: number
  ): ModifierGrantAuthored => ({
    id: makeId(entry),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
    domain: { ability },
    modifierKind: MODIFIER_KIND.BONUS,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { valueKind: 'FIXED' as const, amount },
    order
  })
  const options: OptionAuthored[] = ABILITY_SCORE_IMPROVEMENT_ABILITIES.map(
    ({ ability, label }, index) => ({
      id: makeId(index + 1),
      label: `${label} +2`,
      description,
      grants: { modifiers: [modifier(64 + index, ability, 2, 0)] },
      order: index
    })
  )

  let optionEntry = ABILITY_SCORE_IMPROVEMENT_ABILITIES.length + 1
  let modifierEntry = 96
  for (let leftIndex = 0; leftIndex < ABILITY_SCORE_IMPROVEMENT_ABILITIES.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < ABILITY_SCORE_IMPROVEMENT_ABILITIES.length;
      rightIndex += 1
    ) {
      const left = ABILITY_SCORE_IMPROVEMENT_ABILITIES[leftIndex]
      const right = ABILITY_SCORE_IMPROVEMENT_ABILITIES[rightIndex]
      options.push({
        id: makeId(optionEntry),
        label: `${left.label} +1, ${right.label} +1`,
        description,
        grants: {
          modifiers: [
            modifier(modifierEntry, left.ability, 1, 0),
            modifier(modifierEntry + 1, right.ability, 1, 1)
          ]
        },
        order: optionEntry - 1
      })
      optionEntry += 1
      modifierEntry += 2
    }
  }

  return options
}
