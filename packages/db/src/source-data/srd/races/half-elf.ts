import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
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
  SIZE_CODE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS } from '../ids.js'
import { SRD_CONDITION_TYPES, SRD_ELVEN_HERITAGE_ID, SRD_HUMAN_HERITAGE_ID, SRD_LANGUAGES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID, SRD_SKILLS } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const halfElfWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

function conditionTypeId(code: string): string {
  const entry = SRD_CONDITION_TYPES.find((c) => c.code === code)
  if (!entry) throw new Error(`SRD condition type vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

function availableLanguageIds(excludedCodes: string[] = []): string[] {
  const excluded = new Set(excludedCodes)
  return SRD_LANGUAGES
    .filter((language) => !excluded.has(language.code))
    .map((language) => language.id)
}

// ─── Half-Elf (raceIndex = 7) ─────────────────────────────────────────────────

export const halfElf: RaceAuthored = {
  id: RACE_IDS.HALF_ELF,
  label: 'Half-Elf',
  description: '<p>Your half-elf character has some qualities in common with elves and some that are unique to half-elves.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.DIRECT,
  size: SIZE_CODE.MEDIUM,
  speeds: halfElfWalk30,
  heritageIds: [SRD_HUMAN_HERITAGE_ID, SRD_ELVEN_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(7, 0, 1),
      label: 'Age',
      description: 'Half-elves mature at the same rate humans do and reach adulthood around the age of 20. They live much longer than humans, however, often exceeding 180 years.',
      order: 0
    },
    {
      id: raceFeatureId(7, 0, 2),
      label: 'Alignment',
      description: 'Half-elves share the chaotic bent of their elven heritage. They value both personal freedom and creative expression, demonstrating neither love of leaders nor desire for followers.',
      order: 1
    },
    {
      id: raceFeatureId(7, 0, 3),
      label: 'Size',
      description: 'Half-elves are about the same size as humans, ranging from 5 to 6 feet tall. Your size is Medium.',
      order: 2
    },
    {
      id: raceFeatureId(7, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 30 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(7, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Charisma score increases by 2, and two other ability scores of your choice increase by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(7, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          },
          {
            id: raceFeatureId(7, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.STRENGTH },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 2,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          }
        ]
      }
    },
    {
      id: raceFeatureId(7, 2, 1),
      label: 'Darkvision',
      description: 'Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You cannot discern color in darkness, only shades of gray.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        senses: [
          {
            id: raceFeatureId(7, 2, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(7, 2, 3),
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
      id: raceFeatureId(7, 3, 1),
      label: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(7, 3, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
            domain: {
              ability: ABILITY_CODE.CHARISMA,
              conditionTypeId: conditionTypeId('CHARMED')
            },
            modifierKind: MODIFIER_KIND.ADVANTAGE,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: undefined,
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(7, 4, 1),
      label: 'Skill Versatility',
      description: 'You gain proficiency in two skills of your choice.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(7, 4, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            scalingKind: SCALING.NONE,
            count: 2,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [
              skillId('ACROBATICS'),
              skillId('ANIMAL_HANDLING'),
              skillId('ARCANA'),
              skillId('ATHLETICS'),
              skillId('DECEPTION'),
              skillId('HISTORY'),
              skillId('INSIGHT'),
              skillId('INTIMIDATION'),
              skillId('INVESTIGATION'),
              skillId('MEDICINE'),
              skillId('NATURE'),
              skillId('PERCEPTION'),
              skillId('PERFORMANCE'),
              skillId('PERSUASION'),
              skillId('RELIGION'),
              skillId('SLEIGHT_OF_HAND'),
              skillId('STEALTH'),
              skillId('SURVIVAL')
            ],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(7, 5, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common, Elvish, and one extra language of your choice.',
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(7, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('ELVISH')],
            order: 0
          },
          {
            id: raceFeatureId(7, 5, 3),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: availableLanguageIds(['COMMON', 'ELVISH']),
            order: 1
          }
        ]
      }
    }
  ]
}


