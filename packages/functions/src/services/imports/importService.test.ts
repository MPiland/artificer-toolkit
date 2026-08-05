import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  findActiveBySubject: vi.fn(),
  findActiveMastersBySubjectKind: vi.fn(),
  findDraftBySubject: vi.fn(),
  findImportRef: vi.fn(),
  findSystemAll: vi.fn(),
  findSystemById: vi.fn(),
  upsertImportRef: vi.fn(),
  saveAuthoredInputDraft: vi.fn(),
  activateAuthoredInput: vi.fn(),
  findCharacterById: vi.fn(),
  findCharacterUpdatedAt: vi.fn(),
  saveCharacterDraft: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredContentRepository: () => ({
      findActiveBySubject: mocks.findActiveBySubject,
      findActiveMastersBySubjectKind: mocks.findActiveMastersBySubjectKind,
      findDraftBySubject: mocks.findDraftBySubject
    }),
    createAuthoredImportRefRepository: () => ({
      findByExternalId: mocks.findImportRef,
      upsert: mocks.upsertImportRef
    }),
    createSystemRepository: () => ({
      findAll: mocks.findSystemAll,
      findById: mocks.findSystemById
    }),
    createCharacterRepository: () => ({
      findAuthoredById: mocks.findCharacterById,
      findUpdatedAtById: mocks.findCharacterUpdatedAt
    }),
    withTransaction: async <T>(db: DBLike, callback: (trx: DBLike) => Promise<T>) => callback(db)
  }
})

vi.mock('../authoredContent/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../authoredContent/index.js')>()
  return {
    ...actual,
    saveAuthoredDomainInputDraft: mocks.saveAuthoredInputDraft,
    activateAuthoredDomainInput: mocks.activateAuthoredInput
  }
})

vi.mock('../character/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../character/index.js')>()
  return { ...actual, saveCharacterBuilderDraftForUser: mocks.saveCharacterDraft }
})

const { authoredDomainConfigs } = await import('../authoredContent/index.js')
const {
  getDeselectedPortableReferenceIssues,
  getUnavailablePortableReferenceIssues,
  commitImports,
  previewImports
} = await import('./importService.js')
const { isCompleteExternalCustomContent } = await import('./portableContent.js')

describe('import service', () => {
  beforeEach(() => {
    mocks.findActiveBySubject.mockReset().mockResolvedValue(null)
    mocks.findActiveMastersBySubjectKind.mockReset().mockResolvedValue([])
    mocks.findDraftBySubject.mockReset().mockResolvedValue(null)
    mocks.findImportRef.mockReset().mockResolvedValue(null)
    mocks.findSystemAll.mockReset().mockRejectedValue(new Error('should not load D&D systems'))
    mocks.findSystemById.mockReset().mockResolvedValue({ id: 'system-1' })
    mocks.upsertImportRef.mockReset().mockResolvedValue({})
    mocks.activateAuthoredInput.mockReset().mockResolvedValue({})
    mocks.findCharacterById.mockReset().mockResolvedValue(null)
    mocks.findCharacterUpdatedAt.mockReset().mockResolvedValue(null)
    mocks.saveCharacterDraft.mockReset().mockResolvedValue({ publicId: 'character-public' })
    mocks.saveAuthoredInputDraft
      .mockReset()
      .mockImplementation(
        async (_db: DBLike, _config: unknown, payload: Record<string, unknown>) => ({
          subjectId: payload.id,
          publicId: `public-${payload.id}`
        })
      )
  })

  it('previews Artificer content without requiring a configured D&D system', async () => {
    const response = await previewImports(
      {} as DBLike,
      {
        source: 'ARTIFICER_JSON',
        entries: [
          {
            entryId: 'one',
            name: 'spell.json',
            text: JSON.stringify({
              format: 'artificer-content',
              version: 1,
              item: {
                kind: 'SPELL',
                data: { id: 'spell-1', label: 'Spark', systemId: 'system-1' }
              },
              references: [{ kind: 'CLASS', id: 'missing-class', label: 'Wizard' }]
            })
          }
        ]
      },
      'user-1',
      { createId: () => 'new-spell-1' }
    )

    expect(mocks.findSystemAll).not.toHaveBeenCalled()
    expect(response.items[0]?.destination?.subjectId).toBe('new-spell-1')
    expect(response.items[0]).toMatchObject({
      status: 'NEEDS_REVIEW',
      issues: [
        expect.objectContaining({
          code: 'UNRESOLVED_PORTABLE_REFERENCE',
          path: ['references', 0],
          correctionRequired: true
        })
      ]
    })
  })

  it('fetches only the fixed D&D Beyond character-service endpoint', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    const fetcher = vi.fn(async () =>
      Response.json({ data: { id: 74476867, name: 'Aria', classes: [], inventory: [] } })
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'DND_BEYOND',
        entries: [
          {
            entryId: 'one',
            url: 'https://www.dndbeyond.com/characters/74476867'
          }
        ]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch, createId: () => 'character-1' }
    )

    expect(response.items[0]?.status).toBe('READY')
    expect(fetcher).toHaveBeenCalledWith(
      'https://character-service.dndbeyond.com/character/v5/character/74476867?includeCustomItems=true',
      expect.objectContaining({ credentials: 'omit', redirect: 'error' })
    )
  })

  it('matches unique master labels without reporting a successful-match warning', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    mocks.findActiveMastersBySubjectKind.mockImplementation(
      async ({ subjectKind }: { subjectKind: string }) => {
        if (subjectKind === 'CLASS') return [{ subjectId: 'master-wizard', label: 'Wizard' }]
        if (subjectKind === 'EQUIPMENT') {
          return [
            { subjectId: 'master-backpack', label: 'Backpack' },
            { subjectId: 'master-hole', label: 'Portable Hole' },
            { subjectId: 'master-armor', label: 'Studded Leather Armor +1' },
            { subjectId: 'master-clothes', label: "Traveler's Clothes" }
          ]
        }
        return []
      }
    )
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [{ definition: { id: 1, name: 'wizard' }, level: 1 }],
          inventory: [
            { definition: { id: 2, name: 'Backpack' } },
            { definition: { id: 3, name: 'Portable Hole' } },
            { definition: { id: 4, name: 'Studded Leather +1' } },
            { definition: { id: 5, name: "Clothes, Traveler's" } }
          ]
        }
      })
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'DND_BEYOND',
        entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch }
    )

    expect(response.items[0]).toMatchObject({ status: 'READY', issues: [] })
    expect(response.items[0]?.existingMatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceLabel: 'wizard',
          matchedLabel: 'Wizard',
          subjectKind: 'CLASS'
        }),
        expect.objectContaining({
          sourceLabel: 'Backpack',
          matchedLabel: 'Backpack',
          subjectKind: 'EQUIPMENT'
        })
      ])
    )
    expect(mocks.findActiveBySubject).not.toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: '1' })
    )
  })

  it('summarizes ambiguous and unmatched external references without requiring review', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    mocks.findActiveMastersBySubjectKind.mockResolvedValue([
      { subjectId: 'master-a', label: 'Backpack' },
      { subjectId: 'master-b', label: 'Backpack' }
    ])
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [],
          inventory: [
            { definition: { id: 2, name: 'Backpack' } },
            { definition: { id: 3, name: 'Unknown item' } },
            { definition: { id: 4, name: 'unknown-item' } }
          ]
        }
      })
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'DND_BEYOND',
        entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch }
    )

    expect(response.items[0]).toMatchObject({ status: 'READY', issues: [] })
    expect(response.items[0]?.notImported).toEqual([
      { label: 'Backpack', subjectKind: 'EQUIPMENT', count: 1 },
      { label: 'Unknown item', subjectKind: 'EQUIPMENT', count: 2 }
    ])
  })

  it('reports existing user import mappings as existing matches', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    mocks.findImportRef.mockImplementation(
      async ({ subjectKind, externalId }: { subjectKind: string; externalId: string }) =>
        subjectKind === 'EQUIPMENT' && externalId === '9'
          ? { subjectId: 'existing-equipment' }
          : null
    )
    mocks.findActiveBySubject.mockImplementation(async ({ subjectId }: { subjectId: string }) =>
      subjectId === 'existing-equipment'
        ? { subjectId, label: 'Keepsake', ownerUserId: 'user-1', isMaster: false }
        : null
    )
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [],
          inventory: [{ definition: { id: 9, name: 'Old keepsake' } }]
        }
      })
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'DND_BEYOND',
        entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch }
    )

    expect(response.items[0]).toMatchObject({ status: 'READY', notImported: [] })
    expect(response.items[0]?.existingMatches).toEqual([
      { sourceLabel: 'Old keepsake', matchedLabel: 'Keepsake', subjectKind: 'EQUIPMENT', count: 1 }
    ])
  })

  it('returns custom content metadata with its default active destination', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [],
          inventory: [],
          feats: [
            {
              definition: {
                id: 9,
                name: 'Roadwise',
                description: 'You always know the road home.',
                isHomebrew: true
              }
            }
          ]
        }
      })
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'DND_BEYOND',
        entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch, createId: () => 'target-1' }
    )

    expect(response.items[0]?.relatedContent).toEqual([
      expect.objectContaining({
        externalId: '9',
        label: 'Roadwise',
        subjectKind: 'FEAT',
        activationEligible: true,
        destination: { kind: 'ACTIVE_AUTHORED_CONTENT', subjectKind: 'FEAT', subjectId: 'target-1' }
      })
    ])
    expect(response.items[0]?.issues).not.toContainEqual(
      expect.objectContaining({ code: 'CUSTOM_CONTENT_READY_TO_ACTIVATE' })
    )
  })

  it('keeps incomplete custom content as a draft despite an ACTIVE request', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [],
          inventory: [],
          customItems: [{ id: 9, name: 'Keepsake', description: '' }]
        }
      })
    )

    const response = await commitImports(
      {} as DBLike,
      {
        batch: {
          source: 'DND_BEYOND',
          entries: [{ entryId: 'one', url: 'https://www.dndbeyond.com/characters/74476867' }]
        },
        selectedEntryIds: ['one'],
        resolutions: [],
        customContentChoices: [
          { entryId: 'one', subjectKind: 'EQUIPMENT', externalId: '9', choice: 'ACTIVE' }
        ]
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch, createId: () => 'target-1' }
    )

    expect(response.items[0]?.relatedContent?.[0]).toMatchObject({
      activationEligible: false,
      destination: { kind: 'AUTHORED_DRAFT' }
    })
    expect(mocks.saveAuthoredInputDraft).toHaveBeenCalledOnce()
    expect(mocks.activateAuthoredInput).not.toHaveBeenCalled()
  })

  it('reuses previously imported custom content instead of creating a duplicate', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])
    mocks.findImportRef.mockImplementation(
      async ({ subjectKind, externalId }: { subjectKind: string; externalId: string }) =>
        subjectKind === 'EQUIPMENT' && externalId === '9'
          ? { subjectId: 'existing-equipment' }
          : null
    )
    mocks.findActiveBySubject.mockImplementation(async ({ subjectId }: { subjectId: string }) =>
      subjectId === 'existing-equipment'
        ? { subjectId, ownerUserId: 'user-1', isMaster: false }
        : null
    )
    const fetcher = vi.fn(async () =>
      Response.json({
        data: {
          id: 74476867,
          name: 'Aria',
          classes: [],
          inventory: [
            {
              definition: {
                id: 9,
                name: 'Keepsake',
                description: 'A familiar trinket.',
                isHomebrew: true
              }
            }
          ]
        }
      })
    )

    const response = await commitImports(
      {} as DBLike,
      {
        batch: {
          source: 'DND_BEYOND',
          entries: [
            {
              entryId: 'one',
              url: 'https://www.dndbeyond.com/characters/74476867'
            }
          ]
        },
        selectedEntryIds: ['one'],
        resolutions: [],
        customContentChoices: []
      },
      'user-1',
      { fetch: fetcher as unknown as typeof fetch, createId: () => 'new-id' }
    )

    expect(response.items[0]?.relatedContent).toEqual([])
    expect(mocks.saveAuthoredInputDraft).not.toHaveBeenCalled()
    expect(mocks.activateAuthoredInput).not.toHaveBeenCalled()
    expect(mocks.saveCharacterDraft).toHaveBeenCalledWith(
      expect.anything(),
      'new-id',
      expect.objectContaining({
        character: expect.objectContaining({
          state: expect.objectContaining({
            equipment: expect.objectContaining({
              inventory: [
                expect.objectContaining({ equipmentId: 'existing-equipment', quantity: 1 })
              ]
            })
          })
        })
      }),
      'user-1'
    )
  })

  it('links Foundry custom equipment to the imported character draft', async () => {
    mocks.findSystemAll.mockResolvedValue([
      { id: 'system-1', rulesetCode: 'dnd5e', rulesetVersion: '2014' }
    ])

    const response = await commitImports(
      {} as DBLike,
      {
        batch: {
          source: 'FOUNDRY_DND5E',
          entries: [
            {
              entryId: 'one',
              name: 'aria.json',
              text: JSON.stringify({
                _id: 'actor-1',
                name: 'Aria',
                type: 'character',
                _stats: { systemId: 'dnd5e' },
                system: {},
                items: [
                  {
                    _id: 'blade-1',
                    name: 'Moon Blade',
                    type: 'weapon',
                    system: { quantity: 2, equipped: true, attunement: 2 }
                  }
                ]
              })
            }
          ]
        },
        selectedEntryIds: ['one'],
        resolutions: [],
        customContentChoices: []
      },
      'user-1',
      { createId: () => crypto.randomUUID() }
    )

    const equipmentId = response.items[0]?.relatedContent?.[0]?.destination.subjectId
    expect(equipmentId).toBeTruthy()
    expect(mocks.saveCharacterDraft).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        character: expect.objectContaining({
          state: expect.objectContaining({
            equipment: expect.objectContaining({
              inventory: [expect.objectContaining({ equipmentId, quantity: 2 })],
              equipped: [expect.any(String)],
              attuned: [expect.any(String)]
            })
          })
        })
      }),
      'user-1'
    )
  })

  it('does not resolve a portable native id to foreign-owned content', async () => {
    mocks.findActiveBySubject.mockImplementation(async ({ subjectKind }: { subjectKind: string }) =>
      subjectKind === 'CLASS'
        ? { subjectId: 'foreign-class', ownerUserId: 'user-2', isMaster: false }
        : null
    )

    const response = await previewImports(
      {} as DBLike,
      {
        source: 'ARTIFICER_JSON',
        entries: [
          {
            entryId: 'one',
            name: 'spell.json',
            text: JSON.stringify({
              format: 'artificer-content',
              version: 1,
              item: {
                kind: 'SPELL',
                data: { id: 'spell-1', label: 'Spark', systemId: 'system-1' }
              },
              references: [{ kind: 'CLASS', id: 'foreign-class', label: 'Wizard' }]
            })
          }
        ]
      },
      'user-1'
    )

    expect(response.items[0]?.issues).toContainEqual(
      expect.objectContaining({ code: 'UNRESOLVED_PORTABLE_REFERENCE' })
    )
  })

  it('allows the same native id for different portable subject kinds', async () => {
    let nextId = 0
    const response = await previewImports(
      {} as DBLike,
      {
        source: 'ARTIFICER_JSON',
        entries: (['SPELL', 'CLASS'] as const).map((kind, index) => ({
          entryId: `entry-${index}`,
          name: `${kind.toLowerCase()}.json`,
          text: JSON.stringify({
            format: 'artificer-content',
            version: 1,
            item: { kind, data: { id: 'shared-id', label: kind, systemId: 'system-1' } },
            references: []
          })
        }))
      },
      'user-1',
      { createId: () => `new-${++nextId}` }
    )

    expect(response.summary.unable).toBe(0)
  })

  it('remaps only selected and committable same-batch portable references', async () => {
    const batch = {
      source: 'ARTIFICER_JSON' as const,
      entries: [
        {
          entryId: 'spell',
          name: 'spell.json',
          text: JSON.stringify({
            format: 'artificer-content',
            version: 1,
            item: {
              kind: 'SPELL',
              data: {
                id: 'spell-old',
                label: 'Spark',
                systemId: 'system-1',
                classId: 'class-old'
              }
            },
            references: [{ kind: 'CLASS', id: 'class-old', label: 'Wizard' }]
          })
        },
        {
          entryId: 'class',
          name: 'class.json',
          text: JSON.stringify({
            format: 'artificer-content',
            version: 1,
            item: {
              kind: 'CLASS',
              data: { id: 'class-old', label: 'Wizard', systemId: 'system-1' }
            },
            references: []
          })
        }
      ]
    }

    let nextId = 0
    const deselected = await commitImports(
      {} as DBLike,
      { batch, selectedEntryIds: ['spell'], resolutions: [], customContentChoices: [] },
      'user-1',
      { createId: () => `deselected-${++nextId}` }
    )
    expect(deselected.items.find((item) => item.entryId === 'class')?.outcome).toBe('SKIPPED')
    expect(deselected.items.find((item) => item.entryId === 'spell')?.issues).toContainEqual(
      expect.objectContaining({ code: 'BATCH_REFERENCE_NOT_SELECTED' })
    )
    expect(mocks.saveAuthoredInputDraft.mock.calls[0]?.[2]).toMatchObject({
      classId: 'class-old'
    })

    mocks.saveAuthoredInputDraft.mockClear()
    nextId = 0
    await commitImports(
      {} as DBLike,
      {
        batch,
        selectedEntryIds: ['spell', 'class'],
        resolutions: [],
        customContentChoices: []
      },
      'user-1',
      { createId: () => `selected-${++nextId}` }
    )
    expect(mocks.saveAuthoredInputDraft.mock.calls[0]?.[2]).toMatchObject({
      classId: 'selected-2'
    })
  })

  it('classifies only schema-valid custom content without empty identifiers as complete', () => {
    expect(
      isCompleteExternalCustomContent(authoredDomainConfigs.equipment, {
        kind: 'EQUIPMENT',
        id: 'equipment-1',
        label: 'Keepsake',
        description: '',
        category: 'ADVENTURING_GEAR',
        rarityId: '',
        properties: [],
        systemId: 'system-1',
        userId: 'user-1',
        status: 'DRAFT'
      })
    ).toBe(false)

    expect(
      isCompleteExternalCustomContent(authoredDomainConfigs.feats, {
        id: 'feat-1',
        label: 'Traveler',
        description: 'Always knows the road home.',
        systemId: 'system-1',
        userId: 'user-1',
        status: 'DRAFT'
      })
    ).toBe(true)
  })

  it('reports a same-batch reference when its target is not selected for commit', () => {
    expect(
      getDeselectedPortableReferenceIssues(
        [{ kind: 'CLASS', id: 'class-1', label: 'Wizard' }],
        new Set(['CLASS:class-1']),
        new Set()
      )
    ).toEqual([
      expect.objectContaining({
        code: 'BATCH_REFERENCE_NOT_SELECTED',
        path: ['references', 0],
        correctionRequired: true
      })
    ])
  })

  it('reports a selected same-batch reference when its target cannot commit', () => {
    expect(
      getUnavailablePortableReferenceIssues(
        [{ kind: 'CLASS', id: 'class-1', label: 'Wizard' }],
        new Set(['CLASS:class-1']),
        new Set()
      )
    ).toEqual([
      expect.objectContaining({
        code: 'BATCH_REFERENCE_TARGET_FAILED',
        correctionRequired: true
      })
    ])
  })
})
