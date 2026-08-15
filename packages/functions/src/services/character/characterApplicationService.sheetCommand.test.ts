import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'
import type {
  CharacterSheetCommandInputDto,
  CharacterSheetCommandResponseDto
} from '@artificer-toolkit/schema/api/characters'

const mocks = vi.hoisted(() => ({
  ensureRouteIdentity: vi.fn(),
  executeCharacterSheetCommand: vi.fn(),
  findBuilderDraft: vi.fn(),
  findCharacterById: vi.fn(),
  findAuthoredById: vi.fn(),
  listAdjustments: vi.fn(),
  getMovementPreference: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  loadBuilderContext: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveRuleBinding: vi.fn(),
  buildSheetBundle: vi.fn(),
  resolveContext: vi.fn(),
  buildPanel: vi.fn(),
  resolveByPublicIdForUser: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createAuthoredRouteIdRepository: () => ({
      ensure: mocks.ensureRouteIdentity,
      resolveByPublicIdForUser: mocks.resolveByPublicIdForUser
    }),
    createCharacterRepository: () => ({
      findById: mocks.findCharacterById,
      findAuthoredById: mocks.findAuthoredById
    }),
    createCharacterBuilderDraftRepository: () => ({
      findByCharacter: mocks.findBuilderDraft
    }),
    createCharacterSheetAdjustmentRepository: () => ({
      listByCharacter: mocks.listAdjustments,
      getMovementPreference: mocks.getMovementPreference
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage,
      listSpellCustomizations: mocks.listSpellCustomizations
    })
  }
})

vi.mock('./builderService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./builderService.js')>()
  return {
    ...actual,
    loadCharacterBuilderContext: mocks.loadBuilderContext,
    resolveCharacterBuilder: mocks.resolveBuilder
  }
})

vi.mock('./sheetService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetService.js')>()
  return {
    ...actual,
    executeCharacterSheetCommand: mocks.executeCharacterSheetCommand
  }
})

vi.mock('./sheetProjection.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetProjection.js')>()
  return { ...actual, buildCharacterSheetBundle: mocks.buildSheetBundle }
})

vi.mock('./characterRuleBinding.js', () => ({
  resolveCharacterRuleBinding: mocks.resolveRuleBinding
}))

vi.mock('./campaignCharacterSheet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./campaignCharacterSheet.js')>()
  return {
    ...actual,
    resolveCharacterSheetCampaignContext: mocks.resolveContext,
    getCharacterSheetDisplayAdjustments: () => [],
    mergeCampaignSheetAdjustments: (characterAdjustments: unknown[]) => characterAdjustments,
    getVisibleCampaignConditions: () => [],
    projectCharacterSheetForViewer: (sheet: unknown) => sheet
  }
})

vi.mock('./sheetPanelService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./sheetPanelService.js')>()
  return {
    ...actual,
    buildCharacterSheetPanel: mocks.buildPanel
  }
})

const {
  dispatchCommandForUser,
  getCharacterSheetForUser,
  getCharacterSheetPanelForUser,
  previewCharacterRuleUpgradeForUser
} = await import('./characterApplicationService.js')

const command = {
  type: 'SET_INSPIRATION',
  inspired: true,
  expectedVersion: 2,
  commandId: '00000000-0000-4000-8000-000000000003'
} satisfies CharacterSheetCommandInputDto

describe('dispatchCommandForUser', () => {
  beforeEach(() => {
    mocks.ensureRouteIdentity.mockReset()
    mocks.executeCharacterSheetCommand.mockReset()
    mocks.findBuilderDraft.mockReset()
    mocks.findCharacterById.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.listAdjustments.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.listResourceUsage.mockReset()
    mocks.listSpellCustomizations.mockReset()
    mocks.loadBuilderContext.mockReset()
    mocks.resolveBuilder.mockReset()
    mocks.resolveRuleBinding.mockReset()
    mocks.buildSheetBundle.mockReset()
    mocks.resolveContext.mockReset()
    mocks.buildPanel.mockReset()
    mocks.resolveByPublicIdForUser.mockReset()
    mocks.ensureRouteIdentity.mockResolvedValue({ publicId: 'aria-sheet' })
    mocks.findBuilderDraft.mockResolvedValue(null)
    mocks.findCharacterById.mockResolvedValue({
      stream_version: 3,
      rule_pack_revision_id: 'revision-1'
    })
    mocks.findAuthoredById.mockResolvedValue({
      id: '00000000-0000-4000-8000-000000000001',
      userId: 'user-1',
      status: 'ACTIVE'
    })
    mocks.listAdjustments.mockResolvedValue([])
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.loadBuilderContext.mockResolvedValue({ catalog: {}, registry: {} })
    mocks.resolveBuilder.mockResolvedValue({})
    mocks.resolveRuleBinding.mockImplementation(async ({ existingRevisionId }) => ({
      revisionId: existingRevisionId ?? '00000000-0000-4000-8000-000000000202',
      checksum: existingRevisionId ? 'current-checksum' : 'target-checksum',
      evaluatorKind: 'ZEN',
      evaluatorVersion: '0.54.0',
      modelContractVersion: 4
    }))
    mocks.buildSheetBundle.mockResolvedValue({
      sheet: { meta: {} },
      ruleProjection: { characterId: '00000000-0000-4000-8000-000000000001' },
      ruleEvaluation: { evaluation: { revisionId: 'revision-1' } }
    })
    mocks.resolveContext.mockResolvedValue({
      viewer: 'CHARACTER_OWNER',
      campaignId: null,
      campaignStatus: null,
      contentMaturity: null,
      attunementSlotOverride: 4,
      adjustments: [],
      secretAdjustmentIds: new Set(),
      conditions: []
    })
    mocks.buildPanel.mockImplementation(({ target }: { target: { kind: string } }) => target)
    mocks.executeCharacterSheetCommand.mockImplementation(
      async ({ panelTargets }: { panelTargets?: Array<{ kind: string }> }) =>
        ({
          characterId: '00000000-0000-4000-8000-000000000001',
          sheet: {
            meta: {
              characterId: '00000000-0000-4000-8000-000000000001',
              systemId: 'system-1',
              status: 'ACTIVE',
              streamVersion: 3
            }
          },
          ...(panelTargets?.length ? { panels: panelTargets } : {})
        }) as CharacterSheetCommandResponseDto
    )
  })

  it('resolves public character handles before executing a Sheet command', async () => {
    const canonicalCharacterId = '00000000-0000-4000-8000-000000000001'
    mocks.resolveByPublicIdForUser.mockResolvedValue({
      subjectId: canonicalCharacterId
    })
    const db = {} as DBLike

    const result = await dispatchCommandForUser(db, 'aria-sheet', command, 'user-1')

    expect(mocks.resolveByPublicIdForUser).toHaveBeenCalledWith({
      subjectKind: 'CHARACTER',
      publicId: 'aria-sheet'
    })
    expect(mocks.executeCharacterSheetCommand).toHaveBeenCalledWith({
      db,
      characterId: canonicalCharacterId,
      command,
      panelTargets: [],
      userId: 'user-1'
    })
    expect(result.sheet).toMatchObject({
      publicId: 'aria-sheet',
      meta: { hasBuilderDraft: false }
    })
  })

  it('rejects unknown public character handles without executing a command', async () => {
    mocks.resolveByPublicIdForUser.mockResolvedValue(null)

    await expect(
      dispatchCommandForUser({} as DBLike, 'missing-sheet', command, 'user-1')
    ).rejects.toMatchObject({ name: 'NotFoundError' })
    expect(mocks.executeCharacterSheetCommand).not.toHaveBeenCalled()
  })

  it('dispatches known-spell panel updates and leaves typed resources without panels', async () => {
    const db = {} as DBLike
    mocks.resolveByPublicIdForUser.mockResolvedValue({
      subjectId: '00000000-0000-4000-8000-000000000001'
    })
    const knownSpells = {
      type: 'SET_KNOWN_SPELLS',
      classId: '00000000-0000-4000-8000-000000000002',
      spellIds: [],
      expectedVersion: 2,
      commandId: '00000000-0000-4000-8000-000000000004'
    } satisfies CharacterSheetCommandInputDto
    const typedResource = {
      type: 'USE_RESOURCE',
      resourceGrantId: 'resource-1',
      expectedVersion: 2,
      commandId: '00000000-0000-4000-8000-000000000005'
    } satisfies CharacterSheetCommandInputDto

    const knownResult = await dispatchCommandForUser(db, 'aria-sheet', knownSpells, 'user-1')
    expect(knownResult.panels).toEqual([{ kind: 'SPELLS' }])
    expect(mocks.executeCharacterSheetCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ panelTargets: [{ kind: 'SPELLS' }] })
    )

    const resourceResult = await dispatchCommandForUser(db, 'aria-sheet', typedResource, 'user-1')
    expect(resourceResult.panels).toBeUndefined()
    expect(mocks.executeCharacterSheetCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({ panelTargets: [] })
    )
  })

  it('builds Sheet and panel projections from one exact pinned rule evaluation', async () => {
    const db = {} as DBLike
    const characterId = '00000000-0000-4000-8000-000000000001'

    await getCharacterSheetForUser(db, characterId, 'user-1')
    expect(mocks.loadBuilderContext).toHaveBeenCalledWith(db, expect.anything(), [], {
      includeEffects: true
    })
    expect(mocks.resolveBuilder).toHaveBeenCalledWith(
      db,
      expect.anything(),
      'edit',
      expect.objectContaining({ catalog: {}, registry: {} }),
      null,
      'revision-1'
    )
    expect(mocks.buildSheetBundle).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ruleEvaluation: {
          context: expect.objectContaining({ catalog: {}, registry: {} }),
          revisionId: 'revision-1',
          attunementSlotOverride: 4
        }
      })
    )

    mocks.buildSheetBundle.mockClear()
    await getCharacterSheetPanelForUser(db, characterId, { kind: 'SPELLS' }, 'user-1')
    expect(mocks.buildSheetBundle).toHaveBeenCalledTimes(1)
    expect(mocks.buildPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ruleProjection: expect.objectContaining({ characterId }),
        target: { kind: 'SPELLS' }
      })
    )
  })

  it('fails closed when an active Character has no pinned rule revision', async () => {
    mocks.findCharacterById.mockResolvedValue({
      stream_version: 3,
      rule_pack_revision_id: null
    })

    await expect(
      getCharacterSheetForUser({} as DBLike, '00000000-0000-4000-8000-000000000001', 'user-1')
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })
    expect(mocks.buildSheetBundle).not.toHaveBeenCalled()
  })

  it('previews the current active rule revision without changing the Character pin', async () => {
    const characterId = '00000000-0000-4000-8000-000000000001'
    mocks.findCharacterById.mockResolvedValue({
      stream_version: 3,
      rule_pack_revision_id: '00000000-0000-4000-8000-000000000201'
    })

    const preview = await previewCharacterRuleUpgradeForUser(
      {} as DBLike,
      characterId,
      { expectedVersion: 3 },
      'user-1'
    )

    expect(preview).toMatchObject({
      characterId,
      streamVersion: 3,
      upgradeAvailable: true,
      currentRevision: { revisionId: '00000000-0000-4000-8000-000000000201' },
      targetRevision: { revisionId: '00000000-0000-4000-8000-000000000202' }
    })
    expect(mocks.buildSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        ruleEvaluation: expect.objectContaining({
          revisionId: '00000000-0000-4000-8000-000000000202'
        })
      })
    )
  })
})
