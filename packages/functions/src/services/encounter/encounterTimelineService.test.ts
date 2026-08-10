import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  owner: '00000000-0000-4000-8000-000000000002',
  command: '00000000-0000-4000-8000-000000000006'
}

const mocks = vi.hoisted(() => ({
  authority: vi.fn(),
  encounter: { find: vi.fn(), listEventsPage: vi.fn() }
}))

vi.mock('@artificer-toolkit/db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@artificer-toolkit/db')>()
  return { ...actual, createEncounterRepository: () => mocks.encounter }
})

vi.mock('../campaign/campaignService.js', () => ({
  assertActiveCampaignMember: vi.fn(),
  resolveCampaignAuthority: mocks.authority
}))

import { getEncounterTimeline } from './encounterTimelineService.js'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authority.mockResolvedValue({
    campaign: { id: ids.campaign, status: 'ACTIVE' },
    membership: {
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: '2026-08-01T00:00:00.000Z'
    }
  })
  mocks.encounter.find.mockResolvedValue({ id: ids.command, campaignId: ids.campaign })
  mocks.encounter.listEventsPage.mockResolvedValue([])
})

describe('encounter timeline', () => {
  it('pages only TABLE-visible events for players', async () => {
    await expect(
      getEncounterTimeline({} as DBLike, ids.owner, {
        encounterId: ids.command,
        limit: 20
      })
    ).resolves.toEqual({ entries: [], nextCursor: null })
    expect(mocks.encounter.listEventsPage).toHaveBeenCalledWith(ids.command, undefined, 21, 'TABLE')
  })
})
