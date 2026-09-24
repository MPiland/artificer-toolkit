'use node'

import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  LIVE_SESSION_TICKET_AUDIENCE,
  LIVE_SESSION_TICKET_ISSUER,
  LIVE_SESSION_TICKET_TTL_SECONDS,
  LIVE_SESSION_TICKET_VERSION,
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketAdmissionDtoSchema,
  liveSessionTicketDtoSchema,
  type LiveSessionTicketDto
} from '@artificer-toolkit/schema/api/liveSessionIdentity'
import { SignJWT } from 'jose'
import { internal } from '../_generated/api'
import { action } from '../_generated/server'

function ticketKey() {
  const secret = process.env.LIVE_SESSION_TICKET_SECRET
  if (!secret || new TextEncoder().encode(secret).byteLength < 32)
    throw new Error('LIVE_SESSION_TICKET_SECRET must contain at least 32 bytes.')
  return new TextEncoder().encode(secret)
}

export const issue = action({
  args: zodToConvexFields(liveSessionJoinOptionsDtoSchema.shape),
  returns: zodToConvex(liveSessionTicketDtoSchema),
  handler: async (ctx, args): Promise<LiveSessionTicketDto> => {
    const options = liveSessionJoinOptionsDtoSchema.parse(args)
    const key = ticketKey()
    const issuedAt = Math.floor(Date.now() / 1_000)
    const expiresAt = issuedAt + LIVE_SESSION_TICKET_TTL_SECONDS
    const admission = liveSessionTicketAdmissionDtoSchema.parse(
      await ctx.runMutation(internal.liveSessions.admission.authorize, {
        ...options,
        expiresAt: expiresAt * 1_000
      })
    )
    const ticket = await new SignJWT({
      authorityEpoch: admission.authorityEpoch,
      campaignId: admission.campaignId,
      role: admission.role,
      v: LIVE_SESSION_TICKET_VERSION
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setAudience(LIVE_SESSION_TICKET_AUDIENCE)
      .setExpirationTime(expiresAt)
      .setIssuedAt(issuedAt)
      .setIssuer(LIVE_SESSION_TICKET_ISSUER)
      .setJti(crypto.randomUUID())
      .setSubject(admission.sub)
      .sign(key)
    return liveSessionTicketDtoSchema.parse({
      expiresAt: new Date(expiresAt * 1_000).toISOString(),
      ticket
    })
  }
})
