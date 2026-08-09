import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  channel: vi.fn(),
  removeChannel: vi.fn(),
  send: vi.fn(),
  listActiveMemberships: vi.fn()
}))

vi.mock('@artificer-toolkit/db', () => ({
  createCampaignRepository: () => ({ listActiveMemberships: mocks.listActiveMemberships })
}))

vi.mock('../../clients/supabaseClient.js', () => ({
  createSupabaseClient: mocks.createClient
}))

import { broadcastCampaignInvalidation } from './realtimeService.js'

describe('broadcastCampaignInvalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.send.mockResolvedValue('ok')
    mocks.channel.mockReturnValue({ send: mocks.send })
    mocks.removeChannel.mockResolvedValue('ok')
    mocks.createClient.mockReturnValue({
      channel: mocks.channel,
      removeChannel: mocks.removeChannel
    })
    mocks.listActiveMemberships.mockResolvedValue([
      {
        userId: '64a53af5-1eb3-4768-945a-bc9874b7a396',
        role: 'OWNER',
        accessStartedAt: '2026-08-07T11:00:00.000Z',
        acceptedAt: '2026-08-06T11:00:00.000Z'
      },
      {
        userId: '64a53af5-1eb3-4768-945a-bc9874b7a397',
        role: 'PLAYER',
        accessStartedAt: '2026-08-07T12:00:00.000Z',
        acceptedAt: '2026-08-06T12:00:00.000Z'
      }
    ])
  })

  it('broadcasts only the validated invalidation envelope to the private room topic', async () => {
    const envelope = {
      scope: 'PARTY' as const,
      entity: 'CHAT' as const,
      entityId: 'b43dcfd6-9560-4e6d-90af-dfa3f12ab8f0',
      event: 'CREATED' as const,
      eventId: 'ac7e816a-f237-4266-a18c-50f8524d4013',
      cursor: '2026-08-06T12:00:00.000Z:ac7e816a-f237-4266-a18c-50f8524d4013'
    }

    await expect(
      broadcastCampaignInvalidation({} as DBLike, '64a53af5-1eb3-4768-945a-bc9874b7a395', envelope)
    ).resolves.toBe(true)
    expect(mocks.channel).toHaveBeenCalledWith(
      'campaign:64a53af5-1eb3-4768-945a-bc9874b7a395:party:64a53af5-1eb3-4768-945a-bc9874b7a397:1786104000000',
      { config: { private: true } }
    )
    expect(mocks.channel).toHaveBeenCalledTimes(1)
    expect(mocks.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'committed',
      payload: envelope
    })
  })

  it('treats an unavailable Broadcast client as a best-effort miss', async () => {
    mocks.createClient.mockImplementation(() => {
      throw new Error('offline')
    })

    await expect(
      broadcastCampaignInvalidation({} as DBLike, '64a53af5-1eb3-4768-945a-bc9874b7a395', {
        scope: 'TABLE',
        entity: 'CAMPAIGN',
        entityId: 'b43dcfd6-9560-4e6d-90af-dfa3f12ab8f0',
        event: 'UPDATED',
        eventId: 'ac7e816a-f237-4266-a18c-50f8524d4013',
        cursor: 'ac7e816a-f237-4266-a18c-50f8524d4013'
      })
    ).resolves.toBe(false)
  })
})
