import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput,
  type CharacterRulePolicyOutput
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

type AuthoredGrantCandidate = Extract<
  CharacterRulePolicyInput['resourcePoolCandidates'][number],
  { ownerKind: 'AUTHORED_GRANT' }
>
type AuthoredGrantResource = Extract<
  CharacterRulePolicyOutput['resources'][number],
  { ownerKind: 'AUTHORED_GRANT' }
>

function authoredGrantCandidate(
  overrides: Partial<AuthoredGrantCandidate> = {}
): AuthoredGrantCandidate {
  return {
    sequence: 0,
    poolId: 'AUTHORED_GRANT:resource-1',
    resourceDefinitionId: 'resource-1',
    chargeId: 'charge-1',
    chargeCalculationId: 'AUTHORED_GRANT:resource-1',
    baseResetKind: 'LONG_REST',
    ownerKind: 'AUTHORED_GRANT',
    resourceGrantId: 'resource-1',
    availableAtLevel: 1,
    activeSourceLevel: 1,
    ...overrides
  }
}

function authoredGrantResource(
  overrides: Partial<AuthoredGrantResource> = {}
): AuthoredGrantResource {
  return {
    ...authoredGrantCandidate(),
    state: 'RESOLVED',
    maximum: 3,
    rawUsed: 0,
    effectiveUsed: 0,
    remaining: 3,
    reasonCode: 'CALCULATED',
    baseContribution: { sourceId: 'resource-base', value: 3 },
    bonusContributions: [],
    resetKind: 'LONG_REST',
    resetResolution: { baseResetKind: 'LONG_REST', appliedGrantId: null, source: null },
    ...overrides
  }
}

function compiledClass(
  id: string,
  resource?: { availableAtLevel: number; id: string }
): CharacterAssemblyRegistry['classes'][string] {
  return {
    category: 'SUBCLASS',
    id,
    parentClassId: 'parent-class',
    ...(resource
      ? {
          resources: {
            id: resource.id,
            label: 'Class Resource',
            availableAtLevel: resource.availableAtLevel,
            charges: {
              id: 'charge-1',
              resetKind: 'LONG_REST',
              limitKind: 'FIXED_AMOUNT',
              scalingKind: 'NONE',
              amount: 3
            }
          }
        }
      : {})
  }
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

async function resourceEvaluation(input: {
  candidates: AuthoredGrantCandidate[]
  ownerKind?: 'CLASS' | 'SUBCLASS'
  resources: AuthoredGrantResource[]
}) {
  const ownerKind = input.ownerKind ?? 'CLASS'
  const policyInput = facts()
  policyInput.resourcePoolCandidates = input.candidates
  const { output } = await baseOutput(policyInput)
  return {
    snapshot: {
      ...snapshot,
      classes: [
        {
          classId: 'class-1',
          level: 1,
          ...(ownerKind === 'SUBCLASS' ? { subclassId: 'subclass-1' } : {})
        }
      ]
    },
    registry: {
      ...registry,
      classes: {
        'class-1': compiledClass(
          'class-1',
          ownerKind === 'CLASS' ? { availableAtLevel: 1, id: 'resource-1' } : undefined
        ),
        ...(ownerKind === 'SUBCLASS'
          ? {
              'subclass-1': compiledClass('subclass-1', {
                availableAtLevel: 1,
                id: 'resource-1'
              })
            }
          : {})
      }
    },
    facts: policyInput,
    output: { ...output, resources: input.resources }
  }
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
      senses: [{ senseDefinitionId: '00000000-0000-4000-8000-000000000010', range: null }],
      grantFold: {
        ...output.grantFold,
        activeEquipmentInstanceIds: ['item-instance'],
        senses: [
          {
            senseDefinitionId: '00000000-0000-4000-8000-000000000010',
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
      {
        senseDefinitionId: '00000000-0000-4000-8000-000000000010',
        range: { id: 'sense-self', rangeKind: 'SELF' }
      }
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

  it.each(['CLASS', 'SUBCLASS'] as const)(
    'omits a future inactive %s resource without requiring rule output',
    async (ownerKind) => {
      const evaluation = await resourceEvaluation({
        candidates: [authoredGrantCandidate({ activeSourceLevel: 1, availableAtLevel: 2 })],
        ownerKind,
        resources: []
      })

      expect(projectCharacterRulePolicyToSheetProjection(evaluation).resources).toEqual([])
    }
  )

  it('fails closed when an active resource is missing from rule output', async () => {
    const evaluation = await resourceEvaluation({
      candidates: [authoredGrantCandidate()],
      resources: []
    })

    expect(() => projectCharacterRulePolicyToSheetProjection(evaluation)).toThrow(
      'Character rule policy class resource is missing: AUTHORED_GRANT:resource-1'
    )
  })

  it.each([
    { candidates: [], state: 'missing' },
    {
      candidates: [
        authoredGrantCandidate(),
        authoredGrantCandidate({
          sequence: 1,
          poolId: 'AUTHORED_GRANT:resource-2',
          chargeCalculationId: 'AUTHORED_GRANT:resource-2',
          resourceGrantId: 'resource-2'
        })
      ],
      state: 'ambiguous'
    }
  ])('fails closed when resource candidate ownership is $state', async ({ candidates, state }) => {
    const evaluation = await resourceEvaluation({ candidates, resources: [] })

    expect(() => projectCharacterRulePolicyToSheetProjection(evaluation)).toThrow(
      `Character rule policy class resource ownership is ${state}: class-1`
    )
  })

  it('preserves active resolved resource mapping', async () => {
    const evaluation = await resourceEvaluation({
      candidates: [authoredGrantCandidate()],
      resources: [authoredGrantResource()]
    })

    expect(projectCharacterRulePolicyToSheetProjection(evaluation).resources).toEqual([
      {
        resourceId: 'resource-1',
        label: 'Class Resource',
        maxCount: 3,
        maxCountCalculation: { base: 3, effective: 3, contributions: [] },
        rechargeOn: 'LONG_REST',
        sourceFeatureId: 'class-1'
      }
    ])
  })

  it('fails closed when active rule output is ambiguous', async () => {
    const resource = authoredGrantResource()
    const evaluation = await resourceEvaluation({
      candidates: [authoredGrantCandidate()],
      resources: [resource, resource]
    })

    expect(() => projectCharacterRulePolicyToSheetProjection(evaluation)).toThrow(
      'Character rule policy class resource is ambiguous: AUTHORED_GRANT:resource-1'
    )
  })
})
