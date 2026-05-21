import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import type { AuthoredSubjectDraft, DBLike } from '@artificer-toolkit/db'
import type { AuthoredRecord } from '../routes/authoredContent.js'
import {
  cloneAuthoredItem,
  deleteAuthoredDomainActive,
  discardAuthoredDomainDraft,
  getAuthoredDomain,
  type AuthoredDomainRuntimeConfig
} from './authoredDomains.js'

const domainMocks = vi.hoisted(() => ({
  draftRepository: {
    delete: vi.fn(),
    findBySubject: vi.fn()
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

function createRuntimeConfig(overrides: Partial<AuthoredDomainRuntimeConfig> = {}): AuthoredDomainRuntimeConfig {
  return {
    ...createConfig(),
    ...overrides
  }
}

type FakeRow = Record<string, unknown>

function createFakeDb(initialRows: Record<string, FakeRow[]>) {
  const rows = new Map(Object.entries(initialRows).map(([table, tableRows]) => [table, [...tableRows]]))

  return {
    rows,
    db: {
      selectFrom: (table: string) => createSelectQuery(rows, table),
      deleteFrom: (table: string) => createDeleteQuery(rows, table)
    } as unknown as DBLike
  }
}

function createSelectQuery(rows: Map<string, FakeRow[]>, table: string) {
  const filters: Array<{ field: string, value: unknown }> = []
  const query = {
    select: () => query,
    where: (field: string, _operator: string, value: unknown) => {
      filters.push({ field, value })
      return query
    },
    executeTakeFirst: async () => (rows.get(table) ?? []).find((row) => filters.every((filter) => (
      row[filter.field] === filter.value
    ))) ?? undefined
  }

  return query
}

function createDeleteQuery(rows: Map<string, FakeRow[]>, table: string) {
  const filters: Array<{ field: string, value: unknown }> = []
  const query = {
    where: (field: string, _operator: string, value: unknown) => {
      filters.push({ field, value })
      return query
    },
    execute: async () => {
      rows.set(table, (rows.get(table) ?? []).filter((row) => !filters.every((filter) => (
        row[filter.field] === filter.value
      ))))
    }
  }

  return query
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
    domainMocks.draftRepository.delete.mockReset()
    domainMocks.draftRepository.findBySubject.mockReset()
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

describe('authored domain deletes', () => {
  beforeEach(() => {
    domainMocks.draftRepository.delete.mockReset()
    domainMocks.draftRepository.findBySubject.mockReset()
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
    domainMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())

    await deleteAuthoredDomainActive(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toEqual([])
    expect(domainMocks.draftRepository.delete).not.toHaveBeenCalled()
    expect(domainMocks.routeIdRepository.delete).not.toHaveBeenCalled()
  })

  it('cleans the route identity when deleting the last active representation', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(null)

    await deleteAuthoredDomainActive(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toEqual([])
    expect(domainMocks.routeIdRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
  })

  it('rejects master and foreign active deletes', async () => {
    const master = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: true, ownerUserId: null }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(null)

    await expect(deleteAuthoredDomainActive(master.db, createConfig(), 'spell-public', 'user-1'))
      .rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')

    const foreign = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-2' }]
    })

    await expect(deleteAuthoredDomainActive(foreign.db, createConfig(), 'spell-public', 'user-1'))
      .rejects.toHaveProperty('name', 'AuthoredContentOwnershipError')
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
    domainMocks.draftRepository.findBySubject.mockResolvedValue(null)

    await expect(deleteAuthoredDomainActive(fakeDb, createRuntimeConfig({
      mapId: 'class',
      subjectKind: 'CLASS',
      table: 'classes'
    }), 'class-public', 'user-1')).rejects.toHaveProperty('name', 'AuthoredContentDependencyError')
  })

  it('deletes a draft without deleting the active record', async () => {
    const { db: fakeDb, rows } = createFakeDb({
      spells: [{ id: 'spell-1', isMaster: false, ownerUserId: 'user-1' }]
    })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())

    await discardAuthoredDomainDraft(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(rows.get('spells')).toHaveLength(1)
    expect(domainMocks.draftRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1',
      userId: 'user-1'
    })
    expect(domainMocks.routeIdRepository.delete).not.toHaveBeenCalled()
  })

  it('removes orphan route identity when deleting a draft-only record', async () => {
    const { db: fakeDb } = createFakeDb({ spells: [] })
    domainMocks.draftRepository.findBySubject.mockResolvedValue(createDraft())

    await discardAuthoredDomainDraft(fakeDb, createConfig(), 'spell-public', 'user-1')

    expect(domainMocks.routeIdRepository.delete).toHaveBeenCalledWith({
      subjectKind: 'SPELL',
      subjectId: 'spell-1'
    })
    expect(domainMocks.draftRepository.delete).toHaveBeenCalledWith({
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
    expect(cloned.features[0]?.effects[0]?.paths[0]?.id).not.toBe(input.features[0]?.effects[0]?.paths[0]?.id)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.id).not.toBe(input.features[0]?.effects[0]?.paths[0]?.resultBlock.id)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id).not.toBe(input.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.id)
    expect(cloned.parentRaceId).toBe(input.parentRaceId)
    expect(cloned.equipmentIds).toEqual(input.equipmentIds)
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.damageTypeId).toBe('acid')
    expect(cloned.features[0]?.effects[0]?.paths[0]?.resultBlock.outcomes[0]?.equipmentId).toBe('acid-vial')
    expect(cloned.label).toBe('Dragonborn Copy')
    expect(cloned.status).toBe('DRAFT')
  })
})
