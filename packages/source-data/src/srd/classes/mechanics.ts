import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  DURATION_KIND,
  EFFECT_KIND,
  GRANT_KIND,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type ActivationCode,
  type ModifierIncomingDamageAuthored,
  type AuthoringConstraintCode,
  type DamageDefenseBypassCode,
  type EquipmentCategoryCode,
  type EquipmentPropertyCode,
  type ManualAdjudicationReason
} from '@artificer-toolkit/shared/core'
import type {
  EffectAuthored,
  FacetAuthored,
  ModifierGrantAuthored,
  OptionAuthored,
  ReactionAttackedSelfTriggerBindingAuthored
} from '@artificer-toolkit/shared/authored'
import { ABILITY_CODE, type SrdAbilityCode } from '../vocabulary.js'

export { closedRuleEffect } from '../closed-rule-effect.js'

type FixedResultBlock = Extract<
  EffectAuthored['paths'][number],
  { selectionKind: 'FIXED' }
>['resultBlock']

/**
 * A self-targeted action with one outcome that lasts until an authored lifecycle event ends it
 * (Hide in Plain Sight, One with Shadows). The caller supplies every id so each feature keeps its own.
 */
export function selfActionEffect(input: {
  ids: { effect: string; range: string; path: string; result: string }
  activation: Exclude<ActivationCode, 'FREE'>
  lifecycle: NonNullable<FixedResultBlock['lifecycle']>
  outcome: FixedResultBlock['outcomes'][number]
}): EffectAuthored {
  return {
    id: input.ids.effect,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: input.activation, amount: 1 },
      range: { id: input.ids.range, rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: input.ids.path,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: input.ids.result,
          resultKind: 'SINGLE',
          lifecycle: input.lifecycle,
          outcomes: [input.outcome]
        }
      }
    ]
  }
}

/**
 * A class feature whose whole rule is a ruling the GM makes at the table (D187a): passive, or,
 * with `resourceUse`, a free action that spends the feature's charge and hands its effect to the
 * table (Indomitable's reroll). The caller supplies every id so each feature keeps its own.
 */
export function gmRulingEffect(input: {
  ids: { effect: string; range: string; path: string; result: string; outcome: string }
  label: string
  instructions: string
  reasonCode: ManualAdjudicationReason
  resourceUse?: { chargeId: string; cost: number }
  /** The action the ruling takes; one with a resource cost and no action given is free. */
  activationCode?: Exclude<ActivationCode, 'FREE'>
}): EffectAuthored {
  const range = { id: input.ids.range, rangeKind: RANGE_KIND.SELF } as const
  return {
    id: input.ids.effect,
    order: 1,
    invocation:
      input.resourceUse || input.activationCode
        ? {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            ...(input.resourceUse ? { resourceUse: input.resourceUse } : {}),
            activation: input.activationCode
              ? { code: input.activationCode, amount: 1 }
              : { code: ACTIVATION_CODE.FREE },
            range,
            targeting: { selectionKind: 'SELF' }
          }
        : {
            kind: 'PASSIVE',
            triggerCode: TRIGGER.ACTIVATED,
            range,
            targeting: { selectionKind: 'SELF' }
          },
    paths: [
      {
        id: input.ids.path,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: input.ids.result,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: input.ids.outcome,
              effectKind: EFFECT_KIND.MANUAL_ADJUDICATION,
              label: input.label,
              reasonCode: input.reasonCode,
              instructions: input.instructions
            }
          ]
        }
      }
    ]
  }
}

/**
 * Land's Stride (Circle of the Land, Ranger): the engine has no terrain-cost option or plant-source
 * save qualifier, so the whole feature is a GM ruling (D187a).
 */
export const landsStrideRuling =
  'Nonmagical difficult terrain costs you no extra movement, and nonmagical plants neither slow nor harm you. You have advantage on saving throws against plants magically created or manipulated to impede movement, such as those of entangle. The GM applies the movement and the advantage.'

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
 * Gate on the creature that is a grant's source (the attacker, the effect's origin): with INCLUDE
 * its type is one of `creatureTypeIds`, with EXCLUDE none. Uses ids `makeId(0..3)`.
 */
export function sourceCreatureTypeRestriction(
  makeId: (entry: number) => string,
  constraint: AuthoringConstraintCode,
  creatureTypeIds: readonly string[]
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
            subject: 'CREATURE',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: makeId(3),
                order: 0,
                kind: 'PREDICATE',
                constraint,
                predicateCode: 'SOURCE_CREATURE_TYPE',
                authoringModeKind: 'SELECTED',
                creatureTypeIds: [...creatureTypeIds]
              }
            ]
          }
        ]
      }
    ]
  }
}

/**
 * Gate on a trait of a grant's source (D179): with INCLUDE the source carries one of `traits`, as
 * a spell's effects are magical. Uses ids `makeId(0..3)`.
 */
export function sourceTraitRestriction(
  makeId: (entry: number) => string,
  constraint: AuthoringConstraintCode,
  traits: readonly DamageDefenseBypassCode[]
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
            subject: 'CREATURE',
            authoringModeKind: 'ALL',
            conditions: [
              {
                id: makeId(3),
                order: 0,
                kind: 'PREDICATE',
                constraint,
                predicateCode: 'SOURCE_TRAIT',
                authoringModeKind: 'SELECTED',
                traits: [...traits]
              }
            ]
          }
        ]
      }
    ]
  }
}

/**
 * Advantage on saving throws against a condition (Brave, Fey Ancestry's charm). A condition's save
 * can use any ability, so each ability gets one grant; grant `index` uses id `makeId(index)`.
 */
export function conditionSaveAdvantageGrants(
  makeId: (entry: number) => string,
  conditionTypeId: string,
  firstOrder = 0
): ModifierGrantAuthored[] {
  return Object.values(ABILITY_CODE).map((ability, index) => ({
    id: makeId(index),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    domain: { ability, conditionTypeId },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' },
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    order: firstOrder + index
  }))
}

/**
 * Advantage on saving throws of `abilities` against magic (Magic Resistance, Gnome Cunning): one
 * grant per ability, limited to a magical source (D179). Grant `index` uses ids `makeId(index * 5)`
 * to `makeId(index * 5 + 4)`.
 */
export function magicSaveAdvantageGrants(
  makeId: (entry: number) => string,
  abilities: readonly SrdAbilityCode[],
  firstOrder = 0
): ModifierGrantAuthored[] {
  return abilities.map((ability, index) => ({
    id: makeId(index * 5),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
    domain: { ability },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' },
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    restrictions: sourceTraitRestriction((entry) => makeId(index * 5 + 1 + entry), 'INCLUDE', [
      'MAGICAL'
    ]),
    order: firstOrder + index
  }))
}

/**
 * Immunity to a condition only when magic applies it (Fey Ancestry: magic can't put you to
 * sleep), limited to a magical source (D179). Uses ids `makeId(0..4)`.
 */
export function magicConditionImmunityGrant(
  makeId: (entry: number) => string,
  conditionTypeId: string,
  order: number
): ModifierGrantAuthored {
  return {
    id: makeId(0),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.CONDITION_IMMUNITY,
    domain: {},
    modifierKind: MODIFIER_KIND.ADD_OPTION,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { conditionTypeId },
    restrictions: sourceTraitRestriction((entry) => makeId(1 + entry), 'INCLUDE', ['MAGICAL']),
    order
  }
}

/**
 * Evasion: against an effect that deals half its damage on a successful Dexterity save, the holder
 * takes none on a success and half on a failure.
 */
export function evasionGrant(id: string): ModifierGrantAuthored {
  return {
    id,
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.INCOMING_DAMAGE,
    domain: {},
    modifierKind: MODIFIER_KIND.ENABLE,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: {
      incomingDamageKind: 'SAVE_FOR_HALF',
      saveAbilities: [ABILITY_CODE.DEXTERITY],
      onSaveSuccess: 'NONE',
      onSaveFailure: 'HALF'
    },
    order: 0
  }
}

type IncomingDamageReaction = {
  trigger: ReactionAttackedSelfTriggerBindingAuthored
  payload: ModifierIncomingDamageAuthored
}

/** Uncanny Dodge: answers a hit by an attacker the holder sees by halving that attack's damage. */
export const uncannyDodgeReaction = {
  trigger: { kind: 'ATTACKED_SELF', requiresSight: true },
  payload: { incomingDamageKind: 'HALVE' }
} as const satisfies IncomingDamageReaction

/**
 * A reaction to a hit that changes how the holder takes that attack's damage (used up by the
 * attack), on the same path as Parry. The caller supplies every id.
 */
export function incomingDamageReactionEffect(
  ids: {
    effect: string
    range: string
    path: string
    duration: string
    outcome: string
    grant: string
  },
  reaction: IncomingDamageReaction
): EffectAuthored {
  return {
    id: ids.effect,
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
      reactionTrigger: reaction.trigger,
      range: { id: ids.range, rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: 'SELF' }
    },
    paths: [
      {
        id: ids.path,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${ids.path}__result`,
          resultKind: 'SINGLE',
          duration: { id: ids.duration, durationKind: DURATION_KIND.ROUND, amount: 1 },
          lifecycle: {
            turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
            consumeOnFirstEvents: ['ON_ATTACKED']
          },
          outcomes: [
            {
              id: ids.outcome,
              effectKind: EFFECT_KIND.APPLY_GRANT,
              grants: {
                modifiers: [
                  {
                    id: ids.grant,
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.INCOMING_DAMAGE,
                    domain: {},
                    modifierKind: MODIFIER_KIND.ENABLE,
                    scope: MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    payload: reaction.payload,
                    order: 1
                  }
                ]
              }
            }
          ]
        }
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
 * "Your weapon attacks score a critical hit on a roll of `threshold`-20" (Champion): the lowest
 * natural d20 that crits, for melee, ranged and unarmed weapon attacks. The lowest source wins, so
 * Superior Critical's 18 replaces Improved Critical's 19 without restating it. Uses `makeId(0..2)`.
 */
export function criticalHitThresholdGrants(
  makeId: (entry: number) => string,
  threshold: number
): ModifierGrantAuthored[] {
  return (['MELEE', 'RANGED', 'UNARMED'] as const).map((attackDomain, index) => ({
    id: makeId(index),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.CRITICAL_HIT_THRESHOLD,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.CAP_VALUE,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { amount: threshold },
    order: index
  }))
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
