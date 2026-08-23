import { describe, expect, it } from 'vitest'

import {
  characterRulePolicyOutputSchema,
  type CharacterRulePolicyInput
} from '@artificer-toolkit/schema/api/characterRules'

import { dnd5e2014CharacterPolicyDocument } from './characterPolicy.js'
import { dnd5e2014CharacterGrantFoldEmptyInput } from './characterGrantFoldSource.js'
import { evaluateZenRuleModel } from '../../../zenRuleEngine.js'

type PreparationClass = CharacterRulePolicyInput['spellPreparationClasses'][number]
type PreparationSource = PreparationClass['sources'][number]

function source(sourceId: string, overrides: Partial<PreparationSource> = {}): PreparationSource {
  return {
    sourceKind: 'CLASS',
    sourceId,
    attributes: ['PREPARES_SPELLS'],
    abilityIndex: null,
    spellLimits: [{ classLevel: 1, preparedSpellsLimit: null, spellLevels: [1] }],
    prepareLimit: null,
    ...overrides
  }
}

function preparationClass(
  classId: string,
  classLevel: number,
  sources: PreparationSource[],
  overrides: Partial<PreparationClass> = {}
): PreparationClass {
  return {
    classId,
    classLevel,
    sources,
    learnedStatePresent: false,
    learnedStateSpellIds: [],
    intentSpellIds: [],
    preparedStateSpellIds: [],
    ...overrides
  }
}

function policyFacts(overrides: Partial<CharacterRulePolicyInput> = {}): CharacterRulePolicyInput {
  return {
    contractVersion: 4,
    grantFoldFacts: dnd5e2014CharacterGrantFoldEmptyInput,
    totalLevel: 1,
    derivedBaseFacts: {
      abilities: [
        { abilityId: 'INTELLIGENCE', baseScore: 16, bonuses: [], scoreOverride: null },
        { abilityId: 'WISDOM', baseScore: 8, bonuses: [], scoreOverride: null }
      ],
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
    rest: {
      totalHitDice: 0,
      currentExhaustion: 0,
      attunementSlotOverride: null
    },
    ...overrides,
    spellActionFacts: overrides.spellActionFacts ?? [],
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

async function evaluatePreparation(input: CharacterRulePolicyInput) {
  const evaluated = await evaluateZenRuleModel({
    document: dnd5e2014CharacterPolicyDocument,
    modelKey: 'character-policy',
    context: input
  })
  return characterRulePolicyOutputSchema.parse(evaluated.result)
}

describe('D&D 5e 2014 Character spell preparation policy', () => {
  it('resolves every preparation-limit branch and filters class spell state', async () => {
    const result = await evaluatePreparation(
      policyFacts({
        totalLevel: 20,
        spellPreparationClasses: [
          preparationClass(
            'wizard',
            5,
            [
              source('wizard', {
                abilityIndex: 0,
                spellLimits: [
                  { classLevel: 1, preparedSpellsLimit: 2, spellLevels: [1] },
                  { classLevel: 3, preparedSpellsLimit: 4, spellLevels: [1, 2] },
                  { classLevel: 7, preparedSpellsLimit: 9, spellLevels: [1, 2, 3, 4] }
                ],
                prepareLimit: {
                  methodKinds: ['CLASS_LEVEL', 'SPELLCASTING_ABILITY'],
                  scaling: 'FULL',
                  rounding: null,
                  perLevel: []
                }
              }),
              source('school-of-magic', {
                sourceKind: 'SUBCLASS',
                attributes: [],
                spellLimits: [
                  { classLevel: 1, preparedSpellsLimit: null, spellLevels: [1] },
                  { classLevel: 5, preparedSpellsLimit: null, spellLevels: [1, 2, 3] }
                ],
                prepareLimit: {
                  methodKinds: ['PER_LEVEL'],
                  scaling: null,
                  rounding: null,
                  perLevel: [
                    { classLevel: 1, amount: 2 },
                    { classLevel: 5, amount: 6 },
                    { classLevel: 7, amount: 9 }
                  ]
                }
              })
            ],
            {
              learnedStatePresent: true,
              learnedStateSpellIds: [],
              intentSpellIds: ['valid-1', 'selected-high', 'wizard-cantrip'],
              preparedStateSpellIds: ['valid-1', 'stale-spell']
            }
          ),
          preparationClass('explicit-zero', 3, [
            source('explicit-zero', {
              spellLimits: [{ classLevel: 1, preparedSpellsLimit: 0, spellLevels: [1] }],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'FULL',
                rounding: null,
                perLevel: []
              }
            })
          ]),
          preparationClass('ability-full', 3, [
            source('ability-full', {
              attributes: [],
              abilityIndex: 0,
              prepareLimit: {
                methodKinds: ['SPELLCASTING_ABILITY', 'CLASS_LEVEL'],
                scaling: 'FULL',
                rounding: null,
                perLevel: []
              }
            })
          ]),
          preparationClass('half-up', 3, [
            source('half-up', {
              attributes: [],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'HALF',
                rounding: 'UP',
                perLevel: []
              }
            })
          ]),
          preparationClass('half-down', 3, [
            source('half-down', {
              attributes: [],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'HALF',
                rounding: 'DOWN',
                perLevel: []
              }
            })
          ]),
          preparationClass('half-nearest', 3, [
            source('half-nearest', {
              attributes: [],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'HALF',
                rounding: 'NEAREST',
                perLevel: []
              }
            })
          ]),
          preparationClass('double', 2, [
            source('double', {
              attributes: [],
              prepareLimit: {
                methodKinds: ['CLASS_LEVEL'],
                scaling: 'DOUBLE',
                rounding: null,
                perLevel: []
              }
            })
          ]),
          preparationClass('per-level', 4, [
            source('per-level', {
              attributes: [],
              prepareLimit: {
                methodKinds: ['PER_LEVEL'],
                scaling: null,
                rounding: null,
                perLevel: [
                  { classLevel: 1, amount: 2 },
                  { classLevel: 3, amount: 5 },
                  { classLevel: 7, amount: 9 }
                ]
              }
            })
          ]),
          preparationClass('formula-floor', 1, [
            source('formula-floor', {
              attributes: [],
              abilityIndex: 1,
              prepareLimit: {
                methodKinds: ['SPELLCASTING_ABILITY'],
                scaling: null,
                rounding: null,
                perLevel: []
              }
            })
          ]),
          preparationClass('fighter', 5, [
            source('fighter', {
              attributes: [],
              spellLimits: [{ classLevel: 1, preparedSpellsLimit: 0, spellLevels: [] }]
            })
          ])
        ],
        spellPreparationCatalog: [
          { spellId: 'valid-1', spellLevel: 1, classIds: ['wizard'] },
          { spellId: 'valid-2', spellLevel: 3, classIds: ['school-of-magic'] },
          { spellId: 'selected-high', spellLevel: 8, classIds: ['wizard'] },
          { spellId: 'stale-spell', spellLevel: 1, classIds: ['cleric'] },
          { spellId: 'wizard-cantrip', spellLevel: 0, classIds: ['wizard'] }
        ]
      })
    )

    expect(result.spellPreparation.sources).toEqual([
      {
        classId: 'wizard',
        sourceIds: ['wizard', 'school-of-magic'],
        preparedSpellLimit: 6,
        maxPreparableSpellLevel: 3,
        availableSpellIds: ['valid-1', 'valid-2', 'selected-high', 'wizard-cantrip'],
        learnedSpellIds: [],
        preparedSpellIds: ['valid-1']
      },
      expect.objectContaining({ classId: 'explicit-zero', preparedSpellLimit: 0 }),
      expect.objectContaining({ classId: 'ability-full', preparedSpellLimit: 6 }),
      expect.objectContaining({ classId: 'half-up', preparedSpellLimit: 2 }),
      expect.objectContaining({ classId: 'half-down', preparedSpellLimit: 1 }),
      expect.objectContaining({ classId: 'half-nearest', preparedSpellLimit: 2 }),
      expect.objectContaining({ classId: 'double', preparedSpellLimit: 4 }),
      expect.objectContaining({ classId: 'per-level', preparedSpellLimit: 5 }),
      expect.objectContaining({ classId: 'formula-floor', preparedSpellLimit: 1 })
    ])
    expect(result.spellPreparation.requestDecision).toBeNull()
  })

  it('uses same-evaluation resolved ability scores for spellcasting-ability limits', async () => {
    const result = await evaluatePreparation(
      policyFacts({
        grantFoldFacts: {
          ...dnd5e2014CharacterGrantFoldEmptyInput,
          features: [
            {
              sourceKind: 'FEATURE',
              sourceClassLevel: null,
              timingLevel: null,
              definition: {
                sourceId: 'ability-feature',
                mechanicSource: { kind: 'SYSTEM', systemId: 'dnd5e2014' },
                sourceState: null,
                restrictions: [],
                proficiencies: [],
                senses: [],
                modifiers: [
                  {
                    grantId: 'intelligence-bonus',
                    valueDomainCode: 'ABILITY_SCORE',
                    modifierKind: 'BONUS',
                    domain: { ability: 'INTELLIGENCE' },
                    grant: { payload: { valueKind: 'FIXED', amount: 4 } },
                    restrictions: [],
                    scopeSpellIds: []
                  }
                ],
                feats: [],
                spells: []
              },
              selectedOptions: [],
              featDefinition: null
            }
          ]
        },
        derivedBaseFacts: {
          abilities: [
            {
              abilityId: 'INTELLIGENCE',
              baseScore: 10,
              bonuses: [
                {
                  kind: 'MODIFIER_GROUP',
                  sourceId: 'intelligence-bonus',
                  domainKey: 'ABILITY_SCORE:BONUS|ability=INTELLIGENCE',
                  operation: 'ADD'
                }
              ],
              scoreOverride: null
            }
          ],
          savingThrows: [],
          skills: [],
          initiative: { abilityId: 'INTELLIGENCE', abilityIndex: 0, bonuses: [] },
          spellcasting: null
        },
        spellPreparationClasses: [
          preparationClass('wizard', 1, [
            source('wizard', {
              abilityIndex: 0,
              attributes: [],
              prepareLimit: {
                methodKinds: ['SPELLCASTING_ABILITY'],
                scaling: null,
                rounding: null,
                perLevel: []
              }
            })
          ])
        ]
      })
    )

    expect(result.spellPreparation.sources).toEqual([
      expect.objectContaining({ classId: 'wizard', preparedSpellLimit: 2 })
    ])
  })

  it('retains only selected learned spells for a known-only class source', async () => {
    const knownOnlyFacts = policyFacts({
      spellPreparationClasses: [
        preparationClass(
          'warlock',
          1,
          [
            source('warlock', {
              attributes: ['LIMIT_KNOWN_SPELL_AMOUNT'],
              spellLimits: [{ classLevel: 1, preparedSpellsLimit: null, spellLevels: [1] }]
            })
          ],
          {
            intentSpellIds: ['known-cantrip', 'known-spell']
          }
        )
      ],
      spellPreparationCatalog: [
        { spellId: 'known-cantrip', spellLevel: 0, classIds: ['warlock'] },
        { spellId: 'known-spell', spellLevel: 1, classIds: ['warlock'] },
        { spellId: 'unselected-spell', spellLevel: 1, classIds: ['warlock'] }
      ]
    })
    const result = await evaluatePreparation(knownOnlyFacts)

    expect(result.spellPreparation.sources).toEqual([
      {
        classId: 'warlock',
        sourceIds: ['warlock'],
        preparedSpellLimit: null,
        maxPreparableSpellLevel: 0,
        availableSpellIds: ['known-cantrip', 'known-spell'],
        learnedSpellIds: ['known-cantrip', 'known-spell'],
        preparedSpellIds: []
      }
    ])

    const rejected = await evaluatePreparation({
      ...knownOnlyFacts,
      spellPreparationRequest: { classId: 'warlock', spellIds: ['known-spell'] }
    })
    expect(rejected.spellPreparation.requestDecision).toEqual({
      classId: 'warlock',
      requestedSpellIds: ['known-spell'],
      status: 'REJECTED',
      reasonCode: 'CLASS_DOES_NOT_PREPARE_SPELLS',
      unavailableSpellId: null
    })

    const cleared = await evaluatePreparation({
      ...knownOnlyFacts,
      spellPreparationRequest: { classId: 'warlock', spellIds: [] }
    })
    expect(cleared.spellPreparation.requestDecision).toEqual({
      classId: 'warlock',
      requestedSpellIds: [],
      status: 'ALLOWED',
      reasonCode: 'REQUEST_ALLOWED',
      unavailableSpellId: null
    })
  })

  it.each([
    {
      request: { classId: 'missing', spellIds: [] },
      expected: {
        classId: 'missing',
        requestedSpellIds: [],
        status: 'REJECTED',
        reasonCode: 'CLASS_NOT_ACTIVE',
        unavailableSpellId: null
      }
    },
    {
      request: { classId: 'fighter', spellIds: ['valid-1'] },
      expected: {
        classId: 'fighter',
        requestedSpellIds: ['valid-1'],
        status: 'REJECTED',
        reasonCode: 'CLASS_DOES_NOT_PREPARE_SPELLS',
        unavailableSpellId: null
      }
    },
    {
      request: { classId: 'wizard', spellIds: ['valid-1', 'valid-2'] },
      expected: {
        classId: 'wizard',
        requestedSpellIds: ['valid-1', 'valid-2'],
        status: 'REJECTED',
        reasonCode: 'PREPARATION_LIMIT_EXCEEDED',
        unavailableSpellId: null
      }
    },
    {
      request: { classId: 'wizard', spellIds: ['missing-spell'] },
      expected: {
        classId: 'wizard',
        requestedSpellIds: ['missing-spell'],
        status: 'REJECTED',
        reasonCode: 'SPELL_NOT_AVAILABLE',
        unavailableSpellId: 'missing-spell'
      }
    },
    {
      request: { classId: 'wizard', spellIds: ['valid-1'] },
      expected: {
        classId: 'wizard',
        requestedSpellIds: ['valid-1'],
        status: 'ALLOWED',
        reasonCode: 'REQUEST_ALLOWED',
        unavailableSpellId: null
      }
    },
    {
      request: { classId: 'fighter', spellIds: [] },
      expected: {
        classId: 'fighter',
        requestedSpellIds: [],
        status: 'ALLOWED',
        reasonCode: 'REQUEST_ALLOWED',
        unavailableSpellId: null
      }
    }
  ])(
    'returns the stable request decision for $expected.reasonCode',
    async ({ request, expected }) => {
      const result = await evaluatePreparation(
        policyFacts({
          spellPreparationClasses: [
            preparationClass('wizard', 1, [
              source('wizard', {
                spellLimits: [{ classLevel: 1, preparedSpellsLimit: 1, spellLevels: [1] }]
              })
            ]),
            preparationClass('fighter', 1, [source('fighter', { attributes: [], spellLimits: [] })])
          ],
          spellPreparationCatalog: [
            { spellId: 'valid-1', spellLevel: 1, classIds: ['wizard'] },
            { spellId: 'valid-2', spellLevel: 1, classIds: ['wizard'] }
          ],
          spellPreparationRequest: request
        })
      )

      expect(result.spellPreparation.requestDecision).toEqual(expected)
    }
  )
})
