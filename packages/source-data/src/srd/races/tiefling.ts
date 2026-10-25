import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RANGE_KIND,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SCALING_SOURCE,
  SPELL_GRANT_ATTRIBUTE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS, SPELL_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import {
  SRD_DAMAGE_TYPES,
  SRD_DARKVISION_SENSE_ID,
  SRD_INFERNAL_HERITAGE_ID,
  SRD_LANGUAGES,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'

function damageTypeId(code: string): string {
  const entry = SRD_DAMAGE_TYPES.find((d) => d.code === code)
  if (!entry) throw new Error(`SRD damage type vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const tieflingWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

export const tiefling: RaceAuthored = {
  id: RACE_IDS.TIEFLING,
  label: 'Tiefling',
  description:
    '<p>Tieflings share certain racial traits as a result of their infernal descent.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.DIRECT,
  size: SIZE_CODE.MEDIUM,
  speeds: tieflingWalk30,
  heritageIds: [SRD_INFERNAL_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(9, 0, 1),
      label: 'Age',
      description: 'Tieflings mature at the same rate as humans but live a few years longer.',
      order: 0
    },
    {
      id: raceFeatureId(9, 0, 2),
      label: 'Alignment',
      description:
        'Tieflings might not have an innate tendency toward evil, but many of them end up there. Evil or not, an independent nature inclines many tieflings toward a chaotic alignment.',
      order: 1
    },
    {
      id: raceFeatureId(9, 0, 3),
      label: 'Size',
      description: 'Tieflings are about the same size and build as humans. Your size is Medium.',
      order: 2
    },
    {
      id: raceFeatureId(9, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 30 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(9, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description:
        'Your Intelligence score increases by 1, and your Charisma score increases by 2.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(9, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
          },
          {
            id: raceFeatureId(9, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(9, 2, 1),
      label: 'Darkvision',
      description:
        "Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.",
      availableAtLevel: 1,
      order: 1,
      grants: {
        senses: [
          {
            id: raceFeatureId(9, 2, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(9, 2, 3),
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(9, 3, 1),
      label: 'Hellish Resistance',
      description: 'You have resistance to fire damage.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(9, 3, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.DAMAGE_RESISTANCE,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { damageTypeId: damageTypeId('FIRE') },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(9, 4, 1),
      label: 'Infernal Legacy',
      description:
        'You know the thaumaturgy cantrip. When you reach 3rd level, you can cast the hellish rebuke spell as a 2nd-level spell once with this trait and regain the ability to do so when you finish a long rest. When you reach 5th level, you can cast the darkness spell once with this trait and regain the ability to do so when you finish a long rest. Charisma is your spellcasting ability for these spells.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        spells: [
          {
            id: raceFeatureId(9, 4, 2),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.THAUMATURGY],
            attributes: [SPELL_GRANT_ATTRIBUTE.KNOWN, SPELL_GRANT_ATTRIBUTE.CAST_AT_WILL],
            castingAbility: ABILITY_CODE.CHARISMA,
            order: 0
          },
          {
            id: raceFeatureId(9, 4, 3),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
              levels: [
                {
                  id: raceFeatureId(9, 4, 5),
                  level: 3,
                  order: 0,
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  spellIds: [SPELL_IDS.HELLISH_REBUKE]
                }
              ]
            },
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 2,
            castingAbility: ABILITY_CODE.CHARISMA,
            charges: {
              id: raceFeatureId(9, 4, 6),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 1
          },
          {
            id: raceFeatureId(9, 4, 4),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.PER_LEVEL,
            progression: {
              scalingSource: SCALING_SOURCE.CHARACTER_LEVEL,
              levels: [
                {
                  id: raceFeatureId(9, 4, 7),
                  level: 5,
                  order: 0,
                  authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
                  spellIds: [SPELL_IDS.DARKNESS]
                }
              ]
            },
            attributes: [SPELL_GRANT_ATTRIBUTE.LIMITED_USE, SPELL_GRANT_ATTRIBUTE.CAST_AT_LEVEL],
            castAtLevel: 2,
            castingAbility: ABILITY_CODE.CHARISMA,
            charges: {
              id: raceFeatureId(9, 4, 8),
              limitKind: 'FIXED_AMOUNT',
              scalingKind: SCALING.NONE,
              resetKind: 'LONG_REST',
              amount: 1
            },
            order: 2
          }
        ]
      }
    },
    {
      id: raceFeatureId(9, 5, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description: 'You can speak, read, and write Common and Infernal.',
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(9, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('INFERNAL')],
            order: 0
          }
        ]
      }
    }
  ]
}
