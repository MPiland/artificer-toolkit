import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type {
  AuthoredDefinitionDraft,
  AuthoredDefinitionSelectedRevision,
  DBLike
} from '@artificer-toolkit/db'
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
  type AuthoredDomainRuntimeConfig
} from './authoredDomainService.js'

const domainMocks = vi.hoisted(() => ({
  draftRepository: {
    activateDraft: vi.fn(),
    deleteActive: vi.fn(),
    discardDraft: vi.fn(),
    findBySubject: vi.fn(),
    findDraftBySubject: vi.fn(),
    findSelectedRevision: vi.fn(),
    saveDraft: vi.fn()
  },
  findById: vi.fn(),
  routeIdRepository: {
    canAccessSubjectForUser: vi.fn(),
    delete: vi.fn(),
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
    createAuthoredDefinitionRepository: () => domainMocks.draftRepository
  }
})

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

vi.mock('../nodeRuntime/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../nodeRuntime/index.js')>()

  return {
    ...actual,
    normalizeNodeRuntimeValues: nodeRuntimeMock.normalizeNodeRuntimeValues
  }
})

const db = { isTransaction: true } as unknown as DBLike

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
    listQuery: async () => ({ items: [], meta: {} }),
    mapId: 'spell',
    schema: authoredRecordSchema,
    subjectKind: 'SPELL',
    table: 'spells'
  }
}

function createRuntimeConfig(
  overrides: Partial<AuthoredDomainRuntimeConfig> = {}
): AuthoredDomainRuntimeConfig {
  return {
    ...createConfig(),
    ...overrides
  }
}

type FakeRow = Record<string, unknown>

function createFakeDb(initialRows: Record<string, FakeRow[]>) {
  const rows = new Map(
    Object.entries(initialRows).map(([table, tableRows]) => [table, [...tableRows]])
  )

  return {
    rows,
    db: {
      isTransaction: true,
      selectFrom: (table: string) => createSelectQuery(rows, table),
      deleteFrom: (table: string) => createDeleteQuery(rows, table)
    } as unknown as DBLike
  }
}

function createSelectQuery(rows: Map<string, FakeRow[]>, table: string) {
  const filters: Array<{ field: string; value: unknown }> = []
  const query = {
    select: () => query,
    where: (field: string, _operator: string, value: unknown) => {
      filters.push({ field, value })
      return query
    },
    executeTakeFirst: async () =>
      (rows.get(table) ?? []).find((row) =>
        filters.every((filter) => row[filter.field] === filter.value)
      ) ?? undefined
  }

  return query
}

function createDeleteQuery(rows: Map<string, FakeRow[]>, table: string) {
  const filters: Array<{ field: string; value: unknown }> = []
  const query = {
    where: (field: string, _operator: string, value: unknown) => {
      filters.push({ field, value })
      return query
    },
    execute: async () => {
      rows.set(
        table,
        (rows.get(table) ?? []).filter(
          (row) => !filters.every((filter) => row[filter.field] === filter.value)
        )
      )
    }
  }

  return query
}

function createDraft(overrides: Partial<AuthoredDefinitionDraft> = {}): AuthoredDefinitionDraft {
  return {
    revisionId: 'spell-revision-1',
    revisionNumber: 1,
    activeRevisionId: null,
    baseActiveRevisionId: null,
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
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createDefinition(overrides: Record<string, unknown> = {}) {
  return {
    subjectId: 'spell-1',
    subjectKind: 'SPELL',
    ownerUserId: 'user-1',
    systemId: 'system-1',
    label: 'Spell',
    isMaster: false,
    activeRevisionId: 'spell-revision-1',
    draftRevisionId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

function createSelectedRevision(
  overrides: Partial<AuthoredDefinitionSelectedRevision> = {}
): AuthoredDefinitionSelectedRevision {
  return {
    subjectKind: 'SPELL',
    subjectId: 'spell-1',
    ownerUserId: 'user-1',
    systemId: 'system-1',
    label: 'Broken Draft Spell',
    isMaster: false,
    publicId: 'spell-public',
    activeRevisionId: null,
    draftRevisionId: 'spell-revision-1',
    revisionId: 'spell-revision-1',
    revisionNumber: 1,
    payload: { id: 'spell-1', label: 'Broken Draft Spell' },
    baseActiveRevisionId: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  }
}

describe('getAuthoredDomain', () => {
  beforeEach(() => {
    domainMocks.draftRepository.activateDraft.mockReset()
    domainMocks.draftRepository.deleteActive.mockReset()
    domainMocks.draftRepository.discardDraft.mockReset()
    domainMocks.draftRepository.findBySubject.mockReset()
    domainMocks.draftRepository.findDraftBySubject.mockReset()
    domainMocks.draftRepository.findSelectedRevision.mockReset()
    domainMocks.draftRepository.saveDraft.mockReset()
    domainMocks.findById.mockReset()
    domainMocks.routeIdRepository.canAccessSubjectForUser.mockReset()
    domainMocks.routeIdRepository.delete.mockReset()
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

  it('reads active detail from the selected canonical revision without hydrating projections or drafts', async () => {
    domainMocks.draftRepository.findSelectedRevision.mockResolvedValue(
      createSelectedRevision({
        label: 'Harm',
        activeRevisionId: 'spell-revision-1',
        draftRevisionId: 'spell-revision-2',
        payload: {
          id: 'spell-1',
          label: 'Harm',
          requiredText: 'Valid',
          systemId: 'system-1',
          userId: 'user-1'
        }
      })
    )

    const response = await getAuthoredDomain(
      db,
      createConfig(),
      {
        id: 'spell-public'
      },
      'user-1'
    )

    expect(response).toMatchObject({
      activeRevisionId: 'spell-revision-1',
      hasDraft: true,
      item: { label: 'Harm' },
      publicId: 'spell-public'
    })
    expect(domainMocks.draftRepository.findSelectedRevision).toHaveBeenCalledWith({
      routeId: 'spell-public',
      subjectKind: 'SPELL',
      userId: 'user-1',
      view: 'active'
    })
    expect(domainMocks.draftRepository.findDraftBySubject).not.toHaveBeenCalled()
  })

  it('returns invalid draft context when draft view has no active item', async () => {
    domainMocks.draftRepository.findSelectedRevision
      .mockResolvedValueOnce(createSelectedRevision())
      .mockResolvedValueOnce(null)

    const response = await getAuthoredDomain(
      db,
      createConfig(),
      {
        id: 'spell-public',
        view: 'draft'
      },
      'user-1'
    )

    expect(response).toMatchObject({
      item: null,
      validationIssues: [
        {
          code: 'invalid_type',
          message: expect.any(String),
          path: ['requiredText']
        }
      ],
      publicId: 'spell-public',
      draft: {
        revisionId: 'spell-revision-1',
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
    expect(domainMocks.draftRepository.findDraftBySubject).not.toHaveBeenCalled()
  })

  it('preserves invalid draft issues when falling back to an active item', async () => {
    const { db: fakeDb } = createFakeDb({
      spells: [{ id: 'spell-1', is_master: false, user_id: 'user-1' }]
    })
    domainMocks.draftRepository.findSelectedRevision
      .mockResolvedValueOnce(
        createSelectedRevision({
          activeRevisionId: 'spell-revision-1',
          baseActiveRevisionId: 'spell-revision-1'
        })
      )
      .mockResolvedValueOnce(
        createSelectedRevision({
          label: 'Active Spell',
          activeRevisionId: 'spell-revision-1',
          revisionId: 'spell-revision-1',
          payload: { requiredText: 'Valid' }
        })
      )

    const response = await getAuthoredDomain(
      fakeDb,
      createConfig(),
      {
        id: 'spell-public',
        view: 'draft'
      },
      'user-1'
    )

    expect(response).toMatchObject({
      item: { label: 'Active Spell' },
      validationIssues: [{ path: ['requiredText'] }]
    })
  })

  it('duplicates an active item into a new owned draft', async () => {
    domainMocks.draftRepository.findBySubject.mockImplementation(
      async ({ subjectId }: { subjectId: string }) =>
        subjectId === 'spell-1' ? createDefinition() : null
    )
    domainMocks.draftRepository.saveDraft.mockImplementation(
      async (input: {
        subjectId: string
        userId: string
        systemId: string
        label: string
        payload: AuthoredDefinitionDraft['payload']
      }) =>
        createDraft({
          subjectId: input.subjectId,
          userId: input.userId,
          systemId: input.systemId,
          label: input.label,
          payload: input.payload
        })
    )
    domainMocks.draftRepository.findSelectedRevision.mockResolvedValue(
      createSelectedRevision({
        label: 'Original Spell',
        activeRevisionId: 'spell-revision-1',
        draftRevisionId: null,
        payload: { requiredText: 'Required text' }
      })
    )

    const duplicate = await duplicateAuthoredDomain(db, createConfig(), 'spell-public', 'user-2')

    expect(duplicate).toMatchObject({
      label: 'Original Spell Copy',
      userId: 'user-2'
    })
    expect(duplicate?.subjectId).not.toBe('spell-1')
    expect(domainMocks.draftRepository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        label: 'Original Spell Copy',
        payload: expect.objectContaining({
          label: 'Original Spell Copy',
          status: 'DRAFT',
          userId: 'user-2'
        }),
        userId: 'user-2'
      })
    )
  })
})

describe('authored domain activation', () => {
  beforeEach(() => {
    domainMocks.draftRepository.activateDraft.mockReset()
    domainMocks.draftRepository.findBySubject.mockReset()
    domainMocks.draftRepository.saveDraft.mockReset()
    domainMocks.findById.mockReset()
    domainMocks.routeIdRepository.canAccessSubjectForUser.mockReset()
    domainMocks.routeIdRepository.delete.mockReset()
    domainMocks.routeIdRepository.ensure.mockReset()
    domainMocks.routeIdRepository.resolveByPublicIdForUser.mockReset()
    domainMocks.routeIdRepository.resolveBySubjectForUser.mockReset()
    nodeRuntimeMock.normalizeNodeRuntimeValues.mockClear()
    domainMocks.routeIdRepository.ensure.mockResolvedValue({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      routeNumber: '1',
      publicId: 'spell-public',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
    })
  })

  it('persists and promotes the exact owned revision before returning the active item', async () => {
    const { db: fakeDb } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findBySubject
      .mockResolvedValueOnce(createDefinition())
      .mockResolvedValue(createDefinition({ activeRevisionId: 'spell-revision-2' }))
    domainMocks.draftRepository.saveDraft.mockResolvedValue(
      createDraft({
        revisionId: 'spell-revision-2',
        revisionNumber: 2,
        activeRevisionId: 'spell-revision-1',
        baseActiveRevisionId: 'spell-revision-1'
      })
    )

    const response = await activateAuthoredDomainInput(
      fakeDb,
      createConfig(),
      {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'Required text',
        systemId: 'system-1',
        userId: 'client-controlled-user'
      },
      'user-1'
    )

    expect(response).toMatchObject({
      item: {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'Required text',
        status: 'ACTIVE',
        userId: 'user-1'
      },
      activeRevisionId: 'spell-revision-2',
      permissions: {
        canEdit: true,
        canDelete: true
      },
      provenance: {
        kind: 'OWNED',
        ownerUserId: 'user-1'
      },
      publicId: 'spell-public'
    })
    expect(domainMocks.draftRepository.activateDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1',
      revisionId: 'spell-revision-2'
    })
    expect(domainMocks.draftRepository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          id: 'spell-1',
          label: 'Edited Spell',
          status: 'ACTIVE',
          userId: 'user-1'
        })
      })
    )
  })

  it('promotes a normalized ACTIVE payload instead of the stored DRAFT payload', async () => {
    const { db: fakeDb } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findBySubject
      .mockResolvedValueOnce(createDefinition({ draftRevisionId: 'spell-revision-1' }))
      .mockResolvedValue(createDefinition({ activeRevisionId: 'spell-revision-2' }))
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(
      createDraft({
        payload: {
          id: 'spell-1',
          label: 'Edited Spell',
          requiredText: 'Before normalization',
          status: 'DRAFT',
          systemId: 'system-1',
          userId: 'user-1'
        }
      })
    )
    nodeRuntimeMock.normalizeNodeRuntimeValues.mockResolvedValueOnce({
      clearedPaths: [['obsoleteField']],
      values: {
        id: 'spell-1',
        label: 'Edited Spell',
        requiredText: 'After normalization',
        status: 'DRAFT',
        systemId: 'system-1',
        userId: 'user-1'
      }
    })
    domainMocks.draftRepository.saveDraft.mockResolvedValue(
      createDraft({
        revisionId: 'spell-revision-2',
        revisionNumber: 2,
        activeRevisionId: 'spell-revision-1',
        baseActiveRevisionId: 'spell-revision-1'
      })
    )

    await activateAuthoredDomainDraft(fakeDb, createConfig(), 'spell-1', 'user-1')

    expect(domainMocks.draftRepository.saveDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          requiredText: 'After normalization',
          status: 'ACTIVE'
        })
      })
    )
    expect(domainMocks.draftRepository.activateDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        revisionId: 'spell-revision-2'
      })
    )
  })

  it('keeps master definitions locked from direct activation', async () => {
    const { db: fakeDb } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: true, ownerUserId: 'srd-owner' }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(
      createDefinition({
        isMaster: true,
        ownerUserId: null
      })
    )

    await expect(
      activateAuthoredDomainInput(
        fakeDb,
        createConfig(),
        {
          id: 'spell-1',
          label: 'Edited SRD Spell',
          requiredText: 'Required text',
          systemId: 'system-1',
          userId: 'client-controlled-user'
        },
        'admin-user'
      )
    ).rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')
  })
})

describe('authored domain deletes', () => {
  beforeEach(() => {
    domainMocks.draftRepository.deleteActive.mockReset()
    domainMocks.draftRepository.discardDraft.mockReset()
    domainMocks.draftRepository.findBySubject.mockReset()
    domainMocks.draftRepository.findDraftBySubject.mockReset()
    domainMocks.draftRepository.findBySubject.mockResolvedValue(createDefinition())
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(null)
    domainMocks.routeIdRepository.canAccessSubjectForUser.mockReset()
    domainMocks.routeIdRepository.delete.mockReset()
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

  it('deletes an owned active record while leaving its same-subject draft intact', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(createDraft())

    await deleteAuthoredDomainActive(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toEqual([])
    expect(domainMocks.draftRepository.discardDraft).not.toHaveBeenCalled()
    expect(domainMocks.routeIdRepository.delete).not.toHaveBeenCalled()
  })

  it('cleans the route identity when deleting the last active representation', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(null)
    domainMocks.routeIdRepository.delete.mockImplementation(async () => {
      expect(rows.get('spells')).toEqual([])
    })

    await deleteAuthoredDomainActive(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toEqual([])
    expect(domainMocks.routeIdRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })

  it('rejects active deletes when the route id cannot resolve', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.routeIdRepository.resolveByPublicIdForUser.mockResolvedValue(null)

    await expect(
      deleteAuthoredDomainActive(fakeDb, createConfig(), 'missing-public-id', 'user-1')
    ).rejects.toHaveProperty('name', 'NotFoundError')

    expect(rows.get('spells')).toHaveLength(1)
    expect(domainMocks.routeIdRepository.delete).not.toHaveBeenCalled()
  })

  it('rejects master and foreign active deletes', async () => {
    const master = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: true, ownerUserId: null }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(
      createDefinition({
        isMaster: true,
        ownerUserId: null
      })
    )

    await expect(
      deleteAuthoredDomainActive(master.db, createConfig(), 'spell-public', 'user-1')
    ).rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')

    await expect(
      deleteAuthoredDomainActive(master.db, createConfig(), 'spell-public', 'admin-user')
    ).rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')

    const foreign = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-2' }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(
      createDefinition({
        ownerUserId: 'user-2'
      })
    )

    await expect(
      deleteAuthoredDomainActive(foreign.db, createConfig(), 'spell-public', 'user-1')
    ).rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')
  })

  it('blocks parent active deletes with dependent active records', async () => {
    const { db: fakeDb } = createFakeDb({
      classes: [
        { id: 'class-1', isMaster: false, ownerUserId: 'user-1' },
        { id: 'subclass-1', isMaster: false, ownerUserId: 'user-1', parent_class_id: 'class-1' }
      ]
    })
    domainMocks.routeIdRepository.resolveByPublicIdForUser.mockResolvedValue({
      subjectKind: 'CLASS',
      subjectId: 'class-1',
      publicId: 'class-public'
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(
      createDefinition({
        subjectId: 'class-1',
        subjectKind: 'CLASS'
      })
    )

    await expect(
      deleteAuthoredDomainActive(
        fakeDb,
        createRuntimeConfig({
          mapId: 'class',
          subjectKind: 'CLASS',
          table: 'classes'
        }),
        'class-public',
        'user-1'
      )
    ).rejects.toHaveProperty('name', 'AuthoredContentDependencyError')
  })

  it('deletes a draft without deleting the active record', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(createDraft())

    await discardAuthoredDomainDraft(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toHaveLength(1)
    expect(domainMocks.draftRepository.discardDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(domainMocks.routeIdRepository.delete).not.toHaveBeenCalled()
  })

  it('removes orphan route identity when deleting a draft-only record', async () => {
    const { db: fakeDb } = createFakeDb({ spells: [] })
    domainMocks.draftRepository.findDraftBySubject.mockResolvedValue(createDraft())
    domainMocks.draftRepository.findBySubject.mockResolvedValue(
      createDefinition({
        activeRevisionId: null,
        draftRevisionId: 'spell-revision-1'
      })
    )
    domainMocks.routeIdRepository.delete.mockImplementation(async () => {
      expect(domainMocks.draftRepository.discardDraft).toHaveBeenCalledWith({
        subjectKind: 'SPELL',
        subjectId: 'spell-1',
        userId: 'user-1'
      })
    })

    await discardAuthoredDomainDraft(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(domainMocks.draftRepository.discardDraft.mock.invocationCallOrder[0]).toBeLessThan(
      domainMocks.routeIdRepository.delete.mock.invocationCallOrder[0] ?? 0
    )
    expect(domainMocks.routeIdRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
    expect(domainMocks.draftRepository.discardDraft).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
  })
})

describe('cloneAuthoredItem', () => {
  it('regenerates every owned id while preserving relationship references', () => {
    const input = {
      id: 'race-1',
      label: 'Dragonborn',
      status: 'ACTIVE',
      systemId: 'system-1',
      parentRaceId: 'race-parent',
      details: [
        {
          id: 'detail-1',
          label: 'Lore',
          description: 'Original detail.',
          order: 1
        }
      ],
      features: [
        {
          id: 'feature-1',
          label: 'Breath Weapon',
          selectedOptionId: 'option-1',
          selectedOptionIds: ['option-1'],
          options: [
            {
              id: 'option-1',
              label: 'Red'
            }
          ],
          effects: [
            {
              id: 'effect-1',
              paths: [
                {
                  id: 'path-1',
                  resultBlock: {
                    id: 'result-1',
                    outcomes: [
                      {
                        id: 'outcome-1',
                        damageTypeId: 'acid',
                        equipmentId: 'acid-vial'
                      }
                    ]
                  }
                }
              ]
            }
          ]
        }
      ],
      equipmentIds: ['acid-vial']
    }

    const cloned = cloneAuthoredItem(input)
    const secondClone = cloneAuthoredItem(input)

    expect(cloned).not.toBe(input)
    expect(cloned.details).not.toBe(input.details)
    expect(cloned.features[0]).not.toBe(input.features[0])
    expect(cloned.id).not.toBe(input.id)
    expect(cloned.details[0]?.id).not.toBe(input.details[0]?.id)
    expect(cloned.features[0]?.id).not.toBe(input.features[0]?.id)
    expect(cloned.features[0]?.options[0]?.id).not.toBe(input.features[0]?.options[0]?.id)
    expect(cloned.features[0]?.selectedOptionId).toBe(cloned.features[0]?.options[0]?.id)
    expect(cloned.features[0]?.selectedOptionIds).toEqual([cloned.features[0]?.options[0]?.id])
    expect(cloned.features[0]?.effects[0]?.id).not.toBe(input.features[0]?.effects[0]?.id)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.id).not.toBe(
      input.features[0]?.effects[0]?.paths[0]?.id
    )
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.id).not.toBe(
      input.features[0]?.effects[0]?.paths[0]?.resultBlock.id
    )
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id).not.toBe(
      input.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id
    )
    expect(cloned.parentRaceId).toBe(input.parentRaceId)
    expect(cloned.equipmentIds).toEqual(input.equipmentIds)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.damageTypeId).toBe(
      'acid'
    )
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.equipmentId).toBe(
      'acid-vial'
    )
    expect(cloned.label).toBe('Dragonborn Copy')
    expect(cloned.status).toBe('DRAFT')
    expect(secondClone.id).not.toBe(cloned.id)
    expect(secondClone.details[0]?.id).not.toBe(cloned.details[0]?.id)
    expect(secondClone.features[0]?.id).not.toBe(cloned.features[0]?.id)
    expect(secondClone.features[0]?.options[0]?.id).not.toBe(cloned.features[0]?.options[0]?.id)
    expect(secondClone.features[0]?.effects[0]?.id).not.toBe(cloned.features[0]?.effects[0]?.id)
    expect(secondClone.features[0]?.effects[0]?.paths[0]?.id).not.toBe(
      cloned.features[0]?.effects[0]?.paths[0]?.id
    )
    expect(secondClone.features[0]?.effects[0]?.paths[0]?.resultBlock.id).not.toBe(
      cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.id
    )
    expect(secondClone.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id).not.toBe(
      cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id
    )
    expect(secondClone.features[0]?.selectedOptionId).toBe(secondClone.features[0]?.options[0]?.id)
    expect(secondClone.parentRaceId).toBe(input.parentRaceId)
    expect(secondClone.equipmentIds).toEqual(input.equipmentIds)
  })

  it('registers one canonical service configuration for every root authored domain', () => {
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
