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
import { SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID, SRD_SKILLS } from '../vocabulary.js'

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

const halflingWalk25 = [{ speedId: walkSpeedId, amount: 25, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Halfling (raceIndex = 3) ─────────────────────────────────────────────────

export const halfling: RaceAuthored = {
  id: RACE_IDS.HALFLING,
  label: 'Halfling',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.SMALL,
  speeds: halflingWalk25,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(3, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Dexterity score increases by 2.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(3, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
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
      id: raceFeatureId(3, 2, 1),
      label: 'Lucky',
      description: 'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      availableAtLevel: 1,
      order: 1
    },
    {
      id: raceFeatureId(3, 3, 1),
      label: 'Brave',
      description: 'You have advantage on saving throws against being frightened.',
      availableAtLevel: 1,
      order: 2
    },
    {
      id: raceFeatureId(3, 4, 1),
      label: 'Halfling Nimbleness',
      description: 'You can move through the space of any creature that is of a size larger than yours.',
      availableAtLevel: 1,
      order: 3
    }
  ]
}

// ─── Lightfoot Halfling (subraceIndex = 106) ──────────────────────────────────

export const lightfoot: RaceAuthored = {
  id: SUBRACE_IDS.LIGHTFOOT,
  label: 'Lightfoot',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.HALFLING,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(106, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Charisma score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(106, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
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
      id: raceFeatureId(106, 2, 1),
      label: 'Naturally Stealthy',
      description: 'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
      availableAtLevel: 1,
      order: 1
    }
  ]
}

// ─── Stout Halfling (subraceIndex = 107) ─────────────────────────────────────

export const stout: RaceAuthored = {
  id: SUBRACE_IDS.STOUT,
  label: 'Stout',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.HALFLING,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(107, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your Constitution score increases by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(107, 1, 2),
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
      id: raceFeatureId(107, 2, 1),
      label: 'Stout Resilience',
      description: 'You have advantage on saving throws against poison, and you have resistance against poison damage.',
      availableAtLevel: 1,
      order: 1
    }
  ]
}
