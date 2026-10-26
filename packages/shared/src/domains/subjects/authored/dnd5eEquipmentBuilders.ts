import {
  ACTIVATION_CODE,
  ATTACK_DOMAIN_CODE,
  AUTHORING_SELECTION_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  EQUIPMENT_GRIP,
  EQUIPMENT_PROPERTY_CODE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  SCALING,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type EquipmentGrip
} from '#core'
import {
  type FacetConditionAuthored,
  type ModifierGrantAuthored,
  type ModifierGrantAuthoredFor
} from '#authored'

import type { EquipmentEffectAuthored } from './equipment.js'

/**
 * Names one child node of an Equipment's authored document. The SRD derives deterministic ids from
 * `(bucket, index)`; an import hands out fresh ids and ignores the arguments. `suffix` marks a node
 * that shares its parent's `(bucket, index)` (a result block), so a deterministic scheme can keep
 * its historical ids.
 */
export type EquipmentChildId = (bucket: number, index: number, suffix?: string) => string

export function whileEquippedRestriction(childId: EquipmentChildId, grantIndex: number) {
  // Each grant gets its own restriction node IDs, keyed by grantIndex.
  // Buckets: 0x301 = facet, 0x302 = group, 0x303 = context, 0x304 = condition.
  // grantIndex offsets the index within each bucket to keep IDs unique per grant.
  return {
    id: childId(0x301, grantIndex),
    groups: [
      {
        id: childId(0x302, grantIndex),
        order: 0,
        contexts: [
          {
            id: childId(0x303, grantIndex),
            order: 0,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: childId(0x304, grantIndex),
                order: 0,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'WHILE_SOURCE_EQUIPPED' as const
              }
            ]
          }
        ]
      }
    ]
  }
}

export function whileEquippedWithConditionRestriction(
  childId: EquipmentChildId,
  grantIndex: number,
  facetBucket: number,
  extraConditions: FacetConditionAuthored<'CHARACTER'>[]
) {
  return {
    id: childId(facetBucket, grantIndex),
    groups: [
      {
        id: childId(facetBucket + 1, grantIndex),
        order: 0,
        contexts: [
          {
            id: childId(facetBucket + 2, grantIndex),
            order: 0,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: childId(facetBucket + 3, grantIndex),
                order: 0,
                kind: 'PREDICATE' as const,
                constraint: 'INCLUDE' as const,
                predicateCode: 'WHILE_SOURCE_EQUIPPED' as const
              },
              ...extraConditions
            ]
          }
        ]
      }
    ]
  }
}

// ─── Base weapon modifier helpers ────────────────────────────────────────────

/** A weapon's fixed ability modifier on its attack or damage roll. */
export type WeaponAbilityModifier = Extract<
  | ModifierGrantAuthoredFor<typeof VALUE_DOMAIN_CODE.ATTACK_ROLL>
  | ModifierGrantAuthoredFor<typeof VALUE_DOMAIN_CODE.DAMAGE>,
  { modifierKind: typeof MODIFIER_KIND.ABILITY_MODIFIER_BONUS }
>
function fixedAbilityWeaponModifier(
  childId: EquipmentChildId,
  bucket: number,
  order: number,
  valueDomainCode: typeof VALUE_DOMAIN_CODE.ATTACK_ROLL | typeof VALUE_DOMAIN_CODE.DAMAGE,
  attackDomain: keyof typeof ATTACK_DOMAIN_CODE,
  ability: string
): WeaponAbilityModifier {
  return {
    id: childId(bucket, order),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    scope: MODIFIER_SCOPE_KIND.SOURCE,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { ability },
    restrictions: whileEquippedRestriction(childId, order),
    order
  }
}
export function meleeWeaponAbilityModifiers(childId: EquipmentChildId): WeaponAbilityModifier[] {
  const modifiers: WeaponAbilityModifier[] = []
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      1,
      VALUE_DOMAIN_CODE.ATTACK_ROLL,
      ATTACK_DOMAIN_CODE.MELEE,
      'STRENGTH'
    )
  )
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      2,
      VALUE_DOMAIN_CODE.DAMAGE,
      ATTACK_DOMAIN_CODE.MELEE,
      'STRENGTH'
    )
  )
  return modifiers
}
export function rangedWeaponAbilityModifiers(
  childId: EquipmentChildId,
  ability: string = 'DEXTERITY'
): WeaponAbilityModifier[] {
  const modifiers: WeaponAbilityModifier[] = []
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      1,
      VALUE_DOMAIN_CODE.ATTACK_ROLL,
      ATTACK_DOMAIN_CODE.RANGED,
      ability
    )
  )
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      2,
      VALUE_DOMAIN_CODE.DAMAGE,
      ATTACK_DOMAIN_CODE.RANGED,
      ability
    )
  )
  return modifiers
}
export function thrownWeaponAbilityModifiers(childId: EquipmentChildId): WeaponAbilityModifier[] {
  const modifiers: WeaponAbilityModifier[] = []
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      1,
      VALUE_DOMAIN_CODE.ATTACK_ROLL,
      ATTACK_DOMAIN_CODE.MELEE,
      'STRENGTH'
    )
  )
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      2,
      VALUE_DOMAIN_CODE.DAMAGE,
      ATTACK_DOMAIN_CODE.MELEE,
      'STRENGTH'
    )
  )
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      3,
      VALUE_DOMAIN_CODE.ATTACK_ROLL,
      ATTACK_DOMAIN_CODE.RANGED,
      'STRENGTH'
    )
  )
  modifiers.push(
    fixedAbilityWeaponModifier(
      childId,
      0x300,
      4,
      VALUE_DOMAIN_CODE.DAMAGE,
      ATTACK_DOMAIN_CODE.RANGED,
      'STRENGTH'
    )
  )
  return modifiers
}
/** FINESSE: allow STR or DEX for attack and damage rolls. Bucket 0x310. */
export function finesseWeaponModifiers(childId: EquipmentChildId): ModifierGrantAuthored[] {
  const restriction = (i: number) => whileEquippedWithConditionRestriction(childId, i, 0x310, [])
  return [
    {
      id: childId(0x310, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(1),
      order: 1
    },
    {
      id: childId(0x310, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(2),
      order: 2
    }
  ]
}
/** FINESSE on a thrown/ranged weapon: STR or DEX for both melee and ranged attacks. Bucket 0x310. */
export function finesseWeaponWithRangedModifiers(childId: EquipmentChildId) {
  const restriction = (i: number) => whileEquippedWithConditionRestriction(childId, i, 0x310, [])
  return [
    {
      id: childId(0x310, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(1),
      order: 1
    },
    {
      id: childId(0x310, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(2),
      order: 2
    },
    {
      id: childId(0x310, 3),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(3),
      order: 3
    },
    {
      id: childId(0x310, 4),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as string[] },
      restrictions: restriction(4),
      order: 4
    }
  ]
}
/**
 * HEAVY: Small or Tiny wielders have disadvantage on attack rolls with this weapon, so only its own
 * attack kind is affected. Bucket 0x320; the melee grant keeps index 1 and the ranged grant index 2.
 */
function heavyWeaponDisadvantage(
  childId: EquipmentChildId,
  attackDomain: typeof ATTACK_DOMAIN_CODE.MELEE | typeof ATTACK_DOMAIN_CODE.RANGED,
  order: number
): ModifierGrantAuthored {
  const index = attackDomain === ATTACK_DOMAIN_CODE.MELEE ? 1 : 2
  return {
    id: childId(0x320, index),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' },
    scope: MODIFIER_SCOPE_KIND.SOURCE,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    restrictions: whileEquippedWithConditionRestriction(childId, index, 0x320, [
      {
        id: childId(0x324, index),
        order: 1,
        kind: 'PREDICATE' as const,
        constraint: 'INCLUDE' as const,
        predicateCode: 'SIZE' as const,
        authoringModeKind: 'SELECTED' as const,
        sizes: ['SMALL', 'TINY']
      }
    ]),
    order
  }
}
export function heavyMeleeWeaponModifiers(childId: EquipmentChildId): ModifierGrantAuthored[] {
  return [
    ...meleeWeaponAbilityModifiers(childId),
    heavyWeaponDisadvantage(childId, ATTACK_DOMAIN_CODE.MELEE, 3)
  ]
}
export function heavyRangedWeaponModifiers(childId: EquipmentChildId): ModifierGrantAuthored[] {
  return [
    ...rangedWeaponAbilityModifiers(childId),
    heavyWeaponDisadvantage(childId, ATTACK_DOMAIN_CODE.RANGED, 3)
  ]
}
/**
 * Light and medium armor AC: + DEX modifier while worn (medium caps it at 2). Armor proficiency
 * does not gate it; SRD non-proficiency only affects checks, saves, attacks and spellcasting.
 * Bucket 0x330.
 */
export function lightArmorModifiers(childId: EquipmentChildId) {
  return armorAbilityModModifiers(childId, 'DEXTERITY')
}
export function mediumArmorModifiers(childId: EquipmentChildId) {
  return armorAbilityModModifiers(childId, 'DEXTERITY', { max: 2 })
}
function armorAbilityModModifiers(
  childId: EquipmentChildId,
  ability: string,
  bounds: { min?: number; max?: number } = {}
) {
  return [
    {
      id: childId(0x330, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
      domain: {},
      modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { ability, ...bounds },
      restrictions: whileEquippedWithConditionRestriction(childId, 1, 0x330, []),
      order: 1
    }
  ]
}
export function meleeMagicWeaponModifiers(childId: EquipmentChildId, bonus: number) {
  return [
    {
      id: childId(0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 1),
      order: 1
    },
    {
      id: childId(0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 2),
      order: 2
    }
  ]
}
export function rangedMagicWeaponModifiers(childId: EquipmentChildId, bonus: number) {
  return [
    {
      id: childId(0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 1),
      order: 1
    },
    {
      id: childId(0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 2),
      order: 2
    }
  ]
}
/**
 * A magic ammunition stack's attack and damage bonus. It carries no equipped restriction because
 * ammunition is never wielded: the stack a weapon attack draws is evaluated as a source of that one
 * attack, so the bonus reaches only the attack that fires it.
 */
export function magicAmmunitionModifiers(childId: EquipmentChildId, bonus: number) {
  return rangedMagicWeaponModifiers(childId, bonus).map(
    ({ restrictions: _restrictions, ...grant }) => grant
  )
}
export function thrownMagicWeaponModifiers(childId: EquipmentChildId, bonus: number) {
  return [
    {
      id: childId(0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 1),
      order: 1
    },
    {
      id: childId(0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 2),
      order: 2
    },
    {
      id: childId(0x300, 3),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 3),
      order: 3
    },
    {
      id: childId(0x300, 4),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 4),
      order: 4
    }
  ]
}
export function magicArmorModifiers(childId: EquipmentChildId, bonus: number) {
  return [
    {
      id: childId(0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
      domain: {},
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(childId, 1),
      order: 1
    }
  ]
}

/** Disadvantage on Stealth checks while the armor is worn. Bucket 0x350 holds the grant and its restriction. */
export function stealthDisadvantageModifier(
  childId: EquipmentChildId,
  stealthSkillId: string,
  order = 1
): ModifierGrantAuthored {
  return {
    id: childId(0x350, 1),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.SKILL_MODIFIER,
    domain: { skillId: stealthSkillId },
    modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
    payload: { influence: 'DISADVANTAGE' },
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    restrictions: whileEquippedRestriction(childId, 0x350),
    order
  }
}

/**
 * Heavy armor Strength requirement: walking speed drops by 10 feet while worn unless the wearer's
 * Strength score meets the requirement. Dwarves ignore the reduction (SRD Dwarf: "Your speed is not
 * reduced by wearing heavy armor"). Bucket 0x340 for the grant, 0x341-0x346 for its restriction.
 */
export function heavyArmorStrengthModifier(
  childId: EquipmentChildId,
  vocabulary: { walkSpeedId: string; dwarvenHeritageId: string },
  strengthRequirement: number,
  order = 1
): ModifierGrantAuthored {
  return {
    id: childId(0x340, 1),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode: VALUE_DOMAIN_CODE.SPEED,
    domain: { speedId: vocabulary.walkSpeedId },
    modifierKind: MODIFIER_KIND.PENALTY,
    scope: MODIFIER_SCOPE_KIND.GLOBAL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { amount: 10, unit: 'FEET' as const },
    restrictions: whileEquippedWithConditionRestriction(childId, 1, 0x341, [
      {
        id: childId(0x345, 1),
        order: 1,
        kind: 'PREDICATE' as const,
        constraint: 'INCLUDE' as const,
        predicateCode: 'ABILITY_SCORE' as const,
        authoringModeKind: 'SELECTED' as const,
        abilities: 'STRENGTH' as const,
        min: 1,
        max: strengthRequirement - 1
      },
      {
        id: childId(0x346, 1),
        order: 2,
        kind: 'PREDICATE' as const,
        constraint: 'EXCLUDE' as const,
        predicateCode: 'HERITAGE' as const,
        authoringModeKind: 'SELECTED' as const,
        heritageIds: [vocabulary.dwarvenHeritageId]
      }
    ]),
    order
  }
}

// ─── Weapon effect helpers ───────────────────────────────────────────────
// Buckets: 0x210 = effect, 0x211 = range, 0x212+ = path payload (per effect)
// For weapons with two effects (e.g. versatile, thrown), the second
// effect uses 0x220/0x221/0x222 so IDs stay unique within the item.
function meleeRange(childId: EquipmentChildId, effectBucket: number) {
  return {
    id: childId(effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 5,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
function reachRange(childId: EquipmentChildId, effectBucket: number) {
  return {
    id: childId(effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 10,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
/** A ranged attack's printed normal and long range ("range 80/320 ft."). */
function distanceRange(
  childId: EquipmentChildId,
  effectBucket: number,
  normalFt: number,
  longFt: number
) {
  return {
    id: childId(effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: normalFt,
    longAmount: longFt,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
function damagePath(
  childId: EquipmentChildId,
  pathBucket: number,
  damageTypeId: string,
  diceConfig: string
) {
  return {
    id: childId(pathBucket, 1),
    order: 1,
    pathCode: PATH_CODE.ON_HIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: childId(pathBucket, 1, '__result'),
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: childId(pathBucket, 1),
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId,
          valueKind: DAMAGE_VALUE_KIND.DICE,
          scalingKind: SCALING.NONE,
          diceConfig
        }
      ]
    }
  }
}
function fixedDamagePath(
  childId: EquipmentChildId,
  pathBucket: number,
  damageTypeId: string,
  amount: number
) {
  return {
    id: childId(pathBucket, 1),
    order: 1,
    pathCode: PATH_CODE.ON_HIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    originKind: 'SOURCE' as const,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: childId(pathBucket, 1, '__result'),
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: childId(pathBucket, 1),
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId,
          valueKind: DAMAGE_VALUE_KIND.FIXED,
          scalingKind: SCALING.NONE,
          amount
        }
      ]
    }
  }
}
export function fixedMeleeWeaponEffect(
  childId: EquipmentChildId,
  damageTypeId: string,
  amount: number,
  grip: EquipmentGrip,
  order = 1,
  bucket = 0x220
): EquipmentEffectAuthored {
  return {
    id: childId(bucket, 1),
    order,
    grip,
    invocation: {
      kind: 'ACTION',
      triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
      activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
      range: meleeRange(childId, bucket),
      targeting: {
        selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
        dispositionKind: TARGET_DISPOSITION_KIND.ANY
      }
    },
    paths: [fixedDamagePath(childId, bucket + 2, damageTypeId, amount)]
  }
}
/** Pure melee weapon (e.g. mace, flail, morningstar). */
export function meleeWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  diceConfig: string,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, diceConfig)]
    }
  ]
}
/** Versatile melee weapon: two effects (one-handed / two-handed). */
export function meleeVersatileWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  dice1h: string,
  dice2h: string
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, dice1h)]
    },
    {
      id: childId(0x220, 1),
      order: 2,
      grip: EQUIPMENT_GRIP.TWO_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x220),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x222, damageTypeId, dice2h)]
    }
  ]
}
/** Thrown weapon (also melee): two effects — melee and ranged. */
export function thrownWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  diceConfig: string,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, diceConfig)]
    },
    {
      id: childId(0x220, 1),
      order: 2,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(childId, 0x220, normalRangeFt, longRangeFt),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x222, damageTypeId, diceConfig)]
    }
  ]
}
/** Thrown + versatile weapon (spear, trident): melee 1h, melee 2h, ranged. */
export function thrownVersatileWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  dice1h: string,
  dice2h: string,
  normalRangeFt: number,
  longRangeFt: number
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, dice1h)]
    },
    {
      id: childId(0x220, 1),
      order: 2,
      grip: EQUIPMENT_GRIP.TWO_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(childId, 0x220),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x222, damageTypeId, dice2h)]
    },
    {
      id: childId(0x230, 1),
      order: 3,
      grip: EQUIPMENT_GRIP.ONE_HANDED,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(childId, 0x230, normalRangeFt, longRangeFt),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x232, damageTypeId, dice1h)]
    }
  ]
}
/** Reach melee weapon (glaive, halberd, pike, lance, whip): 10ft range. */
export function meleeReachWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  diceConfig: string,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: reachRange(childId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, diceConfig)]
    }
  ]
}
/** Pure ranged weapon (bow, crossbow, sling). */
export function rangedWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  diceConfig: string,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(childId, 0x210, normalRangeFt, longRangeFt),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(childId, 0x212, damageTypeId, diceConfig)]
    }
  ]
}
/** Ranged weapon with fixed (non-dice) damage (blowgun: 1 piercing). */
export function rangedFixedDamageWeaponEffects(
  childId: EquipmentChildId,
  damageTypeId: string,
  amount: number,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return [
    {
      id: childId(0x210, 1),
      order: 1,
      grip: grip,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(childId, 0x210, normalRangeFt, longRangeFt),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [fixedDamagePath(childId, 0x212, damageTypeId, amount)]
    }
  ]
}

// ─── Off-hand attack (two-weapon fighting) ───────────────────────────────────
// Buckets: 0x240 = the off-hand effect's cloned nodes, 0x250 = its requirement facet,
// 0x260/0x261 = a damage grant's activation context and condition, 0x270 = the off-hand damage
// grant's cloned nodes.

/** Copies `value` with every `id` replaced by the next id, so a clone shares no node with its source. */
function withFreshIds<T>(value: T, nextId: () => string): T {
  if (Array.isArray(value)) return value.map((entry) => withFreshIds(entry, nextId)) as T
  if (typeof value !== 'object' || value === null) return value
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      key === 'id' ? nextId() : withFreshIds(entry, nextId)
    ])
  ) as T
}

/**
 * Two-weapon fighting (SRD 5.1): after the Attack action with a Light melee weapon, the wielder may
 * attack with another Light melee weapon as a bonus action. Clones the weapon's melee attack as a
 * bonus action offered only after an Attack action made with a different Light melee weapon.
 */
export function withOffHandAttack(
  childId: EquipmentChildId,
  effects: EquipmentEffectAuthored[]
): EquipmentEffectAuthored[] {
  const mainHand = effects.find(
    ({ invocation }) =>
      invocation.kind === 'ACTION' && invocation.triggerCode === TRIGGER.MELEE_WEAPON_ATTACK
  )
  if (!mainHand) throw new Error('An off-hand attack needs a melee weapon attack to copy.')
  let node = 0
  const copy = withFreshIds(mainHand, () => childId(0x240, ++node))
  return [
    ...effects,
    {
      ...copy,
      order: Math.max(...effects.map(({ order }) => order)) + 1,
      invocation: {
        kind: 'ACTION' as const,
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.BONUS_ACTION, amount: 1 },
        range: copy.invocation.range,
        targeting: copy.invocation.targeting
      },
      requirements: {
        id: childId(0x250, 1),
        groups: [
          {
            id: childId(0x251, 1),
            order: 0,
            contexts: [
              {
                id: childId(0x252, 1),
                order: 0,
                subject: 'CHARACTER' as const,
                conditions: [
                  {
                    id: childId(0x253, 1),
                    order: 0,
                    kind: 'PREDICATE' as const,
                    constraint: 'INCLUDE' as const,
                    predicateCode: 'ATTACK_ACTION_OTHER_WEAPON' as const,
                    authoringModeKind: 'SELECTED' as const,
                    properties: [EQUIPMENT_PROPERTY_CODE.LIGHT, EQUIPMENT_PROPERTY_CODE.MELEE]
                  }
                ]
              }
            ]
          }
        ]
      }
    }
  ]
}

type MeleeDamageAbilityModifier = Extract<
  ModifierGrantAuthoredFor<typeof VALUE_DOMAIN_CODE.DAMAGE>,
  {
    modifierKind:
      | typeof MODIFIER_KIND.ABILITY_MODIFIER_BONUS
      | typeof MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS
  }
>

function isMeleeDamageAbilityModifier(
  modifier: ModifierGrantAuthored
): modifier is MeleeDamageAbilityModifier {
  return (
    modifier.valueDomainCode === VALUE_DOMAIN_CODE.DAMAGE &&
    modifier.domain.attackDomain === ATTACK_DOMAIN_CODE.MELEE &&
    (modifier.modifierKind === MODIFIER_KIND.ABILITY_MODIFIER_BONUS ||
      modifier.modifierKind === MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS)
  )
}

/**
 * The off-hand attack adds no ability modifier to damage unless it is negative (SRD 5.1). Splits
 * each melee damage ability modifier into the Action attack's and a bonus-action attack's that
 * keeps only a negative modifier (`max: 0`); the Two-Weapon Fighting style restores the rest.
 */
export function withOffHandDamage(
  childId: EquipmentChildId,
  modifiers: ModifierGrantAuthored[]
): ModifierGrantAuthored[] {
  const bonusActionOnly = <M extends ModifierGrantAuthored>(
    modifier: M,
    entry: number,
    constraint: 'INCLUDE' | 'EXCLUDE'
  ): M => {
    const restrictions = modifier.restrictions
    if (!restrictions)
      throw new Error('An off-hand damage modifier needs its equipped restriction.')
    return {
      ...modifier,
      restrictions: {
        ...restrictions,
        groups: restrictions.groups.map((group) => ({
          ...group,
          contexts: [
            ...group.contexts,
            {
              id: childId(0x260, entry),
              order: group.contexts.length,
              subject: 'EQUIPMENT' as const,
              authoringModeKind: 'ALL' as const,
              conditions: [
                {
                  id: childId(0x261, entry),
                  order: 0,
                  kind: 'PREDICATE' as const,
                  constraint,
                  predicateCode: 'ATTACK_ACTIVATION' as const,
                  activation: ACTIVATION_CODE.BONUS_ACTION
                }
              ]
            }
          ]
        }))
      }
    }
  }
  const keepNegativeOnly = <M extends MeleeDamageAbilityModifier>(modifier: M): M => ({
    ...modifier,
    payload: { ...modifier.payload, max: 0 }
  })
  let node = 0
  return modifiers
    .flatMap((modifier, index): ModifierGrantAuthored[] => {
      if (!isMeleeDamageAbilityModifier(modifier)) return [modifier]
      const offHand = withFreshIds(bonusActionOnly(modifier, 2 * index + 2, 'INCLUDE'), () =>
        childId(0x270, ++node)
      )
      return [bonusActionOnly(modifier, 2 * index + 1, 'EXCLUDE'), keepNegativeOnly(offHand)]
    })
    .map(<M extends ModifierGrantAuthored>(modifier: M, index: number): M => ({
      ...modifier,
      order: index + 1
    }))
}
