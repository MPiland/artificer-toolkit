import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_PROTOCOL_PREFIX,
  LIVE_SESSION_TICKET_VERSION,
  LIVE_SESSION_WEBSOCKET_PROTOCOL
} from '@artificer-toolkit/schema/api/liveSessions'
import { SELF } from 'cloudflare:test'
import { SignJWT } from 'jose'
import { expect, it } from 'vitest'

const secret = 'test-secret-that-contains-at-least-thirty-two-bytes'
const allowedOrigin = 'https://app.test'
const campaignId = '00000000-0000-4000-8000-000000000201'
const otherCampaignId = '00000000-0000-4000-8000-000000000202'

async function ticketFor(ticketCampaignId: string) {
  const now = Math.floor(Date.now() / 1_000)
  return new SignJWT({
    authorityEpoch: '00000000-0000-4000-8000-000000000203',
    campaignId: ticketCampaignId,
    role: 'PLAYER',
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setSubject('00000000-0000-4000-8000-000000000204')
    .setJti(crypto.randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + 60)
    .sign(new TextEncoder().encode(secret))
}

function upgrade(pathCampaignId: string, headers: Record<string, string>) {
  return SELF.fetch(`https://session.test/live-session/${pathCampaignId}`, {
    headers: { upgrade: 'websocket', ...headers }
  })
}

it('refuses a valid ticket used on another Campaign room path', async () => {
  const ticket = await ticketFor(campaignId)
  const response = await upgrade(otherCampaignId, {
    origin: allowedOrigin,
    'sec-websocket-protocol': `${LIVE_SESSION_WEBSOCKET_PROTOCOL}, ${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`
  })
  expect(response.status).toBe(403)
  expect(response.webSocket).toBeNull()
})

it('refuses an upgrade from an origin outside the allowlist', async () => {
  const ticket = await ticketFor(campaignId)
  const response = await upgrade(campaignId, {
    origin: 'https://attacker.test',
    'sec-websocket-protocol': `${LIVE_SESSION_WEBSOCKET_PROTOCOL}, ${LIVE_SESSION_TICKET_PROTOCOL_PREFIX}${ticket}`
  })
  expect(response.status).toBe(403)
})

it('refuses an upgrade without a ticket', async () => {
  const response = await upgrade(campaignId, {
    origin: allowedOrigin,
    'sec-websocket-protocol': LIVE_SESSION_WEBSOCKET_PROTOCOL
  })
  expect(response.status).toBe(401)
})
