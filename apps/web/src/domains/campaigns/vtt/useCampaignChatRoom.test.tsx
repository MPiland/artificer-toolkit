import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { getFunctionName } from 'convex/server'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@artificer-toolkit/apis/convex/api'
import { campaignChatEntryDtoSchema } from '@artificer-toolkit/schema/api/campaignCommunication'
import { rollHistoryEntryDtoSchema } from '@artificer-toolkit/schema/api/rolls'
import { getCampaignLiveAuthority } from '#app/data/campaigns/queries'
import { useCampaignChatRoom } from './useCampaignChatRoom'
import { validated } from '../../../test/validatedFixture'

const campaignId = '00000000-0000-4000-8000-000000000123'
const nonce = '00000000-0000-4000-8000-000000000789'
const rollId = '00000000-0000-4000-8000-000000000456'

const mocks = vi.hoisted(() => ({
  convexExecutePrivate: vi.fn(),
  convexReveal: vi.fn(),
  live: {
    onPrivateRoll: undefined as ((roll: unknown) => void) | undefined,
    sendCommand: vi.fn()
  }
}))

vi.mock('convex/react', () => ({
  useMutation: (reference: Parameters<typeof getFunctionName>[0]) =>
    ({
      [getFunctionName(api.campaigns.rolls.executePrivate)]: mocks.convexExecutePrivate,
      [getFunctionName(api.campaigns.rolls.reveal)]: mocks.convexReveal
    })[getFunctionName(reference)] ?? vi.fn()
}))

vi.mock('./useCampaignLiveSession', () => ({
  useCampaignLiveSession: (options: { onPrivateRoll?: (roll: unknown) => void }) => {
    mocks.live.onPrivateRoll = options.onPrivateRoll
    return { sendCommand: mocks.live.sendCommand }
  }
}))

const privateRoll = validated(rollHistoryEntryDtoSchema)({
  id: rollId,
  characterId: null,
  characterLabel: 'GM',
  source: { kind: 'MANUAL', label: 'Manual roll' },
  ruleset: { systemId: '00000000-0000-4000-8000-000000000001', code: 'DND5E_2014', version: '1' },
  normalizedExpression: '1d20',
  evidence: {
    terms: [{ count: 1, die: 20, rolls: [14], subtotal: 14 }],
    modifier: 0,
    mode: 'NORMAL',
    keep: 'FIRST',
    subtotal: 14,
    transform: { kind: 'NONE' },
    total: 14
  },
  createdAt: '2026-09-18T12:00:00.000Z',
  gmCampaignRoll: { campaignId, creature: null, revealedAt: null, noticedAt: null }
})

const chatEntry = validated(campaignChatEntryDtoSchema)({
  id: '00000000-0000-4000-8000-000000000a01',
  campaignId,
  conversationId: '00000000-0000-4000-8000-000000000a02',
  room: 'TABLE',
  kind: 'CHAT',
  mode: 'OOC',
  body: 'Revealed.',
  roll: null,
  revealedByGm: false,
  authorUserId: '00000000-0000-4000-8000-000000000a03',
  authorUsername: 'gm',
  characterId: null,
  characterLabel: null,
  editedAt: null,
  unsentAt: null,
  createdAt: '2026-09-18T12:00:00.000Z'
})

const input = {
  campaignId,
  clientNonce: nonce,
  roll: {
    characterId: null,
    expression: '1d20',
    source: { kind: 'MANUAL' as const, label: 'Manual roll' }
  }
}

function wrapperFor(holdsAuthority: boolean) {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  client.setQueryData(
    getCampaignLiveAuthority(campaignId).queryKey,
    holdsAuthority ? { campaignId, epoch: nonce, checkpointedAt: null } : null
  )
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
}

describe('useCampaignChatRoom GM private rolls', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sends a private roll and a reveal through the room while it holds authority', async () => {
    mocks.live.sendCommand
      .mockResolvedValueOnce({ delta: { scope: 'CAMPAIGN_CHAT', entry: null, privateRoll } })
      .mockResolvedValueOnce({
        delta: { scope: 'CAMPAIGN_CHAT', entry: chatEntry, privateRoll: null }
      })
    const { result } = renderHook(() => useCampaignChatRoom(campaignId), {
      wrapper: wrapperFor(true)
    })

    await expect(result.current.executePrivateRoll(input)).resolves.toBe(privateRoll)
    expect(mocks.live.sendCommand).toHaveBeenNthCalledWith(1, {
      scope: 'CAMPAIGN_CHAT',
      command: { type: 'EXECUTE_PRIVATE_ROLL', commandId: nonce, input }
    })

    await expect(result.current.revealRoll({ campaignId, rollId, mode: 'NOTICE' })).resolves.toBe(
      chatEntry
    )
    expect(mocks.live.sendCommand).toHaveBeenNthCalledWith(2, {
      scope: 'CAMPAIGN_CHAT',
      command: {
        type: 'REVEAL_ROLL',
        commandId: expect.any(String),
        input: { campaignId, rollId, mode: 'NOTICE' }
      }
    })
    expect(mocks.convexExecutePrivate).not.toHaveBeenCalled()
    expect(mocks.convexReveal).not.toHaveBeenCalled()
  })

  it('keeps pushed private rolls, replacing an updated copy by id', () => {
    const { result } = renderHook(() => useCampaignChatRoom(campaignId), {
      wrapper: wrapperFor(true)
    })
    act(() => mocks.live.onPrivateRoll?.(privateRoll))
    const revealed = {
      ...privateRoll,
      gmCampaignRoll: { ...privateRoll.gmCampaignRoll, revealedAt: '2026-09-18T12:01:00.000Z' }
    }
    act(() => mocks.live.onPrivateRoll?.(revealed))
    expect(result.current.pushedPrivateRolls).toEqual([revealed])
  })

  it('uses the Convex functions without authority', async () => {
    mocks.convexExecutePrivate.mockResolvedValue(privateRoll)
    mocks.convexReveal.mockResolvedValue(chatEntry)
    const { result } = renderHook(() => useCampaignChatRoom(campaignId), {
      wrapper: wrapperFor(false)
    })

    await result.current.executePrivateRoll(input)
    await result.current.revealRoll({ campaignId, rollId, mode: 'FULL' })
    expect(mocks.convexExecutePrivate).toHaveBeenCalledWith(input)
    expect(mocks.convexReveal).toHaveBeenCalledWith({ campaignId, rollId, mode: 'FULL' })
    expect(mocks.live.sendCommand).not.toHaveBeenCalled()
  })
})
