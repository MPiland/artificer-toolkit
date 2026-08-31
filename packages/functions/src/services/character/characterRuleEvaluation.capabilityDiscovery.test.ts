import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import {
  ACTIVATION_CODE,
  EFFECT_KIND,
  PATH_CODE,
  PATH_GROUP_TYPE,
  RANGE_KIND,
  TRIGGER
} from '@artificer-toolkit/shared/core'
import type { FeatureAuthored } from '@artificer-toolkit/shared/authored'

import { createEmptyCharacterAuthored, type CharacterBuilderContext } from './builderService.js'

const { resolveBinding, evaluateRevision } = vi.hoisted(() => ({
  resolveBinding: vi.fn(),
  evaluateRevision: vi.fn()
}))

vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: resolveBinding
}))
vi.mock('../rules/ruleRevisionRuntime.js', () => ({
  evaluateRuleRevision: evaluateRevision
}))

const { evaluateCharacterRulePolicy } = await import('./characterRuleEvaluation.js')
const { dnd5e2014CharacterPolicyDocument } =
  await import('../rules/systems/dnd5e/2014/characterPolicy.js')

const SYSTEM_ID = '00000000-0000-0000-0000-000000000001'
const CATALOGUE_ID = '00000000-0000-4000-8000-000000000301'
const FEATURE_ID = '00000000-0000-4000-8000-000000000020'
const EFFECT_ID = '00000000-0000-4000-8000-000000000021'

const feature = {
  id: FEATURE_ID,
  label: 'Capability discovery feature',
  description: '',
  order: 1,
  effects: [
    {
      id: EFFECT_ID,
      order: 1,
      invocation: {
        kind: 'ACTION',
        triggerCode: TRIGGER.ACTIVATED,
        activation: { code: ACTIVATION_CODE.ACTION, amount: 1 },
        range: {
          id: '00000000-0000-4000-8000-000000000022',
          rangeKind: RANGE_KIND.SELF
        },
        targeting: { selectionKind: 'SELF' }
      },
      paths: [
        {
          id: '00000000-0000-4000-8000-000000000023',
          order: 1,
          pathCode: PATH_CODE.ON_USE,
          groupType: PATH_GROUP_TYPE.SINGLE,
          selectionKind: 'FIXED',
          resultBlock: {
            id: '00000000-0000-4000-8000-000000000024',
            resultKind: 'SINGLE',
            outcomes: [
              {
                id: '00000000-0000-4000-8000-000000000025',
                effectKind: EFFECT_KIND.HEAL,
                valueKind: 'FIXED',
                scalingKind: 'NONE',
                amount: 7
              }
            ]
          }
        }
      ]
    }
  ]
} satisfies FeatureAuthored

function context(): CharacterBuilderContext {
  return {
    catalog: {
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      spells: []
    },
    registry: {
      system: null,
      races: [],
      classes: [],
      backgrounds: [],
      equipment: [],
      feats: [],
      features: [feature]
    },
    spellDocumentsById: new Map()
  }
}

describe('Character rule capability discovery integration', () => {
  beforeEach(() => {
    resolveBinding.mockReset()
    evaluateRevision.mockReset()
    resolveBinding.mockResolvedValue({
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    })
    const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
      ({ modelKey }) => modelKey === 'character-policy'
    )
    if (!fixture) throw new Error('Policy fixture missing.')
    evaluateRevision.mockResolvedValue({
      revisionId: 'revision-1',
      checksum: 'checksum-1',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4,
      modelKey: 'character-policy',
      contractKey: 'character-policy',
      normalizedFacts: fixture.input,
      result: fixture.expected,
      trace: null,
      evaluationDurationMs: 1,
      documentBytes: 1,
      normalizedFactsBytes: 1,
      resultBytes: 1
    })
  })

  it('uses the production System registry to discover the exact UUID-backed Effect entry point', async () => {
    const character = createEmptyCharacterAuthored({
      id: 'character-1',
      systemId: SYSTEM_ID,
      primaryRulesCatalogueId: CATALOGUE_ID,
      userId: 'user-1'
    })
    character.intent.featureAcquisitions = [
      {
        id: 'feature-acquisition-1',
        featureId: FEATURE_ID,
        source: { kind: 'FEATURE', featureId: FEATURE_ID },
        timing: { kind: 'IMMEDIATE' }
      }
    ]

    const result = await evaluateCharacterRulePolicy({
      db: {} as unknown as DBLike,
      character,
      context: context(),
      existingRevisionId: 'revision-1'
    })

    expect(result.discoveredActionCapabilities).toEqual([
      expect.objectContaining({
        kind: 'CHARACTER_ACTION',
        gameSystemId: SYSTEM_ID,
        authoredRootKind: 'effect',
        entryPointDefinitionId: EFFECT_ID,
        effectId: EFFECT_ID
      })
    ])
    expect(result.compiledActionEntryPoints).toMatchObject([
      {
        schemaVersion: 4,
        kind: 'CHARACTER_ACTION',
        actionId: result.facts.actionCandidates[0]?.actionId,
        effectId: EFFECT_ID,
        compilation: {
          kind: 'COMPILED',
          executionPlan: {
            kind: 'SINGLE_GRAPH',
            published: {
              id: EFFECT_ID,
              gameSystemId: SYSTEM_ID,
              definitionFamilyKey: 'effect-action'
            }
          }
        }
      }
    ])
    expect(evaluateRevision).toHaveBeenCalledTimes(1)
  })
})
