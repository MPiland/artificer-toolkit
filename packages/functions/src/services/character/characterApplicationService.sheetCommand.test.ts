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
  findMechanics: vi.fn(),
  findAuthoredById: vi.fn(),
  listAdjustments: vi.fn(),
  getMovementPreference: vi.fn(),
  getPreparationOptions: vi.fn(),
  findCampaignByCharacter: vi.fn(),
  lockCampaignMemberForContentRead: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  loadBuilderContext: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveRuleBinding: vi.fn(),
  buildSheetBundle: vi.fn(),
  assembleSheetBundle: vi.fn(),
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
    createCampaignRepository: () => ({
      findCampaignByCharacter: mocks.findCampaignByCharacter
    }),
    createCampaignContentShareRepository: () => ({
      lockCampaignMemberForContentRead: mocks.lockCampaignMemberForContentRead
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: mocks.findMechanics
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
    }),
    getCharacterPreparationOptionsQuery: mocks.getPreparationOptions,
    withTransaction: async (_db: DBLike, callback: (trx: DBLike) => Promise<unknown>) =>
      await callback(_db)
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

vi.mock('./characterSheetBundleAssembly.js', () => ({
  assembleCharacterSheetBundleForRuleContext: mocks.assembleSheetBundle
}))

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
  getCharacterPreparationOptionsForUser,
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
    mocks.findMechanics.mockReset()
    mocks.findAuthoredById.mockReset()
    mocks.listAdjustments.mockReset()
    mocks.getMovementPreference.mockReset()
    mocks.getPreparationOptions.mockReset()
    mocks.findCampaignByCharacter.mockReset()
    mocks.lockCampaignMemberForContentRead.mockReset()
    mocks.listResourceUsage.mockReset()
    mocks.listSpellCustomizations.mockReset()
    mocks.loadBuilderContext.mockReset()
    mocks.resolveBuilder.mockReset()
    mocks.resolveRuleBinding.mockReset()
    mocks.buildSheetBundle.mockReset()
    mocks.assembleSheetBundle.mockReset()
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
      systemId: '00000000-0000-0000-0000-000000000100',
      status: 'ACTIVE'
    })
    mocks.findMechanics.mockResolvedValue({
      projectionChecksum: 'mechanics-checksum',
      commandLaneChecksum: 'mechanics-lane-checksum',
      ruleSnapshot: { characterId: '00000000-0000-4000-8000-000000000001' },
      rulePolicyInput: {},
      rulePolicyOutput: { senses: [] },
      pinnedSenseDefinitions: [],
      ruleRegistry: {}
    })
    mocks.listAdjustments.mockResolvedValue([])
    mocks.getMovementPreference.mockResolvedValue({ mode: 'AUTO' })
    mocks.getPreparationOptions.mockResolvedValue([])
    mocks.findCampaignByCharacter.mockResolvedValue(null)
    mocks.lockCampaignMemberForContentRead.mockResolvedValue({
      campaignExists: true,
      memberActive: true
    })
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
    mocks.assembleSheetBundle.mockResolvedValue({
      bundle: {
        sheet: { meta: {} },
        ruleProjection: { characterId: '00000000-0000-4000-8000-000000000001' },
        ruleEvaluation: {
          binding: {
            revisionId: 'revision-1',
            checksum: 'current-checksum',
            evaluatorKind: 'ZEN',
            evaluatorVersion: '0.54.0',
            modelContractVersion: 4
          },
          context: { catalog: {}, registry: {} },
          snapshot: { characterId: '00000000-0000-4000-8000-000000000001' }
        }
      },
      mechanics: {
        projectionChecksum: 'mechanics-checksum',
        commandLaneChecksum: 'mechanics-lane-checksum',
        ruleSnapshot: { characterId: '00000000-0000-4000-8000-000000000001' },
        rulePolicyInput: {},
        rulePolicyOutput: { senses: [] },
        pinnedSenseDefinitions: [],
        ruleRegistry: {}
      },
      campaignMechanics: null,
      resolution: {},
      characterAdjustments: [],
      movementDisplayPreference: { mode: 'AUTO' }
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
      userId: 'user-1',
      committedRuleSnapshot: expect.objectContaining({ streamVersion: 3 })
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
    const ruleUpgrade = {
      type: 'UPGRADE_RULE_PACK',
      revisionId: '00000000-0000-4000-8000-000000000202',
      expectedVersion: 2,
      commandId: '00000000-0000-4000-8000-000000000006'
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

    await dispatchCommandForUser(db, 'aria-sheet', ruleUpgrade, 'user-1')
    expect(mocks.executeCharacterSheetCommand).toHaveBeenLastCalledWith(
      expect.objectContaining({
        committedRuleSnapshot: expect.objectContaining({ streamVersion: 3 })
      })
    )
  })

  it('builds Sheet and panels from the committed exact-source bundle', async () => {
    const db = {} as DBLike
    const characterId = '00000000-0000-4000-8000-000000000001'

    await getCharacterSheetForUser(db, characterId, 'user-1')
    expect(mocks.assembleSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        db,
        revisionId: 'revision-1',
        ruleContext: {
          adjustments: [],
          additionalConditions: [],
          attunementSlotOverride: 4
        }
      })
    )
    expect(mocks.loadBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveBuilder).not.toHaveBeenCalled()

    mocks.assembleSheetBundle.mockClear()
    await getCharacterSheetPanelForUser(db, characterId, { kind: 'SPELLS' }, 'user-1')
    expect(mocks.assembleSheetBundle).toHaveBeenCalledTimes(1)
    expect(mocks.buildPanel).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ruleProjection: expect.objectContaining({ characterId }),
        target: { kind: 'SPELLS' }
      })
    )
  })

  it('returns only accessible lightweight preparation options from capability output', async () => {
    const characterId = '00000000-0000-4000-8000-000000000001'
    const classId = '00000000-0000-0000-0000-000000000002'
    const spellId = '00000000-0000-0000-0000-000000000003'
    mocks.assembleSheetBundle.mockResolvedValue({
      bundle: {
        sheet: {
          meta: { streamVersion: 3 },
          spells: {
            spells: [],
            slots: [],
            activeGroups: [],
            saveDc: null,
            attackBonus: null
          }
        },
        ruleProjection: { characterId },
        ruleEvaluation: {
          facts: {
            spellPreparationClasses: [
              {
                classId,
                sources: [
                  {
                    sourceId: classId,
                    attributes: ['PREPARES_SPELLS'],
                    prepareLimit: { kind: 'FULL', value: 1 },
                    spellLimits: []
                  }
                ]
              }
            ]
          },
          output: {
            spellPreparation: {
              sources: [
                {
                  classId,
                  sourceIds: [classId],
                  availableSpellIds: [spellId],
                  learnedSpellIds: [],
                  preparedSpellIds: [],
                  preparedSpellLimit: 1,
                  maxPreparableSpellLevel: 1
                }
              ]
            }
          }
        }
      },
      mechanics: {
        projectionChecksum: 'mechanics-checksum',
        commandLaneChecksum: 'mechanics-lane-checksum',
        ruleSnapshot: { characterId },
        rulePolicyInput: {},
        rulePolicyOutput: { senses: [] },
        pinnedSenseDefinitions: [],
        ruleRegistry: {}
      },
      campaignMechanics: null,
      resolution: { registry: { classes: [{ id: classId, label: 'Cleric' }] } },
      characterAdjustments: [],
      movementDisplayPreference: { mode: 'AUTO' }
    })
    mocks.getPreparationOptions.mockResolvedValue([
      { id: spellId, label: 'Healing Word', level: 1 }
    ])

    await expect(
      getCharacterPreparationOptionsForUser({} as DBLike, characterId, 'user-1')
    ).resolves.toEqual({
      characterId,
      streamVersion: 3,
      classes: [
        {
          classId,
          label: 'Cleric',
          preparedSpellLimit: 1,
          options: [
            {
              spellId,
              label: 'Healing Word',
              level: 1,
              prepared: false,
              committed: false
            }
          ]
        }
      ]
    })
    expect(mocks.getPreparationOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({ spellIds: [spellId], campaignId: null })
    )
  })

  it('locks assigned Campaign access before loading preparation options', async () => {
    const characterId = '00000000-0000-4000-8000-000000000001'
    mocks.findCampaignByCharacter.mockResolvedValue({ campaignId: 'campaign-1' })
    mocks.assembleSheetBundle.mockResolvedValue({
      bundle: {
        sheet: {
          meta: { streamVersion: 3 },
          spells: { spells: [], slots: [], activeGroups: [], saveDc: null, attackBonus: null }
        },
        ruleProjection: { characterId },
        ruleEvaluation: {
          facts: { spellPreparationClasses: [] },
          output: { spellPreparation: { sources: [] } }
        }
      },
      mechanics: {
        projectionChecksum: 'mechanics-checksum',
        commandLaneChecksum: 'mechanics-lane-checksum',
        ruleSnapshot: { characterId },
        rulePolicyInput: {},
        rulePolicyOutput: { senses: [] },
        pinnedSenseDefinitions: [],
        ruleRegistry: {}
      },
      campaignMechanics: null,
      resolution: { registry: { classes: [] } },
      characterAdjustments: [],
      movementDisplayPreference: { mode: 'AUTO' }
    })

    await getCharacterPreparationOptionsForUser({} as DBLike, characterId, 'member-1')

    expect(mocks.lockCampaignMemberForContentRead).toHaveBeenCalledWith({
      campaignId: 'campaign-1',
      userId: 'member-1'
    })
    expect(mocks.lockCampaignMemberForContentRead.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.assembleSheetBundle.mock.invocationCallOrder[0] ?? 0
    )
    expect(mocks.getPreparationOptions).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        campaignId: 'campaign-1',
        ownerUserId: 'user-1',
        viewerUserId: 'member-1'
      })
    )
  })

  it('fails closed before rule loading when assigned Campaign membership is inactive', async () => {
    mocks.findCampaignByCharacter.mockResolvedValue({ campaignId: 'campaign-1' })
    mocks.lockCampaignMemberForContentRead.mockResolvedValue({
      campaignExists: true,
      memberActive: false
    })

    await expect(
      getCharacterPreparationOptionsForUser(
        {} as DBLike,
        '00000000-0000-4000-8000-000000000001',
        'former-member'
      )
    ).rejects.toMatchObject({ name: 'NotFoundError' })
    expect(mocks.assembleSheetBundle).not.toHaveBeenCalled()
    expect(mocks.getPreparationOptions).not.toHaveBeenCalled()
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
    mocks.assembleSheetBundle.mockResolvedValue({
      bundle: {
        sheet: { meta: {} },
        ruleProjection: { characterId },
        ruleEvaluation: {
          binding: {
            revisionId: '00000000-0000-4000-8000-000000000201',
            checksum: 'current-checksum',
            evaluatorKind: 'ZEN',
            evaluatorVersion: '0.54.0',
            modelContractVersion: 4
          },
          context: { catalog: {}, registry: {} },
          snapshot: { characterId }
        }
      },
      mechanics: {
        projectionChecksum: 'mechanics-checksum',
        commandLaneChecksum: 'mechanics-lane-checksum',
        ruleSnapshot: { characterId },
        rulePolicyInput: {},
        rulePolicyOutput: { senses: [] },
        pinnedSenseDefinitions: [],
        ruleRegistry: {}
      },
      campaignMechanics: null,
      resolution: {},
      characterAdjustments: [],
      movementDisplayPreference: { mode: 'AUTO' }
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
    expect(mocks.loadBuilderContext).not.toHaveBeenCalled()
    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
  })
})
