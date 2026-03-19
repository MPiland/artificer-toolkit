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
import { SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const halfElfWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Half-Elf (raceIndex = 7) ─────────────────────────────────────────────────

export const halfElf: RaceAuthored = {
  id: RACE_IDS.HALF_ELF,
  label: 'Half-Elf',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: halfElfWalk30,
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
      description: 'Thanks to your elf blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
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
      id: raceFeatureId(7, 3, 1),
      label: 'Fey Ancestry',
      description: 'You have advantage on saving throws against being charmed, and magic can\'t put you to sleep.',
      availableAtLevel: 1,
      order: 2
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
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            order: 0
          }
        ]
      }
    }
  ]
}
