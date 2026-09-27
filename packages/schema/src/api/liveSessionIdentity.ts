import { z, lazySchema } from '../zod.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))

export const LIVE_SESSION_PATH_PREFIX = '/live-session'
export const LIVE_SESSION_TICKET_AUDIENCE = 'artificer-live-session'
export const LIVE_SESSION_TICKET_ISSUER = 'artificer-convex'
export const LIVE_SESSION_TICKET_PROTOCOL_PREFIX = 'artificer.ticket.'
export const LIVE_SESSION_TICKET_TTL_SECONDS = 60
export const LIVE_SESSION_TICKET_VERSION = 2
export const LIVE_SESSION_WEBSOCKET_PROTOCOL = 'artificer.live-session.v1'

export const liveSessionJoinOptionsDtoSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema
  })
)

export const liveSessionActiveMembershipDtoSchema = lazySchema(() =>
  z.strictObject({
    role: z.enum(['OWNER', 'PLAYER']),
    userId: uuidSchema
  })
)

export const liveSessionTicketClaimsDtoSchema = lazySchema(() =>
  z.strictObject({
    aud: z.literal(LIVE_SESSION_TICKET_AUDIENCE),
    authorityEpoch: uuidSchema,
    campaignId: uuidSchema,
    exp: z.number().check(z.int()).check(z.positive()),
    iat: z.number().check(z.int()).check(z.positive()),
    iss: z.literal(LIVE_SESSION_TICKET_ISSUER),
    jti: uuidSchema,
    role: z.enum(['OWNER', 'PLAYER']),
    sub: uuidSchema,
    v: z.literal(LIVE_SESSION_TICKET_VERSION)
  })
)

export const liveSessionTicketAdmissionDtoSchema = lazySchema(() =>
  z.pick(liveSessionTicketClaimsDtoSchema, {
    authorityEpoch: true,
    campaignId: true,
    role: true,
    sub: true
  })
)

export const liveSessionTicketDtoSchema = lazySchema(() =>
  z.strictObject({
    expiresAt: z.iso.datetime({ offset: true }),
    ticket: z.string().check(z.trim()).check(z.minLength(1)).check(z.maxLength(4096))
  })
)

export type LiveSessionJoinOptionsDto = z.infer<typeof liveSessionJoinOptionsDtoSchema>
export type LiveSessionActiveMembershipDto = z.infer<typeof liveSessionActiveMembershipDtoSchema>
export type LiveSessionTicketClaimsDto = z.infer<typeof liveSessionTicketClaimsDtoSchema>
export type LiveSessionTicketAdmissionDto = z.infer<typeof liveSessionTicketAdmissionDtoSchema>
export type LiveSessionTicketDto = z.infer<typeof liveSessionTicketDtoSchema>
