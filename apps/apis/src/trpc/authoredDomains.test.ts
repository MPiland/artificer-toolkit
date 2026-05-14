import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AuthoredSubjectDraft, DBLike } from '@artificer-toolkit/db'
import type { AuthoredRecord } from '../routes/authoredContent.js'
import {
  getAuthoredDomain,
  type AuthoredDomainRuntimeConfig
} from './authoredDomains.js'

const domainMocks = vi.hoisted(() => ({
  draftRepository: {
    findBySubject: vi.fn()
  },
  findById: vi.fn(),
  routeIdRepository: {
    canAccessSubjectForUser: vi.fn(),
    ensure: vi.fn(),
    resolveByPublicIdForUser: vi.fn(),
    resolveBySubjectForUser: vi.fn()
  }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredRouteIdRepository: () => domainMocks.routeIdRepository,
    createAuthoredSubjectDraftRepository: () => domainMocks.draftRepository
  }
})

const db = {} as DBLike

const authoredRecordSchema = z.object({
  id: z.string(),
  label: z.string(),
  requiredText: z.string(),
  systemId: z.string(),
  userId: z.string()
})

function createConfig(): AuthoredDomainRuntimeConfig {
  return {
    createService: () => ({
      execute: async (input) => ({ authored: input })
    }),
    findById: async (_db, id) => {
      const result = await domainMocks.findById(id)
      return result as AuthoredRecord | null
    },
    listQuery: async () => ({ items: [], meta: {} }),
    mapId: 'spell',
    schema: authoredRecordSchema,
    subjectKind: 'SPELL',
    table: 'spells'
  }
}

function createDraft(overrides: Partial<AuthoredSubjectDraft> = {}): AuthoredSubjectDraft {
  return {
    id: 'draft-1',
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    userId: 'user-1',
    systemId: 'system-1',
    label: 'Broken Draft Spell',
    status: 'DRAFT',
    payload: {
      id: 'spell-1',
      label: 'Broken Draft Spell'
    },
    draftState: 'DRAFT_ONLY',
    baseActiveUpdatedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('getAuthoredDomain', () => {
  beforeEach(() => {
    domainMocks.draftRepository.findBySubject.mockReset()
    domainMocks.findById.mockReset()
    domainMocks.routeIdRepository.canAccessSubjectForUser.mockReset()
    domainMocks.routeIdRepository.ensure.mockReset()
    domainMocks.routeIdRepository.resolveByPublicIdForUser.mockReset()
    domainMocks.routeIdRepository.resolveBySubjectForUser.mockReset()
    domainMocks.routeIdRepository.resolveByPublicIdForUser.mockResolvedValue({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      publicId: 'spell-public'
    })
    domainMocks.routeIdRepository.ensure.mockResolvedValue({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      routeNumber: '1',
      publicId: 'spell-public',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
  })

  it('returns invalid draft context when draft view has no active item', async () => {
    domainMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())
    domainMocks.findById.mockResolvedValue(null)

    const response = await getAuthoredDomain(db, createConfig(), {
      id: 'spell-public',
      view: 'draft'
    }, 'user-1')

    expect(response).toMatchObject({
      item: null,
      publicId: 'spell-public',
      draft: {
        id: 'draft-1',
        subjectId: 'spell-1',
        publicId: 'spell-public',
        label: 'Broken Draft Spell'
      },
      provenance: {
        kind: 'OWNED',
        ownerUserId: 'user-1'
      },
      permissions: {
        canView: true,
        canEdit: true,
        canCopy: false,
        canDelete: true
      }
    })
    expect(domainMocks.findById).toHaveBeenCalledWith('spell-1')
  })
})
