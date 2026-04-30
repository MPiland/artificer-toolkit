import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthoredSubjectDraft, DBLike } from '@artificer-toolkit/db'
import {
  normalizeActivatedAuthoringInput,
  normalizeStoredDraftPayloadForActivation,
  normalizeAuthoredListResponseWithDrafts,
  resolveDraftActivationSubjectId,
  requireAuthoredDraft,
  saveAuthoredDraft
} from './authoredContent.js'

const draftRepositoryMock = vi.hoisted(() => ({
  findBySubject: vi.fn(),
  listByUser: vi.fn(),
  save: vi.fn(),
  delete: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createAuthoredSubjectDraftRepository: () => draftRepositoryMock
}))

const db = {} as DBLike

function createDraft(overrides: Partial<AuthoredSubjectDraft> = {}): AuthoredSubjectDraft {
  return {
    id: 'draft-1',
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
    baseActiveUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('authored content draft helpers', () => {
  beforeEach(() => {
    draftRepositoryMock.findBySubject.mockReset()
    draftRepositoryMock.listByUser.mockReset()
    draftRepositoryMock.save.mockReset()
    draftRepositoryMock.delete.mockReset()
  })

  it('merges owned drafts into active list rows and appends draft-only rows', async () => {
    draftRepositoryMock.listByUser.mockResolvedValue([
      createDraft(),
      createDraft({
        id: 'draft-2',
        subjectId: 'spell-2',
        label: 'New Draft Spell',
        draftState: 'DRAFT_ONLY'
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

    expect(response.items).toHaveLength(2)
    expect(response.items[0]).toMatchObject({
      id: 'spell-1',
      label: 'Draft Spell',
      status: 'DRAFT',
      permissions: { canEdit: true, canDelete: true },
      draft: { draftState: 'ACTIVE_WITH_DRAFT' }
    })
    expect(response.items[1]).toMatchObject({
      id: 'spell-2',
      label: 'New Draft Spell',
      status: 'DRAFT',
      provenance: { kind: 'OWNED', ownerUserId: 'user-1' },
      permissions: { canEdit: true, canCopy: true, canDelete: true },
      draft: { draftState: 'DRAFT_ONLY' }
    })
  })

  it('saves draft identity and ownership from the server-owned subject', async () => {
    const draft = createDraft({ userId: 'server-user' })
    draftRepositoryMock.save.mockResolvedValue(draft)

    await expect(saveAuthoredDraft(db, {
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      systemId: 'system-1',
      label: 'Client Draft',
      payload: {
        id: 'client-controlled-id',
        label: 'Client Controlled Label',
        userId: 'client-controlled-user',
        systemId: 'client-controlled-system'
      }
    }, 'server-user')).resolves.toEqual(draft)

    expect(draftRepositoryMock.save).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'server-user',
      systemId: 'system-1',
      label: 'Client Draft',
      payload: {
        id: 'spell-1',
        label: 'Client Draft',
        userId: 'server-user',
        systemId: 'system-1'
      },
      baseActiveUpdatedAt: null
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
      userId: 'server-user',
      systemId: 'server-system'
    })
  })

  it('throws a route-safe error when activating a missing draft', async () => {
    draftRepositoryMock.findBySubject.mockResolvedValue(null)

    await expect(requireAuthoredDraft(db, 'SPELL', 'missing-spell', 'user-1'))
      .rejects
      .toMatchObject({
        name: 'AuthoredDraftNotFoundError',
        message: 'SPELL draft "missing-spell" was not found.'
      })
  })

  it('uses the activation route id as the authoritative draft subject id', () => {
    const req = new Request('https://api.test/content/spells/route-spell-id/draft/activate')

    expect(resolveDraftActivationSubjectId('SPELL', 'route-spell-id', req)).toBe('route-spell-id')
    expect(() => resolveDraftActivationSubjectId('SPELL', 'body-spell-id', req)).toThrowError(
      'SPELL draft route id "route-spell-id" does not match request body subjectId "body-spell-id".'
    )
  })

  it('uses Race activation route ids to reject mismatched draft bodies', () => {
    const req = new Request('https://api.test/content/races/route-race-id/draft/activate')

    expect(resolveDraftActivationSubjectId('RACE', 'route-race-id', req)).toBe('route-race-id')
    expect(() => resolveDraftActivationSubjectId('RACE', 'body-race-id', req)).toThrowError(
      'RACE draft route id "route-race-id" does not match request body subjectId "body-race-id".'
    )
  })
})
