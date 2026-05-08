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
  DAMAGE_VALUE_KIND
} from '@artificer-toolkit/shared'
import { CREATURE_IDS } from '../ids.js'
import {
  SRD_CHALLENGE_RATINGS,
  SRD_CREATURE_TYPES,
  SRD_DAMAGE_TYPES,
  SRD_LANGUAGES,
  SRD_SKILLS,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

function vocabularyId<TCode extends string>(
  entries: readonly { code: TCode, id: string }[],
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
    order
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
    languageIds: languageCodes.map(languageId),
    order
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
  TRIGGER
}
