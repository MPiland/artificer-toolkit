import type { DBLike, RulePackRevisionRecord } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  rulePackDocumentDtoSchema,
  type RulePackDocumentDto
} from '@artificer-toolkit/schema/api/rules'

const ids = {
  pack: '00000000-0000-4000-8000-000000000001',
  revision: '00000000-0000-4000-8000-000000000002',
  user: '00000000-0000-4000-8000-000000000003'
}

const mocks = vi.hoisted(() => ({
  evaluator: vi.fn(),
  repository: {
    activateDraft: vi.fn(),
    findOrCreatePack: vi.fn(),
    getRevision: vi.fn(),
    listPacks: vi.fn(),
    listRevisions: vi.fn(),
    retireActiveRevision: vi.fn(),
    saveDraft: vi.fn()
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createRulePackRepository: () => mocks.repository
}))

vi.mock('./zenRuleEngine.js', () => ({ evaluateZenRuleModel: mocks.evaluator }))

const {
  activateRulePackRevision,
  listRulePacks,
  RuleAccessError,
  saveRulePackDraft,
  simulateRulePack
} = await import('./rulePackService.js')
const { checksumRuleDocument } = await import('./ruleChecksum.js')
const { RuleConformanceError } = await import('./ruleConformance.js')

function document(expectedAllowed = false): RulePackDocumentDto {
  return rulePackDocumentDtoSchema.parse({
    schemaVersion: 1,
    models: {
      charges: {
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
    fixtures: [
      {
        id: '00000000-0000-4000-8000-000000000004',
        label: 'No charges',
        modelKey: 'charges',
        input: { remainingCharges: 0 },
        expected: {
          eligibility: { allowed: expectedAllowed, reasonCode: 'NO_CHARGES' },
          outcomes: [],
          rollRequests: []
        }
      }
    ]
  })
}

function revision(doc = document()): RulePackRevisionRecord {
  return {
    id: ids.revision,
    rulePackId: ids.pack,
    revision: 1,
    document: doc,
    checksum: checksumRuleDocument(doc),
    createdBy: ids.user,
    activatedBy: null,
    activatedAt: null,
    state: 'DRAFT',
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z'
  }
}

describe('rule pack service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('denies non-superadmins before repository or evaluator access', async () => {
    await expect(listRulePacks({} as DBLike, ids.user, false)).rejects.toBeInstanceOf(
      RuleAccessError
    )
    await expect(
      simulateRulePack({} as DBLike, ids.user, false, {
        document: document(),
        input: {},
        modelKey: 'charges'
      })
    ).rejects.toBeInstanceOf(RuleAccessError)

    expect(mocks.repository.listPacks).not.toHaveBeenCalled()
    expect(mocks.evaluator).not.toHaveBeenCalled()
  })

  it('saves a validated draft with the canonical document checksum', async () => {
    const doc = document()
    const saved = revision(doc)
    mocks.repository.findOrCreatePack.mockResolvedValue({ id: ids.pack })
    mocks.repository.saveDraft.mockResolvedValue(saved)

    await expect(
      saveRulePackDraft({} as DBLike, ids.user, true, {
        rulesetCode: 'DND_5E',
        rulesetVersion: '2014',
        document: doc
      })
    ).resolves.toMatchObject({ checksum: checksumRuleDocument(doc), lifecycle: 'DRAFT' })

    expect(mocks.repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        checksum: checksumRuleDocument(doc),
        expectedUpdatedAt: null,
        rulePackId: ids.pack
      })
    )
  })

  it('rejects invalid graphs before persistence', async () => {
    const invalidDocument = rulePackDocumentDtoSchema.parse({
      schemaVersion: 1,
      models: { invalid: { edges: [], nodes: [] } },
      fixtures: []
    })

    await expect(
      saveRulePackDraft({} as DBLike, ids.user, true, {
        rulesetCode: 'DND_5E',
        rulesetVersion: '2014',
        document: invalidDocument
      })
    ).rejects.toMatchObject({ name: 'RuleDocumentValidationError' })
    expect(mocks.repository.findOrCreatePack).not.toHaveBeenCalled()
  })

  it('blocks activation when a fixture does not match', async () => {
    const draft = revision(document(true))
    mocks.repository.getRevision.mockResolvedValue(draft)
    mocks.evaluator.mockResolvedValue({
      result: {
        eligibility: { allowed: false, reasonCode: 'NO_CHARGES' },
        outcomes: [],
        rollRequests: []
      },
      trace: null
    })

    await expect(
      activateRulePackRevision({} as DBLike, ids.user, true, {
        revisionId: ids.revision,
        expectedChecksum: draft.checksum
      })
    ).rejects.toBeInstanceOf(RuleConformanceError)
    expect(mocks.repository.activateDraft).not.toHaveBeenCalled()
  })

  it('executes a deterministic roll stage before accepting fixture output', async () => {
    const draft = revision()
    mocks.repository.getRevision.mockResolvedValue(draft)
    mocks.repository.activateDraft.mockResolvedValue({
      ...draft,
      activatedAt: '2026-08-12T01:00:00.000Z',
      activatedBy: ids.user,
      state: 'ACTIVE'
    })
    mocks.evaluator
      .mockResolvedValueOnce({
        result: {
          eligibility: { allowed: true, reasonCode: 'ALLOWED' },
          outcomes: [],
          rollRequests: [
            {
              id: '00000000-0000-4000-8000-000000000005',
              kind: 'ATTACK',
              configuration: '1d20',
              label: 'Attack',
              targetActorId: null
            }
          ]
        },
        trace: null
      })
      .mockResolvedValueOnce({
        result: {
          eligibility: { allowed: false, reasonCode: 'NO_CHARGES' },
          outcomes: [],
          rollRequests: []
        },
        trace: null
      })

    await expect(
      activateRulePackRevision({} as DBLike, ids.user, true, {
        revisionId: ids.revision,
        expectedChecksum: draft.checksum
      })
    ).resolves.toMatchObject({ lifecycle: 'ACTIVE' })

    expect(mocks.evaluator).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        context: expect.objectContaining({
          rolls: [expect.objectContaining({ normalizedExpression: '1d20', total: 1 })]
        })
      })
    )
  })

  it('simulates with trace and activates a conforming draft', async () => {
    const draft = revision()
    mocks.repository.getRevision.mockResolvedValue(draft)
    mocks.repository.activateDraft.mockResolvedValue({
      ...draft,
      activatedAt: '2026-08-12T01:00:00.000Z',
      activatedBy: ids.user,
      state: 'ACTIVE'
    })
    mocks.evaluator.mockResolvedValue({
      result: {
        eligibility: { allowed: false, reasonCode: 'NO_CHARGES' },
        outcomes: [],
        rollRequests: []
      },
      trace: { nodes: [] }
    })

    await expect(
      simulateRulePack({} as DBLike, ids.user, true, {
        document: draft.document as RulePackDocumentDto,
        input: { remainingCharges: 0 },
        modelKey: 'charges'
      })
    ).resolves.toMatchObject({ trace: { nodes: [] } })
    await expect(
      activateRulePackRevision({} as DBLike, ids.user, true, {
        revisionId: ids.revision,
        expectedChecksum: draft.checksum
      })
    ).resolves.toMatchObject({ lifecycle: 'ACTIVE' })
  })
})
