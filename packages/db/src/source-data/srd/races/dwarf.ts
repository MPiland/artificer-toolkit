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
import { RACE_IDS, SUBRACE_IDS } from '../ids.js'
import { SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_DARKVISION_SENSE_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const dwarfWalk25 = [{ speedId: walkSpeedId, amount: 25, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Dwarf (raceIndex = 1) ────────────────────────────────────────────────────

export const dwarf: RaceAuthored = {
  id: RACE_IDS.DWARF,
  label: 'Dwarf',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: dwarfWalk25,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(1, 1, 1),
      label: 'Darkvision',
      description: 'Accustomed to life underground, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        senses: [
          {
            id: raceFeatureId(1, 1, 2),
            grantKind: GRANT_KIND.SENSE_GRANT,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            senseIds: [SRD_DARKVISION_SENSE_ID],
            range: {
              id: raceFeatureId(1, 1, 3),
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
      id: raceFeatureId(1, 2, 1),
      label: 'Dwarven Resilience',
      description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(1, 3, 1),
      label: 'Dwarven Combat Training',
      description: 'You have proficiency with the battleaxe, handaxe, light hammer, and warhammer.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(1, 4, 1),
      label: 'Tool Proficiency',
      description: "You gain proficiency with the artisan's tools of your choice: smith's tools, brewer's supplies, or mason's tools.",
      availableAtLevel: 1,
      order: 3
    },
    {
      id: raceFeatureId(1, 5, 1),
      label: 'Stonecunning',
      description: 'Whenever you make an Intelligence (History) check related to the origin of stonework, you are considered proficient in the History skill and add double your proficiency bonus to the check, instead of your normal proficiency bonus.',
      availableAtLevel: 1,
      order: 4
    }
  ]
}

// ─── Hill Dwarf (subraceIndex = 101) ─────────────────────────────────────────

export const hillDwarf: RaceAuthored = {
  id: SUBRACE_IDS.HILL_DWARF,
  label: 'Hill Dwarf',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.DWARF,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(101, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Wisdom score increases by 1, and your Constitution score increases by 2.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(101, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.WISDOM },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
          },
          {
            id: raceFeatureId(101, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
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
      id: raceFeatureId(101, 2, 1),
      label: 'Dwarven Toughness',
      description: 'Your hit point maximum increases by 1, and it increases by 1 every time you gain a level.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(101, 2, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.HIT_POINTS_MAX,
            domain: {},
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'CHARACTER_LEVEL' as const, multiplier: 1 },
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── Mountain Dwarf (subraceIndex = 102) ─────────────────────────────────────

export const mountainDwarf: RaceAuthored = {
  id: SUBRACE_IDS.MOUNTAIN_DWARF,
  label: 'Mountain Dwarf',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.DWARF,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(102, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Strength score increases by 2, and your Constitution score increases by 2.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(102, 1, 2),
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
            id: raceFeatureId(102, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
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
      id: raceFeatureId(102, 2, 1),
      label: 'Dwarven Armor Training',
      description: 'You have proficiency with light and medium armor.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(102, 2, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.EQUIPMENT,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            equipmentIds: [],
            order: 0
          }
        ]
      }
    }
  ]
}
