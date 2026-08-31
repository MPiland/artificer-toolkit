import { describe, expect, it } from 'vitest'

import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { CharacterRulePolicyInput } from '@artificer-toolkit/schema/api/characterRules'
import type {
  CharacterAssemblyRegistry,
  CharacterBuildSnapshot
} from '@artificer-toolkit/shared/core'
import { compileEffect, compileFeat, compileFeature } from '@artificer-toolkit/shared/compilers'

import { buildCharacterActionRuleFacts } from './characterActionRuleFacts.js'
import { compileCharacterGrantFoldRuleFacts } from './characterGrantFoldRuleFacts.js'

type ResourcePoolCandidate = NonNullable<CharacterRulePolicyInput['resourcePoolCandidates']>[number]

function actionInvocation(effectId: string, chargeId: string | undefined) {
  return {
    kind: 'ACTION' as const,
    triggerCode: TRIGGER.ACTIVATED,
    activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
    resourceUse: chargeId ? { chargeId, cost: 1 } : undefined,
    range: { id: `range-${effectId}`, rangeKind: RANGE_KIND.SELF }
  }
}

function passiveInvocation(effectId: string) {
  return {
    kind: 'PASSIVE' as const,
    triggerCode: TRIGGER.ACTIVATED,
    range: { id: `range-${effectId}`, rangeKind: RANGE_KIND.SELF }
  }
}

function actionPath(effectId: string) {
  return {
    id: `${effectId}-path`,
    order: 1,
    pathCode: PATH_CODE.ON_USE,
    groupType: PATH_GROUP_TYPE.SINGLE,
    selectionKind: 'FIXED' as const,
    resultBlock: {
      id: `${effectId}-result`,
      resultKind: 'SINGLE' as const,
      outcomes: [
        {
          id: `${effectId}-outcome`,
          effectKind: EFFECT_KIND.CONDITION,
          conditionId: `${effectId}-cond`
        }
      ]
    }
  }
}

function actionEffect(id: string, chargeId?: string) {
  return {
    id,
    order: 1,
    invocation: actionInvocation(id, chargeId),
    paths: [actionPath(id)]
  }
}

function passiveEffect(id: string) {
  return {
    id,
    order: 1,
    invocation: passiveInvocation(id),
    paths: [actionPath(id)]
  }
}

function selectedOption(id: string) {
  return {
    id: 'option-set',
    order: 1,
    subject: 'CHARACTER' as const,
    selectionKey: 'options',
    values: [{ kind: 'ID' as const, id }]
  }
}

function sourceStateRestriction(
  state: 'EQUIPPED' | 'ATTUNED'
): Parameters<typeof compileFeature>[0]['restrictions'] {
  return {
    id: `source-${state}`,
    groups: [
      {
        id: `group-${state}`,
        order: 1,
        contexts: [
          {
            id: `context-${state}`,
            order: 1,
            subject: 'CHARACTER',
            conditions: [
              {
                id: `condition-${state}`,
                order: 1,
                kind: 'PREDICATE',
                predicateCode:
                  state === 'EQUIPPED' ? 'WHILE_SOURCE_EQUIPPED' : 'WHILE_SOURCE_ATTUNED',
                constraint: 'INCLUDE'
              }
            ]
          }
        ]
      }
    ]
  } as Parameters<typeof compileFeature>[0]['restrictions']
}

function equipmentSourceRestriction(state: 'EQUIPPED' | 'ATTUNED') {
  return sourceStateRestriction(state) as NonNullable<
    CharacterBuildSnapshot['equipmentItems'][number]['compiledItem']['restrictions']
  >
}

function resourceCandidate(overrides: Partial<ResourcePoolCandidate>): ResourcePoolCandidate {
  return {
    sequence: 0,
    poolId: 'pool',
    resourceDefinitionId: 'resource-1',
    chargeCalculationId: 'calc',
    baseResetKind: 'LONG_REST',
    ownerKind: 'AUTHORED_SOURCE',
    chargeId: 'missing',
    ...overrides
  } as ResourcePoolCandidate
}

function compositeFixture({ duplicateFeat = false } = {}) {
  const rootFeature = compileFeature({
    id: 'feature-root',
    label: 'Feature root',
    description: '',
    order: 1,
    effects: [actionEffect('root-action', 'root-charge'), passiveEffect('root-passive')]
  })

  const optionFeature = compileFeature({
    id: 'feature-option',
    label: 'Option feature',
    description: '',
    order: 2,
    options: [
      {
        id: 'selected-option',
        label: 'Selected option',
        description: '',
        order: 1,
        effects: [actionEffect('option-action', 'option-charge')]
      },
      {
        id: 'unselected-option',
        label: 'Unselected option',
        description: '',
        order: 2,
        effects: [actionEffect('ignored-option-action', 'ignored-option-charge')]
      }
    ]
  })

  const featDefinition = compileFeat({
    id: 'feat-root',
    label: 'Feat root',
    description: '',
    userId: 'user-root',
    systemId: 'dnd5e2014',
    effects: [actionEffect('feat-action', 'feat-charge')]
  })

  const nestedFeature = compileFeature({
    id: 'nested-feature-a',
    label: 'Nested feature',
    description: '',
    order: 3,
    effects: [actionEffect('nested-action', 'nested-charge')]
  })
  const nestedSibling = compileFeature({
    id: 'nested-feature-b',
    label: 'Nested sibling',
    description: '',
    order: 4,
    effects: [actionEffect('nested-sibling-action', 'nested-sibling-charge')]
  })
  const nestedSiblingWithRestrictions = compileFeature({
    id: 'nested-feature-c',
    label: 'Nested sibling attuned',
    description: '',
    order: 5,
    effects: [actionEffect('nested-c-action', 'nested-c-charge')],
    restrictions: sourceStateRestriction('ATTUNED')
  })

  const snap = {
    characterId: 'character-1',
    systemId: 'dnd5e2014',
    totalLevel: 3,
    classes: [{ classId: 'fighter', level: 1 }],
    abilities: {
      STRENGTH: 12,
      DEXTERITY: 14,
      CONSTITUTION: 10,
      INTELLIGENCE: 10,
      WISDOM: 10,
      CHARISMA: 10
    },
    hitpoints: [],
    features: [
      {
        featureId: rootFeature.id,
        source: { kind: 'FEATURE', featureId: rootFeature.id },
        timing: { kind: 'IMMEDIATE' }
      },
      {
        acquisitionId: 'acquired-option',
        featureId: optionFeature.id,
        source: { kind: 'FEATURE', featureId: optionFeature.id },
        timing: { kind: 'IMMEDIATE' },
        selections: [selectedOption('selected-option')]
      },
      {
        featureId: 'feat-host-1',
        source: { kind: 'FEAT', featId: 'feat-1' },
        timing: { kind: 'IMMEDIATE' }
      },
      ...(duplicateFeat
        ? [
            {
              acquisitionId: 'acquired-feature-2',
              featureId: 'feat-host-2',
              source: { kind: 'FEAT', featId: 'feat-1' },
              timing: { kind: 'IMMEDIATE' }
            } as const
          ]
        : [])
    ],
    equipmentItems: [
      {
        instanceId: 'item-1',
        contentRef: {
          definitionId: 'mysterious-item',
          binding: { kind: 'ACTIVE' },
          systemId: 'dnd5e2014'
        },
        attuned: true,
        compiledItem: {
          id: 'mysterious-item',
          category: 'WEAPON',
          properties: [],
          rarityId: 'COMMON',
          features: [nestedFeature, nestedSibling, nestedSiblingWithRestrictions],
          effects: [compileEffect(actionEffect('item-root-action', 'item-root-charge'))],
          restrictions: equipmentSourceRestriction('EQUIPPED')
        }
      }
    ]
  } satisfies CharacterBuildSnapshot

  const registry: CharacterAssemblyRegistry = {
    backgrounds: {},
    features: {
      [rootFeature.id]: rootFeature,
      [optionFeature.id]: optionFeature,
      'feat-host-1': rootFeature,
      'feat-host-2': optionFeature
    },
    classes: {},
    feats: { 'feat-1': featDefinition },
    races: {},
    equipment: {
      'mysterious-item': {
        id: 'mysterious-item',
        category: 'WEAPON',
        properties: [],
        rarityId: 'COMMON',
        features: []
      } as const
    },
    spells: {}
  }

  return {
    snapshot: snap,
    registry,
    grantFoldFacts: compileCharacterGrantFoldRuleFacts({ snapshot: snap, registry })
  }
}

describe('buildCharacterActionRuleFacts', () => {
  it('retains exact compiled Effects server-side without adding them to serialized rule facts', () => {
    const fixture = compositeFixture()
    const result = buildCharacterActionRuleFacts({
      ...fixture,
      resourcePoolCandidates: []
    })
    const candidate = result.actionCandidates[0]
    const entryPoint = result.entryPoints[0]

    expect(candidate).toBeDefined()
    expect(entryPoint).toBeDefined()
    expect(entryPoint).toMatchObject({
      actionId: candidate?.actionId,
      effectId: candidate?.effectId,
      sourceId: candidate?.sourceId,
      source: candidate?.source,
      mechanicsOwner: candidate?.mechanicsOwner,
      activationSourceKind: candidate?.activationSourceKind
    })
    expect(entryPoint?.compiledEffect.id).toBe(candidate?.effectId)
    expect(Object.hasOwn(candidate ?? {}, 'compiledEffect')).toBe(false)
    expect(JSON.stringify(result.actionCandidates)).not.toContain('compiledEffect')
  })

  it('normalizes authored invocation, damage, and healing into JSON-safe mechanics facts', () => {
    const feature = compileFeature({
      id: 'mechanic-feature',
      label: 'Mechanic feature',
      description: '',
      order: 1,
      effects: [
        {
          id: 'mechanic-effect',
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.SAVING_THROW,
            savingThrow: {
              id: 'mechanic-save',
              dcMethod: 'DERIVED_DC',
              abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
              baseDc: 8,
              bonuses: [
                {
                  id: 'save-wisdom',
                  bonusKind: 'ABILITY_MODIFIER',
                  abilityDefinitionId: '00000000-0000-0000-0011-000500000000'
                },
                { id: 'save-proficiency', bonusKind: 'PROFICIENCY_BONUS' }
              ]
            },
            activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
            range: {
              id: 'mechanic-range',
              rangeKind: RANGE_KIND.DISTANCE,
              amount: 30,
              unit: 'FEET'
            }
          },
          paths: [
            {
              id: 'mechanic-path',
              order: 1,
              pathCode: PATH_CODE.ON_SAVE_FAIL,
              groupType: PATH_GROUP_TYPE.SEQUENTIAL,
              selectionKind: 'FIXED',
              resultBlock: {
                id: 'mechanic-results',
                resultKind: 'SEQUENCE',
                outcomes: [
                  {
                    id: 'mechanic-damage',
                    effectKind: EFFECT_KIND.DAMAGE,
                    damageTypeId: 'fire',
                    valueKind: 'DICE',
                    scalingKind: 'NONE',
                    diceConfig: '1d8',
                    bonuses: [
                      {
                        id: 'damage-wisdom',
                        bonusKind: 'ABILITY_BONUS',
                        ability: 'WISDOM',
                        order: 1
                      }
                    ]
                  },
                  {
                    id: 'mechanic-heal',
                    effectKind: EFFECT_KIND.HEAL,
                    valueKind: 'POOL',
                    scalingKind: 'PER_LEVEL',
                    scalingSource: 'CHARACTER_LEVEL',
                    amount: 1,
                    multiplier: 2,
                    bonuses: [
                      {
                        id: 'heal-fighter-level',
                        bonusKind: 'CLASS_LEVEL',
                        classId: 'fighter',
                        order: 1
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ]
    })
    const snapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 3,
      classes: [{ classId: 'fighter', level: 3 }],
      abilities: {},
      hitpoints: [],
      features: [
        {
          featureId: feature.id,
          source: { kind: 'FEATURE', featureId: feature.id },
          timing: { kind: 'IMMEDIATE' }
        }
      ],
      equipmentItems: []
    } satisfies CharacterBuildSnapshot
    const registry: CharacterAssemblyRegistry = {
      backgrounds: {},
      features: { [feature.id]: feature },
      classes: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {}
    }
    const grantFoldFacts = compileCharacterGrantFoldRuleFacts({ snapshot, registry })

    const candidate = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: []
    }).actionCandidates[0]

    expect(candidate?.mechanicFacts).toEqual({
      invocation: {
        triggerCode: 'SAVING_THROW',
        activation: { code: 'ACTION', amount: 1 },
        range: { rangeKind: 'DISTANCE', amount: 30, unit: 'FEET' },
        reactionMovementTrigger: null,
        savingThrow: {
          dcMethod: 'DERIVED_DC',
          abilityDefinitionId: '00000000-0000-0000-0011-000200000000',
          baseDc: 8,
          bonuses: [
            {
              bonusKind: 'ABILITY_MODIFIER',
              abilityDefinitionId: '00000000-0000-0000-0011-000500000000'
            },
            { bonusKind: 'PROFICIENCY_BONUS' }
          ]
        }
      },
      outcomes: [
        {
          kind: 'DAMAGE',
          outcomeId: 'mechanic-damage',
          pathCode: 'ON_SAVE_FAIL',
          label: null,
          damageTypeId: 'fire',
          valueKind: 'DICE',
          scalingKind: 'NONE',
          scalingSource: null,
          classId: null,
          amountKind: null,
          amountMultiplier: null,
          values: [
            {
              level: null,
              order: 0,
              amount: null,
              dice: '1d8',
              multiplier: null,
              minimum: null,
              maximum: null
            }
          ],
          bonuses: [
            {
              bonusKind: 'ABILITY_BONUS',
              ability: 'WISDOM',
              order: 1,
              min: null,
              max: null,
              multiplier: null
            }
          ]
        },
        {
          kind: 'HEAL',
          outcomeId: 'mechanic-heal',
          pathCode: 'ON_SAVE_FAIL',
          label: null,
          valueKind: 'POOL',
          scalingKind: 'PER_LEVEL',
          scalingSource: 'CHARACTER_LEVEL',
          classId: null,
          temporary: false,
          values: [
            {
              level: null,
              order: 0,
              amount: 1,
              dice: null,
              multiplier: 2,
              minimum: null,
              maximum: null
            }
          ],
          bonuses: [
            {
              bonusKind: 'CLASS_LEVEL',
              classId: 'fighter',
              order: 1,
              min: null,
              max: null,
              multiplier: null
            }
          ]
        }
      ]
    })
    expect(JSON.stringify(candidate?.mechanicFacts)).not.toContain('undefined')
  })

  it('preserves a bound reaction movement trigger and leaves unbound actions explicitly null', () => {
    const reactionFeature = compileFeature({
      id: 'reaction-feature',
      label: 'Reaction feature',
      description: '',
      order: 1,
      effects: [
        {
          id: 'reaction-effect',
          order: 1,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: 'reaction-range', rangeKind: RANGE_KIND.SELF },
            reactionMovementTrigger: {
              kind: 'MOVEMENT',
              stage: 'BEFORE_LEAVE_REACH',
              perceptionRequirement: 'SEE',
              eligibilityDefinitionId: 'aaaaaaaa-0000-4000-8000-000000000001'
            }
          },
          paths: [actionPath('reaction')]
        },
        {
          id: 'unbound-reaction-effect',
          order: 2,
          invocation: {
            kind: 'ACTION',
            triggerCode: TRIGGER.ACTIVATED,
            activation: { code: ACTIVATION_CODE.REACTION, amount: 1 },
            range: { id: 'unbound-reaction-range', rangeKind: RANGE_KIND.SELF }
          },
          paths: [actionPath('unbound-reaction')]
        }
      ]
    })
    const snapshot = {
      characterId: 'character-1',
      systemId: 'dnd5e2014',
      totalLevel: 1,
      classes: [],
      abilities: {},
      hitpoints: [],
      features: [
        {
          featureId: reactionFeature.id,
          source: { kind: 'FEATURE', featureId: reactionFeature.id },
          timing: { kind: 'IMMEDIATE' }
        }
      ],
      equipmentItems: []
    } satisfies CharacterBuildSnapshot
    const registry: CharacterAssemblyRegistry = {
      backgrounds: {},
      features: { [reactionFeature.id]: reactionFeature },
      classes: {},
      feats: {},
      races: {},
      equipment: {},
      spells: {}
    }
    const facts = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts: compileCharacterGrantFoldRuleFacts({ snapshot, registry }),
      resourcePoolCandidates: []
    })

    expect(facts.actionCandidates[0]?.mechanicFacts.invocation.reactionMovementTrigger).toEqual({
      kind: 'MOVEMENT',
      stage: 'BEFORE_LEAVE_REACH',
      perceptionRequirement: 'SEE',
      eligibilityDefinitionId: 'aaaaaaaa-0000-4000-8000-000000000001',
      movementInterruption: null
    })
    expect(facts.actionCandidates[0]?.mechanicFacts.invocation.activation).toEqual({
      code: 'REACTION',
      amount: 1
    })
    expect(
      facts.actionCandidates.find((candidate) => candidate.effectId === 'unbound-reaction-effect')
        ?.mechanicFacts.invocation.reactionMovementTrigger
    ).toBeNull()
  })

  it('builds ordered mechanics owners, ignores passive effects, and preserves source-isolation and restrictions', () => {
    const { snapshot, registry, grantFoldFacts } = compositeFixture({ duplicateFeat: true })
    const { actionCandidates } = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: []
    })

    const featureCandidate = actionCandidates.find(
      (candidate) => candidate.mechanicsOwner.id === 'feature-root'
    )
    const optionCandidate = actionCandidates.find(
      (candidate) => candidate.mechanicsOwner.id === 'selected-option'
    )
    const featCandidates = actionCandidates.filter(
      (candidate) => candidate.mechanicsOwner.kind === 'FEAT'
    )
    const equipmentCandidate = actionCandidates.find(
      (candidate) => candidate.effectId === 'item-root-action'
    )
    const nestedEquippedCandidate = actionCandidates.find(
      (candidate) => candidate.effectId === 'nested-sibling-action'
    )
    const nestedAttunedCandidate = actionCandidates.find(
      (candidate) => candidate.effectId === 'nested-c-action'
    )
    const effectOrder = actionCandidates
      .filter(
        (candidate) =>
          candidate.effectId.endsWith('-action') || candidate.effectId.includes('-action')
      )
      .map((candidate) => candidate.effectId)

    expect(effectOrder).toContain('root-action')
    expect(effectOrder).toContain('option-action')
    expect(effectOrder).toContain('feat-action')
    expect(effectOrder).toContain('item-root-action')
    expect(effectOrder).toContain('nested-action')
    expect(effectOrder).toContain('nested-sibling-action')
    expect(effectOrder).toContain('nested-c-action')

    expect(featureCandidate).toMatchObject({
      mechanicsOwner: { kind: 'FEATURE', id: 'feature-root' }
    })
    expect(optionCandidate).toMatchObject({
      mechanicsOwner: { kind: 'FEATURE_OPTION', id: 'selected-option' }
    })
    expect(featCandidates).toHaveLength(1)
    expect(featCandidates[0]).toMatchObject({ mechanicsOwner: { kind: 'FEAT', id: 'feat-1' } })
    expect(equipmentCandidate).toMatchObject({
      mechanicsOwner: { kind: 'EQUIPMENT', id: 'mysterious-item' },
      activationSourceKind: 'ACTIVE_EQUIPMENT'
    })
    expect(
      actionCandidates.find((candidate) => candidate.effectId === 'root-passive')
    ).toBeUndefined()

    const siblingSourceIds = actionCandidates
      .filter((candidate) => candidate.mechanicsOwner.id.startsWith('nested-feature-'))
      .map((candidate) => candidate.sourceId)
    expect(new Set(siblingSourceIds).size).toBe(3)

    expect(nestedEquippedCandidate).toMatchObject({
      mechanicsOwner: { kind: 'FEATURE', id: 'nested-feature-b' },
      equipment: {
        requiresEquipped: true,
        requiresAttuned: false
      }
    })
    expect(nestedAttunedCandidate).toMatchObject({
      mechanicsOwner: { kind: 'FEATURE', id: 'nested-feature-c' },
      equipment: {
        requiresEquipped: true,
        requiresAttuned: true
      }
    })
  })

  it('resolves candidate pool selection, exact matches, and misses', () => {
    const { snapshot, registry, grantFoldFacts } = compositeFixture()
    const sourceId = grantFoldFacts.features[0]!.definition!.sourceId

    const exactItemPool = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: [
        resourceCandidate({
          ownerKind: 'ITEM_INSTANCE',
          itemInstanceId: 'item-1',
          chargeId: 'unrelated-charge',
          poolId: 'not-exact'
        }),
        resourceCandidate({
          ownerKind: 'ITEM_INSTANCE',
          itemInstanceId: 'item-1',
          chargeId: 'item-root-charge',
          poolId: 'exact'
        })
      ]
    }).actionCandidates

    expect(
      exactItemPool.find((candidate) => candidate.effectId === 'item-root-action')!.resourceUse
    ).toMatchObject({
      poolId: 'exact'
    })

    const sourcePreferred = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: [
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'ineligible',
          chargeId: 'root-charge',
          availableAtLevel: 10,
          activeSourceLevel: 1,
          poolId: 'grant-ineligible'
        }),
        resourceCandidate({
          ownerKind: 'AUTHORED_SOURCE',
          sourceId,
          chargeId: 'root-charge',
          poolId: 'source-preferred'
        }),
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'feat-grant',
          chargeId: 'root-charge',
          availableAtLevel: 1,
          activeSourceLevel: 1,
          poolId: 'grant-eligible'
        })
      ]
    }).actionCandidates

    expect(
      sourcePreferred.find((candidate) => candidate.effectId === 'root-action')!.resourceUse
    ).toMatchObject({
      poolId: 'source-preferred'
    })

    const eligibleGrantFallback = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: [
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'feat-grant',
          chargeId: 'root-charge',
          availableAtLevel: 1,
          activeSourceLevel: 1,
          poolId: 'grant-eligible'
        })
      ]
    }).actionCandidates

    expect(
      eligibleGrantFallback.find((candidate) => candidate.effectId === 'root-action')!.resourceUse
    ).toMatchObject({
      poolId: 'grant-eligible'
    })

    const ineligibleOrMissing = buildCharacterActionRuleFacts({
      snapshot,
      registry,
      grantFoldFacts,
      resourcePoolCandidates: [
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'ineligible',
          chargeId: 'root-charge',
          availableAtLevel: 10,
          activeSourceLevel: 1,
          poolId: 'grant-ineligible'
        }),
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'grant-1',
          chargeId: 'root-charge',
          availableAtLevel: 1,
          activeSourceLevel: 1,
          poolId: 'grant-1'
        }),
        resourceCandidate({
          ownerKind: 'AUTHORED_GRANT',
          resourceGrantId: 'grant-2',
          chargeId: 'root-charge',
          availableAtLevel: 1,
          activeSourceLevel: 1,
          poolId: 'grant-2'
        }),
        resourceCandidate({
          ownerKind: 'AUTHORED_SOURCE',
          sourceId: 'not-match',
          chargeId: 'root-charge',
          poolId: 'source-unrelated'
        })
      ]
    }).actionCandidates

    expect(
      ineligibleOrMissing.find((candidate) => candidate.effectId === 'root-action')!.resourceUse
    ).toMatchObject({
      poolId: null
    })
  })
})
