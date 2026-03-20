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
import { SRD_LANGUAGES, SRD_SPEEDS, SRD_SYSTEM_ID, SRD_USER_ID } from '../vocabulary.js'

function raceFeatureId(raceIndex: number, group: number, entry: number): string {
  const rHex = raceIndex.toString(16).padStart(4, '0')
  const gHex = group.toString(16).padStart(2, '0')
  const eHex = entry.toString(16).padStart(2, '0')
  return `00000000-0000-0000-a001-${rHex}${gHex}${eHex}0000`
}

function languageId(code: string): string {
  const entry = SRD_LANGUAGES.find((l) => l.code === code)
  if (!entry) throw new Error(`SRD language vocabulary entry for ${code} required.`)
  return entry.id
}

const walkSpeedId = SRD_SPEEDS.find((speed) => speed.code === 'WALK')?.id
if (!walkSpeedId) throw new Error('SRD WALK speed vocabulary entry is required for race source data.')

const humanWalk30 = [{ speedId: walkSpeedId, amount: 30, unit: MEASUREMENT_UNIT_CODE.FEET }]

// ─── Human (raceIndex = 4) ────────────────────────────────────────────────────

export const human: RaceAuthored = {
  id: RACE_IDS.HUMAN,
  label: 'Human',
  category: RACE_CATEGORY_CODE.BASE,
  playable: true,
  size: SIZE_CODE.MEDIUM,
  speeds: humanWalk30,
  userId: SRD_USER_ID,
  systemId: SRD_SYSTEM_ID,
  features: [
    {
      id: raceFeatureId(4, 1, 1),
      label: 'Ability Score Increase',
      description: 'Your ability scores each increase by 1.',
      availableAtLevel: 1,
      order: 0,
      grants: {
        modifiers: [
          {
            id: raceFeatureId(4, 1, 2),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.STRENGTH },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 0
          },
          {
            id: raceFeatureId(4, 1, 3),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.DEXTERITY },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 1
          },
          {
            id: raceFeatureId(4, 1, 4),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CONSTITUTION },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 2
          },
          {
            id: raceFeatureId(4, 1, 5),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.INTELLIGENCE },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 3
          },
          {
            id: raceFeatureId(4, 1, 6),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.WISDOM },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 4
          },
          {
            id: raceFeatureId(4, 1, 7),
            grantKind: GRANT_KIND.MODIFIER_GRANT,
            valueDomainCode: VALUE_DOMAIN_CODE.ABILITY_SCORE,
            domain: { ability: ABILITY_CODE.CHARISMA },
            modifierKind: MODIFIER_KIND.BONUS,
            scope: MODIFIER_SCOPE_KIND.GLOBAL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            payload: { valueKind: 'FIXED' as const, amount: 1 },
            order: 5
          }
        ]
      }
    },
    {
      id: raceFeatureId(4, 2, 1),
      label: 'Extra Language',
      description: 'You can speak, read, and write one extra language of your choice.',
      availableAtLevel: 1,
      order: 1,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(4, 2, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.CHOSEN,
            count: 1,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.ALL,
            order: 0
          }
        ]
      }
    },
    {
      id: raceFeatureId(4, 3, 1),
      label: 'Languages',
      description: 'You can speak, read, and write Common.',
      availableAtLevel: 1,
      order: 2,
      grants: {
        proficiencies: [
          {
            id: raceFeatureId(4, 3, 2),
            grantKind: GRANT_KIND.PROFICIENCY_GRANT,
            proficiencyKind: PROFICIENCY_KIND.LANGUAGE,
            level: SCALING_AMOUNT_KIND.FULL,
            selectionKind: AUTHORING_SELECTION_KIND.GRANTED,
            scalingKind: SCALING.NONE,
            authoringModeKind: AUTHORING_MODE_KIND.SELECTED,
            languageIds: [languageId('COMMON')],
            order: 0
          }
        ]
      }
    }
  ]
}
