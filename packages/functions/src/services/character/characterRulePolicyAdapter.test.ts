import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import { compileEquipment } from '@artificer-toolkit/shared/compilers'

import { dnd5e2014CharacterGrantFoldEmptyInput } from '../rules/systems/dnd5e/2014/characterGrantFoldSource.js'
import { dnd5e2014CharacterPolicyDocument } from '../rules/systems/dnd5e/2014/characterPolicy.js'
import { evaluateZenRuleModel } from '../rules/zenRuleEngine.js'
import { projectCharacterRulePolicyToSheetProjection } from './characterRulePolicyAdapter.js'

const snapshot: CharacterBuildSnapshot = {
  characterId: 'character-1',
  systemId: 'dnd5e2014',
  totalLevel: 1,
  classes: [],
  abilities: {},
  hitpoints: [],
  features: [],
  equipmentItems: []
}

const registry: CharacterAssemblyRegistry = {
  backgrounds: {},
  classes: {},
  equipment: {},
  feats: {},
  features: {},
  races: {},
  spells: {}
}

function facts() {
  return characterRulePolicyInputSchema.parse({
    contractVersion: 4,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: 1,
    derivedBaseFacts: {
      abilities: [],
      savingThrows: [],
      skills: [],
      initiative: { abilityId: 'DEXTERITY', abilityIndex: null, bonuses: [] },
      spellcasting: null
    },
    spellAccessCandidates: [],
    spellClasses: [],
    spellPreparationClasses: [],
    spellPreparationCatalog: [],
    spellPreparationRequest: null,
    spellCastCandidates: [],
    spellCastSlots: [],
    spellCastResources: [],
    spellcastingClasses: [],
    chargeCalculations: [],
    resourcePoolCandidates: [],
    actionCandidates: [],
    eligibilityFacets: [],
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null }
  })
}

async function baseOutput(input = facts()) {
  const evaluated = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: input
  })
  return { input, output: characterRulePolicyOutputSchema.parse(evaluated.result) }
}

describe('projectCharacterRulePolicyToSheetProjection', () => {
  it('adapts a real policy evaluation and uses the calculated proficiency value', async () => {
    const { input, output } = await baseOutput()
    const adapted = projectCharacterRulePolicyToSheetProjection({
      snapshot,
      registry,
      facts: input,
      output
    })

    expect(adapted.derivedStats.proficiencyBonus).toBe(
      output.derivedStats.proficiencyBonus.effective
    )
    expect(adapted.spellState).toBeUndefined()
    expect(adapted.systemId).toBe('dnd5e2014')
    expect(adapted.senses).toEqual([])
  })

  it('restores folded non-distance senses and exact active item domain keys', async () => {
    const { input, output } = await baseOutput()
    const item = compileEquipment({
      kind: 'EQUIPMENT',
      id: 'item-1',
      label: 'Item',
      description: '',
      userId: 'user-1',
      systemId: 'dnd5e2014',
      category: 'ADVENTURING_GEAR',
      properties: [],
      rarityId: 'COMMON'
    })
    const itemSnapshot: CharacterBuildSnapshot = {
      ...snapshot,
      equipmentItems: [
        {
          instanceId: 'item-instance',
          contentRef: { definitionId: item.id, binding: { kind: 'ACTIVE' }, systemId: 'dnd5e2014' },
          attuned: false,
          compiledItem: item
        }
      ]
    }
    const targeted = characterRulePolicyOutputSchema.parse({
      ...output,
      senses: [{ senseCode: 'SPECIAL_SENSE', range: null }],
      grantFold: {
        ...output.grantFold,
        activeEquipmentInstanceIds: ['item-instance'],
        senses: [
          {
            senseCode: 'SPECIAL_SENSE',
            range: { id: 'sense-self', rangeKind: 'SELF' },
            acceptedSenseIndex: 0,
            grantId: 'sense-grant',
            source: { kind: 'SYSTEM', systemId: 'dnd5e2014' }
          }
        ],
        modifiers: [
          {
            domainKey: 'SPEED|speedId=walk',
            modifierKind: 'BONUS',
            grant: {},
            source: {
              kind: 'EQUIPMENT_INSTANCE',
              equipmentId: item.id,
              itemInstanceId: 'item-instance'
            }
          }
        ],
        modifierGroups: [
          {
            domainKey: 'SPEED|speedId=walk',
            valueDomainCode: 'SPEED',
            modifierKind: 'BONUS',
            contributions: [
              {
                acceptedModifierIndex: 0,
                sourceId: 'item-modifier',
                grantId: 'item-grant',
                grant: {}
              }
            ]
          }
        ]
      }
    })
    const adapted = projectCharacterRulePolicyToSheetProjection({
      snapshot: itemSnapshot,
      registry: { ...registry, equipment: { [item.id]: item } },
      facts: input,
      output: targeted
    })
    expect(adapted.senses).toEqual([
      { senseCode: 'SPECIAL_SENSE', range: { id: 'sense-self', rangeKind: 'SELF' } }
    ])
    expect(adapted.activeItemContributions).toEqual([
      {
        instanceId: 'item-instance',
        contentRef: itemSnapshot.equipmentItems[0]!.contentRef,
        modifiersApplied: ['SPEED|speedId=walk']
      }
    ])
  })

  it('rehydrates skill override source IDs as adjustment IDs', async () => {
    const input = facts()
    input.derivedBaseFacts.skills.push({
      skillId: 'athletics',
      governingAbilityId: 'STRENGTH',
      governingAbilityIndex: null,
      governingAbilityOverride: {
        sourceId: 'adjustment-1',
        value: 'DEXTERITY',
        abilityIndex: null
      },
      proficiencySubjectIds: ['athletics'],
      proficiencyOverride: null,
      bonuses: [],
      totalOverride: null,
      passiveOverride: null
    })
    const { output } = await baseOutput(input)
    const adapted = projectCharacterRulePolicyToSheetProjection({
      snapshot,
      registry,
      facts: input,
      output
    })
    expect(adapted.calculations.skillGoverningAbilities.athletics?.override).toEqual({
      adjustmentId: 'adjustment-1',
      value: 'DEXTERITY'
    })
  })

  it('fails closed when a policy spell charge cannot be rehydrated from the registry', async () => {
    const { input, output } = await baseOutput()
    const targeted = characterRulePolicyOutputSchema.parse({
      ...output,
      spellAccess: [
        {
          sequence: 0,
          accessId: 'access-1',
          sourceInstanceId: 'source-1',
          spellId: 'spell-1',
          sourceFeatureId: 'feature-1',
          grantId: 'grant-1',
          sourceKind: 'CLASS',
          sourceId: 'class-1',
          owningClassId: 'class-1',
          timingKind: 'CLASS_LEVEL',
          timingLevel: 1,
          attributes: [],
          acquisition: 'GRANTED',
          castMode: 'LIMITED_USE',
          castAtLevel: null,
          castingAbility: null,
          charge: { id: 'charge-1', limitKind: 'FIXED_AMOUNT', resetKind: 'LONG_REST' },
          learned: false,
          prepared: false
        }
      ]
    })
    expect(() =>
      projectCharacterRulePolicyToSheetProjection({
        snapshot,
        registry,
        facts: input,
        output: targeted
      })
    ).toThrow('Character rule policy spell charge is missing or mismatched: access-1')
  })
})
