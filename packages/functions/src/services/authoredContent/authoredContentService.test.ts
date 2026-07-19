import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredDefinitionDraft, DBLike } from '@artificer-toolkit/db'
import {
  normalizeActivatedAuthoringInput,
  normalizeStoredDraftPayloadForActivation,
  normalizeAuthoredListResponse,
  normalizeAuthoredListResponseWithDrafts,
  requireAuthoredDraft,
  saveAuthoredDraft,
  assertWritableAuthoredSubject
} from './authoredContentService.js'

const draftRepositoryMock = vi.hoisted(() => ({
  discardDraft: vi.fn(),
  findBySubjects: vi.fn(),
  findBySubject: vi.fn(),
  findDraftBySubject: vi.fn(),
  listDraftsByUser: vi.fn(),
  saveDraft: vi.fn()
}))

const routeIdRepositoryMock = vi.hoisted(() => ({
  ensure: vi.fn(),
  ensureMany: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createAuthoredRouteIdRepository: () => routeIdRepositoryMock,
  createAuthoredDefinitionRepository: () => draftRepositoryMock
}))

const db = {} as DBLike

function createDraft(overrides: Partial<AuthoredDefinitionDraft> = {}): AuthoredDefinitionDraft {
  return {
    revisionId: 'revision-1',
    revisionNumber: 2,
    activeRevisionId: 'revision-1-active',
    baseActiveRevisionId: 'revision-1-active',
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    userId: 'user-1',
    systemId: 'system-1',
    label: 'Draft Spell',
    status: 'DRAFT',
    payload: {
      id: 'spell-1',
      label: 'Draft Spell'
    },
    draftState: 'ACTIVE_WITH_DRAFT',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('authored content draft helpers', () => {
  beforeEach(() => {
    draftRepositoryMock.discardDraft.mockReset()
    draftRepositoryMock.findBySubjects.mockReset()
    draftRepositoryMock.findBySubject.mockReset()
    draftRepositoryMock.findDraftBySubject.mockReset()
    draftRepositoryMock.listDraftsByUser.mockReset()
    draftRepositoryMock.saveDraft.mockReset()
    draftRepositoryMock.findBySubjects.mockImplementation(async ({ subjectIds }: { subjectIds: string[] }) => (
      subjectIds.map((subjectId) => ({
        subjectId,
        subjectKind: 'SPELL',
        ownerUserId: 'user-1',
        systemId: 'system-1',
        label: subjectId,
        isMaster: false,
        activeRevisionId: `${subjectId}-revision`,
        draftRevisionId: null,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }))
    ))
    routeIdRepositoryMock.ensure.mockReset()
    routeIdRepositoryMock.ensureMany.mockReset()
    routeIdRepositoryMock.ensure.mockImplementation(async ({ subjectId }: { subjectId: string }) => ({
      subjectKind: 'SPELL',
      subjectId,
      routeNumber: '1',
      publicId: `${subjectId}-public`,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    }))
    routeIdRepositoryMock.ensureMany.mockImplementation(async (_subjectKind: string, subjectIds: string[]) => (
      new Map(subjectIds.map((subjectId) => [subjectId, {
        subjectKind: 'SPELL',
        subjectId,
        routeNumber: '1',
        publicId: `${subjectId}-public`,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z'
      }]))
    ))
  })

  it('keeps active rows active and exposes owned drafts separately', async () => {
    draftRepositoryMock.listDraftsByUser.mockResolvedValue([
      createDraft(),
      createDraft({
        revisionId: 'revision-2',
        subjectId: 'spell-2',
        label: 'New Draft Spell',
        draftState: 'DRAFT_ONLY',
        activeRevisionId: null,
        baseActiveRevisionId: null
      })
    ])

    const response = await normalizeAuthoredListResponseWithDrafts(
      db,
      {
        items: [{
          id: 'spell-1',
          label: 'Active Spell',
          description: 'Still active.',
          status: 'ACTIVE',
          userId: 'user-1',
          ownerUserId: 'user-1',
          isMaster: false,
          systemId: 'system-1'
        }],
        meta: {}
      },
      'user-1',
      'SPELL'
    )

    expect(response.items).toHaveLength(1)
    expect(response.items[0]).toMatchObject({
      id: 'spell-1',
      label: 'Active Spell',
      publicId: 'spell-1-public',
      status: 'ACTIVE',
      permissions: { canEdit: true, canDelete: true },
      draft: { draftState: 'ACTIVE_WITH_DRAFT', publicId: 'spell-1-public' }
    })
    expect(response.drafts).toHaveLength(2)
    expect(response.drafts[1]).toMatchObject({
      subjectId: 'spell-2',
      label: 'New Draft Spell',
      publicId: 'spell-2-public',
      status: 'DRAFT',
      draftState: 'DRAFT_ONLY'
    })
  })

  it('keeps master rows read-only for every user', () => {
    const response = {
      items: [{
        id: 'spell-1',
        label: 'SRD Spell',
        status: 'ACTIVE',
        userId: 'master',
        ownerUserId: 'srd-owner',
        isMaster: true,
        systemId: 'system-1'
      }],
      meta: {}
    }

    expect(normalizeAuthoredListResponse(response, 'user-1').items[0]).toMatchObject({
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canEdit: false, canDelete: false }
    })
    expect(normalizeAuthoredListResponse(response, 'admin-user').items[0]).toMatchObject({
      provenance: { kind: 'MASTER', ownerUserId: null },
      permissions: { canEdit: false, canDelete: false }
    })
  })

  it('loads list draft overlays only for the authenticated user', async () => {
    draftRepositoryMock.listDraftsByUser.mockResolvedValue([])

    await normalizeAuthoredListResponseWithDrafts(
      db,
      {
        items: [],
        meta: {}
      },
      'user-1',
      'SPELL'
    )

    expect(draftRepositoryMock.listDraftsByUser).toHaveBeenCalledWith({
      userId: 'user-1',
      subjectKind: 'SPELL'
    })
  })

  it('saves draft identity and ownership from the server-owned subject', async () => {
    const draft = createDraft({ userId: 'server-user' })
    draftRepositoryMock.saveDraft.mockResolvedValue(draft)

    await expect(saveAuthoredDraft(db, {
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      systemId: 'system-1',
      label: 'Client Draft',
      payload: {
        id: 'client-controlled-id',
        label: 'Client Controlled Label',
        status: 'ACTIVE',
        userId: 'client-controlled-user',
        systemId: 'client-controlled-system'
      }
    }, 'server-user')).resolves.toEqual({
      ...draft,
      publicId: 'spell-1-public'
    })

    expect(draftRepositoryMock.saveDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'server-user',
      systemId: 'system-1',
      label: 'Client Draft',
      payload: {
        id: 'spell-1',
        label: 'Client Draft',
        status: 'DRAFT',
        userId: 'server-user',
        systemId: 'system-1'
      }
    })
  })

  it('forces activated records to ACTIVE with server-owned user id', () => {
    expect(normalizeActivatedAuthoringInput({
      id: 'spell-1',
      label: 'Draft Spell',
      userId: 'client-controlled-user',
      systemId: 'system-1',
      status: 'DRAFT'
    }, 'server-user')).toEqual({
      id: 'spell-1',
      label: 'Draft Spell',
      userId: 'server-user',
      systemId: 'system-1',
      status: 'ACTIVE'
    })
  })

  it('normalizes stored draft payload identity before activation', () => {
    const draft = createDraft({
      subjectId: 'server-subject-id',
      systemId: 'server-system',
      label: 'Server Label',
      payload: {
        id: 'stale-payload-id',
        label: 'Stale Payload Label',
        userId: 'stale-user',
        systemId: 'stale-system'
      }
    })

    expect(normalizeStoredDraftPayloadForActivation(draft, 'server-user')).toEqual({
      id: 'server-subject-id',
      label: 'Server Label',
      status: 'DRAFT',
      userId: 'server-user',
      systemId: 'server-system'
    })
  })

  it('throws a route-safe error when activating a missing draft', async () => {
    draftRepositoryMock.findDraftBySubject.mockResolvedValue(null)

    await expect(requireAuthoredDraft(db, 'SPELL', 'missing-spell', 'user-1'))
      .rejects
      .toMatchObject({
        name: 'AuthoredDraftNotFoundError',
        message: 'SPELL draft "missing-spell" was not found.'
      })
  })

  it('rejects writes to master and foreign definitions while allowing owned definitions', async () => {
    draftRepositoryMock.findBySubject.mockResolvedValueOnce({ isMaster: true, ownerUserId: null })
    await expect(assertWritableAuthoredSubject(
      db,
      'CREATURE',
      'master-creature',
      'user-1'
    )).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    draftRepositoryMock.findBySubject.mockResolvedValueOnce({ isMaster: true, ownerUserId: null })
    await expect(assertWritableAuthoredSubject(
      db,
      'CREATURE',
      'master-creature',
      'admin-user'
    )).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    draftRepositoryMock.findBySubject.mockResolvedValueOnce({ isMaster: false, ownerUserId: 'other-user' })
    await expect(assertWritableAuthoredSubject(
      db,
      'CREATURE',
      'foreign-creature',
      'user-1'
    )).rejects.toMatchObject({ name: 'AuthoredContentOwnershipError' })

    draftRepositoryMock.findBySubject.mockResolvedValueOnce({ isMaster: false, ownerUserId: 'user-1' })
    await expect(assertWritableAuthoredSubject(
      db,
      'CREATURE',
      'owned-creature',
      'user-1'
    )).resolves.toMatchObject({ isMaster: false, ownerUserId: 'user-1' })
  })
})
