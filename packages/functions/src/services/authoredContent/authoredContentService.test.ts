import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredActiveMetadata, AuthoredDraft, DBLike } from '@artificer-toolkit/db'
import {
  assertWritableAuthoredSubject,
  normalizeActivatedAuthoringInput,
  normalizeAuthoredListResponse,
  normalizeAuthoredListResponseWithDrafts,
  normalizeStoredDraftPayloadForActivation,
  requireAuthoredDraft,
  saveAuthoredDraft
} from './authoredContentService.js'

const contentRepositoryMock = vi.hoisted(() => ({
  forDb: vi.fn(),
  findActiveBySubject: vi.fn(),
  findActiveBySubjects: vi.fn(),
  findDraftBySubject: vi.fn(),
  listDraftsByUser: vi.fn(),
  saveDraft: vi.fn()
}))

const routeIdRepositoryMock = vi.hoisted(() => ({
  forDb: vi.fn(),
  ensure: vi.fn(),
  ensureMany: vi.fn()
}))

const entitlementMocks = vi.hoisted(() => ({
  withLockedLimits: vi.fn(),
  transaction: { isTransaction: true } as DBLike
}))

vi.mock('@artificer-toolkit/db', () => ({
  createAuthoredContentRepository: (database: DBLike) => {
    contentRepositoryMock.forDb(database)
    return contentRepositoryMock
  },
  createAuthoredRouteIdRepository: (database: DBLike) => {
    routeIdRepositoryMock.forDb(database)
    return routeIdRepositoryMock
  }
}))

vi.mock('../account/entitlementService.js', () => ({
  withLockedEntitlementLimits: entitlementMocks.withLockedLimits
}))

const db = {} as DBLike

function createDraft(overrides: Partial<AuthoredDraft> = {}): AuthoredDraft {
  return {
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    userId: 'user-1',
    systemId: 'system-1',
    label: 'Draft Spell',
    status: 'DRAFT',
    payload: { id: 'spell-1', label: 'Draft Spell' },
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
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides
  }
}

describe('authored content draft helpers', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    entitlementMocks.withLockedLimits.mockImplementation(
      async (
        _db: DBLike,
        _userId: string,
        callback: (trx: DBLike, limits: { homebrewRoots: number | null }) => Promise<unknown>
      ) => callback(entitlementMocks.transaction, { homebrewRoots: 20 })
    )
    contentRepositoryMock.findActiveBySubjects.mockImplementation(
      async ({ subjectIds }: { subjectIds: string[] }) =>
        subjectIds.map((subjectId) => createActive({ subjectId, label: subjectId }))
    )
    routeIdRepositoryMock.ensure.mockImplementation(
      async ({ subjectId }: { subjectId: string }) => ({
        subjectKind: 'SPELL',
        subjectId,
        routeNumber: '1',
        publicId: `${subjectId}-public`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      })
    )
    routeIdRepositoryMock.ensureMany.mockImplementation(
      async (_kind: string, subjectIds: string[]) =>
        new Map(subjectIds.map((subjectId) => [subjectId, { publicId: `${subjectId}-public` }]))
    )
  })

  it('keeps active rows active and exposes owned drafts separately', async () => {
    contentRepositoryMock.listDraftsByUser.mockResolvedValue([
      createDraft(),
      createDraft({
        subjectId: 'spell-2',
        label: 'New Draft Spell',
        draftState: 'DRAFT_ONLY',
        baseActiveUpdatedAt: null
      })
    ])

    const response = await normalizeAuthoredListResponseWithDrafts(
      db,
      {
        items: [
          {
            id: 'spell-1',
            label: 'Active Spell',
            description: 'Still active.',
            status: 'ACTIVE',
            userId: 'user-1',
            ownerUserId: 'user-1',
            isMaster: false,
            systemId: 'system-1'
          }
        ],
        meta: {}
      },
      'user-1',
      'SPELL'
    )

    expect(response.items[0]).toMatchObject({
      publicId: 'spell-1-public',
      activeUpdatedAt: '2026-01-02T00:00:00.000Z',
      draft: { draftState: 'ACTIVE_WITH_DRAFT', baseActiveUpdatedAt: '2026-01-01T00:00:00.000Z' }
    })
    expect(response.drafts[1]).toMatchObject({
      subjectId: 'spell-2',
      draftState: 'DRAFT_ONLY',
      baseActiveUpdatedAt: null
    })
    expect(contentRepositoryMock.listDraftsByUser).toHaveBeenCalledWith({
      userId: 'user-1',
      subjectKind: 'SPELL'
    })
  })

  it('keeps master rows read-only for every user', () => {
    const response = normalizeAuthoredListResponse(
      {
        items: [
          {
            id: 'spell-1',
            label: 'SRD Spell',
            status: 'ACTIVE',
            userId: 'master',
            ownerUserId: null,
            isMaster: true,
            systemId: 'system-1'
          }
        ],
        meta: {}
      },
      'user-1'
    )

    expect(response.items[0]).toMatchObject({
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canEdit: false, canDelete: false }
    })
  })

  it('saves a new root with locked entitlement limits in the draft transaction', async () => {
    const draft = createDraft({ userId: 'server-user' })
    contentRepositoryMock.saveDraft.mockResolvedValue(draft)

    await expect(
      saveAuthoredDraft(
        db,
        {
          subjectKind: 'SPELL',
          subjectId: 'spell-1',
          systemId: 'system-1',
          label: 'Client Draft',
          payload: {
            id: 'client-id',
            label: 'Client Label',
            status: 'ACTIVE',
            userId: 'client-user',
            systemId: 'client-system'
          }
        },
        'server-user'
      )
    ).resolves.toEqual({ ...draft, publicId: 'spell-1-public' })

    expect(contentRepositoryMock.saveDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'server-user',
      systemId: 'system-1',
      label: 'Client Draft',
      rootLimit: 20,
      payload: {
        id: 'spell-1',
        label: 'Client Draft',
        status: 'DRAFT',
        userId: 'server-user',
        systemId: 'system-1'
      }
    })
    expect(entitlementMocks.withLockedLimits).toHaveBeenCalledWith(
      db,
      'server-user',
      expect.any(Function)
    )
    expect(contentRepositoryMock.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({ rootLimit: 20 })
    )
    expect(contentRepositoryMock.forDb).toHaveBeenCalledWith(entitlementMocks.transaction)
    expect(routeIdRepositoryMock.ensure).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
    expect(routeIdRepositoryMock.forDb).toHaveBeenCalledWith(entitlementMocks.transaction)
  })

  it('does not create a route when the locked homebrew-root limit rejects a new draft', async () => {
    contentRepositoryMock.saveDraft.mockRejectedValue(new Error('homebrew-root limit reached'))

    await expect(
      saveAuthoredDraft(
        db,
        {
          subjectKind: 'SPELL',
          subjectId: 'spell-over-limit',
          systemId: 'system-1',
          label: 'Over Limit Spell',
          payload: {}
        },
        'user-1'
      )
    ).rejects.toThrow('homebrew-root limit reached')

    expect(contentRepositoryMock.saveDraft).toHaveBeenCalledTimes(1)
    expect(routeIdRepositoryMock.ensure).not.toHaveBeenCalled()
  })

  it('normalizes identities before activation and rejects missing drafts', async () => {
    expect(
      normalizeActivatedAuthoringInput(
        { id: 'spell-1', label: 'Draft', userId: 'client', systemId: 'system-1', status: 'DRAFT' },
        'server'
      )
    ).toMatchObject({ userId: 'server', status: 'ACTIVE' })
    expect(
      normalizeStoredDraftPayloadForActivation(
        createDraft({ payload: { id: 'stale-id' } }),
        'server'
      )
    ).toMatchObject({ id: 'spell-1', label: 'Draft Spell', userId: 'server', status: 'DRAFT' })

    contentRepositoryMock.findDraftBySubject.mockResolvedValue(null)
    await expect(
      requireAuthoredDraft(db, 'SPELL', 'missing-spell', 'user-1')
    ).rejects.toMatchObject({
      name: 'AuthoredDraftNotFoundError'
    })
  })

  it('rejects writes to master and foreign active content while allowing owned active content', async () => {
    contentRepositoryMock.findActiveBySubject.mockResolvedValueOnce(
      createActive({ isMaster: true, ownerUserId: null })
    )
    await expect(
      assertWritableAuthoredSubject(db, 'SPELL', 'spell-1', 'user-1')
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    contentRepositoryMock.findActiveBySubject.mockResolvedValueOnce(
      createActive({ ownerUserId: 'other-user' })
    )
    await expect(
      assertWritableAuthoredSubject(db, 'SPELL', 'spell-1', 'user-1')
    ).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    contentRepositoryMock.findActiveBySubject.mockResolvedValueOnce(createActive())
    await expect(
      assertWritableAuthoredSubject(db, 'SPELL', 'spell-1', 'user-1')
    ).resolves.toMatchObject({ ownerUserId: 'user-1' })
  })
})
