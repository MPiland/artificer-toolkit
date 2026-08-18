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
      projectionChecksum: 'c'.repeat(64),
      rulePolicyOutput: { senses: [{ senseCode: 'DARKVISION', range: { amount: 60, unit: 'FEET' } }] }
    })
    mocks.resolveRuleContext.mockResolvedValue({
      adjustments: [],
      additionalConditions: [],
      attunementSlotOverride: 4
    })
    mocks.checksumRuleContext.mockReturnValue(null)
    mocks.assembleBundle.mockResolvedValue({
      bundle: { ruleEvaluation: { output: { senses: [] } } },
      mechanics: {
        projectionChecksum: 'a'.repeat(64),
        commandLaneChecksum: 'b'.repeat(64),
      },
      resolution: { selections: {} }
    })
    mocks.requireCurrentMechanics.mockResolvedValue({
      rulePolicyOutput: { senses: [] }
    })
  })

  it('derives scene vision from the committed mechanics projection', async () => {
    mocks.requireCurrentMechanics.mockResolvedValue({
      rulePolicyOutput: {
        senses: [
          {
            senseCode: 'DARKVISION',
            range: { amount: 60, unit: 'FEET' }
          }
        ]
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

  it('applies the Campaign darkvision range override without hydrating a rule bundle', () => {
    expect(
      resolveCharacterSceneVisionDimRangeFeet(
        [
          {
            senseCode: 'DARKVISION',
            range: {
              id: 'darkvision-120',
              amount: 120,
              unit: 'FEET',
              calculation: { base: 120, effective: 120, override: null, contributions: [] }
            }
          }
        ],
        [
          {
            id: 'adjustment-1',
            characterId: ids.character,
            family: 'SENSE',
            senseId: 'DARKVISION',
            field: 'RANGE_OVERRIDE',
            value: 30,
            createdBy: 'user-1',
            updatedBy: 'user-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      )
    ).toBe(30)
  })

  it('rebuilds scene vision when a prior Campaign context was removed', async () => {
    mocks.checksumRuleContext.mockReturnValue('c'.repeat(64))
    mocks.requireCurrentMechanics.mockResolvedValue({
      rulePolicyOutput: {
        senses: [{ senseCode: 'DARKVISION', range: { amount: 120, unit: 'FEET' } }]
      }
    })
    mocks.assembleBundle.mockResolvedValue({
      bundle: {
        ruleEvaluation: {
          output: {
            senses: [{ senseCode: 'DARKVISION', range: { amount: 60, unit: 'FEET' } }]
          }
        }
      },
      mechanics: {
        projectionChecksum: 'a'.repeat(64),
        commandLaneChecksum: 'b'.repeat(64),
      },
      resolution: { selections: {} }
    })

    await expect(
      loadCharacterSceneVisionForLiveSessionCampaign({} as DBLike, ids.character, {
        id: ids.campaign,
        attunementSlotOverride: 4
      })
    ).resolves.toEqual({ streamVersion: 12, dimRangeFeet: 60 })
    expect(mocks.findAuthoredById).not.toHaveBeenCalled()
    expect(mocks.assembleBundle).not.toHaveBeenCalled()
    expect(mocks.requireCurrentCampaignMechanics).toHaveBeenCalled()
  })

  it('converts a Campaign override using the existing darkvision range unit', () => {
    expect(
      resolveCharacterSceneVisionDimRangeFeet(
        [
          {
            senseCode: 'DARKVISION',
            range: {
              id: 'darkvision-yards',
              amount: 40,
              unit: 'YARDS',
              calculation: { base: 40, effective: 40, override: null, contributions: [] }
            }
          }
        ],
        [
          {
            id: 'adjustment-yards',
            characterId: ids.character,
            family: 'SENSE',
            senseId: 'DARKVISION',
            field: 'RANGE_OVERRIDE',
            value: 30,
            createdBy: 'user-1',
            updatedBy: 'user-1',
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z'
          }
        ]
      )
    ).toBe(90)
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
