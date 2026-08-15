import type { DBLike, RulePackRevisionRecord } from '@artificer-toolkit/db'
import type { RulePackDocumentDto } from '@artificer-toolkit/schema/api/rules'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checksumRuleDocument } from './ruleChecksum.js'
import { dnd5e2014CanonicalRulePackDocument } from './systems/dnd5e/2014/canonicalRulePack.js'
import { dnd5e2014CharacterPolicyDocument } from './systems/dnd5e/2014/characterPolicy.js'
import { RULE_MODEL_CONTRACT_VERSION } from './ruleModelContracts.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  pack: '00000000-0000-4000-8000-000000000002',
  revision: '00000000-0000-4000-8000-000000000003'
}

const mocks = vi.hoisted(() => ({
  repository: {
    activateDraft: vi.fn(),
    backfillActiveCharacterRevision: vi.fn(),
    findActiveByRuleset: vi.fn(),
    findOrCreatePack: vi.fn(),
    findSeededRuleset: vi.fn(),
    listRevisions: vi.fn(),
    saveDraft: vi.fn()
  },
  conformance: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createRulePackRepository: () => mocks.repository
}))
vi.mock('./ruleConformance.js', () => ({ assertRulePackConformance: mocks.conformance }))

const { installDnd5e2014CanonicalRulePack } = await import('./canonicalRulePackInstaller.js')
const db = {} as DBLike

function revision(
  document: RulePackDocumentDto,
  state: RulePackRevisionRecord['state'] = 'DRAFT'
): RulePackRevisionRecord {
  return {
    id: ids.revision,
    rulePackId: ids.pack,
    revision: 1,
    evaluatorKind: 'ZEN',
    evaluatorVersion: '0.54.0',
    modelContractVersion: RULE_MODEL_CONTRACT_VERSION,
    document,
    checksum: checksumRuleDocument(document),
    createdBy: ids.actor,
    activatedBy: state === 'DRAFT' ? null : ids.actor,
    activatedAt: state === 'DRAFT' ? null : '2026-08-13T00:00:00.000Z',
    state,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z'
  }
}

function adminDocument(): RulePackDocumentDto {
  return {
    schemaVersion: 1,
    models: {
      'character-policy': { nodes: [], edges: [] },
      'admin-model': {
        nodes: [
          { id: 'input', type: 'inputNode' },
          { id: 'output', type: 'outputNode' }
        ],
        edges: [{ id: 'input-output', sourceId: 'input', targetId: 'output' }]
      }
    },
    fixtures: [
      {
        id: '00000000-0000-4000-8000-000000000004',
        label: 'Admin model fixture',
        modelKey: 'admin-model',
        input: {},
        expected: {}
      },
      {
        id: '00000000-0000-4000-8000-000000000005',
        label: 'Old character fixture',
        modelKey: 'character-policy',
        input: {},
        expected: {}
      }
    ]
  }
}

describe('canonical D&D 5e 2014 rule-pack installer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.repository.findSeededRuleset.mockResolvedValue({ ownerId: ids.actor })
    mocks.repository.findOrCreatePack.mockResolvedValue({ id: ids.pack })
    mocks.repository.findActiveByRuleset.mockResolvedValue(null)
    mocks.repository.backfillActiveCharacterRevision.mockResolvedValue(0)
    mocks.repository.listRevisions.mockResolvedValue([])
    mocks.repository.saveDraft.mockImplementation(
      ({ document }: { document: RulePackDocumentDto }) => Promise.resolve(revision(document))
    )
    mocks.repository.activateDraft.mockImplementation(({ checksum }: { checksum: string }) =>
      Promise.resolve({
        ...revision(dnd5e2014CanonicalRulePackDocument),
        checksum,
        state: 'ACTIVE'
      })
    )
  })

  it('creates and activates the first canonical revision', async () => {
    await expect(installDnd5e2014CanonicalRulePack(db)).resolves.toEqual({
      status: 'activated',
      revisionId: ids.revision,
      backfilledCharacters: 0
    })
    expect(mocks.repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ createdBy: ids.actor, expectedUpdatedAt: null })
    )
  })

  it('preserves admin models and fixtures while replacing canonical content', async () => {
    mocks.repository.findActiveByRuleset.mockResolvedValue(revision(adminDocument(), 'ACTIVE'))

    await installDnd5e2014CanonicalRulePack(db)

    const saved = mocks.repository.saveDraft.mock.calls[0]?.[0]?.document as RulePackDocumentDto
    expect(saved.models['admin-model']).toEqual(adminDocument().models['admin-model'])
    expect(saved.models['character-policy']).toEqual(
      dnd5e2014CharacterPolicyDocument.models['character-policy']
    )
    expect(saved.fixtures).toEqual(
      expect.arrayContaining([expect.objectContaining({ modelKey: 'admin-model' })])
    )
    expect(saved.fixtures).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Old character fixture' })])
    )
  })

  it('does nothing when the active revision already matches', async () => {
    mocks.repository.findActiveByRuleset.mockResolvedValue(
      revision(dnd5e2014CanonicalRulePackDocument, 'ACTIVE')
    )
    mocks.repository.backfillActiveCharacterRevision.mockResolvedValue(3)

    await expect(installDnd5e2014CanonicalRulePack(db)).resolves.toEqual({
      status: 'unchanged',
      revisionId: ids.revision,
      backfilledCharacters: 3
    })
    expect(mocks.repository.listRevisions).not.toHaveBeenCalled()
    expect(mocks.repository.activateDraft).not.toHaveBeenCalled()
    expect(mocks.repository.backfillActiveCharacterRevision).toHaveBeenCalledWith({
      rulesetCode: 'dnd5e',
      version: '2014',
      revisionId: ids.revision
    })
  })

  it('replaces an otherwise matching active v4 revision', async () => {
    mocks.repository.findActiveByRuleset.mockResolvedValue({
      ...revision(dnd5e2014CanonicalRulePackDocument, 'ACTIVE'),
      modelContractVersion: 4
    })

    await expect(installDnd5e2014CanonicalRulePack(db)).resolves.toMatchObject({
      status: 'activated'
    })
    expect(mocks.repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ modelContractVersion: RULE_MODEL_CONTRACT_VERSION })
    )
  })

  it('activates an existing matching draft', async () => {
    mocks.repository.listRevisions.mockResolvedValue([revision(dnd5e2014CanonicalRulePackDocument)])

    await expect(installDnd5e2014CanonicalRulePack(db)).resolves.toEqual({
      status: 'activated',
      revisionId: ids.revision,
      backfilledCharacters: 0
    })
    expect(mocks.repository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ expectedUpdatedAt: '2026-08-13T00:00:00.000Z' })
    )
  })

  it('does not activate a stale canonical merge after another revision becomes active', async () => {
    mocks.repository.activateDraft.mockResolvedValue(null)

    await expect(installDnd5e2014CanonicalRulePack(db)).rejects.toThrow(
      'Canonical dnd5e/2014 rule-pack installation conflicted with another activation.'
    )

    expect(mocks.repository.activateDraft).toHaveBeenCalledWith(
      expect.objectContaining({ expectedActiveRevisionId: null })
    )
    expect(mocks.repository.backfillActiveCharacterRevision).not.toHaveBeenCalled()
  })

  it('refuses to overwrite a different admin draft', async () => {
    mocks.repository.listRevisions.mockResolvedValue([revision(adminDocument())])

    await expect(installDnd5e2014CanonicalRulePack(db)).rejects.toThrow(
      'Cannot install canonical dnd5e/2014 rules while a different admin draft exists.'
    )
    expect(mocks.repository.activateDraft).not.toHaveBeenCalled()
  })
})
