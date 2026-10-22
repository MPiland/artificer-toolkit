import type { ImportIssueDto } from '@artificer-toolkit/schema/api/imports'
import {
  finesseWeaponModifiers,
  finesseWeaponWithRangedModifiers,
  heavyArmorStrengthModifier,
  heavyMeleeWeaponModifiers,
  heavyRangedWeaponModifiers,
  lightArmorModifiers,
  magicArmorModifiers,
  mediumArmorModifiers,
  meleeMagicWeaponModifiers,
  meleeWeaponAbilityModifiers,
  rangedMagicWeaponModifiers,
  rangedWeaponAbilityModifiers,
  stealthDisadvantageModifier,
  thrownMagicWeaponModifiers,
  thrownWeaponAbilityModifiers,
  type EquipmentChildId,
  type ModifierGrantAuthored
} from '@artificer-toolkit/shared/authored'
import { EQUIPMENT_CATEGORY_CODE, EQUIPMENT_PROPERTY_CODE } from '@artificer-toolkit/shared/core'
import {
  SRD_DWARVEN_HERITAGE_ID,
  SRD_GOLD_CURRENCY_ID,
  SRD_STEALTH_SKILL_ID,
  SRD_WALK_SPEED_ID
} from '@artificer-toolkit/source-data/srd/vocabulary.js'

import type { ExternalCustomContent } from './importParsers.js'
import {
  resolveImportedVocabularyEntry,
  type ImportedVocabularyEntry
} from './importedWeaponAttack.js'

type EquipmentTermsSource = Pick<
  ExternalCustomContent,
  | 'label'
  | 'path'
  | 'payload'
  | 'magicBonus'
  | 'rarityName'
  | 'costGold'
  | 'strengthRequirement'
  | 'stealthDisadvantage'
>

/** The parts of a System's vocabulary that custom Equipment terms resolve against. */
export interface ImportedEquipmentVocabulary {
  rarities: readonly ImportedVocabularyEntry[]
  currencies: readonly ImportedVocabularyEntry[]
  speeds: readonly ImportedVocabularyEntry[]
  skills: readonly ImportedVocabularyEntry[]
  heritages: readonly ImportedVocabularyEntry[]
}

/** The SRD's source-data definition ids are the terms the SRD armor and price rules name. */
function findById(vocabulary: readonly ImportedVocabularyEntry[], id: string) {
  return vocabulary.find((entry) => entry.id === id)
}

/**
 * The Stealth and Strength rules the source states for a piece of armor, as the SRD's heavy armor
 * grants them. A rule whose System vocabulary entry is missing is left out and named in `skipped`.
 */
function armorRuleGrants(
  childId: EquipmentChildId,
  { stealthDisadvantage, strengthRequirement }: EquipmentTermsSource,
  vocabulary: ImportedEquipmentVocabulary,
  skipped: string[]
): ModifierGrantAuthored[] {
  const grants: ModifierGrantAuthored[] = []
  if (stealthDisadvantage) {
    const stealth = findById(vocabulary.skills, SRD_STEALTH_SKILL_ID)
    if (stealth) grants.push(stealthDisadvantageModifier(childId, stealth.id))
    else skipped.push('its Stealth disadvantage (the System has no Stealth skill)')
  }
  if (strengthRequirement !== undefined) {
    const walk = findById(vocabulary.speeds, SRD_WALK_SPEED_ID)
    const dwarven = findById(vocabulary.heritages, SRD_DWARVEN_HERITAGE_ID)
    if (walk && dwarven)
      grants.push(
        heavyArmorStrengthModifier(
          childId,
          { walkSpeedId: walk.id, dwarvenHeritageId: dwarven.id },
          strengthRequirement
        )
      )
    else
      skipped.push(
        'its Strength requirement (the System has no Walking speed or no Dwarven heritage)'
      )
  }
  return grants
}

/**
 * The modifier grants the seeded SRD item with the same category and properties carries, so an
 * imported weapon adds its ability modifier to attack and damage, imported light or medium armor
 * adds its Dexterity modifier to AC, and armor with a stated Strength requirement or Stealth penalty
 * carries the SRD's heavy armor grants for them.
 */
function equipmentModifiers(
  childId: EquipmentChildId,
  custom: EquipmentTermsSource,
  vocabulary: ImportedEquipmentVocabulary,
  skippedArmorRules: string[]
): ModifierGrantAuthored[] {
  const { payload, magicBonus } = custom
  const properties: unknown[] = Array.isArray(payload.properties) ? payload.properties : []
  const has = (code: string) => properties.includes(code)

  if (payload.category === EQUIPMENT_CATEGORY_CODE.WEAPON) {
    const ranged = has(EQUIPMENT_PROPERTY_CODE.RANGED)
    if (!ranged && !has(EQUIPMENT_PROPERTY_CODE.MELEE)) return []
    const thrown = has(EQUIPMENT_PROPERTY_CODE.THROWN)
    const finesse = has(EQUIPMENT_PROPERTY_CODE.FINESSE)
    const heavy = has(EQUIPMENT_PROPERTY_CODE.HEAVY)
    const abilities = ranged
      ? heavy
        ? heavyRangedWeaponModifiers(childId)
        : rangedWeaponAbilityModifiers(childId)
      : thrown
        ? finesse
          ? finesseWeaponWithRangedModifiers(childId)
          : thrownWeaponAbilityModifiers(childId)
        : finesse
          ? finesseWeaponModifiers(childId)
          : heavy
            ? heavyMeleeWeaponModifiers(childId)
            : meleeWeaponAbilityModifiers(childId)
    const bonus =
      magicBonus === undefined
        ? []
        : ranged
          ? rangedMagicWeaponModifiers(childId, magicBonus)
          : thrown
            ? thrownMagicWeaponModifiers(childId, magicBonus)
            : meleeMagicWeaponModifiers(childId, magicBonus)
    return [...abilities, ...bonus]
  }

  const isArmor = payload.category === EQUIPMENT_CATEGORY_CODE.ARMOR
  if (!isArmor && payload.category !== EQUIPMENT_CATEGORY_CODE.SHIELD) return []
  const dexterity = !isArmor
    ? []
    : has(EQUIPMENT_PROPERTY_CODE.LIGHT)
      ? lightArmorModifiers(childId)
      : has(EQUIPMENT_PROPERTY_CODE.MEDIUM)
        ? mediumArmorModifiers(childId)
        : []
  return [
    ...dexterity,
    ...(isArmor ? armorRuleGrants(childId, custom, vocabulary, skippedArmorRules) : []),
    ...(magicBonus === undefined ? [] : magicArmorModifiers(childId, magicBonus))
  ]
}

/**
 * Completes a parsed custom Equipment payload with what the source states about it: the SRD's
 * modifier grants for its category, properties and armor rules, its rarity, and its price. The
 * rarity, the gold currency and the armor rules' skill, speed and heritage are resolved against the
 * target System's vocabulary; a name the System does not know is left out, never guessed, and an
 * armor rule that cannot be resolved is reported. Every id comes from `createId` in a fixed order.
 */
export function applyImportedEquipmentTerms(
  custom: EquipmentTermsSource,
  vocabulary: ImportedEquipmentVocabulary,
  createId: () => string
): { payload: Record<string, unknown>; issues: ImportIssueDto[] } {
  const skippedArmorRules: string[] = []
  const modifiers = equipmentModifiers(() => createId(), custom, vocabulary, skippedArmorRules).map(
    (grant, index) => ({ ...grant, order: index + 1 })
  )
  const rarity = custom.rarityName
    ? resolveImportedVocabularyEntry(vocabulary.rarities, custom.rarityName)
    : undefined
  const gold = findById(vocabulary.currencies, SRD_GOLD_CURRENCY_ID)
  return {
    payload: {
      ...custom.payload,
      ...(modifiers.length ? { modifiers } : {}),
      ...(rarity ? { rarityId: rarity.id } : {}),
      ...(custom.costGold !== undefined && gold
        ? { cost: { amount: custom.costGold, currencyId: gold.id } }
        : {})
    },
    issues: skippedArmorRules.length
      ? [
          {
            severity: 'WARNING',
            code: 'UNKNOWN_ARMOR_VOCABULARY',
            message: `Custom armor "${custom.label}" was imported without ${skippedArmorRules.join(' and ')}.`,
            path: custom.path,
            correctionRequired: true
          }
        ]
      : []
  }
}
