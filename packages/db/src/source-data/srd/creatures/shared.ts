import {
  ABILITY_CODE,
  ACTIVATION_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CHARGE_RESET_KIND,
  type AbilityCode,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_INITIATIVE_MODE_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  CREATURE_RECORD_KIND_CODE,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  PROFICIENCY_KIND,
  RANGE_KIND,
  SCALING,
  SCALING_AMOUNT_KIND,
  SIZE_CODE,
  TARGET_SELECTION_KIND,
  TRIGGER,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
} from '@artificer-toolkit/shared'
import { CREATURE_IDS } from '../ids.js'
import { SRD_DAMAGE_TYPES, SRD_LANGUAGES, SRD_SKILLS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

export const CREATURE_TYPE = {
  ABERRATION: '00000000-0000-0000-000e-000100000000',
  BEAST: '00000000-0000-0000-000e-000200000000',
  CELESTIAL: '00000000-0000-0000-000e-000300000000',
  CONSTRUCT: '00000000-0000-0000-000e-000400000000',
  DRAGON: '00000000-0000-0000-000e-000500000000',
  ELEMENTAL: '00000000-0000-0000-000e-000600000000',
  FEY: '00000000-0000-0000-000e-000700000000',
  FIEND: '00000000-0000-0000-000e-000800000000',
  GIANT: '00000000-0000-0000-000e-000900000000',
  HUMANOID: '00000000-0000-0000-000e-000a00000000',
  MONSTROSITY: '00000000-0000-0000-000e-000b00000000',
  OOZE: '00000000-0000-0000-000e-000c00000000',
  PLANT: '00000000-0000-0000-000e-000d00000000',
  UNDEAD: '00000000-0000-0000-000e-000e00000000'
} as const

export const CR = {
  CR_0: '00000000-0000-0000-000d-000100000000',
  CR_1_8: '00000000-0000-0000-000d-000200000000',
  CR_1_4: '00000000-0000-0000-000d-000300000000',
  CR_1_2: '00000000-0000-0000-000d-000400000000',
  CR_1: '00000000-0000-0000-000d-000500000000',
  CR_2: '00000000-0000-0000-000d-000600000000',
  CR_3: '00000000-0000-0000-000d-000700000000',
  CR_4: '00000000-0000-0000-000d-000800000000',
  CR_5: '00000000-0000-0000-000d-000900000000',
  CR_6: '00000000-0000-0000-000d-000a00000000',
  CR_7: '00000000-0000-0000-000d-000b00000000',
  CR_8: '00000000-0000-0000-000d-000c00000000',
  CR_9: '00000000-0000-0000-000d-000d00000000',
  CR_10: '00000000-0000-0000-000d-000e00000000',
  CR_11: '00000000-0000-0000-000d-000f00000000',
  CR_12: '00000000-0000-0000-000d-001000000000',
  CR_13: '00000000-0000-0000-000d-001100000000',
  CR_14: '00000000-0000-0000-000d-001200000000',
  CR_15: '00000000-0000-0000-000d-001300000000',
  CR_16: '00000000-0000-0000-000d-001400000000',
  CR_17: '00000000-0000-0000-000d-001500000000',
  CR_18: '00000000-0000-0000-000d-001600000000',
  CR_19: '00000000-0000-0000-000d-001700000000',
  CR_20: '00000000-0000-0000-000d-001800000000',
  CR_21: '00000000-0000-0000-000d-001900000000',
  CR_22: '00000000-0000-0000-000d-001a00000000',
  CR_23: '00000000-0000-0000-000d-001b00000000',
  CR_24: '00000000-0000-0000-000d-001c00000000',
  CR_25: '00000000-0000-0000-000d-001d00000000',
  CR_26: '00000000-0000-0000-000d-001e00000000',
  CR_27: '00000000-0000-0000-000d-001f00000000',
  CR_28: '00000000-0000-0000-000d-002000000000',
  CR_29: '00000000-0000-0000-000d-002100000000',
  CR_30: '00000000-0000-0000-000d-002200000000'
} as const

const WALK_SPEED_ID = '00000000-0000-0000-000b-000100000000'
const SWIM_SPEED_ID = '00000000-0000-0000-000b-000200000000'
const CLIMB_SPEED_ID = '00000000-0000-0000-000b-000300000000'
const FLY_SPEED_ID = '00000000-0000-0000-000b-000400000000'
const BURROW_SPEED_ID = '00000000-0000-0000-000b-000500000000'

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

export function featureId(creatureIndex: number, localIndex: number) {
  return localId(1, creatureIndex, localIndex)
}

export function actionId(creatureIndex: number, localIndex: number) {
  return localId(2, creatureIndex, localIndex)
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

export function lairActionId(creatureIndex: number, localIndex: number) {
  return localId(6, creatureIndex, localIndex)
}

export function proficiencyId(creatureIndex: number, localIndex: number) {
  return localId(7, creatureIndex, localIndex)
}

export function skillId(code: string) {
  const entry = SRD_SKILLS.find((skill) => skill.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

export function languageId(code: string) {
  const entry = SRD_LANGUAGES.find((language) => language.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

export function damageTypeId(code: string) {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} required.`)
  return entry.id
}

export function grantedSkillProficiency(
  creatureIndex: number,
  order: number,
  ...skillCodes: string[]
) {
  return {
    id: proficiencyId(creatureIndex, order),
    grantKind: GRANT_KIND.PROFICIENCY_GRANT,
    proficiencyKind: PROFICIENCY_KIND.SKILL,
    selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
    scalingKind: SCALING.NONE,
    authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
    level: SCALING_AMOUNT_KIND.FULL,
    skillIds: skillCodes.map(skillId),
    order,
  }
}

export function grantedSaveProficiency(
  creatureIndex: number,
  order: number,
  ...abilities: AbilityCode[]
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
    order,
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
    languageIds: languageCodes.map(languageId),
    order,
  }
}

export {
  ABILITY_CODE,
  ACTIVATION_CODE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  PATH_RESOLUTION_KIND,
  CHARGE_RESET_KIND,
  CREATURE_CATEGORY_CODE,
  CREATURE_COMPANION_BOND_TYPE_CODE,
  CREATURE_IDS,
  CREATURE_INITIATIVE_MODE_CODE,
  CREATURE_MOUNT_TYPE_CODE,
  CREATURE_RECORD_KIND_CODE,
  DAMAGE_BONUS_KIND,
  DAMAGE_VALUE_KIND,
  EFFECT_KIND,
  FEATURE_ATTRIBUTE,
  MEASUREMENT_UNIT_CODE,
  SIZE_CODE,
  RANGE_KIND,
  SCALING,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  TARGET_SELECTION_KIND,
  TRIGGER,
}


