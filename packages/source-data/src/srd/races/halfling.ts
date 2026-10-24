import {
  ABILITY_CODE,
  AUTHORING_MODE_KIND,
  AUTHORING_SELECTION_KIND,
  CLOSED_RULE_KIND,
  FEATURE_ATTRIBUTE,
  GRANT_KIND,
  MEASUREMENT_UNIT_CODE,
  MODIFIER_KIND,
  MODIFIER_SCOPE_KIND,
  PROFICIENCY_KIND,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS, SUBRACE_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import {
  SRD_HALFLING_HERITAGE_ID,
  SRD_LANGUAGES,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID
} from '../vocabulary.js'
import { conditionTypeId } from '../spells/shared.js'
import { raceClosedRuleEffect } from './closed-rule-effect.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId)
  throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

const halflingWalk25 = [{ speedId: walkSpeedId, amount: 25, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Halfling (raceIndex = 3) ─────────────────────────────────────────────────

export const halfling: RaceAuthored = {
  id: RACE_IDS.HALFLING,
  label: 'Halfling',
  description:
    '<p>Your halfling character has a number of traits in common with all other halflings.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.REQUIRES_SUBRACE,
  size: SIZE_CODE.SMALL,
  speeds: halflingWalk25,
  heritageIds: [SRD_HALFLING_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(3, 0, 1),
      label: 'Age',
      description:
        'A halfling reaches adulthood at the age of 20 and generally lives into the middle of his or her second century.',
      order: 0
    },
    {
      id: raceFeatureId(3, 0, 2),
      label: 'Alignment',
      description:
        'Most halflings are lawful good. As a rule, they are good-hearted and kind, hate to see others in pain, and have no tolerance for oppression. They are also very orderly and traditional, leaning heavily on the support of their community and the comfort of their old ways.',
      order: 1
    },
    {
      id: raceFeatureId(3, 0, 3),
      label: 'Size',
      description:
        'Halflings average about 3 feet tall and weigh about 40 pounds. Your size is Small.',
      order: 2
    },
    {
      id: raceFeatureId(3, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 25 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(3, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
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
      description:
        'When you roll a 1 on the d20 for an attack roll, ability check, or saving throw, you can reroll the die and must use the new roll.',
      availableAtLevel: 1,
      order: 1,
      effects: [
        raceClosedRuleEffect(
          (entry) => raceFeatureId(3, 2, entry),
          CLOSED_RULE_KIND.RACE_HALFLING_LUCKY
        )
      ]
    },
    {
      id: raceFeatureId(3, 3, 1),
      label: 'Brave',
      description: 'You have advantage on saving throws against being frightened.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        // Frightening effects call for saves of any ability, so each ability gets the advantage.
        modifiers: Object.values(ABILITY_CODE).map((ability, index) => ({
          id: raceFeatureId(3, 3, 2 + index),
          grantKind: GRANT_KIND.MODIFIER_GRANT,
          valueDomainCode: VALUE_DOMAIN_CODE.SAVING_THROW_MODIFIER,
          domain: { ability, conditionTypeId: conditionTypeId('FRIGHTENED') },
          modifierKind: MODIFIER_KIND.ROLL_INFLUENCE,
          payload: { influence: 'ADVANTAGE' },
          scope: MODIFIER_SCOPE_KIND.GLOBAL,
          selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
          order: index
        }))
      }
    },
    {
      id: raceFeatureId(3, 4, 1),
      label: 'Halfling Nimbleness',
      description:
        'You can move through the space of any creature that is of a size larger than yours.',
      availableAtLevel: 1,
      order: 3,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(3, 4, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.MOVEMENT_PASSAGE,
            domain: {},
            modifierKind: MODIFIER_KIND.ADD_OPTION,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: {
              creatures: 'LARGER_THAN_SELF' as const,
              mayEndInCreature: false,
              blockingBarriers: false,
              costMultiplier: 1 as const
            },
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(3, 5, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description:
        "You can speak, read, and write Common and Halfling. The Halfling language isn't secret, but halflings are loath to share it with others. They write very little, so they don't have a rich body of literature. Their oral tradition, however, is very strong. Almost all halflings speak Common to converse with the people in whose lands they dwell or through which they are traveling.",
      availableAtLevel: 1,
      order: 4,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(3, 5, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON'), languageId('HALFLING')],
            order: 0
          }
        ]
      }
    }
  ]
}

// ─── Lightfoot Halfling (subraceIndex = 106) ──────────────────────────────────

export const lightfoot: RaceAuthored = {
  id: SUBRACE_IDS.LIGHTFOOT,
  label: 'Lightfoot',
  description:
    '<p>As a lightfoot halfling, you can easily hide from notice, even using other people as cover.</p>',
  category: RACE_CATEGORY_CODE.SUBRACE,
  parentRaceId: RACE_IDS.HALFLING,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(106, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
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
      description:
        'You can attempt to hide even when you are obscured only by a creature that is at least one size larger than you.',
      availableAtLevel: 1,
      order: 1
    }
  ]
}
