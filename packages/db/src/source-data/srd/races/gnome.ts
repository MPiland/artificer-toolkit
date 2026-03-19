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
import { RACE_IDS, SUBRACE_IDS, SPELL_IDS } from '../ids.js'
import { SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const gnomeWalk25 = [{ speedId: walkSpeedId, amount: 25, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Gnome (raceIndex = 6) ────────────────────────────────────────────────────

export const gnome: RaceAuthored = {
  id: RACE_IDS.GNOME,
  label: 'Gnome',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.SMALL,
  speeds: gnomeWalk25,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(6, 1, 1),
      label: 'Darkvision',
      description: 'Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: raceFeatureId(6, 1, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(6, 1, 3),
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
      id: raceFeatureId(6, 2, 1),
      label: 'Ability Score Increase',
      description: 'Your Intelligence score increases by 2.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(6, 2, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 2 },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(6, 3, 1),
      label: 'Gnome Cunning',
      description: 'You have advantage on all Intelligence, Wisdom, and Charisma saving throws against magic.',
      availableAtLevel: 1,
      order: 2
    }
  ]
}

// ─── Rock Gnome (subraceIndex = 109) ─────────────────────────────────────────

export const rockGnome: RaceAuthored = {
  id: SUBRACE_IDS.ROCK_GNOME,
  label: 'Rock Gnome',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.GNOME,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(109, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Constitution score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(109, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(109, 2, 1),
      label: "Artificer's Lore",
      description: 'Whenever you make an Intelligence (History) check related to magic items, alchemical objects, or technological devices, you can add twice your proficiency bonus, instead of any proficiency bonus you normally apply.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(109, 3, 1),
      label: 'Tinker',
      description: 'You have proficiency with artisan\'s tools (tinker\'s tools). Using those tools, you can spend 1 hour and 10 gp worth of materials to construct a Tiny clockwork device (AC 5, 1 hp).',
      availableAtLevel: 1,
      order: 2
    }
  ]
}
