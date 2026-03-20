import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  SIZE_CODE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS } from '../ids.js'
import { SRD_LANGUAGES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID, SRD_SKILLS } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

function skillId(code: string): string {
  const entry = SRD_SKILLS.find((s) => s.code === code)
  if (!entry) throw new Error(`SRD skill vocabulary entry for ${code} required.`)
  return entry.id
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

const halfOrcWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Half-Orc (raceIndex = 8) ─────────────────────────────────────────────────

export const halfOrc: RaceAuthored = {
  id: RACE_IDS.HALF_ORC,
  label: 'Half-Orc',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: halfOrcWalk30,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(8, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Constitution score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(8, 1, 2),
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
            id: raceFeatureId(8, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
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
      id: raceFeatureId(8, 2, 1),
      label: 'Darkvision',
      description: 'Thanks to your orc blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        senses: [
          {
            id: raceFeatureId(8, 2, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(8, 2, 3),
              rangeKind: 'DISTANCE' as const,
              amount: 60,
              unit: MEASUREMENT_UNIT_CODE.FEET
            },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(8, 3, 1),
      label: 'Menacing',
      description: 'You gain proficiency in the Intimidation skill.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(8, 3, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.SKILL,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            skillIds: [skillId('INTIMIDATION')],
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(8, 4, 1),
      label: 'Relentless Endurance',
      description: 'When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can\'t use this feature again until you finish a long rest.',
      availableAtLevel: 1,
      order: 3
    },
    {
      id: raceFeatureId(8, 5, 1),
      label: 'Savage Attacks',
      description: 'When you score a critical hit with a melee weapon attack, you can roll one of the weapon\'s damage dice one additional time and add it to the extra damage of the critical hit.',
      availableAtLevel: 1,
      order: 4
    },
    {
      id: raceFeatureId(8, 6, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common and Orc.',
      availableAtLevel: 1,
      order: 5,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(8, 6, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('ORC')],
            order: 0
          }
        ]
      }
    }
  ]
}
