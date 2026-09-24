import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CampaignInviteDto } from '@artificer-toolkit/schema/api/campaignCore'
import { useInvitationExpiry } from './useInvitationExpiry'

const start = Date.parse('2026-09-10T12:00:00.000Z')
const invitation: CampaignInviteDto = {
  invitePublicId: 'aaaaaaaa-1111-4111-8111-111111111111',
  listingPublicId: 'bbbbbbbb-2222-4222-8222-222222222222',
  listingTitle: 'A table',
  hostProfilePublicId: 'cccccccc-3333-4333-8333-333333333333',
  hostUsername: 'Host',
  recipientUsername: 'Player',
  status: 'PENDING',
  expiresAt: new Date(start + 1000).toISOString(),
  respondedAt: null,
  createdAt: new Date(start).toISOString(),
  version: 0
}

describe('invitation pagination horizon', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(start)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps the horizon stable until the next pending expiry and does not loop on stale results', () => {
    const { result, rerender } = renderHook(
      ({ rows }) => {
        const [asOf, setAsOf] = useState(() => new Date().toISOString())
        useInvitationExpiry(asOf, setAsOf, rows)
        return asOf
      },
      {
        initialProps: {
          rows: [
            invitation,
            {
              ...invitation,
              status: 'REVOKED' as const,
              expiresAt: new Date(start + 200).toISOString()
            }
          ]
        }
      }
    )
    act(() => {
      vi.advanceTimersByTime(999)
    })
    expect(result.current).toBe(new Date(start).toISOString())
    rerender({ rows: [invitation] })
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe(invitation.expiresAt)
    act(() => {
      vi.advanceTimersByTime(5000)
    })
    expect(result.current).toBe(invitation.expiresAt)
  })

  it('advances immediately when a later page introduces an already expired row', () => {
    const future = { ...invitation, expiresAt: new Date(start + 60_000).toISOString() }
    const { result, rerender } = renderHook(
      ({ rows }) => {
        const [asOf, setAsOf] = useState(() => new Date().toISOString())
        useInvitationExpiry(asOf, setAsOf, rows)
        return asOf
      },
      { initialProps: { rows: [future] } }
    )
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current).toBe(new Date(start).toISOString())
    rerender({ rows: [future, invitation] })
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current).toBe(new Date(start + 2000).toISOString())
  })

  it('refreshes on focus and visible wake, and removes timers/listeners on unmount', () => {
    const update = vi.fn()
    const { unmount } = renderHook(() =>
      useInvitationExpiry(new Date(start).toISOString(), update, [invitation])
    )
    vi.setSystemTime(start + 500)
    act(() => {
      window.dispatchEvent(new Event('focus'))
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(update).toHaveBeenCalledWith(new Date(start + 500).toISOString())
    const calls = update.mock.calls.length
    unmount()
    act(() => {
      vi.advanceTimersByTime(1000)
      window.dispatchEvent(new Event('focus'))
    })
    expect(update).toHaveBeenCalledTimes(calls)
  })

  it('handles the maximum 30-day invite without browser timeout overflow', () => {
    const deadline = start + 30 * 86_400_000
    const { result } = renderHook(() => {
      const [asOf, setAsOf] = useState(() => new Date().toISOString())
      useInvitationExpiry(asOf, setAsOf, [
        { ...invitation, expiresAt: new Date(deadline).toISOString() }
      ])
      return asOf
    })
    act(() => {
      vi.advanceTimersByTime(2_147_483_647)
    })
    expect(Date.parse(result.current)).toBe(start + 2_147_483_647)
    act(() => {
      vi.advanceTimersByTime(deadline - Date.now())
    })
    expect(result.current).toBe(new Date(deadline).toISOString())
  })
})
