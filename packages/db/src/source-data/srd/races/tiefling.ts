import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  RACE_CATEGORY_CODE,
  SCALING,
  SIZE_CODE,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS, SPELL_IDS } from '../ids.js'
import { SRD_DARKVISION_SENSE_ID, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const tieflingWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

export const tiefling: RaceAuthored = {
  id: RACE_IDS.TIEFLING,
  label: 'Tiefling',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: tieflingWalk30,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(9, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 1, and your Charisma score increases by 2.',
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
      description: 'Thanks to your infernal heritage, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
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
      id: raceFeatureId(9, 3, 1),
      label: 'Hellish Resistance',
      description: 'You have resistance to fire damage.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(9, 4, 1),
      label: 'Infernal Legacy',
      description: 'You know the Thaumaturgy cantrip. When you reach 3rd level, you can cast Hellish Rebuke as a 2nd-level spell once per long rest. When you reach 5th level, you can cast Darkness once per long rest. Charisma is your spellcasting ability for these spells.',
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
            order: 0
          },
          {
            id: raceFeatureId(9, 4, 3),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.HELLISH_REBUKE],
            order: 1
          },
          {
            id: raceFeatureId(9, 4, 4),
            grantKind: GRANT_KIND.SPELL_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            spellIds: [SPELL_IDS.DARKNESS],
            order: 2
          }
        ]
      }
    }
  ]
}