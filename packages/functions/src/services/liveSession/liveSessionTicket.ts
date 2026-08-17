import { randomUUID } from 'node:crypto'

import type { DBLike } from '@artificer-toolkit/db'
import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionTicketClaimsDtoSchema,
  liveSessionTicketDtoSchema,
  type LiveSessionJoinOptionsDto,
  type LiveSessionTicketClaimsDto,
  type LiveSessionTicketDto
} from '@artificer-toolkit/schema/api/liveSessions'
import { jwtVerify, SignJWT } from 'jose'

import { authorizeLiveSessionAdmission } from './liveSessionService.js'

export const LIVE_SESSION_TICKET_TTL_SECONDS = 60

export class LiveSessionTicketConfigurationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LiveSessionTicketConfigurationError'
  }
}

export async function verifyLiveSessionTicket(
  ticket: string,
  secret: string,
  currentDate = new Date()
): Promise<LiveSessionTicketClaimsDto> {
  const verified = await jwtVerify(ticket, ticketKey(secret), {
    algorithms: ['HS256'],
    audience: LIVE_SESSION_TICKET_AUDIENCE,
    currentDate,
    issuer: LIVE_SESSION_TICKET_ISSUER
  })
  return liveSessionTicketClaimsDtoSchema.parse(verified.payload)
}

function ticketKey(secret: string): Uint8Array {
  if (new TextEncoder().encode(secret).byteLength < 32) {
    throw new LiveSessionTicketConfigurationError(
      'LIVE_SESSION_TICKET_SECRET must contain at least 32 bytes.'
    )
  }
  return new TextEncoder().encode(secret)
}

export async function issueLiveSessionTicket(
  db: DBLike,
  userId: string,
  options: LiveSessionJoinOptionsDto,
  secret: string,
  runtime: { now?: Date; ticketId?: string } = {}
): Promise<LiveSessionTicketDto> {
  const admission = await authorizeLiveSessionAdmission(db, userId, options)
  const issuedAt = Math.floor((runtime.now ?? new Date()).getTime() / 1000)
  const expiresAt = issuedAt + LIVE_SESSION_TICKET_TTL_SECONDS
  const ticket = await new SignJWT({
    campaignId: admission.options.campaignId,
    role: admission.role,
    sessionId: admission.options.sessionId,
    v: LIVE_SESSION_TICKET_VERSION
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
    .setExpirationTime(expiresAt)
    .setIssuedAt(issuedAt)
    .setIssuer(LIVE_SESSION_TICKET_ISSUER)
    .setJti(runtime.ticketId ?? randomUUID())
    .setSubject(userId)
    .sign(ticketKey(secret))

  return liveSessionTicketDtoSchema.parse({
    expiresAt: new Date(expiresAt * 1000).toISOString(),
    ticket
  })
}
