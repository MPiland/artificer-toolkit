import {
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_GRIP,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SHAPE_KIND,
  TARGET_SELECTION_KIND,
  TARGET_DISPOSITION_KIND,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE
} from '@artificer-toolkit/shared'
import {
  fixedMeleeWeaponEffect as sharedFixedMeleeWeaponEffect,
  finesseWeaponModifiers as sharedFinesseWeaponModifiers,
  finesseWeaponWithRangedModifiers as sharedFinesseWeaponWithRangedModifiers,
  heavyArmorStrengthModifier as sharedHeavyArmorStrengthModifier,
  heavyMeleeWeaponModifiers as sharedHeavyMeleeWeaponModifiers,
  heavyRangedWeaponModifiers as sharedHeavyRangedWeaponModifiers,
  lightArmorModifiers as sharedLightArmorModifiers,
  magicArmorModifiers as sharedMagicArmorModifiers,
  mediumArmorModifiers as sharedMediumArmorModifiers,
  meleeMagicWeaponModifiers as sharedMeleeMagicWeaponModifiers,
  meleeReachWeaponEffects as sharedMeleeReachWeaponEffects,
  meleeVersatileWeaponEffects as sharedMeleeVersatileWeaponEffects,
  meleeWeaponAbilityModifiers as sharedMeleeWeaponAbilityModifiers,
  meleeWeaponEffects as sharedMeleeWeaponEffects,
  rangedFixedDamageWeaponEffects as sharedRangedFixedDamageWeaponEffects,
  magicAmmunitionModifiers as sharedMagicAmmunitionModifiers,
  rangedMagicWeaponModifiers as sharedRangedMagicWeaponModifiers,
  rangedWeaponAbilityModifiers as sharedRangedWeaponAbilityModifiers,
  rangedWeaponEffects as sharedRangedWeaponEffects,
  stealthDisadvantageModifier as sharedStealthDisadvantageModifier,
  thrownMagicWeaponModifiers as sharedThrownMagicWeaponModifiers,
  thrownVersatileWeaponEffects as sharedThrownVersatileWeaponEffects,
  thrownWeaponAbilityModifiers as sharedThrownWeaponAbilityModifiers,
  thrownWeaponEffects as sharedThrownWeaponEffects,
  withOffHandAttack as sharedWithOffHandAttack,
  withOffHandDamage as sharedWithOffHandDamage
} from '@artificer-toolkit/shared'
import type {
  ClosedRuleKind,
  EquipmentChildId,
  EquipmentEffectAuthored,
  EquipmentGrip,
  ModifierGrantAuthored,
  WeaponAbilityModifier
} from '@artificer-toolkit/shared'
import {
  SRD_CONDITION_TYPES,
  SRD_CREATURE_TYPES,
  SRD_CURRENCIES,
  SRD_DAMAGE_TYPES,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_DWARVEN_HERITAGE_ID,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  ABILITY_CODE,
  type SrdAbilityCode
} from '../vocabulary.js'
export {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_SELECTION_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  DAMAGE_VALUE_KIND,
  DURATION_KIND,
  EQUIPMENT_ATTRIBUTE,
  EQUIPMENT_CATEGORY_CODE,
  EQUIPMENT_GRIP,
  EQUIPMENT_PROPERTY_CODE,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RANGE_KIND,
  SCALING,
  SHAPE_KIND,
  TARGET_DISPOSITION_KIND,
  TARGET_SELECTION_KIND,
  SUBJECT,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  SRD_SYSTEM_ID,
  SRD_USER_ID
}
export function equipId(index: number): string {
  const hex = index.toString(16).padStart(4, '0')
  return `00000000-0000-0000-0060-${hex}00000000`
}
export const RARITY_COMMON = '00000000-0000-0000-0009-000100000000'
export const RARITY_UNCOMMON = '00000000-0000-0000-0009-000200000000'
export const RARITY_RARE = '00000000-0000-0000-0009-000300000000'
export const RARITY_VERY_RARE = '00000000-0000-0000-0009-000400000000'
export const MAGIC_AMMUNITION_DESCRIPTION =
  'You have a bonus to attack and damage rolls made with this piece of magic ammunition. The bonus is determined by the rarity of the ammunition. Once it hits a target, the ammunition is no longer magical.'
export const MAGIC_ARMOR_DESCRIPTION =
  'You have a bonus to AC while wearing this armor. The bonus is determined by its rarity.'
export const MAGIC_SHIELD_DESCRIPTION =
  "While holding this shield, you have a bonus to AC determined by the shield's rarity. This bonus is in addition to the shield's normal bonus to AC."
export const MAGIC_WEAPON_DESCRIPTION =
  "You have a bonus to attack and damage rolls made with this magic weapon. The bonus is determined by the weapon's rarity."
export const ARCANE_FOCUS_DESCRIPTION =
  'An arcane focus is a special item- an orb, a crystal, a rod, a specially constructed staff, a wand-like length of wood, or some similar item- designed to channel the power of arcane spells. A sorcerer, warlock, or wizard can use such an item as a spellcasting focus.'
export const DRUIDIC_FOCUS_DESCRIPTION =
  'A druidic focus might be a sprig of mistletoe or holly, a wand or scepter made of yew or another special wood, a staff drawn whole out of a living tree, or a totem object incorporating feathers, fur, bones, and teeth from sacred animals. A druid can use such an object as a spellcasting focus.'
export const HOLY_SYMBOL_DESCRIPTION =
  'A holy symbol is a representation of a god or pantheon. It might be an amulet depicting a symbol representing a deity, the same symbol carefully engraved or inlaid as an emblem on a shield, or a tiny box holding a fragment of a sacred relic. Appendix PH-B "Fantasy-Historical Pantheons" lists the symbols commonly associated with many gods in the multiverse. A cleric or paladin can use a holy symbol as a spellcasting focus. To use the symbol in this way, the caster must hold it in hand, wear it visibly, or bear it on a shield.'
export const SHIELD_DESCRIPTION =
  'A shield is made from wood or metal and is carried in one hand. Wielding a shield increases your Armor Class by 2. You can benefit from only one shield at a time.'
export const ARTISANS_TOOLS_DESCRIPTION =
  "These special tools include the items needed to pursue a craft or trade. The table shows examples of the most common types of tools, each providing items related to a single craft. Proficiency with a set of artisan's tools lets you add your proficiency bonus to any ability checks you make using the tools in your craft. Each type of artisan's tools requires a separate proficiency."
export const GAMING_SET_DESCRIPTION =
  'This item encompasses a wide range of game pieces, including dice and decks of cards (for games such as Three-Dragon Ante). A few common examples appear on the Tools table, but other kinds of gaming sets exist. If you are proficient with a gaming set, you can add your proficiency bonus to ability checks you make to play a game with that set. Each type of gaming set requires a separate proficiency.'
export const MUSICAL_INSTRUMENT_DESCRIPTION =
  'Several of the most common types of musical instruments are shown on the table as examples. If you have proficiency with a given musical instrument, you can add your proficiency bonus to any ability checks you make to play music with the instrument. A bard can use a musical instrument as a spellcasting focus. Each type of musical instrument requires a separate proficiency.'
export const ROPE_DESCRIPTION =
  'Rope, whether made of hemp or silk, has 2 hit points and can be burst with a DC 17 Strength check.'
function currencyId(code: string): string {
  const entry = SRD_CURRENCIES.find((currency) => currency.code === code)
  if (!entry) throw new Error(`SRD currency "${code}" is missing.`)
  return entry.id
}
const CURRENCY_GP = currencyId('GP')
const CURRENCY_SP = currencyId('SP')
const CURRENCY_CP = currencyId('CP')
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
    throw new Error(
      `SRD condition type vocabulary entry for ${code} required for equipment source data.`
    )
  }
  return entry.id
}
export function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) {
    throw new Error(
      `SRD damage type vocabulary entry for ${code} required for equipment source data.`
    )
  }
  return entry.id
}
export function creatureTypeId(code: string): string {
  const entry = SRD_CREATURE_TYPES.find((creatureType) => creatureType.code === code)
  if (!entry) {
    throw new Error(
      `SRD creature type vocabulary entry for ${code} required for equipment source data.`
    )
  }
  return entry.id
}
export function skillId(code: string): string {
  const entry = SRD_SKILLS.find((skill) => skill.code === code)
  if (!entry)
    throw new Error(`SRD skill vocabulary entry for ${code} required for equipment source data.`)
  return entry.id
}

export function stealthDisadvantageModifier(equipmentId: string, order = 1): ModifierGrantAuthored {
  return sharedStealthDisadvantageModifier(srdChildId(equipmentId), skillId('STEALTH'), order)
}

export function passiveEquipmentClosedRuleEffect(
  equipmentId: string,
  ruleKind: ClosedRuleKind,
  order = 1,
  bucket = 0x2e0
): EquipmentEffectAuthored {
  return {
    id: equipmentChildId(equipmentId, bucket, 1),
    order,
    grip: null,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: {
        id: equipmentChildId(equipmentId, bucket + 1, 1),
        rangeKind: RANGE_KIND.SELF
      }
    },
    paths: [
      {
        id: equipmentChildId(equipmentId, bucket + 2, 1),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${equipmentChildId(equipmentId, bucket + 2, 1)}__result`,
          resultKind: 'SINGLE',
          outcomes: [
            {
              id: equipmentChildId(equipmentId, bucket + 3, 1),
              effectKind: EFFECT_KIND.CLOSED_RULE,
              ruleKind
            }
          ]
        }
      }
    ]
  }
}

export function lightSourceEffect(
  equipmentId: string,
  brightFeet: number,
  dimAdditionalFeet: number,
  hours: number,
  cone = false
): EquipmentEffectAuthored {
  return {
    id: equipmentChildId(equipmentId, 0x210, 1),
    order: 1,
    grip: null,
    invocation: {
      kind: 'PASSIVE',
      triggerCode: TRIGGER.ACTIVATED,
      range: {
        id: equipmentChildId(equipmentId, 0x211, 1),
        rangeKind: RANGE_KIND.SELF
      }
    },
    paths: [
      {
        id: equipmentChildId(equipmentId, 0x212, 1),
        order: 1,
        pathCode: PATH_CODE.ON_USE,
        groupType: PATH_GROUP_TYPE.SINGLE,
        originKind: 'SOURCE',
        selectionKind: 'FIXED',
        resultBlock: {
          id: `${equipmentChildId(equipmentId, 0x212, 1)}__result`,
          resultKind: 'SINGLE',
          duration: {
            id: equipmentChildId(equipmentId, 0x213, 1),
            durationKind: DURATION_KIND.HOUR,
            amount: hours
          },
          outcomes: [
            {
              id: equipmentChildId(equipmentId, 0x214, 1),
              effectKind: EFFECT_KIND.MANIFEST,
              manifestKind: 'OBJECT',
              attachmentKind: 'SOURCE',
              ...(cone
                ? {
                    shape: {
                      id: equipmentChildId(equipmentId, 0x215, 1),
                      shapeKind: SHAPE_KIND.CONE,
                      length: { amount: brightFeet, unit: MEASUREMENT_UNIT_CODE.FEET }
                    }
                  }
                : {}),
              light: {
                bright: { amount: brightFeet, unit: MEASUREMENT_UNIT_CODE.FEET },
                dimAdditional: {
                  amount: dimAdditionalFeet,
                  unit: MEASUREMENT_UNIT_CODE.FEET
                }
              }
            }
          ]
        }
      }
    ]
  }
}

export function speedId(code: string): string {
  const entry = SRD_SPEEDS.find((speed) => speed.code === code)
  if (!entry)
    throw new Error(`SRD speed vocabulary entry for ${code} required for equipment source data.`)
  return entry.id
}
export function equipmentChildId(equipmentId: string, bucket: number, index: number): string {
  const [, , , equipmentDomain, equipmentSuffix] = equipmentId.split('-')
  const bucketHex = bucket.toString(16).padStart(4, '0')
  const indexHex = index.toString(16).padStart(12, '0')
  return `${equipmentDomain.padStart(8, '0')}-0000-${bucketHex}-${equipmentSuffix.slice(0, 4)}-${indexHex}`
}
/** The SRD's deterministic child-id scheme, adapted to the shared builders' `EquipmentChildId`. */
function srdChildId(equipmentId: string): EquipmentChildId {
  return (bucket, index, suffix = '') => equipmentChildId(equipmentId, bucket, index) + suffix
}

// The dnd5e weapon and armor grants live in `@artificer-toolkit/shared` so imports share them. The
// functions below only bind the SRD id scheme and resolve damage type codes to vocabulary ids.
export function fixedMeleeWeaponEffect(
  equipmentId: string,
  damageTypeCode: string,
  amount: number,
  grip: EquipmentGrip,
  order = 1,
  bucket = 0x220
): EquipmentEffectAuthored {
  return sharedFixedMeleeWeaponEffect(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    amount,
    grip,
    order,
    bucket
  )
}
export function meleeWeaponAbilityModifiers(equipmentId: string): WeaponAbilityModifier[] {
  return sharedMeleeWeaponAbilityModifiers(srdChildId(equipmentId))
}
export function rangedWeaponAbilityModifiers(
  equipmentId: string,
  ability: SrdAbilityCode = 'DEXTERITY'
): WeaponAbilityModifier[] {
  return sharedRangedWeaponAbilityModifiers(srdChildId(equipmentId), ability)
}
export function thrownWeaponAbilityModifiers(equipmentId: string): WeaponAbilityModifier[] {
  return sharedThrownWeaponAbilityModifiers(srdChildId(equipmentId))
}
export function finesseWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  return sharedFinesseWeaponModifiers(srdChildId(equipmentId))
}
export function finesseWeaponWithRangedModifiers(equipmentId: string) {
  return sharedFinesseWeaponWithRangedModifiers(srdChildId(equipmentId))
}
export function heavyMeleeWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  return sharedHeavyMeleeWeaponModifiers(srdChildId(equipmentId))
}
export function heavyRangedWeaponModifiers(equipmentId: string): ModifierGrantAuthored[] {
  return sharedHeavyRangedWeaponModifiers(srdChildId(equipmentId))
}
export function lightArmorModifiers(equipmentId: string) {
  return sharedLightArmorModifiers(srdChildId(equipmentId))
}
export function mediumArmorModifiers(equipmentId: string) {
  return sharedMediumArmorModifiers(srdChildId(equipmentId))
}
export function meleeMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return sharedMeleeMagicWeaponModifiers(srdChildId(equipmentId), bonus)
}
export function rangedMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return sharedRangedMagicWeaponModifiers(srdChildId(equipmentId), bonus)
}
export function thrownMagicWeaponModifiers(equipmentId: string, bonus: number) {
  return sharedThrownMagicWeaponModifiers(srdChildId(equipmentId), bonus)
}
export function magicArmorModifiers(equipmentId: string, bonus: number) {
  return sharedMagicArmorModifiers(srdChildId(equipmentId), bonus)
}
/** A Light melee weapon's bonus-action attack for two-weapon fighting. */
export function withOffHandAttack(equipmentId: string, effects: EquipmentEffectAuthored[]) {
  return sharedWithOffHandAttack(srdChildId(equipmentId), effects)
}
/** A Light melee weapon's damage modifiers split for the off-hand attack. */
export function withOffHandDamage(equipmentId: string, modifiers: ModifierGrantAuthored[]) {
  return sharedWithOffHandDamage(srdChildId(equipmentId), modifiers)
}
export function magicAmmoModifiers(equipmentId: string, bonus: number) {
  return sharedMagicAmmunitionModifiers(srdChildId(equipmentId), bonus)
}
export function heavyArmorStrengthModifier(
  equipmentId: string,
  strengthRequirement: number,
  order: number
): ModifierGrantAuthored {
  return sharedHeavyArmorStrengthModifier(
    srdChildId(equipmentId),
    { walkSpeedId: speedId('WALK'), dwarvenHeritageId: SRD_DWARVEN_HERITAGE_ID },
    strengthRequirement,
    order
  )
}
export function meleeWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  diceConfig: string,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return sharedMeleeWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    diceConfig,
    grip
  )
}
export function meleeVersatileWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  dice1h: string,
  dice2h: string
): EquipmentEffectAuthored[] {
  return sharedMeleeVersatileWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    dice1h,
    dice2h
  )
}
export function thrownWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  diceConfig: string,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return sharedThrownWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    diceConfig,
    normalRangeFt,
    longRangeFt,
    grip
  )
}
export function thrownVersatileWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  dice1h: string,
  dice2h: string,
  normalRangeFt: number,
  longRangeFt: number
): EquipmentEffectAuthored[] {
  return sharedThrownVersatileWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    dice1h,
    dice2h,
    normalRangeFt,
    longRangeFt
  )
}
export function meleeReachWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  diceConfig: string,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return sharedMeleeReachWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    diceConfig,
    grip
  )
}
export function rangedWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  diceConfig: string,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return sharedRangedWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    diceConfig,
    normalRangeFt,
    longRangeFt,
    grip
  )
}
export function rangedFixedDamageWeaponEffects(
  equipmentId: string,
  damageTypeCode: string,
  amount: number,
  normalRangeFt: number,
  longRangeFt: number,
  grip: EquipmentGrip
): EquipmentEffectAuthored[] {
  return sharedRangedFixedDamageWeaponEffects(
    srdChildId(equipmentId),
    damageTypeId(damageTypeCode),
    amount,
    normalRangeFt,
    longRangeFt,
    grip
  )
}
