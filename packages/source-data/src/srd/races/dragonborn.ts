import { SRD_ABILITY_DEFINITION_IDS as SRD_EFFECT_ABILITY_DEFINITION_IDS } from '../vocabulary.js'
import {
  ACTIVATION_CODE,
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  FEATURE_ATTRIBUTE,
  PATH_CODE,
  PATH_GROUP_TYPE,
  EFFECT_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SAVING_THROW_DC_BONUS_KIND,
  SAVING_THROW_DC_METHOD,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SHAPE_KIND,
  TARGET_DISPOSITION_KIND,
  TRIGGER,
  VALUE_DOMAIN_CODE,
  type FeatureAuthored,
  type RaceAncestryAuthored,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import {
  SRD_DAMAGE_TYPES,
  SRD_DRACONIC_HERITAGE_ID,
  SRD_LANGUAGES,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}
// ancestry option ID helper
function ancestryOptionId(index: number): string {
  const hex = index.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-0005aa${hex}0000`
}
function ancestryFeatureId(optionIndex: number, entry: number): string {
  return raceFeatureId(5, 0x10 + optionIndex, entry)
}
function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((damageType) => damageType.code === code)
  if (!entry)
    throw new Error(
      `SRD damage type vocabulary entry for ${code} is required for dragonborn source data.`
    )
  return entry.id
}
function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}
type DragonbornAncestryConfig = {
  damageCode: string
  shapeKind: 'LINE' | 'CONE'
  saveAbility: 'DEXTERITY' | 'CONSTITUTION'
}

const DRACONIC_ANCESTRY_DESCRIPTION =
  'You have draconic ancestry. Choose one type of dragon from the Draconic Ancestry table. Your breath weapon and damage resistance are determined by the dragon type, as shown in the table.'

const BREATH_WEAPON_DESCRIPTION =
  "You can use your action to exhale destructive energy. Your draconic ancestry determines the size, shape, and damage type of the exhalation. When you use your breath weapon, each creature in the area of the exhalation must make a saving throw, the type of which is determined by your draconic ancestry. The DC for this saving throw equals 8 + your Constitution modifier + your proficiency bonus. A creature takes 2d6 damage on a failed save, and half as much damage on a successful one. The damage increases to 3d6 at 6th level, 4d6 at 11th level, and 5d6 at 16th level. After you use your breath weapon, you can't use it again until you complete a short or long rest."

function dragonbornAncestryFeatures(
  optionIndex: number,
  config: DragonbornAncestryConfig
): FeatureAuthored[] {
  const damageType = damageTypeId(config.damageCode)
  return [
    {
      id: ancestryFeatureId(optionIndex, 1),
      label: 'Breath Weapon',
      description: BREATH_WEAPON_DESCRIPTION,
      attributes: ['LIMITED_USE'],
      charges: {
        id: ancestryFeatureId(optionIndex, 2),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'SHORT_REST',
        amount: 1
      },
      effects: [
        {
          id: ancestryFeatureId(optionIndex, 3),
          order: 1,
          invocation: {
            kind: 'ACTION' as const,
            triggerCode: TRIGGER.SAVING_THROW,
            resourceUse: { chargeId: ancestryFeatureId(optionIndex, 2), cost: 1 },
            savingThrow: {
              id: ancestryFeatureId(optionIndex, 4),
              dcMethod: SAVING_THROW_DC_METHOD.DERIVED_DC,
              abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS[config.saveAbility],
              baseDc: 8,
              bonuses: [
                {
                  id: ancestryFeatureId(optionIndex, 19),
                  bonusKind: SAVING_THROW_DC_BONUS_KIND.ABILITY_MODIFIER,
                  abilityDefinitionId: SRD_EFFECT_ABILITY_DEFINITION_IDS.CONSTITUTION
                },
                {
                  id: ancestryFeatureId(optionIndex, 20),
                  bonusKind: SAVING_THROW_DC_BONUS_KIND.PROFICIENCY_BONUS
                }
              ]
            },
            activation: {
              code: ACTIVATION_CODE.ACTION,
              amount: 1
            },
            range: {
              id: ancestryFeatureId(optionIndex, 5),
              rangeKind: RANGE_KIND.SELF
            },
            targeting: {
              selectionKind: 'AREA_CONTENTS',
              dispositionKind: TARGET_DISPOSITION_KIND.ANY
            },
            shape:
              config.shapeKind === SHAPE_KIND.LINE
                ? {
                    id: ancestryFeatureId(optionIndex, 6),
                    shapeKind: SHAPE_KIND.LINE,
                    length: {
                      amount: 30,
                      unit: MEASUREMENT_UNIT_CODE.FEET
                    },
                    width: {
                      amount: 5,
                      unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                  }
                : {
                    id: ancestryFeatureId(optionIndex, 6),
                    shapeKind: SHAPE_KIND.CONE,
                    length: {
                      amount: 15,
                      unit: MEASUREMENT_UNIT_CODE.FEET
                    }
                  }
          },
          paths: [
            {
              id: ancestryFeatureId(optionIndex, 7),
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: ancestryFeatureId(optionIndex, 7) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: ancestryFeatureId(optionIndex, 7),
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: damageType,
                    valueKind: 'DICE',
                    scalingKind: SCALING.PER_LEVEL,
                    scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                    levels: [
                      {
                        id: ancestryFeatureId(optionIndex, 8),
                        level: 1,
                        order: 1,
                        diceConfig: '2d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 9),
                        level: 6,
                        order: 2,
                        diceConfig: '3d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 10),
                        level: 11,
                        order: 3,
                        diceConfig: '4d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 11),
                        level: 16,
                        order: 4,
                        diceConfig: '5d6'
                      }
                    ]
                  }
                ]
              }
            },
            {
              id: ancestryFeatureId(optionIndex, 12),
              order: 2,
              pathCode: PATH_CODE.ON_SAVE_SUCCESS,
              groupType: PATH_GROUP_TYPE.SINGLE,
              originKind: 'SOURCE' as const,
              selectionKind: 'FIXED' as const,
              resultBlock: {
                id: ancestryFeatureId(optionIndex, 12) + '__result',
                resultKind: 'SINGLE' as const,
                outcomes: [
                  {
                    id: ancestryFeatureId(optionIndex, 12),
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: damageType,
                    amountKind: SCALING_AMOUNT_KIND.HALF,
                    valueKind: 'DICE',
                    scalingKind: SCALING.PER_LEVEL,
                    scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
                    levels: [
                      {
                        id: ancestryFeatureId(optionIndex, 13),
                        level: 1,
                        order: 1,
                        diceConfig: '2d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 14),
                        level: 6,
                        order: 2,
                        diceConfig: '3d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 15),
                        level: 11,
                        order: 3,
                        diceConfig: '4d6'
                      },
                      {
                        id: ancestryFeatureId(optionIndex, 16),
                        level: 16,
                        order: 4,
                        diceConfig: '5d6'
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ],
      availableAtLevel: 1,
      order: 0
    },
    {
      id: ancestryFeatureId(optionIndex, 17),
      label: 'Damage Resistance',
      description: 'You have resistance to the damage type associated with your draconic ancestry.',
      grants: {
        modifiers: [
          {
            id: ancestryFeatureId(optionIndex, 18),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageType },
            order: 0
          }
        ]
      },
      availableAtLevel: 1,
      order: 1
    }
  ]
}
const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for race source data.')
const dragonbornWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]
const dragonbornAncestry: RaceAncestryAuthored = {
  id: raceFeatureId(5, 9, 1),
  label: 'Draconic Ancestry',
  description: DRACONIC_ANCESTRY_DESCRIPTION,
  options: [
    {
      id: ancestryOptionId(1),
      label: 'Black (Acid)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 0,
      features: dragonbornAncestryFeatures(1, {
        damageCode: 'ACID',
        shapeKind: 'LINE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(2),
      label: 'Blue (Lightning)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 1,
      features: dragonbornAncestryFeatures(2, {
        damageCode: 'LIGHTNING',
        shapeKind: 'LINE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(3),
      label: 'Brass (Fire)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 2,
      features: dragonbornAncestryFeatures(3, {
        damageCode: 'FIRE',
        shapeKind: 'LINE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(4),
      label: 'Bronze (Lightning)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 3,
      features: dragonbornAncestryFeatures(4, {
        damageCode: 'LIGHTNING',
        shapeKind: 'LINE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(5),
      label: 'Copper (Acid)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 4,
      features: dragonbornAncestryFeatures(5, {
        damageCode: 'ACID',
        shapeKind: 'LINE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(6),
      label: 'Gold (Fire)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 5,
      features: dragonbornAncestryFeatures(6, {
        damageCode: 'FIRE',
        shapeKind: 'CONE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(7),
      label: 'Green (Poison)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 6,
      features: dragonbornAncestryFeatures(7, {
        damageCode: 'POISON',
        shapeKind: 'CONE',
        saveAbility: 'CONSTITUTION'
      })
    },
    {
      id: ancestryOptionId(8),
      label: 'Red (Fire)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 7,
      features: dragonbornAncestryFeatures(8, {
        damageCode: 'FIRE',
        shapeKind: 'CONE',
        saveAbility: 'DEXTERITY'
      })
    },
    {
      id: ancestryOptionId(9),
      label: 'Silver (Cold)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 8,
      features: dragonbornAncestryFeatures(9, {
        damageCode: 'COLD',
        shapeKind: 'CONE',
        saveAbility: 'CONSTITUTION'
      })
    },
    {
      id: ancestryOptionId(10),
      label: 'White (Cold)',
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      order: 9,
      features: dragonbornAncestryFeatures(10, {
        damageCode: 'COLD',
        shapeKind: 'CONE',
        saveAbility: 'CONSTITUTION'
      })
    }
  ]
}
// ─── Dragonborn (raceIndex = 5) ───────────────────────────────────────────────
export const dragonborn: RaceAuthored = {
  id: RACE_IDS.DRAGONBORN,
  label: 'Dragonborn',
  description:
    '<p>Your draconic heritage manifests in a variety of traits you share with other dragonborn.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.DIRECT,
  size: SIZE_CODE.MEDIUM,
  speeds: dragonbornWalk30,
  heritageIds: [SRD_DRACONIC_HERITAGE_ID],
  ancestry: dragonbornAncestry,
  details: [
    {
      id: raceFeatureId(5, 0, 1),
      label: 'Age',
      description:
        'Young dragonborn grow quickly. They walk hours after hatching, attain the size and development of a 10-year-old human child by the age of 3, and reach adulthood by 15. They live to be around 80.',
      order: 0
    },
    {
      id: raceFeatureId(5, 0, 2),
      label: 'Alignment',
      description:
        'Dragonborn tend to extremes, making a conscious choice for one side or the other in the cosmic war between good and evil. Most dragonborn are good, but those who side with evil can be terrible villains.',
      order: 1
    },
    {
      id: raceFeatureId(5, 0, 3),
      label: 'Size',
      description:
        'Dragonborn are taller and heavier than humans, standing well over 6 feet tall and averaging almost 250 pounds. Your size is Medium.',
      order: 2
    },
    {
      id: raceFeatureId(5, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 30 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(5, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'Your Strength score increases by 2, and your Charisma score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(5, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.STRENGTH },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(5, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(5, 2, 1),
      label: 'Draconic Ancestry',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: DRACONIC_ANCESTRY_DESCRIPTION,
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(5, 4, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'You can speak, read, and write Common and Draconic.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(5, 4, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('DRACONIC')],
            order: 0
          }
        ]
      }
    }
  ]
}
