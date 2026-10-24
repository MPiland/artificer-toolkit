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
  RANGE_KIND,
  RACE_CATEGORY_CODE,
  RACE_SELECTION_MODE,
  SCALING,
  SCALING_AMOUNT_KIND,
  VALUE_DOMAIN_CODE,
  type RaceAuthored
} from '@artificer-toolkit/shared'
import { RACE_IDS } from '../ids.js'
import { SIZE_CODE } from '../sizes.js'
import {
  SRD_HUMAN_HERITAGE_ID,
  SRD_LANGUAGES,
  SRD_ORCISH_HERITAGE_ID,
  SRD_SPEEDS,
  SRD_SYSTEM_ID,
  SRD_USER_ID,
  SRD_DARKVISION_SENSE_ID,
  SRD_SKILLS
} from '../vocabulary.js'
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
  description: '<p>Your half-orc character has certain traits deriving from your orc ancestry.</p>',
  category: RACE_CATEGORY_CODE.BASE,
  selectionMode: RACE_SELECTION_MODE.DIRECT,
  size: SIZE_CODE.MEDIUM,
  speeds: halfOrcWalk30,
  heritageIds: [SRD_HUMAN_HERITAGE_ID, SRD_ORCISH_HERITAGE_ID],
  details: [
    {
      id: raceFeatureId(8, 0, 1),
      label: 'Age',
      description:
        'Half-orcs mature a little faster than humans, reaching adulthood around age 14. They age noticeably faster and rarely live longer than 75 years.',
      order: 0
    },
    {
      id: raceFeatureId(8, 0, 2),
      label: 'Alignment',
      description:
        'Half-orcs inherit a tendency toward chaos from their orc parents and are not strongly inclined toward good. Half-orcs raised among orcs and willing to live out their lives among them are usually evil.',
      order: 1
    },
    {
      id: raceFeatureId(8, 0, 3),
      label: 'Size',
      description:
        'Half-orcs are somewhat larger and bulkier than humans, and they range from 5 to well over 6 feet tall. Your size is Medium.',
      order: 2
    },
    {
      id: raceFeatureId(8, 0, 4),
      label: 'Speed',
      description: 'Your base walking speed is 30 feet.',
      order: 3
    }
  ],
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(8, 1, 1),
      label: 'Ability Score Increase',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
      description:
        'Your Strength score increases by 2, and your Constitution score increases by 1.',
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
      description:
        "Thanks to your orc blood, you have superior vision in dark and dim conditions. You can see in dim light within 60 feet of you as if it were bright light, and in darkness as if it were dim light. You can't discern color in darkness, only shades of gray.",
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
      description:
        "When you are reduced to 0 hit points but not killed outright, you can drop to 1 hit point instead. You can't use this feature again until you finish a long rest.",
      attributes: [FEATURE_ATTRIBUTE.LIMITED_USE],
      charges: {
        id: raceFeatureId(8, 4, 2),
        limitKind: 'FIXED_AMOUNT',
        scalingKind: SCALING.NONE,
        resetKind: 'LONG_REST',
        amount: 1
      },
      availableAtLevel: 1,
      order: 3,
      effects: [
        raceClosedRuleEffect(
          (entry) => raceFeatureId(8, 4, entry),
          CLOSED_RULE_KIND.RACE_RELENTLESS_ENDURANCE
        )
      ]
    },
    {
      id: raceFeatureId(8, 5, 1),
      label: 'Savage Attacks',
      description:
        "When you score a critical hit with a melee weapon attack, you can roll one of the weapon's damage dice one additional time and add it to the extra damage of the critical hit.",
      availableAtLevel: 1,
      order: 4,
      effects: [
        raceClosedRuleEffect(
          (entry) => raceFeatureId(8, 5, entry),
          CLOSED_RULE_KIND.RACE_SAVAGE_ATTACKS
        )
      ]
    },
    {
      id: raceFeatureId(8, 6, 1),
      label: 'Languages',
      attributes: [FEATURE_ATTRIBUTE.HIDDEN_ON_SHEET],
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
