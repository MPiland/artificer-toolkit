import type { DBLike } from '@artificer-toolkit/db'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  character: '00000000-0000-4000-8000-000000000002',
  revision: '00000000-0000-4000-8000-000000000003'
} as const

const mocks = vi.hoisted(() => ({
  findById: vi.fn(),
  findAuthoredById: vi.fn(),
  requireCurrentCampaignMechanics: vi.fn(),
  requireCurrentMechanics: vi.fn(),
  resolveRuleContext: vi.fn(),
  checksumRuleContext: vi.fn(),
  assembleBundle: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById
    }),
    createCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: mocks.requireCurrentMechanics
    }),
    createCampaignCharacterMechanicsProjectionRepository: () => ({
      requireCurrent: mocks.requireCurrentCampaignMechanics
    })
  }
})

vi.mock('./campaignCharacterSheet.js', () => ({
  checksumCampaignCharacterMechanicalContext: mocks.checksumRuleContext,
  resolveCharacterLiveSessionRuleContext: mocks.resolveRuleContext
}))

vi.mock('./characterSheetBundleAssembly.js', () => ({
  assembleCharacterSheetBundleForRuleContext: mocks.assembleBundle
}))

const {
  loadCharacterRuleSnapshotForLiveSessionCampaign,
  loadCharacterSceneVisionForLiveSessionCampaign,
  resolveCharacterSceneVisionDimRangeFeet
} = await import('./characterLiveSessionSnapshot.js')

function visionPin(amount: number, unit: 'FEET' | 'YARDS' = 'FEET') {
  return {
    senseDefinitionId: '00000000-0000-4000-8000-000000000010',
    definitionVersion: 1,
    definitionContractVersion: 1,
    definitionChecksum: 'a'.repeat(64),
    document: {
      schemaVersion: 1 as const,
      kind: 'SENSE' as const,
      id: '00000000-0000-4000-8000-000000000010',
      gameSystemId: '00000000-0000-4000-8000-000000000011',
      capabilities: [
        {
          channel: 'VISUAL' as const,
          accessGrade: 'PRECISE' as const,
          satisfies: ['SEE' as const],
          illuminationAccess: 'ORDINARY_DARKNESS' as const,
          obscurementAccess: 'NONE' as const,
          perceivesInvisible: false,
          physicalConstraints: []
        }
      ]
    },
    range: {
      id: 'range-1',
      amount,
      unit,
      calculation: { base: amount, effective: amount, override: null, contributions: [] }
    }
  }
}

describe('live-session Character rule snapshots', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findById.mockResolvedValue({
      id: ids.character,
      rule_pack_revision_id: ids.revision,
      status: 'ACTIVE',
      stream_version: 12
    })
    mocks.findAuthoredById.mockResolvedValue({
      id: ids.character,
      status: 'ACTIVE',
      userId: '00000000-0000-4000-8000-000000000004'
    })
    mocks.requireCurrentCampaignMechanics.mockResolvedValue({
      kind: 'BASE_REFERENCE',
      projectionChecksum: 'c'.repeat(64)
    })
    mocks.resolveRuleContext.mockResolvedValue({
      adjustments: [],
      additionalConditions: [],
      attunementSlotOverride: 4
    })
    mocks.checksumRuleContext.mockReturnValue(null)
    mocks.assembleBundle.mockResolvedValue({
      bundle: { ruleEvaluation: { output: { senses: [] } } },
      campaignMechanics: { kind: 'BASE_REFERENCE' },
      mechanics: {
        projectionChecksum: 'a'.repeat(64),
        commandLaneChecksum: 'b'.repeat(64),
        pinnedSenseDefinitions: [],
        rulePolicyOutput: { senses: [] }
      },
      resolution: { selections: {} }
    })
    mocks.requireCurrentMechanics.mockResolvedValue({
      rulePolicyOutput: { senses: [] }
    })
  })

  it('derives scene vision from the committed mechanics projection', async () => {
    mocks.requireCurrentMechanics.mockResolvedValue({
      pinnedSenseDefinitions: [visionPin(60)],
      rulePolicyOutput: {
        senses: [{ senseDefinitionId: visionPin(60).senseDefinitionId, range: visionPin(60).range }]
      }
    })

    await expect(
      loadCharacterSceneVisionForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: 4
      })
    ).resolves.toEqual({ streamVersion: 12, dimRangeFeet: 60 })
    expect(mocks.requireCurrentMechanics).toHaveBeenCalledWith({
      characterId: ids.character,
      expectedStreamVersion: 12,
      expectedRuleRevisionId: ids.revision
    })
    expect(mocks.findAuthoredById).not.toHaveBeenCalled()
    expect(mocks.assembleBundle).not.toHaveBeenCalled()
  })

  it('derives a darkness-capable visual range from the pinned capability document', () => {
    expect(resolveCharacterSceneVisionDimRangeFeet([visionPin(120)])).toBe(120)
  })

  it('rebuilds scene vision when a prior Campaign context was removed', async () => {
    mocks.checksumRuleContext.mockReturnValue('c'.repeat(64))
    mocks.requireCurrentMechanics.mockResolvedValue({
      pinnedSenseDefinitions: [visionPin(60)],
      rulePolicyOutput: {
        senses: [
          { senseDefinitionId: visionPin(60).senseDefinitionId, range: visionPin(120).range }
        ]
      }
    })
    mocks.assembleBundle.mockResolvedValue({
      bundle: {
        ruleEvaluation: {
          output: {
            senses: [
              { senseDefinitionId: visionPin(60).senseDefinitionId, range: visionPin(60).range }
            ]
          }
        }
      },
      campaignMechanics: { kind: 'BASE_REFERENCE' },
      mechanics: {
        projectionChecksum: 'a'.repeat(64),
        commandLaneChecksum: 'b'.repeat(64),
        pinnedSenseDefinitions: [],
        rulePolicyOutput: { senses: [] }
      },
      resolution: { selections: {} }
    })

    await expect(
      loadCharacterSceneVisionForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: 4
      })
    ).resolves.toEqual({ streamVersion: 12, dimRangeFeet: 120 })
    expect(mocks.findAuthoredById).not.toHaveBeenCalled()
    expect(mocks.assembleBundle).not.toHaveBeenCalled()
    expect(mocks.requireCurrentCampaignMechanics).toHaveBeenCalled()
  })

  it('converts a pinned qualifying vision range to feet', () => {
    expect(resolveCharacterSceneVisionDimRangeFeet([visionPin(40, 'YARDS')])).toBe(120)
  })

  it('assembles the pinned active Character with its admitted Campaign context', async () => {
    await expect(
      loadCharacterRuleSnapshotForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: 4
      })
    ).resolves.toMatchObject({
      streamVersion: 12,
      evaluation: { output: { senses: [] } }
    })
    expect(mocks.resolveRuleContext).toHaveBeenCalledWith(expect.anything(), ids.character, {
      id: ids.campaign,
      attunementSlotOverride: 4
    })
    expect(mocks.assembleBundle).toHaveBeenCalledWith(
      expect.objectContaining({ revisionId: ids.revision })
    )
  })

  it('rejects inactive, unassigned, and unpinned Characters', async () => {
    mocks.findAuthoredById.mockResolvedValueOnce({
      id: ids.character,
      status: 'DRAFT',
      userId: '00000000-0000-4000-8000-000000000004'
    })
    await expect(
      loadCharacterRuleSnapshotForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: null
      })
    ).resolves.toBeNull()

    mocks.resolveRuleContext.mockResolvedValueOnce(null)
    await expect(
      loadCharacterRuleSnapshotForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: null
      })
    ).resolves.toBeNull()

    mocks.findById.mockResolvedValueOnce({
      id: ids.character,
      rule_pack_revision_id: null,
      stream_version: 12
    })
    await expect(
      loadCharacterRuleSnapshotForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: null
      })
    ).rejects.toMatchObject({ name: 'CharacterRuleBindingError' })
    expect(mocks.assembleBundle).not.toHaveBeenCalled()
  })
})
