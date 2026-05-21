import { ACTIVATION_CODE, ATTACK_DOMAIN_CODE, AUTHORING_SELECTION_KIND, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, DAMAGE_VALUE_KIND, EQUIPMENT_ATTRIBUTE, EQUIPMENT_CATEGORY_CODE, EQUIPMENT_PROPERTY_CODE, EFFECT_KIND, GRANT_KIND, MEASUREMENT_UNIT_CODE, MODIFIER_KIND, MODIFIER_SCOPE_KIND, RANGE_KIND, SCALING, TARGET_SELECTION_KIND, TARGET_DISPOSITION_KIND, SUBJECT, TRIGGER, VALUE_DOMAIN_CODE } from '@artificer-toolkit/shared'
import type { AbilityCode, FacetConditionAuthored, ModifierGrantAuthored, SizeCode } from '@artificer-toolkit/shared'
import { SRD_CONDITION_TYPES, SRD_DAMAGE_TYPES, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'
export { ACTIVATION_CODE, PATH_CODE, PATH_GROUP_TYPE, PATH_RESOLUTION_KIND, DAMAGE_VALUE_KIND, EQUIPMENT_ATTRIBUTE, EQUIPMENT_CATEGORY_CODE, EQUIPMENT_PROPERTY_CODE, EFFECT_KIND, MEASUREMENT_UNIT_CODE, RANGE_KIND, SCALING, TARGET_DISPOSITION_KIND, TARGET_SELECTION_KIND, SUBJECT, TRIGGER, SRD_SYSTEM_ID, SRD_USER_ID }
export function equipId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}
export const RARITY_COMMON = '00000000-0000-0000-0009-000100000000'
export const RARITY_UNCOMMON = '00000000-0000-0000-0009-000200000000'
export const RARITY_RARE = '00000000-0000-0000-0009-000300000000'
export const RARITY_VERY_RARE = '00000000-0000-0000-0009-000400000000'
export const RARITY_LEGENDARY = '00000000-0000-0000-0009-000500000000'
const CURRENCY_GP = '00000000-0000-0000-0003-000400000000'
const CURRENCY_SP = '00000000-0000-0000-0003-000300000000'
const CURRENCY_CP = '00000000-0000-0000-0003-000200000000'
export function gp(amount: number) {
  return { amount, currencyId: CURRENCY_GP }
}
export function sp(amount: number) {
  return { amount, currencyId: CURRENCY_SP }
}
export function cp(amount: number) {
  return { amount, currencyId: CURRENCY_CP }
}
export function lbs(amount: number) {
  return { amount, unit: MEASUREMENT_UNIT_CODE.POUNDS }
}
export function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((conditionType) => conditionType.code === code)
  if (!entry) {
    throw new Error(`SRD condition type vocabulary entry for ${code} required for equipment source data.`)
  }
  return entry.id
}
export function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) {
    throw new Error(`SRD damage type vocabulary entry for ${code} required for equipment source data.`)
  }
  return entry.id
}
export function equipmentChildId(equipmentId: string, bucket: number, index: number): string {
  const [
    , , , , equipmentSuffix
  ] = equipmentId.split('-')
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')
  return `00000000-0000-${bucketHex}-${equipmentSuffix.slice(0, 4)}-${indexHex}`
}
function whileEquippedRestriction(equipmentId: string, grantIndex: number) {
  // Each grant gets its own restriction node IDs, keyed by grantIndex.
  // Buckets: 0x301 = facet, 0x302 = group, 0x303 = context, 0x304 = condition.
  // grantIndex offsets the index within each bucket to keep IDs unique per grant.
  return {
    id: equipmentChildId(equipmentId, 0x301, grantIndex),
    groups: [
      {
        id: equipmentChildId(equipmentId, 0x302, grantIndex),
        order: 0,
        contexts: [
          {
            id: equipmentChildId(equipmentId, 0x303, grantIndex),
            order: 0,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: equipmentChildId(equipmentId, 0x304, grantIndex),
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
function whileEquippedWithConditionRestriction(equipmentId: string, grantIndex: number, facetBucket: number, extraConditions: FacetConditionAuthored<'CHARACTER'>[]) {
  return {
    id: equipmentChildId(equipmentId, facetBucket, grantIndex),
    groups: [
      {
        id: equipmentChildId(equipmentId, facetBucket + 1, grantIndex),
        order: 0,
        contexts: [
          {
            id: equipmentChildId(equipmentId, facetBucket + 2, grantIndex),
            order: 0,
            subject: 'CHARACTER' as const,
            conditions: [
              {
                id: equipmentChildId(equipmentId, facetBucket + 3, grantIndex),
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
function fixedAbilityWeaponModifier(equipmentId: string, bucket: number, order: number, valueDomainCode: typeof VALUE_DOMAIN_CODE.ATTACK_ROLL | typeof VALUE_DOMAIN_CODE.DAMAGE, attackDomain: keyof typeof ATTACK_DOMAIN_CODE, ability: AbilityCode): ModifierGrantAuthored {
  return {
    id: equipmentChildId(equipmentId, bucket, order),
    grantKind: GRANT_KIND.MODIFIER_GRANT,
    valueDomainCode,
    domain: { attackDomain },
    modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
    scope: MODIFIER_SCOPE_KIND.SOURCE,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    payload: { ability },
    restrictions: whileEquippedRestriction(equipmentId, order),
    order
  }
}
export function meleeWeaponAbilityModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const modifiers: ModifierGrantAuthored[] = []
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 1, VALUE_DOMAIN_CODE.ATTACK_ROLL, ATTACK_DOMAIN_CODE.MELEE, 'STRENGTH') as ModifierGrantAuthored)
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 2, VALUE_DOMAIN_CODE.DAMAGE, ATTACK_DOMAIN_CODE.MELEE, 'STRENGTH') as ModifierGrantAuthored)
  return modifiers
}
export function rangedWeaponAbilityModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const modifiers: ModifierGrantAuthored[] = []
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 1, VALUE_DOMAIN_CODE.ATTACK_ROLL, ATTACK_DOMAIN_CODE.RANGED, 'DEXTERITY') as ModifierGrantAuthored)
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 2, VALUE_DOMAIN_CODE.DAMAGE, ATTACK_DOMAIN_CODE.RANGED, 'DEXTERITY') as ModifierGrantAuthored)
  return modifiers
}
export function thrownWeaponAbilityModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const modifiers: ModifierGrantAuthored[] = []
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 1, VALUE_DOMAIN_CODE.ATTACK_ROLL, ATTACK_DOMAIN_CODE.MELEE, 'STRENGTH') as ModifierGrantAuthored)
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 2, VALUE_DOMAIN_CODE.DAMAGE, ATTACK_DOMAIN_CODE.MELEE, 'STRENGTH') as ModifierGrantAuthored)
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 3, VALUE_DOMAIN_CODE.ATTACK_ROLL, ATTACK_DOMAIN_CODE.RANGED, 'STRENGTH') as ModifierGrantAuthored)
  modifiers.push(fixedAbilityWeaponModifier(equipmentId, 0x300, 4, VALUE_DOMAIN_CODE.DAMAGE, ATTACK_DOMAIN_CODE.RANGED, 'STRENGTH') as ModifierGrantAuthored)
  return modifiers
}
/** FINESSE: allow STR or DEX for attack and damage rolls. Bucket 0x310. */
export function finesseWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const restriction = (i: number) => whileEquippedWithConditionRestriction(equipmentId, i, 0x310, [])
  return [
    {
      id: equipmentChildId(equipmentId, 0x310, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(1),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x310, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(2),
      order: 2
    }
  ]
}
/** FINESSE on a thrown/ranged weapon: STR or DEX for both melee and ranged attacks. Bucket 0x310. */
export function finesseWeaponWithRangedModifiers(equipmentId: string) {
  const restriction = (i: number) => whileEquippedWithConditionRestriction(equipmentId, i, 0x310, [])
  return [
    {
      id: equipmentChildId(equipmentId, 0x310, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(1),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x310, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(2),
      order: 2
    },
    {
      id: equipmentChildId(equipmentId, 0x310, 3),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(3),
      order: 3
    },
    {
      id: equipmentChildId(equipmentId, 0x310, 4),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.OPTIONAL_ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { abilities: ['STRENGTH', 'DEXTERITY'] as AbilityCode[] },
      restrictions: restriction(4),
      order: 4
    }
  ]
}
/** HEAVY: disadvantage on attack rolls for Small or Tiny characters. Bucket 0x320. */
export function heavyWeaponModifiers(equipmentId: string) {
  const sizeCondition = (i: number): FacetConditionAuthored<'CHARACTER'> => ({
    id: equipmentChildId(equipmentId, 0x324, i),
    order: 1,
    kind: 'PREDICATE' as const,
    constraint: 'INCLUDE' as const,
    predicateCode: 'SIZE' as const,
    authoringModeKind: 'SELECTED' as const,
    sizes: ['SMALL', 'TINY'] as SizeCode[]
  })
  return [
    {
      id: equipmentChildId(equipmentId, 0x320, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.DISADVANTAGE,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      restrictions: whileEquippedWithConditionRestriction(equipmentId, 1, 0x320, [sizeCondition(1)]),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x320, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.DISADVANTAGE,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      restrictions: whileEquippedWithConditionRestriction(equipmentId, 2, 0x320, [sizeCondition(2)]),
      order: 2
    }
  ]
}
export function heavyMeleeWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const modifiers: ModifierGrantAuthored[] = []
  modifiers.push(...meleeWeaponAbilityModifiers(equipmentId))
  modifiers.push(...heavyWeaponModifiers(equipmentId))
  return modifiers
}
export function heavyRangedWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  const modifiers: ModifierGrantAuthored[] = []
  modifiers.push(...rangedWeaponAbilityModifiers(equipmentId))
  modifiers.push(...heavyWeaponModifiers(equipmentId))
  return modifiers
}
/** ARMOR proficiency AC grant: +DEX modifier gated on character having the armor property proficiency. Bucket 0x330. */
export function lightArmorModifiers(equipmentId: string) {
  return armorAbilityModModifiers(equipmentId, 'LIGHT', 'DEXTERITY')
}
export function mediumArmorModifiers(equipmentId: string) {
  return armorAbilityModModifiers(equipmentId, 'MEDIUM', 'DEXTERITY', { max: 2 })
}
function proficiencyCondition(equipmentId: string, bucket: number, grantIndex: number, property: keyof typeof EQUIPMENT_PROPERTY_CODE) {
  return {
    id: equipmentChildId(equipmentId, bucket + 4, grantIndex),
    order: 1,
    kind: 'PREDICATE' as const,
    constraint: 'INCLUDE' as const,
    predicateCode: 'EQUIPMENT_PROPERTY_PROFICIENCY' as const,
    authoringModeKind: 'SELECTED' as const,
    properties: [property]
  }
}
function armorAbilityModModifiers(equipmentId: string, property: keyof typeof EQUIPMENT_PROPERTY_CODE, ability: AbilityCode, bounds: { min?: number, max?: number } = {}) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x330, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
      domain: {},
      modifierKind: MODIFIER_KIND.ABILITY_MODIFIER_BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { ability, ...bounds },
      restrictions: whileEquippedWithConditionRestriction(equipmentId, 1, 0x330, [proficiencyCondition(equipmentId, 0x330, 1, property)]),
      order: 1
    }
  ]
}
export function meleeMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 1),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 2),
      order: 2
    }
  ]
}
export function rangedMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 1),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 2),
      order: 2
    }
  ]
}
export function thrownMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 1),
      order: 1
    },
    {
      id: equipmentChildId(equipmentId, 0x300, 2),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.MELEE },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 2),
      order: 2
    },
    {
      id: equipmentChildId(equipmentId, 0x300, 3),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ATTACK_ROLL,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 3),
      order: 3
    },
    {
      id: equipmentChildId(equipmentId, 0x300, 4),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE,
      domain: { attackDomain: ATTACK_DOMAIN_CODE.RANGED },
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.SOURCE,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 4),
      order: 4
    }
  ]
}
export function magicArmorModifiers(equipmentId: string, bonus: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x300, 1),
      grantKind: GRANT_KIND.MODIFIER_GRANT,
      valueDomainCode: VALUE_DOMAIN_CODE.ARMOR_CLASS,
      domain: {},
      modifierKind: MODIFIER_KIND.BONUS,
      scope: MODIFIER_SCOPE_KIND.GLOBAL,
      selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
      payload: { valueKind: 'FIXED' as const, amount: bonus },
      restrictions: whileEquippedRestriction(equipmentId, 1),
      order: 1
    }
  ]
}
export function magicAmmoModifiers(equipmentId: string, bonus: number) {
  return rangedMagicWeaponModifiers(equipmentId, bonus)
}
// ─── Weapon effect helpers ───────────────────────────────────────────────
// Buckets: 0x210 = effect, 0x211 = range, 0x212+ = path payload (per effect)
// For weapons with two effects (e.g. versatile, thrown), the second
// effect uses 0x220/0x221/0x222 so IDs stay unique within the item.
function meleeRange(equipmentId: string, effectBucket: number) {
  return {
    id: equipmentChildId(equipmentId, effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 5,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
function reachRange(equipmentId: string, effectBucket: number) {
  return {
    id: equipmentChildId(equipmentId, effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: 10,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
function distanceRange(equipmentId: string, effectBucket: number, normalFt: number) {
  return {
    id: equipmentChildId(equipmentId, effectBucket + 1, 1),
    rangeKind: RANGE_KIND.DISTANCE,
    amount: normalFt,
    unit: MEASUREMENT_UNIT_CODE.FEET
  }
}
function damagePath(equipmentId: string, pathBucket: number, damageTypeCode: string, diceConfig: string) {
  return {
    id: equipmentChildId(equipmentId, pathBucket, 1),
    order: 1,
    pathCode: PATH_CODE.ON_HIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: equipmentChildId(equipmentId, pathBucket, 1) + '__result',
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: equipmentChildId(equipmentId, pathBucket, 1),
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId(damageTypeCode),
          valueKind: DAMAGE_VALUE_KIND.DICE,
          scalingKind: SCALING.NONE,
          diceConfig
        }
      ]
    }
  }
}
function fixedDamagePath(equipmentId: string, pathBucket: number, damageTypeCode: string, amount: number) {
  return {
    id: equipmentChildId(equipmentId, pathBucket, 1),
    order: 1,
    pathCode: PATH_CODE.ON_HIT,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: equipmentChildId(equipmentId, pathBucket, 1) + '__result',
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: equipmentChildId(equipmentId, pathBucket, 1),
          effectKind: EFFECT_KIND.DAMAGE,
          damageTypeId: damageTypeId(damageTypeCode),
          valueKind: DAMAGE_VALUE_KIND.FIXED,
          scalingKind: SCALING.NONE,
          amount
        }
      ]
    }
  }
}
/** Pure melee weapon (e.g. mace, flail, morningstar). */
export function meleeWeaponEffects(equipmentId: string, damageTypeCode: string, diceConfig: string) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x210)
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, diceConfig)]
    }
  ]
}
/** Versatile melee weapon: two effects (one-handed / two-handed). */
export function meleeVersatileWeaponEffects(equipmentId: string, damageTypeCode: string, dice1h: string, dice2h: string) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, dice1h)]
    },
    {
      id: equipmentChildId(equipmentId, 0x220, 1),
      order: 2,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x220),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(equipmentId, 0x222, damageTypeCode, dice2h)]
    }
  ]
}
/** Thrown weapon (also melee): two effects — melee and ranged. */
export function thrownWeaponEffects(equipmentId: string, damageTypeCode: string, diceConfig: string, normalRangeFt: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x210)
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, diceConfig)]
    },
    {
      id: equipmentChildId(equipmentId, 0x220, 1),
      order: 2,
      invocation: {
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(equipmentId, 0x220, normalRangeFt)
      },
      paths: [damagePath(equipmentId, 0x222, damageTypeCode, diceConfig)]
    }
  ]
}
/** Thrown + versatile weapon (spear, trident): melee 1h, melee 2h, ranged. */
export function thrownVersatileWeaponEffects(equipmentId: string, damageTypeCode: string, dice1h: string, dice2h: string, normalRangeFt: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x210),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, dice1h)]
    },
    {
      id: equipmentChildId(equipmentId, 0x220, 1),
      order: 2,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: meleeRange(equipmentId, 0x220),
        targeting: {
          selectionKind: TARGET_SELECTION_KIND.SINGLE_TARGET,
          dispositionKind: TARGET_DISPOSITION_KIND.ANY
        }
      },
      paths: [damagePath(equipmentId, 0x222, damageTypeCode, dice2h)]
    },
    {
      id: equipmentChildId(equipmentId, 0x230, 1),
      order: 3,
      invocation: {
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(equipmentId, 0x230, normalRangeFt)
      },
      paths: [damagePath(equipmentId, 0x232, damageTypeCode, dice1h)]
    }
  ]
}
/** Reach melee weapon (glaive, halberd, pike, lance, whip): 10ft range. */
export function meleeReachWeaponEffects(equipmentId: string, damageTypeCode: string, diceConfig: string) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.MELEE_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: reachRange(equipmentId, 0x210)
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, diceConfig)]
    }
  ]
}
/** Pure ranged weapon (bow, crossbow, sling). */
export function rangedWeaponEffects(equipmentId: string, damageTypeCode: string, diceConfig: string, normalRangeFt: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(equipmentId, 0x210, normalRangeFt)
      },
      paths: [damagePath(equipmentId, 0x212, damageTypeCode, diceConfig)]
    }
  ]
}
/** Ranged weapon with fixed (non-dice) damage (blowgun: 1 piercing). */
export function rangedFixedDamageWeaponEffects(equipmentId: string, damageTypeCode: string, amount: number, normalRangeFt: number) {
  return [
    {
      id: equipmentChildId(equipmentId, 0x210, 1),
      order: 1,
      invocation: {
        triggerCode: TRIGGER.RANGED_WEAPON_ATTACK,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: distanceRange(equipmentId, 0x210, normalRangeFt)
      },
      paths: [fixedDamagePath(equipmentId, 0x212, damageTypeCode, amount)]
    }
  ]
}
