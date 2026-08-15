import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'

import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

function policyFacts(overrides: Partial<CharacterRulePolicyInput> = {}): CharacterRulePolicyInput {
  const spellActionFacts =
    overrides.spellActionFacts ??
    [...new Set((overrides.spellCastCandidates ?? []).map((candidate) => candidate.spellId))].map(
      (spellId) => ({ spellId, effects: [] })
    )
  return {
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
    rest: { totalHitDice: 0, currentExhaustion: 0, attunementSlotOverride: null },
    ...overrides,
    spellActionFacts,
    spellMechanicsFacts: overrides.spellMechanicsFacts ?? { snapshotSources: [], adjustments: [] },
    itemMechanicsFacts: overrides.itemMechanicsFacts ?? { items: [], adjustments: [] },
    companionMechanicsFacts: overrides.companionMechanicsFacts ?? {
      companions: [],
      adjustments: []
    },
    defenseFacts: overrides.defenseFacts ?? { manualAdditions: [] },
    proficiencyFacts: overrides.proficiencyFacts ?? { manualAdditions: [] }
  }
}

function spellCastIdentity(candidateId: string) {
  return {
    candidateId,
    spellId: 'spell-1',
    source: {
      spellId: 'spell-1',
      sourceKind: 'CLASS' as const,
      sourceInstanceId: 'class-source-1'
    }
  }
}

describe('D&D 5e 2014 Character spell cast policy', () => {
  it('resolves cast-level effects from same-evaluation spell mechanics', async () => {
    const source = {
      spellId: 'fire-spell',
      sourceKind: 'CLASS' as const,
      sourceInstanceId: 'wizard-source'
    }
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        totalLevel: 5,
        derivedBaseFacts: {
          abilities: [
            {
              abilityId: 'INTELLIGENCE',
              baseScore: 18,
              bonuses: [],
              scoreOverride: null
            }
          ],
          savingThrows: [],
          skills: [],
          initiative: { abilityId: 'DEXTERITY', abilityIndex: null, bonuses: [] },
          spellcasting: {
            abilityId: 'INTELLIGENCE',
            abilityIndex: 0,
            saveDcBonuses: [],
            attackBonuses: []
          }
        },
        spellMechanicsFacts: {
          snapshotSources: [{ ...source, sequence: 0 }],
          adjustments: [
            { sequence: 0, id: 'spell-damage', source, field: 'DAMAGE_BONUS', value: 2 }
          ]
        },
        spellCastCandidates: [
          {
            sequence: 0,
            candidateId: 'fire-spell:level:3',
            spellId: 'fire-spell',
            source,
            spellLevel: 1,
            castMode: 'AT_WILL',
            castLevel: 3,
            baseEntry: true,
            resourceOwnerKey: null
          }
        ],
        spellActionFacts: [
          {
            spellId: 'fire-spell',
            effects: [
              {
                effectId: 'fire-effect',
                mechanicFacts: {
                  invocation: {
                    triggerCode: 'SPELL_ATTACK',
                    activation: { code: 'ACTION', amount: 1 },
                    range: { rangeKind: 'DISTANCE', amount: 120, unit: 'FEET' },
                    savingThrow: null
                  },
                  outcomes: [
                    {
                      kind: 'DAMAGE',
                      pathCode: 'ON_SUCCESS',
                      label: null,
                      damageTypeId: 'fire',
                      valueKind: 'DICE',
                      scalingKind: 'BREAKPOINTS',
                      scalingSource: 'SPELL_CAST_LEVEL',
                      classId: null,
                      amountKind: null,
                      amountMultiplier: null,
                      values: [
                        {
                          level: 1,
                          order: 0,
                          amount: null,
                          dice: '1d8',
                          multiplier: null,
                          minimum: null,
                          maximum: null
                        },
                        {
                          level: 3,
                          order: 1,
                          amount: null,
                          dice: '2d8',
                          multiplier: null,
                          minimum: null,
                          maximum: null
                        }
                      ],
                      bonuses: []
                    }
                  ]
                }
              }
            ]
          }
        ]
      })
    })
    const output = characterRulePolicyOutputSchema.parse(evaluated.result)

    expect(output.spellCastMechanics).toEqual([
      expect.objectContaining({
        candidateId: 'fire-spell:level:3',
        castLevel: 3,
        mechanics: [
          expect.objectContaining({
            attackBonus: 7,
            outcomes: [expect.objectContaining({ expression: '2d8 + 2' })]
          })
        ]
      })
    ])
  })

  it('matches cast availability branches and preserves request order', async () => {
    const evaluated = await evaluateZenRuleModel({
      document: dnd5e2014CharacterPolicyDocument,
      modelKey: 'character-policy',
      context: policyFacts({
        spellCastCandidates: [
          {
            sequence: 0,
            ...spellCastIdentity('cantrip'),
            spellLevel: 0,
            castMode: 'SPELL_SLOT',
            castLevel: 0,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 1,
            ...spellCastIdentity('at-will'),
            spellLevel: 1,
            castMode: 'AT_WILL',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 2,
            ...spellCastIdentity('ritual'),
            spellLevel: 1,
            castMode: 'RITUAL',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 3,
            ...spellCastIdentity('fixed-free'),
            spellLevel: 1,
            castMode: 'FIXED_LEVEL',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 4,
            ...spellCastIdentity('limited-missing'),
            spellLevel: 1,
            castMode: 'LIMITED_USE',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 5,
            ...spellCastIdentity('resource-ready'),
            spellLevel: 1,
            castMode: 'LIMITED_USE',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: 'ready'
          },
          {
            sequence: 6,
            ...spellCastIdentity('resource-empty'),
            spellLevel: 1,
            castMode: 'FIXED_LEVEL',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: 'empty'
          },
          {
            sequence: 7,
            ...spellCastIdentity('base-fallback'),
            spellLevel: 1,
            castMode: 'SPELL_SLOT',
            castLevel: 1,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 8,
            ...spellCastIdentity('upcast-exact'),
            spellLevel: 1,
            castMode: 'SPELL_SLOT',
            castLevel: 2,
            baseEntry: false,
            resourceOwnerKey: null
          },
          {
            sequence: 9,
            ...spellCastIdentity('slot-exhausted'),
            spellLevel: 3,
            castMode: 'SPELL_SLOT',
            castLevel: 3,
            baseEntry: true,
            resourceOwnerKey: null
          },
          {
            sequence: 10,
            ...spellCastIdentity('no-slot'),
            spellLevel: 4,
            castMode: 'SPELL_SLOT',
            castLevel: 4,
            baseEntry: true,
            resourceOwnerKey: null
          }
        ],
        spellcastingClasses: [
          {
            classId: 'wizard',
            classLevel: 3,
            resetKind: 'LONG_REST',
            spellLimits: [
              {
                classLevel: 3,
                slots: [
                  { spellLevel: 1, slotCount: 4 },
                  { spellLevel: 2, slotCount: 3 },
                  { spellLevel: 3, slotCount: 2 }
                ]
              }
            ]
          }
        ],
        spellSlotUsageFacts: [
          { kind: 'STANDARD', spellLevel: 1, rawUsed: 4 },
          { kind: 'STANDARD', spellLevel: 2, rawUsed: 2 },
          { kind: 'STANDARD', spellLevel: 3, rawUsed: 2 }
        ],
        chargeCalculations: [
          {
            calculationId: 'ready',
            sourceId: 'ready:charge',
            base: { kind: 'FIXED_AMOUNT', amount: 1 },
            bonuses: []
          },
          {
            calculationId: 'empty',
            sourceId: 'empty:charge',
            base: { kind: 'FIXED_AMOUNT', amount: 1 },
            bonuses: []
          }
        ],
        resourcePoolCandidates: [
          {
            sequence: 0,
            poolId: 'ready',
            ownerKind: 'ITEM_INSTANCE',
            itemInstanceId: 'item-ready',
            sourceId: null,
            chargeId: 'ready-charge',
            resourceDefinitionId: 'ready-charge',
            chargeCalculationId: 'ready',
            baseResetKind: 'LONG_REST'
          },
          {
            sequence: 1,
            poolId: 'empty',
            ownerKind: 'ITEM_INSTANCE',
            itemInstanceId: 'item-empty',
            sourceId: null,
            chargeId: 'empty-charge',
            resourceDefinitionId: 'empty-charge',
            chargeCalculationId: 'empty',
            baseResetKind: 'LONG_REST'
          }
        ],
        resourceUsageFacts: [
          { poolId: 'ready', rawUsed: 0 },
          { poolId: 'empty', rawUsed: 1 }
        ]
      })
    })

    const output = characterRulePolicyOutputSchema.parse(evaluated.result)
    expect(
      output.spellSlots.maxByLevel.map(({ spellLevel, rawUsed, remaining }) => ({
        spellLevel,
        rawUsed,
        remaining
      }))
    ).toEqual([
      { spellLevel: 1, rawUsed: 4, remaining: 0 },
      { spellLevel: 2, rawUsed: 2, remaining: 1 },
      { spellLevel: 3, rawUsed: 2, remaining: 0 }
    ])
    expect(output.spellCastDecisions).toEqual([
      { candidateId: 'cantrip', status: 'AVAILABLE', reasonCode: 'CANTRIP', slotKey: null },
      { candidateId: 'at-will', status: 'AVAILABLE', reasonCode: 'AT_WILL', slotKey: null },
      { candidateId: 'ritual', status: 'AVAILABLE', reasonCode: 'RITUAL', slotKey: null },
      {
        candidateId: 'fixed-free',
        status: 'AVAILABLE',
        reasonCode: 'FIXED_LEVEL_WITHOUT_RESOURCE',
        slotKey: null
      },
      {
        candidateId: 'limited-missing',
        status: 'UNAVAILABLE',
        reasonCode: 'RESOURCE_OWNER_MISSING',
        slotKey: null
      },
      {
        candidateId: 'resource-ready',
        status: 'AVAILABLE',
        reasonCode: 'RESOURCE_REMAINING',
        slotKey: null
      },
      {
        candidateId: 'resource-empty',
        status: 'UNAVAILABLE',
        reasonCode: 'RESOURCE_EXHAUSTED',
        slotKey: null
      },
      {
        candidateId: 'base-fallback',
        status: 'AVAILABLE',
        reasonCode: 'SPELL_SLOT_REMAINING',
        slotKey: 'STANDARD:2'
      },
      {
        candidateId: 'upcast-exact',
        status: 'AVAILABLE',
        reasonCode: 'SPELL_SLOT_REMAINING',
        slotKey: 'STANDARD:2'
      },
      {
        candidateId: 'slot-exhausted',
        status: 'UNAVAILABLE',
        reasonCode: 'SPELL_SLOT_EXHAUSTED',
        slotKey: 'STANDARD:3'
      },
      {
        candidateId: 'no-slot',
        status: 'UNAVAILABLE',
        reasonCode: 'NO_ELIGIBLE_SPELL_SLOT',
        slotKey: null
      }
    ])
  })
})
