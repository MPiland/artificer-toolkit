import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  find: vi.fn(),
  resolveAuthority: vi.fn(),
  assertActiveMember: vi.fn()
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return {
    ...actual,
    createCampaignSettingsRepository: () => ({ find: mocks.find })
  }
})

vi.mock('./campaignService.js', () => ({
  CampaignConflictError: class CampaignConflictError extends Error {},
  CampaignNotFoundError: class CampaignNotFoundError extends Error {},
  assertActiveCampaignMember: mocks.assertActiveMember,
  assertCampaignOwner: vi.fn(),
  assertCampaignWritable: vi.fn(),
  resolveCampaignAuthority: mocks.resolveAuthority
}))

const { getCampaignPlaySettings } = await import('./campaignPlaySettingsService.js')

const campaignId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const settings = {
  campaignId,
  normalCadenceDays: 14,
  expectedDurationMinutes: 240,
  quorum: 3,
  absentCharacterPolicy: 'No shitstorm autopilot.',
  contentGuidance: 'Avoid the shitstorm.',
  allowedContentRules: 'No shitstorm exceptions.',
  tableConduct: 'No shitstorm insults.',
  contentBoundaries: 'No shitstorm gore.',
  safetyPractices: ['SESSION_ZERO'],
  liveSafetyMethod: 'Say shitstorm stop.',
  version: 1,
  updatedAt: '2026-08-12T12:00:00.000Z'
}

function authority(role: 'OWNER' | 'PLAYER', contentMaturity: 'STANDARD' | 'MATURE') {
  return {
    campaign: { contentMaturity },
    membership: { role, status: 'ACTIVE' }
  }
}

describe('Campaign play settings service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.find.mockResolvedValue(settings)
  })

  it('masks shared Standard settings for players', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('PLAYER', 'STANDARD'))

    const result = await getCampaignPlaySettings({} as DBLike, userId, campaignId)

    expect(result.absentCharacterPolicy).not.toContain('shitstorm')
    expect(result.contentGuidance).toBe('Avoid the ****storm.')
    expect(result.allowedContentRules).not.toContain('shitstorm')
    expect(result.tableConduct).not.toContain('shitstorm')
    expect(result.contentBoundaries).not.toContain('shitstorm')
    expect(result.liveSafetyMethod).not.toContain('shitstorm')
  })

  it('preserves raw settings for the owner', async () => {
    mocks.resolveAuthority.mockResolvedValue(authority('OWNER', 'STANDARD'))

    await expect(getCampaignPlaySettings({} as DBLike, userId, campaignId)).resolves.toEqual(
      settings
    )
  })
})
