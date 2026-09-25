import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION
} from '@artificer-toolkit/schema/api/liveSessions'
import { SignJWT } from 'jose'
import { describe, expect, it } from 'vitest'

import { verifyLiveSessionTicket } from './ticket.js'

const now = new Date('2026-08-15T12:00:00.000Z')
const secret = 'ticket-secret-that-is-at-least-32-bytes'

describe('Cloudflare live-session ticket verification', () => {
  it('accepts only the signed room, actor, role, and expiration claims', async () => {
    const issuedAt = Math.floor(now.getTime() / 1000)
    const ticket = await new SignJWT({
      authorityEpoch: '00000000-0000-4000-8000-000000000005',
      campaignId: '00000000-0000-4000-8000-000000000001',
      role: 'PLAYER',
      v: LIVE_SESSION_TICKET_VERSION
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
      .setExpirationTime(issuedAt + 60)
      .setIssuedAt(issuedAt)
      .setIssuer(LIVE_SESSION_TICKET_ISSUER)
      .setJti('00000000-0000-4000-8000-000000000003')
      .setSubject('00000000-0000-4000-8000-000000000004')
      .sign(new TextEncoder().encode(secret))

    await expect(verifyLiveSessionTicket(ticket, secret, now)).resolves.toMatchObject({
      campaignId: '00000000-0000-4000-8000-000000000001',
      role: 'PLAYER',
      sub: '00000000-0000-4000-8000-000000000004'
    })
    await expect(
      verifyLiveSessionTicket(ticket, 'different-secret-that-is-at-least-32-bytes', now)
    ).rejects.toBeDefined()
  })

  it('rejects a correctly signed ticket from the retired Session-scoped version', async () => {
    const issuedAt = Math.floor(now.getTime() / 1000)
    const ticket = await new SignJWT({
      authorityEpoch: '00000000-0000-4000-8000-000000000005',
      campaignId: '00000000-0000-4000-8000-000000000001',
      role: 'PLAYER',
      sessionId: '00000000-0000-4000-8000-000000000002',
      v: 1
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
      .setExpirationTime(issuedAt + 60)
      .setIssuedAt(issuedAt)
      .setIssuer(LIVE_SESSION_TICKET_ISSUER)
      .setJti('00000000-0000-4000-8000-000000000003')
      .setSubject('00000000-0000-4000-8000-000000000004')
      .sign(new TextEncoder().encode(secret))

    await expect(verifyLiveSessionTicket(ticket, secret, now)).rejects.toBeDefined()
  })
})
