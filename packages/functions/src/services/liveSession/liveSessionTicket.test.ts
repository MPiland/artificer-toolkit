import type { DBLike } from '@artificer-toolkit/db'
import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  liveSessionTicketClaimsDtoSchema
} from '@artificer-toolkit/schema/api/liveSessions'
import { jwtVerify } from 'jose'
import { describe, expect, it, vi } from 'vitest'

const authorizeLiveSessionAdmission = vi.hoisted(() => vi.fn())

vi.mock('./liveSessionService.js', () => ({ authorizeLiveSessionAdmission }))

import {
  issueLiveSessionTicket,
  LIVE_SESSION_TICKET_TTL_SECONDS,
  LiveSessionTicketConfigurationError,
  verifyLiveSessionTicket
} from './liveSessionTicket.js'

const ids = {
  campaign: '00000000-0000-4000-8000-000000000001',
  session: '00000000-0000-4000-8000-000000000002',
  ticket: '00000000-0000-4000-8000-000000000003',
  user: '00000000-0000-4000-8000-000000000004'
} as const

describe('live-session tickets', () => {
  it('signs an authorized, room-bound ticket that expires after one minute', async () => {
    authorizeLiveSessionAdmission.mockResolvedValueOnce({
      options: { campaignId: ids.campaign, sessionId: ids.session },
      role: 'PLAYER'
    })
    const now = new Date('2026-08-15T12:00:00.000Z')
    const secret = 'ticket-secret-that-is-at-least-32-bytes'

    const result = await issueLiveSessionTicket(
      {} as DBLike,
      ids.user,
      { campaignId: ids.campaign, sessionId: ids.session },
      secret,
      { now, ticketId: ids.ticket }
    )
    const verified = await jwtVerify(result.ticket, new TextEncoder().encode(secret), {
      audience: LIVE_SESSION_TICKET_AUDIENCE,
      currentDate: now,
      issuer: LIVE_SESSION_TICKET_ISSUER
    })
    const claims = liveSessionTicketClaimsDtoSchema.parse(verified.payload)

    expect(claims).toMatchObject({
      campaignId: ids.campaign,
      jti: ids.ticket,
      role: 'PLAYER',
      sessionId: ids.session,
      sub: ids.user
    })
    expect(claims.exp - claims.iat).toBe(LIVE_SESSION_TICKET_TTL_SECONDS)
    expect(result.expiresAt).toBe('2026-08-15T12:01:00.000Z')
    await expect(verifyLiveSessionTicket(result.ticket, secret, now)).resolves.toEqual(claims)
    await expect(
      verifyLiveSessionTicket(result.ticket, secret, new Date('2026-08-15T12:01:01.000Z'))
    ).rejects.toBeDefined()
  })

  it('rejects a signing secret shorter than 32 bytes', async () => {
    authorizeLiveSessionAdmission.mockResolvedValueOnce({
      options: { campaignId: ids.campaign, sessionId: ids.session },
      role: 'OWNER'
    })

    await expect(
      issueLiveSessionTicket(
        {} as DBLike,
        ids.user,
        { campaignId: ids.campaign, sessionId: ids.session },
        'too-short'
      )
    ).rejects.toBeInstanceOf(LiveSessionTicketConfigurationError)
  })
})
