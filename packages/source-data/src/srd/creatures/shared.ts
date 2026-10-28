import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CHARGE_RESET_KIND,
  CLOSED_RULE_KIND,
  DAMAGE_DEFENSE_BYPASS_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_USAGE,
  CREATURE_CATEGORY_CODE,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  FOLLOW_UP_SAVE_TIMING,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SHAPE_KIND,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  type ActorRelationshipAuthored,
  type ActorRelationshipModuleAuthored,
  type AttackSlotCondition,
  type CreatureAuthored,
  type CreatureSenseAuthored,
  type EffectAuthored,
  type FeatureAuthored,
  type FollowUpSaveAuthored,
  type ModifierGrantAuthored,
  type MovementPassageOption
} from '@artificer-toolkit/shared'
import { v5 as uuidv5 } from 'uuid'
import { SRD_BASIC_ACTION_IDS } from '../basicActions.js'
import { magicConditionImmunityGrant, magicSaveAdvantageGrants } from '../classes/mechanics.js'
import { CREATURE_IDS } from '../ids.js'
import { SIZE_CODE, type SizeCode } from '../sizes.js'
export { SPELL_IDS } from '../ids.js'
import {
  SRD_ABILITY_DEFINITION_IDS,
  SRD_ACROBATICS_SKILL_ID,
  SRD_ATHLETICS_SKILL_ID,
  SRD_BLINDSIGHT_SENSE_ID,
  SRD_CHALLENGE_RATINGS,
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_DARKVISION_SENSE_ID,
  SRD_LANGUAGES,
  SRD_MAGIC_SCHOOLS,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_TREMORSENSE_SENSE_ID,
  SRD_TRUESIGHT_SENSE_ID,
  SRD_USER_ID,
  ABILITY_CODE,
  type SrdAbilityCode
} from '../vocabulary.js'

export { SRD_ABILITY_DEFINITION_IDS } from '../vocabulary.js'

export { closedRuleEffect, manualAdjudicationEffect } from '../closed-rule-effect.js'

export {
  DND5E_LEGENDARY_ACTION_LIFECYCLE_DEFINITION_ID,
  DND5E_LEGENDARY_RESISTANCE_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_4_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_5_LIFECYCLE_DEFINITION_ID,
  DND5E_RECHARGE_6_LIFECYCLE_DEFINITION_ID
} from '@artificer-toolkit/schema/shared/encounterLifecycle'

const SRD_RECHARGE_CHARGE_NAMESPACE = '2b7463a4-0980-4e55-8f3d-1b5704d06856'

export function rechargeFeatureCharge(featureId: string) {
  return {
    id: uuidv5(`${featureId}:recharge-charge`, SRD_RECHARGE_CHARGE_NAMESPACE),
    limitKind: 'FIXED_AMOUNT' as const,
    scalingKind: SCALING.NONE,
    resetKind: CHARGE_RESET_KIND.MANUAL,
    amount: 1
  }
}

function vocabularyId<TCode extends string>(
  entries: readonly { code: TCode; id: string }[],
  code: TCode
): string {
  const entry = entries.find((item) => item.code === code)

  if (!entry) {
    throw new Error(`Missing SRD vocabulary ID for ${code}`)
  }

  return entry.id
}

export const CREATURE_TYPE = {
  ABERRATION: vocabularyId(SRD_CREATURE_TYPES, 'ABERRATION'),
  BEAST: vocabularyId(SRD_CREATURE_TYPES, 'BEAST'),
  CELESTIAL: vocabularyId(SRD_CREATURE_TYPES, 'CELESTIAL'),
  CONSTRUCT: vocabularyId(SRD_CREATURE_TYPES, 'CONSTRUCT'),
  DRAGON: vocabularyId(SRD_CREATURE_TYPES, 'DRAGON'),
  ELEMENTAL: vocabularyId(SRD_CREATURE_TYPES, 'ELEMENTAL'),
  FEY: vocabularyId(SRD_CREATURE_TYPES, 'FEY'),
  FIEND: vocabularyId(SRD_CREATURE_TYPES, 'FIEND'),
  GIANT: vocabularyId(SRD_CREATURE_TYPES, 'GIANT'),
  HUMANOID: vocabularyId(SRD_CREATURE_TYPES, 'HUMANOID'),
  MONSTROSITY: vocabularyId(SRD_CREATURE_TYPES, 'MONSTROSITY'),
  OOZE: vocabularyId(SRD_CREATURE_TYPES, 'OOZE'),
  PLANT: vocabularyId(SRD_CREATURE_TYPES, 'PLANT'),
  UNDEAD: vocabularyId(SRD_CREATURE_TYPES, 'UNDEAD')
} as const

export const CR = {
  CR_0: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_0'),
  CR_1_8: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_8'),
  CR_1_4: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_4'),
  CR_1_2: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1_2'),
  CR_1: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_1'),
  CR_2: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_2'),
  CR_3: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_3'),
  CR_4: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_4'),
  CR_5: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_5'),
  CR_6: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_6'),
  CR_7: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_7'),
  CR_8: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_8'),
  CR_9: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_9'),
  CR_10: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_10'),
  CR_11: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_11'),
  CR_12: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_12'),
  CR_13: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_13'),
  CR_14: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_14'),
  CR_15: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_15'),
  CR_16: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_16'),
  CR_17: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_17'),
  CR_18: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_18'),
  CR_19: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_19'),
  CR_20: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_20'),
  CR_21: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_21'),
  CR_22: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_22'),
  CR_23: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_23'),
  CR_24: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_24'),
  CR_25: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_25'),
  CR_26: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_26'),
  CR_27: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_27'),
  CR_28: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_28'),
  CR_29: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_29'),
  CR_30: vocabularyId(SRD_CHALLENGE_RATINGS, 'CR_30')
} as const

const GRAPPLED_CONDITION_ID = vocabularyId(SRD_CONDITION_TYPES, 'GRAPPLED')
const WALK_SPEED_ID = vocabularyId(SRD_SPEEDS, 'WALK')
const SWIM_SPEED_ID = vocabularyId(SRD_SPEEDS, 'SWIM')
const CLIMB_SPEED_ID = vocabularyId(SRD_SPEEDS, 'CLIMB')
const FLY_SPEED_ID = vocabularyId(SRD_SPEEDS, 'FLY')
const BURROW_SPEED_ID = vocabularyId(SRD_SPEEDS, 'BURROW')

function localId(group: number, creatureIndex: number, localIndex: number) {
  return `00000000-${group.toString(16).padStart(4, '0')}-${localIndex.toString(16).padStart(4, '0')}-0070-${creatureIndex.toString(16).padStart(4, '0')}00000000`
}

export function walk(amount: number) {
  return [{ speedId: WALK_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function climb(amount: number) {
  return [{ speedId: CLIMB_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function swim(amount: number) {
  return [{ speedId: SWIM_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function fly(amount: number) {
  return [{ speedId: FLY_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

export function burrow(amount: number) {
  return [{ speedId: BURROW_SPEED_ID, amount, unit: MEASUREMENT_UNIT_CODE.FEET }]
}

/** A printed Sense ("darkvision 60 ft."); `qualifier` is the printed note after its range. */
function sense(senseDefinitionId: string, feet: number, qualifier?: string): CreatureSenseAuthored {
  return {
    senseDefinitionId,
    range: {
      id: `${senseDefinitionId}-range`,
      rangeKind: RANGE_KIND.DISTANCE,
      amount: feet,
      unit: MEASUREMENT_UNIT_CODE.FEET
    },
    ...(qualifier ? { qualifier } : {})
  }
}

/** A magical sleep ends when the sleeper takes damage or another creature shakes it awake. */
export const WAKE_END_TRIGGERS = [
  { event: 'DAMAGE_TAKEN' as const, by: 'ANYONE' as const },
  { event: 'ACTION_USED_ON_HOLDER' as const, actionDefinitionIds: [SRD_BASIC_ACTION_IDS.ROUSE] }
]

export const darkvision = (feet: number, qualifier?: string) =>
  sense(SRD_DARKVISION_SENSE_ID, feet, qualifier)
export const blindsight = (feet: number, qualifier?: string) =>
  sense(SRD_BLINDSIGHT_SENSE_ID, feet, qualifier)
export const tremorsense = (feet: number, qualifier?: string) =>
  sense(SRD_TREMORSENSE_SENSE_ID, feet, qualifier)
export const truesight = (feet: number, qualifier?: string) =>
  sense(SRD_TRUESIGHT_SENSE_ID, feet, qualifier)

export function featureId(creatureIndex: number, localIndex: number) {
  return localId(1, creatureIndex, localIndex)
}

export function actionId(creatureIndex: number, localIndex: number) {
  return localId(2, creatureIndex, localIndex)
}

/**
 * A slotted caster's Spellcasting grants: its at-will cantrips, one PREPARED grant per spell level
 * listing that level's spells, and the feature's long-rest slot table those slot-mode grants cast
 * from (Acolyte, Spirit Naga), each casting at the spell save DC its stat block states. Grant ids
 * use local indexes 220-229 and the table 240-249 of the creature.
 */
export function slottedSpellcastingGrants(
  creatureIndex: number,
  castingAbility: SrdAbilityCode,
  spellSaveDc: number,
  cantripIds: string[],
  slotted: ReadonlyArray<{ level: number; slots: number; spellIds: string[] }>
): NonNullable<FeatureAuthored['grants']> {
  const spellGrant = (index: number, spellIds: string[]) => ({
    id: featureId(creatureIndex, 220 + index),
    grantKind: GRANT_KIND.SPELL_GRANT,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    spellIds,
    castingAbility,
    spellSaveDc,
    order: index
  })
  return {
    spells: [
      {
        ...spellGrant(0, cantripIds),
        attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED, SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL]
      },
      ...slotted.map(({ level, spellIds }) => ({
        ...spellGrant(level, spellIds),
        attributes: [SPELL_GRANT_ATTRIBUTE.PREPARED]
      }))
    ],
    spellSlots: {
      id: featureId(creatureIndex, 240),
      resetKind: CHARGE_RESET_KIND.LONG_REST,
      levels: slotted.map(({ level, slots }) => ({
        id: featureId(creatureIndex, 240 + level),
        level,
        amount: slots
      }))
    }
  }
}

/** A feature's grant of where the Creature may move: through creatures, objects, or both. */
export function movementPassageGrants(
  id: string,
  passage: MovementPassageOption
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: [
      {
        id,
        grantKind: GRANT_KIND.MODIFIER_GRANT,
        valueDomainCode: VALUE_DOMAIN_CODE.MOVEMENT_PASSAGE,
        domain: {},
        modifierKind: MODIFIER_KIND.ADD_OPTION,
        scope: MODIFIER_SCOPE_KIND.GLOBAL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        payload: passage,
        order: 0
      }
    ]
  }
}

/**
 * A feature's advantage on saving throws against being <conditions>, on <savesAgainstMagic>
 * ability saves against a magical source (D179), and on checks of <skills>. A condition's save can
 * use any ability, so each condition gets one grant per ability. The grants take the IDs
 * `grantId(creatureIndex, firstLocalIndex)` onward; each magic save uses five.
 */
export function advantageGrants(
  creatureIndex: number,
  firstLocalIndex: number,
  input: {
    savesAgainst?: readonly SrdConditionCode[]
    savesAgainstMagic?: readonly SrdAbilityCode[]
    skills?: readonly string[]
  }
): { modifiers: ModifierGrantAuthored[] } {
  const common = {
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'ADVANTAGE' },
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED
  } as const
  const domains = [
    ...(input.skills ?? []).map((code) => ({
      valueDomainCode: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
      domain: { skillId: skillId(code) }
    })),
    ...(input.savesAgainst ?? []).flatMap((code) =>
      Object.values(ABILITY_CODE).map((ability) => ({
        valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
        domain: { ability, conditionTypeId: vocabularyId(SRD_CONDITION_TYPES, code) }
      }))
    )
  ]
  return {
    modifiers: [
      ...domains.map((entry, order) => ({
        ...common,
        ...entry,
        id: grantId(creatureIndex, firstLocalIndex + order),
        order
      })),
      ...magicSaveAdvantageGrants(
        (entry) => grantId(creatureIndex, firstLocalIndex + domains.length + entry),
        input.savesAgainstMagic ?? [],
        domains.length
      )
    ]
  }
}

/**
 * A sphinx's Inscrutable: immunity to divination spells, and disadvantage on Wisdom (Insight) checks
 * made to read it. The grants take the IDs `grantId(creatureIndex, firstLocalIndex)` onward.
 */
export function inscrutableGrants(
  creatureIndex: number,
  firstLocalIndex: number
): NonNullable<FeatureAuthored['grants']> {
  const common = {
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    modifierKind: MODIFIER_KIND.ADD_OPTION,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    domain: {}
  } as const
  return {
    modifiers: [
      {
        ...common,
        id: grantId(creatureIndex, firstLocalIndex),
        valueDomainCode: VALUE_DOMAIN_CODE.SPELL_SCHOOL_IMMUNITY,
        payload: {
          magicSchoolId: magicSchoolId('DIVINATION')
        },
        order: 0
      },
      {
        ...common,
        id: grantId(creatureIndex, firstLocalIndex + 1),
        valueDomainCode: VALUE_DOMAIN_CODE.CHECKS_AGAINST_HOLDER,
        payload: { skillId: skillId('INSIGHT') },
        order: 1
      }
    ]
  }
}

/** A feature that makes all the Creature's attacks magical (Magic Weapons): one ATTACK_TRAIT grant. */
export function magicWeaponsGrants(
  creatureIndex: number,
  localIndex: number
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: [
      {
        grantKind: GRANT_KIND.MODIFIER_GRANT,
        modifierKind: MODIFIER_KIND.ENABLE,
        scope: MODIFIER_SCOPE_KIND.GLOBAL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        id: grantId(creatureIndex, localIndex),
        valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_TRAIT,
        domain: { trait: DAMAGE_DEFENSE_BYPASS_CODE.MAGICAL },
        order: 0
      }
    ]
  }
}

/**
 * Magic Resistance: advantage on every saving throw against spells and other magical effects,
 * limited to a magical source (D179). The grants take the IDs `grantId(creatureIndex,
 * firstLocalIndex)` through `firstLocalIndex + 29`.
 */
export function magicResistanceGrants(creatureIndex: number, firstLocalIndex: number) {
  return advantageGrants(creatureIndex, firstLocalIndex, {
    savesAgainstMagic: Object.values(ABILITY_CODE)
  })
}

/**
 * Immunity to a condition only when magic applies it (Fey Ancestry: magic can't put it to sleep).
 * The grant takes the IDs `grantId(creatureIndex, firstLocalIndex)` through `firstLocalIndex + 4`.
 */
export function magicConditionImmunity(
  creatureIndex: number,
  firstLocalIndex: number,
  conditionCode: SrdConditionCode,
  order: number
) {
  return magicConditionImmunityGrant(
    (entry) => grantId(creatureIndex, firstLocalIndex + entry),
    vocabularyId(SRD_CONDITION_TYPES, conditionCode),
    order
  )
}

/** A feature that makes the Creature's movement provoke no opportunity attacks (Flyby). */
export function flybyGrants(
  creatureIndex: number,
  localIndex: number
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: [
      {
        grantKind: GRANT_KIND.MODIFIER_GRANT,
        modifierKind: MODIFIER_KIND.ENABLE,
        scope: MODIFIER_SCOPE_KIND.GLOBAL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        id: grantId(creatureIndex, localIndex),
        valueDomainCode: VALUE_DOMAIN_CODE.OPPORTUNITY_ATTACK_IMMUNITY,
        domain: {},
        order: 0
      }
    ]
  }
}

/** A feature that gives the Creature a condition it always has (Invisible Stalker's Invisibility). */
export function innateConditionGrants(
  creatureIndex: number,
  localIndex: number,
  conditionCode: SrdConditionCode
): NonNullable<FeatureAuthored['grants']> {
  return {
    modifiers: [
      {
        grantKind: GRANT_KIND.MODIFIER_GRANT,
        modifierKind: MODIFIER_KIND.ADD_OPTION,
        scope: MODIFIER_SCOPE_KIND.GLOBAL,
        selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
        id: grantId(creatureIndex, localIndex),
        valueDomainCode: VALUE_DOMAIN_CODE.CONDITION,
        domain: {},
        payload: { conditionTypeId: vocabularyId(SRD_CONDITION_TYPES, conditionCode) },
        order: 0
      }
    ]
  }
}

/**
 * Parry: a reaction to a melee attack by an attacker the Creature sees that adds `armorClassBonus` to
 * its AC against that one attack (used up by it). Its ids run from `base` in the Creature's reactions.
 */
export function parryReaction(
  creatureIndex: number,
  base: number,
  armorClassBonus: number
): EffectAuthored {
  const pathId = reactionId(creatureIndex, base + 2)
  return {
    id: reactionId(creatureIndex, base),
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.ACTIVATED,
      activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
      reactionTrigger: { kind: 'ATTACKED_SELF', attackRange: 'MELEE', requiresSight: true },
      range: { id: reactionId(creatureIndex, base + 1), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
    },
    paths: [
      {
        id: pathId,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${pathId}__result`,
          resultKind: 'SINGLE',
          duration: {
            id: reactionId(creatureIndex, base + 3),
            durationKind: DURATION_KIND.ROUND,
            amount: 1
          },
          lifecycle: {
            turnAnchor: { actor: 'SOURCE', boundary: 'START_OF_TURN' },
            consumeOnFirstEvents: ['ON_ATTACKED']
          },
          outcomes: [
            {
              id: pathId,
              effectKind: EFFECT_KIND.APPLY_GRANT,
              grants: {
                modifiers: [
                  {
                    id: reactionId(creatureIndex, base + 4),
                    grantKind: GRANT_KIND.MODIFIER_GRANT,
                    valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
                    domain: {},
                    modifierKind: MODIFIER_KIND.BONUS,
                    scope: MODIFIER_SCOPE_KIND.GLOBAL,
                    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                    payload: { valueKind: 'FIXED', amount: armorClassBonus },
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

/** A breath weapon's cone: a Self area that starts at the creature and catches everyone in it. */
export function selfCone(rangeId: string, shapeId: string, lengthFeet: number) {
  return {
    range: { id: rangeId, rangeKind: RANGE_KIND.SELF },
    shape: {
      id: shapeId,
      shapeKind: SHAPE_KIND.CONE,
      length: { amount: lengthFeet, unit: MEASUREMENT_UNIT_CODE.FEET }
    },
    targeting: {
      selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
      dispositionKind: TARGET_DISPOSITION_KIND.ANY
    }
  }
}

const SRD_INCOMING_DAMAGE_GRANT_NAMESPACE = '5d1f0f1e-8a4b-4c63-9b52-3e7a2c9d4b10'

type AuthoredModifierGrant = NonNullable<
  NonNullable<FeatureAuthored['grants']>['modifiers']
>[number]

/** A modifier grant minus the fields the Effect supplies; distributes so each value domain keeps its own shape. */
type IncomingDamageGrant = AuthoredModifierGrant extends infer Grant
  ? Grant extends unknown
    ? Omit<Grant, 'id' | 'grantKind' | 'scope' | 'selectionKind' | 'order'>
    : never
  : never

/**
 * A passive Effect by which the creature, on taking damage of the given types, gains modifier
 * grants until the end of its next turn. The Effect's range, path, result, outcome and grant ids
 * derive from the Effect's own id.
 */
export function incomingDamageGrantEffect(
  effectId: string,
  damageTypeCodes: readonly string[],
  grants: readonly IncomingDamageGrant[]
): EffectAuthored {
  const childId = (kind: string, index = 0) =>
    uuidv5(`${effectId}:${kind}:${index}`, SRD_INCOMING_DAMAGE_GRANT_NAMESPACE)
  return {
    id: effectId,
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.INCOMING_DAMAGE,
      damageTypeIds: damageTypeCodes.map(damageTypeId),
      range: { id: childId('range'), rangeKind: RANGE_KIND.SELF },
      targeting: { selectionKind: TARGET_SELECTION_KIND.SELF }
    },
    paths: [
      {
        id: childId('path'),
        order: 1,
        pathCode: PATH_CODE.PASSIVE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: childId('result'),
          resultKind: 'SINGLE',
          duration: { id: childId('duration'), durationKind: DURATION_KIND.ROUND, amount: 1 },
          lifecycle: { turnAnchor: { actor: 'TARGET', boundary: 'END_OF_TURN' } },
          outcomes: [
            {
              id: childId('outcome'),
              effectKind: EFFECT_KIND.APPLY_GRANT,
              grants: {
                modifiers: grants.map((grant, order) => ({
                  ...grant,
                  id: childId('grant', order),
                  grantKind: GRANT_KIND.MODIFIER_GRANT,
                  scope: MODIFIER_SCOPE_KIND.GLOBAL,
                  selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
                  order
                }))
              }
            }
          ]
        }
      }
    ]
  }
}
/**
 * A passive Effect by which the creature sheds light around itself: bright light, then dim light
 * for the additional distance. It is the same MANIFEST light a torch carries; the Effect's range,
 * path and outcome ids follow the Effect's own local index.
 */
export function shedLightEffect(
  creatureIndex: number,
  localIndex: number,
  brightFeet: number,
  dimAdditionalFeet: number
): EffectAuthored {
  const pathId = actionId(creatureIndex, localIndex + 200)
  return {
    id: actionId(creatureIndex, localIndex),
    order: 1,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: { id: actionId(creatureIndex, localIndex + 100), rangeKind: RANGE_KIND.SELF }
    },
    paths: [
      {
        id: pathId,
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${pathId}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: actionId(creatureIndex, localIndex + 300),
              effectKind: EFFECT_KIND.MANIFEST,
              manifestKind: 'OBJECT',
              attachmentKind: 'SOURCE',
              light: {
                bright: { amount: brightFeet, unit: MEASUREMENT_UNIT_CODE.FEET },
                dimAdditional: { amount: dimAdditionalFeet, unit: MEASUREMENT_UNIT_CODE.FEET }
              }
            }
          ]
        }
      }
    ]
  }
}
/** A breath weapon's line: a Self area that starts at the creature and catches everyone in it. */
export function selfLine(rangeId: string, shapeId: string, lengthFeet: number, widthFeet: number) {
  return {
    range: { id: rangeId, rangeKind: RANGE_KIND.SELF },
    shape: {
      id: shapeId,
      shapeKind: SHAPE_KIND.LINE,
      length: { amount: lengthFeet, unit: MEASUREMENT_UNIT_CODE.FEET },
      width: { amount: widthFeet, unit: MEASUREMENT_UNIT_CODE.FEET }
    },
    targeting: {
      selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
      dispositionKind: TARGET_DISPOSITION_KIND.ANY
    }
  }
}

export function bonusActionId(creatureIndex: number, localIndex: number) {
  return localId(3, creatureIndex, localIndex)
}

export function reactionId(creatureIndex: number, localIndex: number) {
  return localId(4, creatureIndex, localIndex)
}

export function legendaryActionId(creatureIndex: number, localIndex: number) {
  return localId(5, creatureIndex, localIndex)
}

function proficiencyId(creatureIndex: number, localIndex: number) {
  return localId(7, creatureIndex, localIndex)
}

export function equipmentLoadoutId(creatureIndex: number, localIndex: number) {
  return localId(8, creatureIndex, localIndex)
}

export function grantId(creatureIndex: number, localIndex: number) {
  return localId(6, creatureIndex, localIndex)
}

function grappleId(creatureIndex: number, localIndex: number) {
  return localId(9, creatureIndex, localIndex)
}

type SrdConditionCode = (typeof SRD_CONDITION_TYPES)[number]['code']

/** A printed grapple rider: "grappled (escape DC N)" (D105). */
export type GrappleRider = {
  /** The first of this rider's IDs in the creature's grapple ID group. */
  localIndex: number
  escapeDc: number
  /** How many creatures this attack holds at once: 1 unless the stat block says otherwise. */
  heldAtOnce: number
  /** The printed size limit ("if the target is Large or smaller"). */
  largestTarget?: SizeCode
  /** The printed "until this grapple ends" conditions besides Grappled. */
  untilEnds?: readonly SrdConditionCode[]
  /** The hold imposes only `untilEnds`: it layers on a grapple the source already has (Engulf). */
  omitGrappled?: true
  /** The printed "can't bite another target": these actions may target only the held creature. */
  restrictedActionEffectIds?: readonly string[]
  /** The hold applies only when this holds of the open Attack action (a Multiattack's "if both attacks hit"). */
  appliesWhen?: AttackSlotCondition
  /** The printed "takes N damage at the start of each of its turns" while held. */
  recurrence?: ActorRelationshipAuthored['recurrence']
}

/**
 * A Grappled outcome (D105): the target escapes with its Action by an Athletics or Acrobatics
 * check against the printed escape DC, and the grappler drags it when it moves. It takes the IDs
 * `grappleId(creatureIndex, localIndex)` through `localIndex + 4 + untilEnds.length`, and one more
 * for an action restriction.
 */
export function grappledOutcome(
  creatureIndex: number,
  rider: GrappleRider
): ActorRelationshipAuthored {
  const id = (offset: number) => grappleId(creatureIndex, rider.localIndex + offset)
  const modules: ActorRelationshipModuleAuthored[] = [
    ...(rider.largestTarget
      ? [
          {
            id: id(2),
            order: 0,
            kind: 'TARGET_SIZE_MAXIMUM' as const,
            sizeCode: rider.largestTarget
          }
        ]
      : []),
    {
      id: id(1),
      order: 0,
      kind: 'ESCAPE_CHECK',
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      checks: {
        skillIds: [SRD_ACROBATICS_SKILL_ID, SRD_ATHLETICS_SKILL_ID].sort(),
        abilityDefinitionIds: []
      },
      dc: { kind: 'FIXED', value: rider.escapeDc },
      actorKinds: ['TARGET']
    },
    { id: id(4 + (rider.untilEnds?.length ?? 0)), order: 0, kind: 'TARGET_DRAGGED' },
    ...(rider.restrictedActionEffectIds
      ? [
          {
            id: id(5 + (rider.untilEnds?.length ?? 0)),
            order: 0,
            kind: 'SOURCE_ACTION_TARGET_RESTRICTION' as const,
            actionEffectIds: [...rider.restrictedActionEffectIds]
          }
        ]
      : [])
  ]
  return {
    id: id(0),
    effectKind: EFFECT_KIND.ACTOR_RELATIONSHIP,
    heldAtOnce: rider.heldAtOnce,
    ...(rider.appliesWhen ? { appliesWhen: rider.appliesWhen } : {}),
    ...(rider.recurrence ? { recurrence: rider.recurrence } : {}),
    modules: modules.map((module, order) => ({ ...module, order: order + 1 })),
    conditions: [
      ...(rider.omitGrappled ? [] : [GRAPPLED_CONDITION_ID]),
      ...(rider.untilEnds ?? []).map((code) => vocabularyId(SRD_CONDITION_TYPES, code))
    ].map((conditionId, index) => ({
      id: id(3 + index),
      effectKind: EFFECT_KIND.CONDITION,
      conditionId
    }))
  }
}
/**
 * A successful save's 24 hours of immunity to this source's use of the action ("the creature is
 * immune to the cloaker's moan for the next 24 hours"): one SOURCE_IMMUNITY on the success path,
 * keyed by the action and its source (D156). It takes the IDs `actionId(creatureIndex, localIndex +
 * 0..2)`.
 */
export function saveImmunityPath(
  creatureIndex: number,
  localIndex: number
): EffectAuthored['paths'][number] {
  const id = (offset: number) => actionId(creatureIndex, localIndex + offset)
  return {
    id: id(0),
    order: 2,
    pathCode: PATH_CODE.ON_SAVE_SUCCESS,
    groupType: PATH_GROUP_TYPE.SINGLE,
    originKind: 'SOURCE',
    selectionKind: 'FIXED',
    resultBlock: {
      id: `${id(0)}__result`,
      resultKind: 'SINGLE',
      duration: { id: id(1), durationKind: DURATION_KIND.HOUR, amount: 24 },
      outcomes: [{ id: id(2), effectKind: EFFECT_KIND.SOURCE_IMMUNITY }]
    }
  }
}

/**
 * A minute of fear with a repeated save (Frightful Presence, Horror Nimbus): each creature it
 * reaches makes a Wisdom save or is frightened of the source for 1 minute, repeating the save at
 * the end of each of its turns, and one that succeeds is immune to this source's use of it for 24
 * hours. It reaches the creatures the source chooses within `chosenWithinFeet`, or everyone in a
 * sphere of `radiusFeet` around it. "Aware of it", "that can see the light" and "or the effect ends
 * for it" stay in the description. It takes the IDs `actionId(creatureIndex, localIndex + 0..12)`.
 */
export function minuteFearSaveEffect(
  creatureIndex: number,
  input: {
    localIndex: number
    dc: number
    reach: { chosenWithinFeet: number } | { radiusFeet: number }
    repeatRollInfluence?: FollowUpSaveAuthored['repeatRollInfluence']
  }
): EffectAuthored {
  const id = (offset: number) => actionId(creatureIndex, input.localIndex + offset)
  const savingThrow = (offset: number) => ({
    id: id(offset),
    dcMethod: 'FIXED_DC' as const,
    abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.WISDOM,
    baseDc: input.dc
  })
  return {
    id: id(0),
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.SAVING_THROW,
      savingThrow: savingThrow(1),
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      ...('chosenWithinFeet' in input.reach
        ? {
            range: {
              id: id(2),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: input.reach.chosenWithinFeet,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.CHOSEN_CREATURES,
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            }
          }
        : {
            range: { id: id(2), rangeKind: RANGE_KIND.SELF },
            shape: {
              id: id(11),
              shapeKind: SHAPE_KIND.SPHERE,
              radius: { amount: input.reach.radiusFeet, unit: MEASUREMENT_UNIT_CODE.FEET }
            },
            targeting: {
              selectionKind: TARGET_SELECTION_KIND.AREA_CONTENTS,
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            }
          })
    },
    paths: [
      {
        id: id(3),
        order: 1,
        pathCode: PATH_CODE.ON_SAVE_FAIL,
        groupType: PATH_GROUP_TYPE.SEQUENTIAL,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: id(12),
          resultKind: 'SEQUENCE',
          duration: { id: id(4), durationKind: DURATION_KIND.MINUTE, amount: 1 },
          outcomes: [
            {
              id: id(5),
              effectKind: EFFECT_KIND.CONDITION,
              conditionId: vocabularyId(SRD_CONDITION_TYPES, 'FRIGHTENED'),
              recordsSource: true
            },
            {
              id: id(6),
              effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
              timing: FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END,
              savingThrow: savingThrow(7),
              attempts: { kind: 'ONCE', repeatOnFailure: true },
              ...(input.repeatRollInfluence && { repeatRollInfluence: input.repeatRollInfluence }),
              onSuccess: { kind: 'END' },
              onFailure: { kind: 'CONTINUE' }
            }
          ]
        }
      },
      saveImmunityPath(creatureIndex, input.localIndex + 8)
    ]
  }
}

/**
 * The printed creature Sneak Attack ("once per turn ... when it hits a target with a weapon
 * attack"): a once-per-turn `ON_HIT` rider of the weapon's damage type, gated as the Rogue's is
 * (advantage, or an able enemy of the target within 5 feet and no disadvantage) but without its
 * finesse check. One passive Effect per weapon trigger; the two share the Feature's one use. Each
 * takes the IDs `actionId(creatureIndex, localIndex + 0..11)`, the ranged one from `+ 16`.
 */
export function sneakAttackEffects(
  creatureIndex: number,
  localIndex: number,
  diceConfig: string
): EffectAuthored[] {
  return [TRIGGER.MELEE_WEAPON_ATTACK, TRIGGER.RANGED_WEAPON_ATTACK].map((triggerCode, variant) => {
    const id = (offset: number) => actionId(creatureIndex, localIndex + variant * 16 + offset)
    const roll = (rollMode: string, negated?: true) => ({
      kind: 'PREDICATE' as const,
      constraint: 'INCLUDE' as const,
      predicateCode: 'ATTACK_ROLL_MODE' as const,
      rollMode,
      ...(negated && { negated })
    })
    const gates = [
      [roll('ADVANTAGE')],
      [
        {
          kind: 'PREDICATE' as const,
          constraint: 'INCLUDE' as const,
          predicateCode: 'ENEMY_NEAR_TARGET' as const,
          feet: 5
        },
        roll('DISADVANTAGE', true)
      ]
    ]
    return {
      id: id(0),
      order: variant + 1,
      invocation: {
        kind: 'PASSIVE' as const,
        triggerCode,
        range: { id: id(1), rangeKind: RANGE_KIND.SPECIAL },
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [
        {
          id: id(2),
          order: 1,
          pathCode: PATH_CODE.ON_HIT,
          groupType: PATH_GROUP_TYPE.SINGLE,
          originKind: 'SOURCE' as const,
          selectionKind: 'FIXED' as const,
          usage: PATH_USAGE.ONCE_PER_TURN,
          restrictions: {
            id: id(4),
            groups: gates.map((conditions, index) => ({
              id: id(5 + index),
              order: index,
              contexts: [
                {
                  id: id(7 + index),
                  order: 0,
                  subject: 'EQUIPMENT' as const,
                  authoringModeKind: 'ALL' as const,
                  conditions: conditions.map((condition, order) => ({
                    ...condition,
                    id: id(9 + index + order),
                    order
                  }))
                }
              ]
            }))
          },
          resultBlock: {
            id: `${id(2)}__result`,
            resultKind: 'SINGLE' as const,
            outcomes: [
              {
                id: id(3),
                effectKind: EFFECT_KIND.DAMAGE,
                usesTriggeringWeaponDamageType: true,
                valueKind: DAMAGE_VALUE_KIND.DICE,
                scalingKind: SCALING.NONE,
                diceConfig
              }
            ]
          }
        }
      ]
    }
  })
}

function magicSchoolId(code: string) {
  const entry = SRD_MAGIC_SCHOOLS.find((school) => school.code === code)
  if (!entry) throw new Error(`SRD magic school vocabulary entry for ${code} required.`)
  return entry.id
}

export function skillId(code: string) {
  const entry = SRD_SKILLS.find((skill) => skill.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string) {
  const entry = SRD_LANGUAGES.find((language) => language.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

export function damageTypeId(code: string) {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} required.`)
  return entry.id
}

/**
 * A hit's condition rider: "the target must succeed on a DC N saving throw or be <condition>",
 * optionally repeating the save at the end of each of its turns to end the condition.
 */
export function conditionSave(input: {
  id: string
  savingThrowId: string
  ability: 'CONSTITUTION' | 'STRENGTH'
  dc: number
  conditionOutcomeId: string
  conditionId: string
  repeatsAtTurnEnd: boolean
}): FollowUpSaveAuthored {
  return {
    id: input.id,
    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
    timing: FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
    ...(input.repeatsAtTurnEnd ? { repeatTiming: FOLLOW_UP_SAVE_TIMING.TARGET_TURN_END } : {}),
    savingThrow: {
      id: input.savingThrowId,
      dcMethod: 'FIXED_DC',
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS[input.ability],
      baseDc: input.dc
    },
    attempts: { kind: 'ONCE', ...(input.repeatsAtTurnEnd ? { repeatOnFailure: true } : {}) },
    onSuccess: { kind: 'END' },
    onFailure: {
      kind: 'OUTCOMES',
      endCurrent: false,
      resultKind: 'SINGLE',
      outcomes: [
        {
          id: input.conditionOutcomeId,
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: input.conditionId
        }
      ]
    }
  }
}

/**
 * Life Drain's rider (Wight, Wraith, Specter): "the target must succeed on a DC N Constitution
 * saving throw or its hit point maximum is reduced by an amount equal to the damage taken. This
 * reduction lasts until the target finishes a long rest" (D62). Restoration magic also ends it.
 */
export function lifeDrainSave(input: {
  id: string
  savingThrowId: string
  dc: number
  reductionOutcomeId: string
  damageOutcomeId: string
}): FollowUpSaveAuthored {
  return {
    id: input.id,
    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
    timing: FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
    savingThrow: {
      id: input.savingThrowId,
      dcMethod: 'FIXED_DC',
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
      baseDc: input.dc
    },
    attempts: { kind: 'ONCE' },
    onSuccess: { kind: 'END' },
    onFailure: {
      kind: 'OUTCOMES',
      endCurrent: false,
      resultKind: 'SINGLE',
      outcomes: [
        {
          id: input.reductionOutcomeId,
          effectKind: EFFECT_KIND.HIT_POINT_MAXIMUM_REDUCTION,
          amountSource: { kind: 'DAMAGE_TAKEN', damageOutcomeId: input.damageOutcomeId },
          recoveryTags: ['RESTORE_HIT_POINT_MAXIMUM', 'LONG_REST']
        }
      ]
    }
  }
}

/**
 * A hit's poison rider: "the target must make a DC N Constitution saving throw, taking X poison
 * damage on a failed save, or half as much damage on a successful one", or, with a null
 * successDamageId, "must succeed on a DC N Constitution saving throw or take X poison damage".
 */
export function constitutionPoisonDamageSave(input: {
  id: string
  savingThrowId: string
  dc: number
  failureDamageId: string
  successDamageId: string | null
  diceConfig: string
}): FollowUpSaveAuthored {
  const poisonDamage = (id: string) => ({
    id,
    effectKind: EFFECT_KIND.DAMAGE,
    damageTypeId: damageTypeId('POISON'),
    valueKind: DAMAGE_VALUE_KIND.DICE,
    scalingKind: SCALING.NONE,
    diceConfig: input.diceConfig
  })
  return {
    id: input.id,
    effectKind: EFFECT_KIND.FOLLOW_UP_SAVE,
    timing: FOLLOW_UP_SAVE_TIMING.IMMEDIATE,
    savingThrow: {
      id: input.savingThrowId,
      dcMethod: 'FIXED_DC',
      abilityDefinitionId: SRD_ABILITY_DEFINITION_IDS.CONSTITUTION,
      baseDc: input.dc
    },
    attempts: { kind: 'ONCE' },
    onFailure: {
      kind: 'OUTCOMES',
      endCurrent: false,
      resultKind: 'SINGLE',
      outcomes: [poisonDamage(input.failureDamageId)]
    },
    onSuccess:
      input.successDamageId === null
        ? { kind: 'END' }
        : {
            kind: 'OUTCOMES',
            endCurrent: false,
            resultKind: 'SINGLE',
            outcomes: [{ ...poisonDamage(input.successDamageId), multiplier: 0.5 }]
          }
  }
}

/**
 * A weapon attack action: "Melee Weapon Attack: … reach N ft." (or "Ranged … range N ft."), one
 * target, dealing `diceConfig` damage plus the ability modifier on a hit, then in printed order any
 * further damage parts ("plus 2d6 poison damage"), a Grappled outcome (`grappledOutcome`) and a
 * follow-up save. It takes the IDs `actionId(creatureIndex, localIndex)` through `localIndex + 4`,
 * then one more per further damage part; its ATTACK roll comes from the
 * printed bonus (attack-bonuses.ts). A swarm's bites author `halfHitPointsDiceConfig`, the dice
 * rolled while the swarm has half of its hit points or fewer.
 */
export function weaponAttack(
  input: {
    creatureIndex: number
    localIndex: number
    damageType: string
    diceConfig: string
    halfHitPointsDiceConfig?: string
    ability: SrdAbilityCode | null
    extraDamage?: readonly { damageType: string; diceConfig: string }[]
    grapple?: GrappleRider
    followUpSave?: FollowUpSaveAuthored
  } & (
    | { kind: 'MELEE'; feet: number }
    /** "range 20/60 ft.": the normal and long range. */
    | { kind: 'RANGED'; feet: number; longFeet: number }
  )
): NonNullable<FeatureAuthored['effects']>[number] {
  const id = (offset: number) => actionId(input.creatureIndex, input.localIndex + offset)
  const extraDamage = input.extraDamage ?? []
  const riders = [
    ...extraDamage.map((part, index) => ({
      id: id(5 + index),
      effectKind: EFFECT_KIND.DAMAGE,
      damageTypeId: damageTypeId(part.damageType),
      valueKind: DAMAGE_VALUE_KIND.DICE,
      scalingKind: SCALING.NONE,
      diceConfig: part.diceConfig
    })),
    ...(input.grapple ? [grappledOutcome(input.creatureIndex, input.grapple)] : []),
    ...(input.followUpSave ? [input.followUpSave] : [])
  ]
  const sequence = riders.length > 0
  return {
    id: id(0),
    order: 1,
    invocation: {
      kind: 'ACTION',
      triggerCode:
        input.kind === 'MELEE' ? TRIGGER.MELEE_WEAPON_ATTACK : TRIGGER.RANGED_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: {
        id: id(1),
        rangeKind: RANGE_KIND.DISTANCE,
        amount: input.feet,
        ...(input.kind === 'RANGED' ? { longAmount: input.longFeet } : {}),
        unit: MEASUREMENT_UNIT_CODE.FEET
      },
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      }
    },
    paths: [
      {
        id: id(2),
        order: 1,
        pathCode: PATH_CODE.ON_HIT,
        groupType: sequence ? PATH_GROUP_TYPE.SEQUENTIAL : PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${id(2)}__result`,
          resultKind: sequence ? 'SEQUENCE' : 'SINGLE',
          outcomes: [
            {
              id: id(3),
              effectKind: EFFECT_KIND.DAMAGE,
              damageTypeId: damageTypeId(input.damageType),
              valueKind: DAMAGE_VALUE_KIND.DICE,
              scalingKind: SCALING.NONE,
              diceConfig: input.diceConfig,
              ...(input.halfHitPointsDiceConfig
                ? { halfHitPointsDiceConfig: input.halfHitPointsDiceConfig }
                : {}),
              ...(input.ability
                ? {
                    bonuses: [
                      {
                        id: id(4),
                        bonusKind: DAMAGE_BONUS_KIND.ABILITY_BONUS,
                        ability: input.ability,
                        order: 1
                      }
                    ]
                  }
                : {})
            },
            ...riders
          ]
        }
      }
    ]
  }
}
function grantedSkill(
  level: typeof SCALING_AMOUNT_KIND.FULL | typeof SCALING_AMOUNT_KIND.DOUBLE,
  creatureIndex: number,
  order: number,
  skillCodes: string[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.SKILL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level,
    skillIds: skillCodes.map(skillId),
    order
  }
}

export function grantedSkillProficiency(
  creatureIndex: number,
  order: number,
  ...skillCodes: string[]
) {
  return grantedSkill(SCALING_AMOUNT_KIND.FULL, creatureIndex, order, skillCodes)
}

/** Skills whose printed bonus is twice the proficiency bonus, as a dragon's Perception. */
export function grantedSkillExpertise(
  creatureIndex: number,
  order: number,
  ...skillCodes: string[]
) {
  return grantedSkill(SCALING_AMOUNT_KIND.DOUBLE, creatureIndex, order, skillCodes)
}

export function grantedSaveProficiency(
  creatureIndex: number,
  order: number,
  ...abilities: SrdAbilityCode[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.SAVE_ABILITY,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    abilities,
    order
  }
}

export function grantedLanguageProficiency(
  creatureIndex: number,
  order: number,
  ...languageCodes: string[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    languageIds: languageCodes.map(languageId).sort(),
    order
  }
}

interface LegendaryActionOptionTemplate {
  label: string
  description: string
  order?: number
}

const dragonLegendaryActionOptions: LegendaryActionOptionTemplate[] = [
  {
    label: 'Detect',
    description: 'The dragon makes a Wisdom (Perception) check.'
  },
  {
    label: 'Tail Attack',
    description: 'The dragon makes a tail attack.'
  },
  {
    label: 'Wing Attack (Costs 2 Actions)',
    description:
      'The dragon beats its wings. Nearby creatures risk bludgeoning damage and being knocked prone, then the dragon can fly up to half its flying speed.'
  }
]

const dragonWingAttackDescriptionsByCreatureLabel: Record<string, string> = {
  'Adult Black Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Blue Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 20 Dexterity saving throw or take 14 (2d6 + 7) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Brass Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Bronze Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 20 Dexterity saving throw or take 14 (2d6 + 7) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Copper Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Gold Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Green Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Red Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult Silver Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 21 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Adult White Dragon':
    'The dragon beats its wings. Each creature within 10 feet of the dragon must succeed on a DC 19 Dexterity saving throw or take 13 (2d6 + 6) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Black Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Blue Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 24 Dexterity saving throw or take 16 (2d6 + 9) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Brass Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Bronze Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 24 Dexterity saving throw or take 16 (2d6 + 9) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Copper Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Gold Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Green Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 23 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Red Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient Silver Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 25 Dexterity saving throw or take 17 (2d6 + 10) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.',
  'Ancient White Dragon':
    'The dragon beats its wings. Each creature within 15 feet of the dragon must succeed on a DC 22 Dexterity saving throw or take 15 (2d6 + 8) bludgeoning damage and be knocked prone. The dragon can then fly up to half its flying speed.'
}

const legendaryActionOptionsByCreatureLabel: Record<string, LegendaryActionOptionTemplate[]> = {
  Androsphinx: [
    {
      label: 'Claw Attack',
      description: 'The sphinx makes one claw attack.'
    },
    {
      label: 'Teleport (Costs 2 Actions)',
      description:
        'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.'
    },
    {
      label: 'Cast a Spell (Costs 3 Actions)',
      description:
        'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.'
    }
  ],
  Gynosphinx: [
    {
      label: 'Claw Attack',
      description: 'The sphinx makes one claw attack.'
    },
    {
      label: 'Teleport (Costs 2 Actions)',
      description:
        'The sphinx magically teleports, along with any equipment it is wearing or carrying, up to 120 feet to an unoccupied space it can see.'
    },
    {
      label: 'Cast a Spell (Costs 3 Actions)',
      description:
        'The sphinx casts a spell from its list of prepared spells, using a spell slot as normal.'
    }
  ],
  Lich: [
    {
      label: 'Cantrip',
      description: 'The lich casts a cantrip.'
    },
    {
      label: 'Paralyzing Touch (Costs 2 Actions)',
      description: 'The lich uses its Paralyzing Touch.'
    },
    {
      label: 'Frightening Gaze (Costs 2 Actions)',
      description:
        "The lich fixes its gaze on one creature it can see within 10 feet of it. The target must succeed on a DC 18 Wisdom saving throw against this magic or become frightened for 1 minute. The frightened target can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success. If a target's saving throw is successful or the effect ends for it, the target is immune to the lich's gaze for the next 24 hours."
    },
    {
      label: 'Disrupt Life (Costs 3 Actions)',
      description:
        'Each non-undead creature within 20 feet of the lich must make a DC 18 Constitution saving throw against this magic, taking 21 (6d6) necrotic damage on a failed save, or half as much damage on a successful one.'
    }
  ],
  'Mummy Lord': [
    {
      label: 'Attack',
      description:
        'The mummy lord makes one attack with its rotting fist or uses its Dreadful Glare.'
    },
    {
      label: 'Blinding Dust',
      description:
        "Blinding dust and sand swirls magically around the mummy lord. Each creature within 5 feet of the mummy lord must succeed on a DC 16 Constitution saving throw or be blinded until the end of the creature's next turn."
    },
    {
      label: 'Blasphemous Word (Costs 2 Actions)',
      description:
        "The mummy lord utters a blasphemous word. Each non-undead creature within 10 feet of the mummy lord that can hear the magical utterance must succeed on a DC 16 Constitution saving throw or be stunned until the end of the mummy lord's next turn."
    },
    {
      label: 'Channel Negative Energy (Costs 2 Actions)',
      description:
        "The mummy lord magically unleashes negative energy. Creatures within 60 feet of the mummy lord, including ones behind barriers and around corners, can't regain hit points until the end of the mummy lord's next turn."
    },
    {
      label: 'Whirlwind of Sand (Costs 2 Actions)',
      description:
        'The mummy lord magically transforms into a whirlwind of sand, moves up to 60 feet, and reverts to its normal form.'
    }
  ],
  Unicorn: [
    {
      label: 'Hooves',
      description: 'The unicorn makes one attack with its hooves.'
    },
    {
      label: 'Shimmering Shield (Costs 2 Actions)',
      description:
        "The unicorn creates a shimmering, magical field around itself or another creature it can see within 60 feet of it. The target gains a +2 bonus to AC until the end of the unicorn's next turn."
    },
    {
      label: 'Heal Self (Costs 3 Actions)',
      description: 'The unicorn magically regains 11 (2d8 + 2) hit points.'
    }
  ],
  Vampire: [
    {
      label: 'Move',
      description: 'The vampire moves up to its speed without provoking opportunity attacks.'
    },
    {
      label: 'Unarmed Strike',
      description: 'The vampire makes one unarmed strike.'
    },
    {
      label: 'Bite (Costs 2 Actions)',
      description: 'The vampire makes one bite attack.'
    }
  ]
}

export function normalizeLegendaryActionOptions<TCreature extends CreatureAuthored>(
  creature: TCreature
): TCreature {
  if (!creature.features.some(isLegendaryActionFeature)) {
    return creature
  }

  let changed = false
  const features = creature.features.map((feature) => {
    if (!isLegendaryActionFeature(feature) || feature.options?.length) {
      return feature
    }

    const optionTemplates = getLegendaryActionOptionTemplates(creature.label)

    if (!optionTemplates.length) {
      return feature
    }

    changed = true
    return buildLegendaryActionFeatureWithOptions(feature, optionTemplates)
  })

  return changed ? { ...creature, features } : creature
}

function isLegendaryActionFeature(feature: FeatureAuthored): boolean {
  return feature.label.toLowerCase() === 'legendary actions'
}

function getLegendaryActionOptionTemplates(creatureLabel: string): LegendaryActionOptionTemplate[] {
  if (creatureLabel.endsWith('Dragon')) {
    const wingAttackDescription = dragonWingAttackDescriptionsByCreatureLabel[creatureLabel]

    return wingAttackDescription
      ? dragonLegendaryActionOptions.map((template) =>
          template.label === 'Wing Attack (Costs 2 Actions)'
            ? { ...template, description: wingAttackDescription }
            : template
        )
      : dragonLegendaryActionOptions
  }

  return legendaryActionOptionsByCreatureLabel[creatureLabel] ?? []
}

function buildLegendaryActionFeatureWithOptions(
  feature: FeatureAuthored,
  optionTemplates: LegendaryActionOptionTemplate[]
): FeatureAuthored {
  const effectsByOrder = new Map<number, NonNullable<FeatureAuthored['effects']>>()

  for (const effect of feature.effects ?? []) {
    effectsByOrder.set(effect.order, [...(effectsByOrder.get(effect.order) ?? []), effect])
  }

  const featureWithoutEffects = { ...feature }
  delete featureWithoutEffects.effects

  return {
    ...featureWithoutEffects,
    description: getLegendaryActionIntro(feature.description, optionTemplates),
    options: optionTemplates.map((template, index) => {
      const order = template.order ?? index + 1
      const optionEffects = effectsByOrder.get(order)

      return {
        id: legendaryActionOptionId(feature.id, order),
        label: template.label,
        description: template.description,
        order,
        ...(optionEffects?.length ? { effects: optionEffects } : {})
      }
    })
  }
}

function getLegendaryActionIntro(
  description: string,
  optionTemplates: LegendaryActionOptionTemplate[]
): string {
  const plainText = description
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^Legendary Actions\.\s*/, '')
  const firstOptionIndex = optionTemplates
    .map((template) => plainText.indexOf(`${template.label}.`))
    .filter((index) => index > 0)
    .sort((left, right) => left - right)[0]

  return firstOptionIndex ? plainText.slice(0, firstOptionIndex).trim() : plainText
}

function legendaryActionOptionId(featureId: string, order: number): string {
  const parts = featureId.split('-')
  const creatureIndex = Number.parseInt(parts[4]?.slice(0, 4) ?? '', 16)

  if (parts.length !== 5 || parts[3] !== '0070' || Number.isNaN(creatureIndex)) {
    throw new Error(`Cannot derive legendary action option ID from feature ID "${featureId}".`)
  }

  return localId(5, creatureIndex, 200 + order)
}

export {
  ABILITY_CODE,
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  CHARGE_RESET_KIND,
  CLOSED_RULE_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_IDS,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  FOLLOW_UP_SAVE_TIMING,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  SIZE_CODE,
  RANGE_KIND,
  SCALING,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  SPELL_GRANT_ATTRIBUTE,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE
}
