import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  liveSessionTicketClaimsDtoSchema,
  type LiveSessionTicketClaimsDto
} from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { jwtVerify } from 'jose'

function signingKey(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret)
  if (key.byteLength < 32) throw new Error('LIVE_SESSION_TICKET_SECRET must contain 32 bytes.')
  return key
}

export async function verifyLiveSessionTicket(
  ticket: string,
  secret: string,
  currentDate = new Date()
): Promise<LiveSessionTicketClaimsDto> {
  const verified = await jwtVerify(ticket, signingKey(secret), {
    algorithms: ['HS256'],
    audience: LIVE_SESSION_TICKET_AUDIENCE,
    currentDate,
    issuer: LIVE_SESSION_TICKET_ISSUER
  })
  return liveSessionTicketClaimsDtoSchema.parse(verified.payload)
}
