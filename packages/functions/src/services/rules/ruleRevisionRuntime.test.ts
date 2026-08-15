import type { DBLike, RulePackRevisionRecord } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  rulePackDocumentDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'
import {
  characterRulePolicyInputSchema,
  characterRulePolicyOutputSchema
} from '@artificer-toolkit/schema/api/characterRules'
import { CHARACTER_ACTION_MODEL_KEY } from '@artificer-toolkit/schema/api/characterActionRules'

import { checksumRuleDocument } from './ruleChecksum.js'
import {
  getRuleModelContract,
  RULE_EVALUATOR_KIND,
  RULE_EVALUATOR_VERSION,
  RULE_MODEL_CONTRACT_VERSION
} from './ruleModelContracts.js'
import {
  dnd5e2014CharacterGrantFoldEmptyInput,
  dnd5e2014CharacterGrantFoldEmptyOutput
} from './systems/dnd5e/2014/characterGrantFoldSource.js'
import { dnd5e2014CharacterPolicyDocument } from './systems/dnd5e/2014/characterPolicy.js'

const ids = {
  pack: '00000000-0000-4000-8000-000000000001',
  revision: '00000000-0000-4000-8000-000000000002',
  actor: '00000000-0000-4000-8000-000000000003'
}

const mocks = vi.hoisted(() => ({
  evaluate: vi.fn(),
  getRevision: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createRulePackRepository: () => ({ getRevision: mocks.getRevision })
}))

vi.mock('./zenRuleEngine.js', () => ({ evaluateZenRuleModel: mocks.evaluate }))

const { evaluateRuleRevision, RuleRevisionEvaluationError } =
  await import('./ruleRevisionRuntime.js')

function document(): RulePackDocumentDto {
  return rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: {
      'encounter-resolve': {
        edges: [
          { sourceId: 'input', targetId: 'decision' },
          { sourceId: 'decision', targetId: 'output' }
        ],
        nodes: [
          { id: 'input', type: 'inputNode' },
          { id: 'decision', type: 'decisionTableNode' },
          { id: 'output', type: 'outputNode' }
        ]
      }
    },
    fixtures: []
  })
}

function revision(state: RulePackRevisionRecord['state'] = 'ACTIVE'): RulePackRevisionRecord {
  const doc = document()
  return {
    id: ids.revision,
    rulePackId: ids.pack,
    revision: 1,
    document: doc,
    checksum: checksumRuleDocument(doc),
    createdBy: ids.actor,
    activatedBy: ids.actor,
    activatedAt: '2026-08-13T00:00:00.000Z',
    state,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z',
    evaluatorKind: RULE_EVALUATOR_KIND,
    evaluatorVersion: RULE_EVALUATOR_VERSION,
    modelContractVersion: RULE_MODEL_CONTRACT_VERSION
  }
}

function facts() {
  return {
    encounter: {
      id: ids.pack,
      status: 'ACTIVE',
      round: 1,
      currentActorId: ids.actor
    },
    action: { actorId: ids.actor, targetActorIds: [], choices: {} },
    actor: {
      id: ids.actor,
      kind: 'CHARACTER',
      label: 'Aria',
      systemId: ids.pack
    },
    targets: [],
    rolls: []
  }
}

function characterPolicyFactsWithCharges(count: number) {
  const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
    ({ modelKey }) => modelKey === 'character-policy'
  )
  if (!fixture) throw new Error('Character policy fixture is required.')
  const fixtureInput = characterRulePolicyInputSchema.parse(fixture.input)
  const paddedIdentity = (prefix: string, index: number) => `${prefix}-${index}`.padEnd(220, 'x')

  return characterRulePolicyInputSchema.parse({
    ...fixtureInput,
    chargeCalculations: Array.from({ length: count }, (_, index) => ({
      calculationId: paddedIdentity('calculation', index),
      sourceId: paddedIdentity('source', index),
      base: { kind: 'FIXED_AMOUNT', amount: 3 },
      bonuses: ['ability', 'skill', 'proficiency'].map((kind, bonusIndex) => ({
        sourceId: paddedIdentity(`${kind}-bonus-${bonusIndex}`, index),
        kind: 'PROFICIENCY_BONUS',
        multiplier: null,
        minimum: null,
        maximum: null
      }))
    }))
  })
}

function characterPolicyRevision(): RulePackRevisionRecord {
  const document = rulePackDocumentDtoSchema.parse(dnd5e2014CharacterPolicyDocument)
  return {
    ...revision(),
    document,
    checksum: checksumRuleDocument(document)
  }
}

describe('exact rule revision evaluator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getRevision.mockResolvedValue(revision())
    mocks.evaluate.mockResolvedValue({
      result: {
        eligibility: { allowed: true, reasonCode: 'ALLOWED' },
        rollRequests: [],
        outcomes: []
      },
      trace: { nodes: [] }
    })
  })

  it('registers the scalar character policy contract with closed input and output schemas', () => {
    const contract = getRuleModelContract('character-policy')
    expect(contract?.version).toBe(RULE_MODEL_CONTRACT_VERSION)
    expect(() =>
      contract?.input.parse({
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
        eligibilityFacets: [],
        rest: {
          totalHitDice: 1,
          currentExhaustion: 0,
          attunementSlotOverride: null
        },
        unexpected: true
      })
    ).toThrow()
  })

  it('keeps pinned v4 Character action outputs readable after the bounded spell contract upgrade', () => {
    const contract = getRuleModelContract(CHARACTER_ACTION_MODEL_KEY, 4)
    expect(contract?.version).toBe(4)
    expect(
      contract?.output.parse({
        actionDecisions: [],
        spellCastMechanics: [],
        spellReferenceMechanics: []
      })
    ).toMatchObject({ spellCastDecisions: [] })
  })

  it('accepts near-limit facts and rejects oversized facts before evaluation', async () => {
    const nearLimitFacts = {
      ...facts(),
      action: {
        ...facts().action,
        choices: { note: 'x'.repeat(250 * 1024) }
      }
    }

    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: nearLimitFacts
      })
    ).resolves.toMatchObject({ normalizedFacts: nearLimitFacts })

    mocks.evaluate.mockClear()
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: {
          ...facts(),
          action: {
            ...facts().action,
            choices: { note: 'x'.repeat(256 * 1024) }
          }
        }
      })
    ).rejects.toThrow('cannot exceed 262144 bytes')
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })

  it('enforces the runtime fact limit for dense charge calculations independently of document size', async () => {
    const nearLimitFacts = characterPolicyFactsWithCharges(170)
    const oversizedFacts = characterPolicyFactsWithCharges(190)
    const fixture = dnd5e2014CharacterPolicyDocument.fixtures.find(
      ({ modelKey }) => modelKey === 'character-policy'
    )
    if (!fixture) throw new Error('Character policy fixture is required.')
    const expected = characterRulePolicyOutputSchema.parse(fixture.expected)

    expect(
      Buffer.byteLength(JSON.stringify(dnd5e2014CharacterPolicyDocument), 'utf8')
    ).toBeLessThan(1024 * 1024)
    expect(Buffer.byteLength(JSON.stringify(nearLimitFacts), 'utf8')).toBeLessThan(256 * 1024)
    expect(Buffer.byteLength(JSON.stringify(oversizedFacts), 'utf8')).toBeGreaterThan(256 * 1024)

    mocks.getRevision.mockResolvedValue(characterPolicyRevision())
    mocks.evaluate.mockResolvedValue({ result: expected, trace: null })
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'character-policy',
        normalizedFacts: nearLimitFacts
      })
    ).resolves.toMatchObject({ normalizedFacts: nearLimitFacts })

    mocks.evaluate.mockClear()
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'character-policy',
        normalizedFacts: oversizedFacts
      })
    ).rejects.toThrow('Normalized rule facts cannot exceed 262144 bytes')
    expect(mocks.evaluate).not.toHaveBeenCalled()
  })

  it('evaluates an exact active revision and returns its runtime identity', async () => {
    const result = await evaluateRuleRevision({
      db: {} as DBLike,
      revisionId: ids.revision,
      modelKey: 'encounter-resolve',
      normalizedFacts: facts(),
      trace: true
    })

    expect(result).toMatchObject({
      revisionId: ids.revision,
      checksum: revision().checksum,
      evaluatorKind: RULE_EVALUATOR_KIND,
      evaluatorVersion: RULE_EVALUATOR_VERSION,
      modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
      result: { eligibility: { allowed: true } }
    })
    expect(result.evaluationDurationMs).toBeGreaterThanOrEqual(0)
    expect(result.documentBytes).toBeGreaterThan(0)
    expect(result.normalizedFactsBytes).toBeGreaterThan(0)
    expect(result.resultBytes).toBeGreaterThan(0)
  })

  it('evaluates the reserved grant-fold model under the current global contract', async () => {
    mocks.getRevision.mockResolvedValue({
      ...revision(),
      document: dnd5e2014CharacterPolicyDocument,
      checksum: checksumRuleDocument(dnd5e2014CharacterPolicyDocument)
    })
    mocks.evaluate.mockResolvedValueOnce({
      result: dnd5e2014CharacterGrantFoldEmptyOutput,
      trace: null
    })

    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'character-grant-fold',
        normalizedFacts: dnd5e2014CharacterGrantFoldEmptyInput
      })
    ).resolves.toMatchObject({ modelContractVersion: RULE_MODEL_CONTRACT_VERSION })
  })

  it('applies a registered domain contract to a pack-specific model key', async () => {
    const canonicalModel = document().models['encounter-resolve']
    if (!canonicalModel) throw new Error('Encounter contract fixture model is missing.')
    const packSpecificDocument = rulePackDocumentDtoSchema.parse({
      ...document(),
      models: { 'pack-action': canonicalModel }
    })
    mocks.getRevision.mockResolvedValue({
      ...revision(),
      document: packSpecificDocument,
      checksum: checksumRuleDocument(packSpecificDocument)
    })

    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'pack-action',
        contractKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).resolves.toMatchObject({
      modelKey: 'pack-action',
      contractKey: 'encounter-resolve',
      result: { eligibility: { allowed: true } }
    })
  })

  it('permits an activated retired revision but rejects drafts', async () => {
    mocks.getRevision.mockResolvedValue(revision('RETIRED'))
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).resolves.toMatchObject({ revisionId: ids.revision })

    mocks.getRevision.mockResolvedValue(revision('DRAFT'))
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).rejects.toBeInstanceOf(RuleRevisionEvaluationError)
  })

  it('rejects experimental models and incompatible runtime metadata before evaluation', async () => {
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'experimental-model',
        normalizedFacts: facts()
      })
    ).rejects.toThrow('not registered')

    mocks.getRevision.mockResolvedValue({
      ...revision(),
      evaluatorVersion: '0.0.0'
    })
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).rejects.toThrow('unsupported evaluator version')

    mocks.getRevision.mockResolvedValue({
      ...revision(),
      modelContractVersion: 2
    })
    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).rejects.toThrow('unsupported model contract version')
  })

  it('evaluates an older registered Encounter contract without moving its pin', async () => {
    mocks.getRevision.mockResolvedValue({
      ...revision('RETIRED'),
      modelContractVersion: 1
    })

    await expect(
      evaluateRuleRevision({
        db: {} as DBLike,
        revisionId: ids.revision,
        modelKey: 'encounter-resolve',
        normalizedFacts: facts()
      })
    ).resolves.toMatchObject({
      revisionId: ids.revision,
      modelContractVersion: 1
    })
  })
})
