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
  resolveRuleContext: vi.fn(),
  assembleBundle: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCharacterRepository: () => ({
      findById: mocks.findById,
      findAuthoredById: mocks.findAuthoredById
    })
  }
})

vi.mock('./campaignCharacterSheet.js', () => ({
  resolveCharacterLiveSessionRuleContext: mocks.resolveRuleContext
}))

vi.mock('./characterSheetBundleAssembly.js', () => ({
  assembleCharacterSheetBundleForRuleContext: mocks.assembleBundle
}))

const { loadCharacterRuleSnapshotForLiveSessionCampaign } =
  await import('./characterLiveSessionSnapshot.js')

describe('live-session Character rule snapshots', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findById.mockResolvedValue({
      id: ids.character,
      rule_pack_revision_id: ids.revision,
      stream_version: 12
    })
    mocks.findAuthoredById.mockResolvedValue({
      id: ids.character,
      status: 'ACTIVE',
      userId: '00000000-0000-4000-8000-000000000004'
    })
    mocks.resolveRuleContext.mockResolvedValue({
      adjustments: [],
      additionalConditions: [],
      attunementSlotOverride: 4
    })
    mocks.assembleBundle.mockResolvedValue({
      bundle: { ruleEvaluation: { output: { senses: [] } } },
      resolution: { selections: {} }
    })
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
