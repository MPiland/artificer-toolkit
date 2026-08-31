import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  assembleRuleSnapshot: vi.fn(),
  buildSheetBundle: vi.fn(),
  createCommittedExtras: vi.fn(),
  createCommittedSpells: vi.fn(),
  findDraft: vi.fn(),
  findMechanics: vi.fn(),
  getMovementPreference: vi.fn(),
  listAdjustments: vi.fn(),
  listResourceUsage: vi.fn(),
  listSpellCustomizations: vi.fn(),
  loadCommittedSources: vi.fn(),
  loadContext: vi.fn(),
  resolveBuilder: vi.fn(),
  resolveCommittedSheet: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCharacterBuilderDraftRepository: () => ({ findByCharacter: mocks.findDraft }),
    createCharacterMechanicsProjectionRepository: () => ({ requireCurrent: mocks.findMechanics }),
    createCharacterSheetAdjustmentRepository: () => ({
      getMovementPreference: mocks.getMovementPreference,
      listByCharacter: mocks.listAdjustments
    }),
    createCharacterSheetPlayStateRepository: () => ({
      listResourceUsage: mocks.listResourceUsage,
      listSpellCustomizations: mocks.listSpellCustomizations
    })
  }
})

vi.mock('./builderService.js', () => ({
  loadCharacterBuilderContext: mocks.loadContext,
  resolveCharacterBuilder: mocks.resolveBuilder
}))
vi.mock('./characterRuleSnapshot.js', () => ({
  assembleCharacterRuleSnapshot: mocks.assembleRuleSnapshot
}))
vi.mock('./characterCommittedSheetSources.js', () => ({
  createCharacterCommittedSheetExtras: mocks.createCommittedExtras,
  createCharacterCommittedSheetSpells: mocks.createCommittedSpells,
  loadCharacterCommittedSheetSources: mocks.loadCommittedSources,
  createCharacterCommittedSheetResolution: mocks.resolveCommittedSheet
}))
vi.mock('./sheetProjection.js', () => ({
  buildCharacterSheetBundle: mocks.buildSheetBundle
}))

const { assembleCharacterSheetBundleForRuleContext } =
  await import('./characterSheetBundleAssembly.js')

const ids = {
  character: 'character-1',
  revision: 'revision-1',
  system: 'system-1'
}
const vocabularySnapshot = {
  document: { abilities: [] },
  snapshotId: 'vocabulary-1'
}

describe('assembleCharacterSheetBundleForRuleContext', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findDraft.mockResolvedValue(null)
    mocks.getMovementPreference.mockResolvedValue(null)
    mocks.listAdjustments.mockResolvedValue([])
    mocks.listResourceUsage.mockResolvedValue([])
    mocks.listSpellCustomizations.mockResolvedValue([])
    mocks.loadContext.mockResolvedValue({ catalog: {}, registry: {} })
    mocks.resolveBuilder.mockResolvedValue({ summary: { totalLevel: 1 } })
    mocks.loadCommittedSources.mockResolvedValue({ vocabularySnapshot })
    mocks.createCommittedExtras.mockReturnValue({
      creaturesById: new Map(),
      vehiclesById: new Map()
    })
    mocks.createCommittedSpells.mockReturnValue(new Map([['spell-1', { id: 'spell-1' }]]))
    mocks.resolveCommittedSheet.mockReturnValue({
      catalog: {},
      registry: {},
      sourceRegistry: {},
      summary: { totalLevel: 1 }
    })
    mocks.assembleRuleSnapshot.mockReturnValue({
      snapshot: { characterId: ids.character },
      registry: {}
    })
    mocks.findMechanics.mockResolvedValue({
      ruleRevisionId: ids.revision,
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '1.0.0',
      modelContractVersion: 4,
      rulePolicyInput: { contractVersion: 4 },
      rulePolicyOutput: { senses: [] }
    })
    mocks.buildSheetBundle.mockResolvedValue({ sheet: {}, ruleEvaluation: {} })
  })

  it('uses the matching committed mechanics result when no mutable mechanics overlay applies', async () => {
    await assembleCharacterSheetBundleForRuleContext({
      db: {} as DBLike,
      character: { id: ids.character, systemId: ids.system, userId: 'user-1' },
      row: { stream_version: 7 },
      revisionId: ids.revision,
      ruleContext: { adjustments: [], additionalConditions: [], attunementSlotOverride: null }
    } as unknown as Parameters<typeof assembleCharacterSheetBundleForRuleContext>[0])

    expect(mocks.findMechanics).toHaveBeenCalledWith({
      characterId: ids.character,
      expectedRuleRevisionId: ids.revision,
      expectedStreamVersion: 7
    })
    expect(mocks.loadCommittedSources).toHaveBeenCalled()
    expect(mocks.createCommittedExtras).toHaveBeenCalled()
    expect(mocks.createCommittedSpells).toHaveBeenCalled()
    expect(mocks.loadContext).not.toHaveBeenCalled()
    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.buildSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        committedRuleEvaluation: expect.objectContaining({
          facts: { contractVersion: 4 },
          output: { senses: [] }
        }),
        pinnedSpellsById: new Map([['spell-1', { id: 'spell-1' }]])
      })
    )
  })

  it('uses exact committed sources but reevaluates mutable mechanics', async () => {
    mocks.listResourceUsage.mockResolvedValue([{ owner: { kind: 'AUTHORED_GRANT' } }])

    await assembleCharacterSheetBundleForRuleContext({
      db: {} as DBLike,
      character: { id: ids.character, systemId: ids.system, userId: 'user-1' },
      row: { stream_version: 7 },
      revisionId: ids.revision,
      ruleContext: { adjustments: [], additionalConditions: [], attunementSlotOverride: null }
    } as unknown as Parameters<typeof assembleCharacterSheetBundleForRuleContext>[0])

    expect(mocks.findMechanics).toHaveBeenCalled()
    expect(mocks.loadCommittedSources).toHaveBeenCalled()
    expect(mocks.createCommittedExtras).toHaveBeenCalled()
    expect(mocks.createCommittedSpells).toHaveBeenCalled()
    expect(mocks.loadContext).not.toHaveBeenCalled()
    expect(mocks.resolveBuilder).not.toHaveBeenCalled()
    expect(mocks.buildSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({
        committedRuleEvaluation: expect.any(Object),
        pinnedSpellsById: new Map([['spell-1', { id: 'spell-1' }]]),
        ruleEvaluation: expect.objectContaining({
          context: expect.objectContaining({ vocabularySnapshot })
        })
      })
    )
  })

  it('reevaluates when a Campaign context was removed after the mechanics projection committed', async () => {
    mocks.findMechanics.mockResolvedValue({
      ruleRevisionId: ids.revision,
      ruleRevisionChecksum: 'a'.repeat(64),
      evaluatorVersion: '1.0.0',
      modelContractVersion: 4,
      rulePolicyInput: { contractVersion: 4 },
      rulePolicyOutput: { senses: [] }
    })

    await assembleCharacterSheetBundleForRuleContext({
      db: {} as DBLike,
      character: { id: ids.character, systemId: ids.system, userId: 'user-1' },
      row: { stream_version: 7 },
      revisionId: ids.revision,
      ruleContext: { adjustments: [], additionalConditions: [], attunementSlotOverride: null }
    } as unknown as Parameters<typeof assembleCharacterSheetBundleForRuleContext>[0])

    expect(mocks.buildSheetBundle).toHaveBeenCalledWith(
      expect.objectContaining({ committedRuleEvaluation: expect.any(Object) })
    )
  })
})
