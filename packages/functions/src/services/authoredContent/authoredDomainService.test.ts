import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AuthoredActiveMetadata, AuthoredDraft, DBLike } from '@artificer-toolkit/db'
import type { NodeRuntimeNormalizeValuesResponseDto } from '@artificer-toolkit/schema/api/nodeRuntime'
import { cloneAuthoredItem } from '@artificer-toolkit/shared/utils'
import {
  activateAuthoredDomainDraft,
  activateAuthoredDomainInput,
  authoredDomainConfigs,
  deleteAuthoredDomainActive,
  discardAuthoredDomainDraft,
  duplicateAuthoredDomain,
  getAuthoredDomain,
  listAuthoredDomain,
  type AuthoredDomainRuntimeConfig
} from './authoredDomainService.js'

const mocks = vi.hoisted(() => ({
  contentRepository: {
    clearDraftBaseAfterActiveDelete: vi.fn(),
    deleteDraft: vi.fn(),
    findActiveByRoute: vi.fn(),
    findActiveBySubject: vi.fn(),
    findDraftByRoute: vi.fn(),
    findDraftBySubject: vi.fn(),
    lockDraftForActivation: vi.fn(),
    listDraftsByUser: vi.fn(),
    saveDraft: vi.fn()
  },
  routeRepository: {
    canAccessSubjectForUser: vi.fn(),
    delete: vi.fn(),
    ensure: vi.fn(),
    ensureMany: vi.fn(),
    resolveByPublicIdForUser: vi.fn(),
    resolveBySubjectForUser: vi.fn()
  },
  mediaRepository: {
    deleteAuthoredSlot: vi.fn(),
    getAuthoredSlot: vi.fn(),
    upsertAuthoredSlot: vi.fn()
  },
  authoredVersionRepository: {
    findActive: vi.fn(),
    publish: vi.fn()
  },
  vocabularySnapshotRepository: {
    findActive: vi.fn()
  },
  publishVersionedAuthoredAggregate: vi.fn(),
  prepare: vi.fn(),
  findById: vi.fn(),
  getAuthoredCatalogPage: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@artificer-toolkit/db')>()),
  createAuthoredContentRepository: () => mocks.contentRepository,
  getAuthoredCatalogPage: mocks.getAuthoredCatalogPage,
  createAuthoredVersionRepository: () => mocks.authoredVersionRepository,
  createAccountEntitlementsRepository: () => ({ lockTier: async () => 'FREE' as const }),
  createMediaRepository: () => mocks.mediaRepository,
  createAuthoredRouteIdRepository: () => mocks.routeRepository,
  createSystemVocabularySnapshotRepository: () => mocks.vocabularySnapshotRepository
}))

const nodeRuntimeMock = vi.hoisted(() => ({
  normalizeNodeRuntimeValues: vi.fn(
    async (
      _db: unknown,
      request: { values: Record<string, unknown> }
    ): Promise<NodeRuntimeNormalizeValuesResponseDto> => ({
      clearedPaths: [],
      values: request.values
    })
  )
}))

vi.mock('../nodeRuntime/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../nodeRuntime/index.js')>()),
  normalizeNodeRuntimeValues: nodeRuntimeMock.normalizeNodeRuntimeValues
}))

vi.mock('./versionedAuthoring.js', () => ({
  publishVersionedAuthoredAggregate: mocks.publishVersionedAuthoredAggregate
}))

const db = { isTransaction: true } as unknown as DBLike
const schema = z
  .object({
    id: z.string(),
    label: z.string(),
    requiredText: z.string(),
    systemId: z.string(),
    userId: z.string(),
    status: z.enum(['ACTIVE', 'DRAFT']).optional()
  })
  .passthrough()

function createConfig(): AuthoredDomainRuntimeConfig {
  return {
    createService: () => ({ prepare: mocks.prepare, findById: mocks.findById }),
    mapId: 'spell',
    schema,
    subjectKind: 'SPELL',
    table: 'spells'
  }
}

function createRuntimeConfig(
  overrides: Partial<AuthoredDomainRuntimeConfig>
): AuthoredDomainRuntimeConfig {
  return { ...createConfig(), ...overrides }
}

function createDraft(overrides: Partial<AuthoredDraft> = {}): AuthoredDraft {
  return {
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    userId: 'user-1',
    systemId: 'system-1',
    label: 'Draft Spell',
    status: 'DRAFT',
    payload: {
      id: 'spell-1',
      label: 'Draft Spell',
      requiredText: 'Valid',
      systemId: 'system-1',
      userId: 'user-1'
    },
    draftState: 'ACTIVE_WITH_DRAFT',
    baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createActive(overrides: Partial<AuthoredActiveMetadata> = {}): AuthoredActiveMetadata {
  return {
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    ownerUserId: 'user-1',
    systemId: 'system-1',
    label: 'Active Spell',
    isMaster: false,
    hasDraft: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  nodeRuntimeMock.normalizeNodeRuntimeValues.mockImplementation(
    async (_db: unknown, request: { values: Record<string, unknown> }) => ({
      clearedPaths: [],
      values: request.values
    })
  )
  mocks.routeRepository.ensure.mockResolvedValue({
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    publicId: 'spell-public'
  })
  mocks.routeRepository.ensureMany.mockResolvedValue(new Map())
  mocks.contentRepository.listDraftsByUser.mockResolvedValue([])
  mocks.routeRepository.resolveByPublicIdForUser.mockResolvedValue({
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    publicId: 'spell-public'
  })
  mocks.contentRepository.findActiveByRoute.mockResolvedValue({
    ...createActive(),
    publicId: 'spell-public'
  })
  mocks.contentRepository.findActiveBySubject.mockResolvedValue(createActive())
  mocks.authoredVersionRepository.findActive.mockResolvedValue({
    authored: {
      document: {
        id: 'spell-1',
        label: 'Active Spell',
        requiredText: 'Valid',
        systemId: 'system-1',
        userId: 'user-1',
        status: 'ACTIVE'
      }
    }
  })
  mocks.vocabularySnapshotRepository.findActive.mockResolvedValue({
    checksum: 'a'.repeat(64),
    snapshotId: 'snapshot-1',
    snapshotVersion: 1,
    systemId: 'system-1'
  })
  mocks.findById.mockResolvedValue({
    id: 'spell-1',
    label: 'Active Spell',
    requiredText: 'Valid',
    systemId: 'system-1',
    userId: 'user-1',
    status: 'ACTIVE'
  })
  mocks.prepare.mockImplementation(async (input: unknown) => ({ authored: input, compiled: {} }))
})

describe('getAuthoredDomain', () => {
  it('hydrates the active aggregate after resolving canonical active metadata', async () => {
    const response = await getAuthoredDomain(db, createConfig(), { id: 'spell-public' }, 'user-1')

    expect(response).toMatchObject({
      item: { label: 'Active Spell' },
      activeUpdatedAt: '2026-01-01T00:00:00.000Z',
      hasDraft: true,
      publicId: 'spell-public'
    })
    expect(mocks.contentRepository.findActiveByRoute).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      routeId: 'spell-public',
      userId: 'user-1'
    })
    expect(mocks.authoredVersionRepository.findActive).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })

  it('returns draft validation issues without writing when the draft view is incomplete', async () => {
    mocks.contentRepository.findDraftByRoute.mockResolvedValue({
      ...createDraft({
        payload: { id: 'spell-1' },
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null
      }),
      publicId: 'spell-public'
    })
    mocks.contentRepository.findActiveByRoute.mockResolvedValue(null)

    const response = await getAuthoredDomain(
      db,
      createConfig(),
      { id: 'spell-public', view: 'draft' },
      'user-1'
    )

    expect(response).toMatchObject({
      item: null,
      activeUpdatedAt: null,
      validationIssues: [{ path: ['requiredText'] }],
      draft: { subjectId: 'spell-1', baseActiveUpdatedAt: null }
    })
    expect(mocks.authoredVersionRepository.findActive).not.toHaveBeenCalled()
  })

  it('preserves invalid draft issues while falling back to the active aggregate', async () => {
    mocks.contentRepository.findDraftByRoute.mockResolvedValue({
      ...createDraft({ payload: {} }),
      publicId: 'spell-public'
    })

    const response = await getAuthoredDomain(
      db,
      createConfig(),
      { id: 'spell-public', view: 'draft' },
      'user-1'
    )

    expect(response).toMatchObject({
      item: { label: 'Active Spell' },
      validationIssues: [{ path: ['requiredText'] }]
    })
    expect(mocks.authoredVersionRepository.findActive).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })
})

describe('listAuthoredDomain', () => {
  it('maps the bounded root-envelope page without rehydrating an authored aggregate', async () => {
    mocks.getAuthoredCatalogPage.mockResolvedValue({
      items: [
        {
          activeUpdatedAt: '2026-01-01T00:00:00.000Z',
          description: null,
          id: 'spell-1',
          isMaster: true,
          label: 'Active Spell',
          ownerUserId: null,
          publicId: 'spell-public',
          status: 'ACTIVE',
          systemId: 'system-1',
          userId: 'master'
        }
      ],
      meta: {},
      page: { nextCursor: null, previousCursor: null, totalCount: 1 },
      summary: { activeCount: 1, masterCount: 1, ownedCount: 0 }
    })

    const result = await listAuthoredDomain(
      db,
      createConfig(),
      { direction: 'FORWARD', limit: 48, sort: 'name' },
      'user-1'
    )

    expect(mocks.getAuthoredCatalogPage).toHaveBeenCalledWith(db, {
      request: { direction: 'FORWARD', limit: 48, sort: 'name' },
      subjectKind: 'SPELL',
      userId: 'user-1'
    })
    expect(result).toMatchObject({
      page: { totalCount: 1 },
      summary: { activeCount: 1 },
      items: [
        {
          id: 'spell-1',
          permissions: { canCopy: true, canDelete: false, canEdit: false, canView: true },
          provenance: { kind: 'MASTER' }
        }
      ]
    })
    expect(mocks.authoredVersionRepository.findActive).not.toHaveBeenCalled()
    expect(mocks.findById).not.toHaveBeenCalled()
  })
})

describe('authored domain lifecycle', () => {
  it('duplicates a hydrated active aggregate into a deep-remapped owned draft', async () => {
    mocks.authoredVersionRepository.findActive.mockResolvedValue({
      authored: {
        document: {
        id: 'spell-1',
        label: 'Original Spell',
        requiredText: 'Valid',
      systemId: 'system-1',
      userId: 'user-1',
      status: 'ACTIVE',
          features: [
            { id: 'feature-1', options: [{ id: 'option-1' }], selectedOptionId: 'option-1' }
          ]
        }
      }
    })
    mocks.contentRepository.saveDraft.mockImplementation(async (input) =>
      createDraft({
        subjectId: input.subjectId,
        userId: input.userId,
        label: input.label,
        payload: input.payload,
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null
      })
    )

    const duplicate = await duplicateAuthoredDomain(db, createConfig(), 'spell-public', 'user-1')

    expect(duplicate).toMatchObject({
      label: 'Original Spell Copy',
      userId: 'user-1',
      draftState: 'DRAFT_ONLY'
    })
    expect(duplicate?.subjectId).not.toBe('spell-1')
    expect(mocks.contentRepository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Original Spell Copy',
        payload: expect.objectContaining({
          id: expect.not.stringMatching(/^spell-1$/),
          features: [
            expect.objectContaining({
              id: expect.not.stringMatching(/^feature-1$/),
              selectedOptionId: expect.any(String)
            })
          ]
        })
      })
    )
  })

  it('locks the saved edit draft, writes the normalized active aggregate, then deletes the draft', async () => {
    const draft = createDraft({
      payload: {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'Before',
        systemId: 'system-1',
        userId: 'user-1'
      }
    })
    mocks.contentRepository.saveDraft.mockResolvedValue(draft)
    mocks.contentRepository.lockDraftForActivation.mockResolvedValue(draft)
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(
      createActive({ hasDraft: false, updatedAt: '2026-01-02T00:00:00.000Z' })
    )
    nodeRuntimeMock.normalizeNodeRuntimeValues.mockResolvedValueOnce({
      clearedPaths: [],
      values: {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'After',
        systemId: 'system-1',
        userId: 'user-1'
      }
    })

    const response = await activateAuthoredDomainInput(
      db,
      createConfig(),
      {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'Before',
        systemId: 'system-1',
        userId: 'client-user'
      },
      'user-1'
    )

    expect(mocks.contentRepository.lockDraftForActivation).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ requiredText: 'After', status: 'ACTIVE', userId: 'user-1' })
    )
    expect(mocks.publishVersionedAuthoredAggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectKind: 'SPELL',
        authored: expect.objectContaining({ id: 'spell-1' })
      })
    )
    expect(mocks.contentRepository.deleteDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(response).toMatchObject({
      item: { label: 'Edited Spell', status: 'ACTIVE' },
      activeUpdatedAt: '2026-01-02T00:00:00.000Z'
    })
  })

  it('activates a stored draft through the same lock and delete path', async () => {
    const draft = createDraft()
    mocks.contentRepository.lockDraftForActivation.mockResolvedValue(draft)
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(createActive({ hasDraft: false }))

    await activateAuthoredDomainDraft(db, createConfig(), 'spell-1', 'user-1')

    expect(mocks.prepare).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ACTIVE', userId: 'user-1' })
    )
    expect(mocks.contentRepository.deleteDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
  })

  it('discards a draft and deletes its route only when no active item remains', async () => {
    mocks.contentRepository.findDraftBySubject.mockResolvedValue(
      createDraft({ draftState: 'DRAFT_ONLY', baseActiveUpdatedAt: null })
    )
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(null)

    await discardAuthoredDomainDraft(db, createConfig(), 'spell-public', 'user-1')

    expect(mocks.contentRepository.deleteDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(mocks.routeRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })

  it('deletes an owned active record after checking ownership', async () => {
    const deleted: string[] = []
    const deleteDb = {
      isTransaction: true,
      deleteFrom: () => {
        const query = {
          where: () => query,
          execute: async () => {
            deleted.push('spell-1')
          }
        }
        return query
      },
      selectFrom: () => {
        const query = {
          select: () => query,
          where: () => query,
          executeTakeFirst: async () => undefined
        }
        return query
      }
    } as unknown as DBLike
    mocks.contentRepository.findDraftBySubject.mockResolvedValue(null)

    await deleteAuthoredDomainActive(deleteDb, createConfig(), 'spell-public', 'user-1')

    expect(deleted).toEqual(['spell-1'])
    expect(mocks.contentRepository.clearDraftBaseAfterActiveDelete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
  })

  it('keeps the same-subject draft and its route when deleting active content', async () => {
    const deleteDb = {
      isTransaction: true,
      deleteFrom: () => {
        const query = { where: () => query, execute: async () => undefined }
        return query
      },
      selectFrom: () => {
        const query = {
          select: () => query,
          where: () => query,
          executeTakeFirst: async () => undefined
        }
        return query
      }
    } as unknown as DBLike
    mocks.contentRepository.findDraftBySubject.mockResolvedValue(createDraft())

    await deleteAuthoredDomainActive(deleteDb, createConfig(), 'spell-public', 'user-1')

    expect(mocks.contentRepository.clearDraftBaseAfterActiveDelete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(mocks.routeRepository.delete).not.toHaveBeenCalled()
  })

  it('removes the route after deleting the final active representation', async () => {
    const deleteDb = {
      isTransaction: true,
      deleteFrom: () => {
        const query = { where: () => query, execute: async () => undefined }
        return query
      },
      selectFrom: () => {
        const query = {
          select: () => query,
          where: () => query,
          executeTakeFirst: async () => undefined
        }
        return query
      }
    } as unknown as DBLike
    mocks.contentRepository.findDraftBySubject.mockResolvedValue(null)

    await deleteAuthoredDomainActive(deleteDb, createConfig(), 'spell-public', 'user-1')

    expect(mocks.routeRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })

  it('rejects unresolved routes and dependent parent deletes', async () => {
    mocks.routeRepository.resolveByPublicIdForUser.mockResolvedValueOnce(null)
    await expect(
      deleteAuthoredDomainActive(db, createConfig(), 'missing', 'user-1')
    ).rejects.toMatchObject({ name: 'NotFoundError' })

    mocks.routeRepository.resolveByPublicIdForUser.mockResolvedValue({
      subjectKind: 'CLASS',
      subjectId: 'class-1',
      publicId: 'class-public'
    })
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(
      createActive({ subjectKind: 'CLASS', subjectId: 'class-1' })
    )
    const dependentDb = {
      isTransaction: true,
      selectFrom: () => {
        const query = {
          select: () => query,
          where: () => query,
          executeTakeFirst: async () => ({ id: 'subclass-1' })
        }
        return query
      }
    } as unknown as DBLike

    await expect(
      deleteAuthoredDomainActive(
        dependentDb,
        createRuntimeConfig({ mapId: 'class', subjectKind: 'CLASS', table: 'classes' }),
        'class-public',
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentDependencyError' })
  })

  it('rejects direct activation of master and foreign active content', async () => {
    mocks.contentRepository.findActiveBySubject.mockResolvedValueOnce(
      createActive({ isMaster: true, ownerUserId: null })
    )
    await expect(
      activateAuthoredDomainInput(
        db,
        createConfig(),
        {
          id: 'spell-1',
          label: 'Edit',
          requiredText: 'Valid',
          systemId: 'system-1',
          userId: 'user-1'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    mocks.contentRepository.findActiveBySubject.mockResolvedValueOnce(
      createActive({ ownerUserId: 'other-user' })
    )
    await expect(
      activateAuthoredDomainInput(
        db,
        createConfig(),
        {
          id: 'spell-1',
          label: 'Edit',
          requiredText: 'Valid',
          systemId: 'system-1',
          userId: 'user-1'
        },
        'user-1'
      )
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })
  })

  it('discards drafts without deleting active content and removes the draft-only route', async () => {
    mocks.contentRepository.findDraftBySubject.mockResolvedValue(createDraft())
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(createActive())
    await discardAuthoredDomainDraft(db, createConfig(), 'spell-public', 'user-1')
    expect(mocks.contentRepository.deleteDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(mocks.routeRepository.delete).not.toHaveBeenCalled()

    mocks.contentRepository.findDraftBySubject.mockResolvedValue(
      createDraft({ draftState: 'DRAFT_ONLY', baseActiveUpdatedAt: null })
    )
    mocks.contentRepository.findActiveBySubject.mockResolvedValue(null)
    await discardAuthoredDomainDraft(db, createConfig(), 'spell-public', 'user-1')
    expect(mocks.routeRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })
})

describe('authored cloning and configuration', () => {
  it('regenerates nested owned ids while preserving external references', () => {
    const input = {
      id: 'race-1',
      label: 'Dragonborn',
      status: 'ACTIVE',
      systemId: 'system-1',
      parentRaceId: 'race-parent',
      equipmentIds: ['acid-vial'],
      features: [
        {
          id: 'feature-1',
          selectedOptionId: 'option-1',
          options: [{ id: 'option-1' }],
          effects: [
            {
              id: 'effect-1',
              paths: [
                {
                  id: 'path-1',
                  resultBlock: {
                    id: 'result-1',
                    outcomes: [{ id: 'outcome-1', equipmentId: 'acid-vial' }]
                  }
                }
              ]
            }
          ]
        }
      ]
    }
    const cloned = cloneAuthoredItem(input)

    expect(cloned.id).not.toBe(input.id)
    expect(cloned.features[0]?.id).not.toBe(input.features[0]?.id)
    expect(cloned.features[0]?.options[0]?.id).not.toBe(input.features[0]?.options[0]?.id)
    expect(cloned.features[0]?.selectedOptionId).toBe(cloned.features[0]?.options[0]?.id)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id).not.toBe(
      'outcome-1'
    )
    expect(cloned.parentRaceId).toBe('race-parent')
    expect(cloned.equipmentIds).toEqual(['acid-vial'])
  })

  it('registers one canonical configuration for every authored root domain', () => {
    expect(
      Object.entries(authoredDomainConfigs).map(([key, config]) => ({
        key,
        mapId: config.mapId,
        subjectKind: config.subjectKind,
        table: config.table
      }))
    ).toEqual([
      { key: 'backgrounds', mapId: 'background', subjectKind: 'BACKGROUND', table: 'backgrounds' },
      { key: 'classes', mapId: 'class', subjectKind: 'CLASS', table: 'classes' },
      { key: 'creatures', mapId: 'creature', subjectKind: 'CREATURE', table: 'creatures' },
      { key: 'equipment', mapId: 'equipment', subjectKind: 'EQUIPMENT', table: 'equipment' },
      { key: 'feats', mapId: 'feat', subjectKind: 'FEAT', table: 'feats' },
      { key: 'races', mapId: 'race', subjectKind: 'RACE', table: 'races' },
      { key: 'spells', mapId: 'spell', subjectKind: 'SPELL', table: 'spells' },
      { key: 'vehicles', mapId: 'vehicle', subjectKind: 'VEHICLE', table: 'vehicles' }
    ])
  })
})
