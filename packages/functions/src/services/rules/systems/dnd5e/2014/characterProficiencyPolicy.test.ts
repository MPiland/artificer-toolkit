import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import { characterGrantFoldInputSchema } from '@artificer-toolkit/schema/api/characterGrantFoldRules'
import {
  type CharacterAssemblyRegistry,
  type CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'

import { buildCharacterProficiencyRuleFacts } from '../../../../character/characterProficiencyRuleFacts.js'
import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function canonicalInput() {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    ({ modelKey }) => modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('The canonical Character policy fixture is missing.')
  return characterRulePolicyInputSchema.parse(fixture.input)
}

function equipmentItem(
  instanceId: string,
  proficiencyKind: 'SKILL' | 'EQUIPMENT' = 'SKILL',
  targetId = 'skill-perception-record',
  matchId = 'perception'
) {
  const source = {
    sourceId: `EQUIPMENT_INSTANCE:item-definition:${instanceId}`,
    mechanicSource: {
      kind: 'EQUIPMENT_INSTANCE' as const,
      equipmentId: 'item-definition',
      itemInstanceId: instanceId
    },
    sourceState: { carried: true, equipped: true, attuned: false },
    restrictions: [],
    proficiencies: [
      {
        grantId: 'shared-perception-grant',
        proficiencyKind,
        targetIds: [targetId],
        matchIds: [matchId],
        category: null,
        scaling: 'FULL'
      }
    ],
    senses: [],
    modifiers: [],
    feats: [],
    spells: []
  }
  return {
    instanceId,
    equipmentId: 'item-definition',
    requiresAttunement: false,
    equipped: true,
    attuned: false,
    restrictions: [],
    rootSourceId: `EQUIPMENT_INSTANCE:item-definition:${instanceId}:root`,
    rootModifiers: [],
    chargeId: null,
    features: [{ source, sourceChargeUse: null }]
  }
}

describe('D&D 5e 2014 Character proficiency provenance', () => {
  it('matches legacy ordered Sheet additions without mutating grant-fold evidence', async () => {
    const snapshot: CharacterBuildSnapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [],
      equipmentItems: [],
      adjustments: [
        {
          id: 'language-elvish',
          family: 'PROFICIENCY',
          proficiencyKind: 'LANGUAGE',
          targetId: 'elvish',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'armor-light',
          family: 'PROFICIENCY',
          proficiencyKind: 'ARMOR',
          targetId: 'light',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'tool-thieves',
          family: 'PROFICIENCY',
          proficiencyKind: 'TOOL',
          targetId: 'thieves-tools',
          field: 'ADDITION',
          value: true
        },
        {
          id: 'weapon-longsword',
          family: 'PROFICIENCY',
          proficiencyKind: 'WEAPON',
          targetId: 'longsword',
          field: 'ADDITION',
          value: true
        }
      ]
    }
    const registry: CharacterAssemblyRegistry = {
      classes: {},
      features: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {}
    }
    const base = canonicalInput()
    const input = characterRulePolicyInputSchema.parse({
      ...base,
      ...buildCharacterProficiencyRuleFacts(snapshot)
    })
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: input
    })
    const output = characterRulePolicyOutputSchema.parse(evaluated.result)

    expect(output.proficiencies).toEqual([
      {
        kind: 'LANGUAGE',
        subjectId: 'elvish',
        scaling: 'FULL',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'language-elvish' }
      },
      {
        kind: 'EQUIPMENT',
        subjectId: 'light',
        scaling: 'FULL',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'armor-light' }
      },
      {
        kind: 'EQUIPMENT',
        subjectId: 'thieves-tools',
        scaling: 'FULL',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'tool-thieves' }
      },
      {
        kind: 'EQUIPMENT',
        subjectId: 'longsword',
        scaling: 'FULL',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'weapon-longsword' }
      }
    ])
    expect(output.grantFold.proficiencies).toEqual([])
  })

  it('distinguishes identical grants from two equipment instances', async () => {
    const base = canonicalInput()
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      ...base.grantFoldFacts,
      base: {
        ...base.grantFoldFacts.base,
        totalLevel: 5,
        abilities: { WISDOM: 16 },
        equipment: [
          {
            equipmentId: 'item-definition',
            category: null,
            properties: [],
            equipped: true,
            attuned: false
          }
        ]
      },
      equipmentItems: [equipmentItem('item-1'), equipmentItem('item-2')]
    })
    const input = characterRulePolicyInputSchema.parse({
      ...base,
      totalLevel: 5,
      grantFoldFacts,
      derivedBaseFacts: {
        abilities: [{ abilityId: 'WISDOM', baseScore: 16, bonuses: [], scoreOverride: null }],
        savingThrows: [],
        skills: [
          {
            skillId: 'perception',
            governingAbilityId: 'WISDOM',
            governingAbilityIndex: 0,
            governingAbilityOverride: null,
            proficiencySubjectIds: ['perception'],
            proficiencyOverride: null,
            bonuses: [
              { kind: 'PROFICIENCY', sourceId: 'perception-proficiency', operation: 'ADD' }
            ],
            totalOverride: null,
            passiveOverride: null
          }
        ],
        initiative: { abilityId: 'WISDOM', abilityIndex: 0, bonuses: [] },
        spellcasting: null
      },
      proficiencyFacts: {
        manualAdditions: [
          {
            sourceId: 'manual-perception',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-perception' },
            proficiencyKind: 'TOOL',
            targetId: 'perception'
          },
          {
            sourceId: 'manual-language',
            source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-language' },
            proficiencyKind: 'LANGUAGE',
            targetId: 'elvish'
          }
        ]
      }
    })

    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: input
    })
    const output = characterRulePolicyOutputSchema.parse(evaluated.result)
    const proficiency = output.derivedStats.skills[0]?.proficiency

    expect(output.grantFold.proficiencies).toMatchObject([
      {
        acceptedProficiencyIndex: 0,
        grantId: 'shared-perception-grant',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-1' }
      },
      {
        acceptedProficiencyIndex: 1,
        grantId: 'shared-perception-grant',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-2' }
      }
    ])
    expect(proficiency?.contributions).toMatchObject([
      {
        acceptedProficiencyIndex: 0,
        state: 'APPLIED',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-1' }
      },
      {
        acceptedProficiencyIndex: 1,
        state: 'SUPPRESSED',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-2' }
      }
    ])
    expect(output.derivedStats.skills[0]?.total).toMatchObject({
      effective: 6,
      contributions: [
        { source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-1' }, value: 3 }
      ]
    })
    expect(output.proficiencies).toMatchObject([
      {
        kind: 'SKILL',
        subjectId: 'skill-perception-record',
        grantId: 'shared-perception-grant',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-1' }
      },
      {
        kind: 'SKILL',
        subjectId: 'skill-perception-record',
        grantId: 'shared-perception-grant',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-2' }
      },
      {
        kind: 'EQUIPMENT',
        subjectId: 'perception',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-perception' }
      },
      {
        kind: 'LANGUAGE',
        subjectId: 'elvish',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-language' }
      }
    ])
    expect(output.grantFold.proficiencies).toHaveLength(2)
  })

  it('retains an authored and manual proficiency collision in source order', async () => {
    const base = canonicalInput()
    const grantFoldFacts = characterGrantFoldInputSchema.parse({
      ...base.grantFoldFacts,
      base: {
        ...base.grantFoldFacts.base,
        equipment: [
          {
            equipmentId: 'item-definition',
            category: null,
            properties: [],
            equipped: true,
            attuned: false
          }
        ]
      },
      equipmentItems: [equipmentItem('item-1', 'EQUIPMENT', 'light', 'light')]
    })
    const output = characterRulePolicyOutputSchema.parse(
      (
        await evaluateZenRuleModel({
          document: dnd5e2014CharacterPolicyDocument,
          modelKey: 'character-policy',
          context: characterRulePolicyInputSchema.parse({
            ...base,
            grantFoldFacts,
            proficiencyFacts: {
              manualAdditions: [
                {
                  sourceId: 'manual-light',
                  source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-light' },
                  proficiencyKind: 'ARMOR',
                  targetId: 'light'
                }
              ]
            }
          })
        })
      ).result
    )

    expect(output.proficiencies).toMatchObject([
      {
        kind: 'EQUIPMENT',
        subjectId: 'light',
        grantId: 'shared-perception-grant',
        source: { kind: 'EQUIPMENT_INSTANCE', itemInstanceId: 'item-1' }
      },
      {
        kind: 'EQUIPMENT',
        subjectId: 'light',
        source: { kind: 'MANUAL_ADJUSTMENT', adjustmentId: 'manual-light' }
      }
    ])
    expect(output.grantFold.proficiencies).toHaveLength(1)
  })
})
