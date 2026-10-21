import {
  liveSessionWebSocketServerMessageDtoSchema,
  type LiveSessionWebSocketServerMessageDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { LiveSessionRoomSceneCapture } from '@artificer-toolkit/schema/api/liveSessionTransient'
import type { LiveSessionScenePublicationDto } from '@artificer-toolkit/schema/api/liveSessionState'
import { type SceneBaseOrdinals } from '@artificer-toolkit/schema/api/sceneGeometry'
import { type SceneLiveStateHeader } from '@artificer-toolkit/schema/api/sceneLiveState'
import { type CampaignSceneStateDto } from '@artificer-toolkit/schema/api/vttScenes'
import { type SceneViewer } from '@artificer-toolkit/shared/vtt'
import { z } from 'zod'
import { meterFrame } from './roomMeter.js'
import { type AccountBucketKind } from './roomRateLimits.js'

/**
 * What survives hibernation about a socket. `admissionDeadline` (the admission's token expiry) and
 * `feeds` are set only while the socket is admitted and cleared when it is challenged or closed, so
 * a woken room restores an admission only for a socket that held one. No token is ever stored.
 */
export const socketAttachmentSchema = z.strictObject({
  acceptedAt: z.number().int().positive(),
  admissionDeadline: z.nullable(z.number().int().positive()),
  authSubject: z.string().min(1),
  authorityEpoch: z.string().uuid(),
  campaignId: z.string().uuid(),
  feeds: z.nullable(
    z.strictObject({
      characterSheet: z.nullable(z.string().uuid()),
      encounterSession: z.nullable(
        z.strictObject({
          timeline: z.boolean(),
          shown: z.nullable(
            z.strictObject({
              encounterId: z.string().uuid(),
              occurrenceId: z.string().uuid(),
              occurrenceVersion: z.number().int().nonnegative()
            })
          )
        })
      ),
      campaignSummary: z.boolean()
    })
  ),
  membershipEpoch: z.nullable(z.iso.datetime({ offset: true })),
  role: z.enum(['OWNER', 'PLAYER']),
  socketId: z.string().uuid(),
  ticketExpiresAt: z.number().int().positive(),
  userId: z.string().uuid()
})
export type SocketAttachment = z.infer<typeof socketAttachmentSchema>

export interface Admission {
  deadline: number
  generation: number
  membershipEpoch: string
  role: 'OWNER' | 'PLAYER'
  userId: string
}

/**
 * The room's shared Scene: every entity (never filtered for one member), each token's and
 * barrier's definition ordinal and the bound Encounter.
 */
export interface TransientCache {
  baseOrdinals: SceneBaseOrdinals
  characterRevisions: LiveSessionRoomSceneCapture['observedCharacterRevisions']
  encounterId: string | null
  key: string
  scene: CampaignSceneStateDto | null
  /** Authored token vision only; derived Character vision is never persisted as an override. */
  uncomposedScene: CampaignSceneStateDto | null
  sceneHeader: SceneLiveStateHeader | null
  presentation: LiveSessionScenePublicationDto['presentation'] | null
}

export function attachment(socket: WebSocket): SocketAttachment | null {
  const parsed = socketAttachmentSchema.safeParse(socket.deserializeAttachment())
  return parsed.success ? parsed.data : null
}

export function viewer(value: Pick<Admission, 'role' | 'userId'>): SceneViewer {
  return {
    role: value.role === 'OWNER' ? 'GM' : 'PLAYER',
    userId: value.userId
  }
}

export function send(socket: WebSocket, message: LiveSessionWebSocketServerMessageDto): void {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(JSON.stringify(liveSessionWebSocketServerMessageDtoSchema.parse(message)))
  meterFrame(socket, message.type)
}

export function accountBucket(
  kind: AccountBucketKind,
  value: SocketAttachment,
  admission: Admission
) {
  return {
    epoch: value.authorityEpoch,
    kind,
    role: admission.role,
    userId: admission.userId
  } as const
}
