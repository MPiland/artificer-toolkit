import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import {
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketClaimsDtoSchema
} from './liveSessionIdentity.js'
import {
  sceneSessionVisionCharacterRevisionsSchema,
  sceneSessionVisionFreshnessSchema
} from './sceneSessionVision.js'
import { sceneLiveStateHeaderSchema } from './sceneLiveState.js'
import { campaignScenePresentationDtoSchema } from './vttScenes.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const membershipEpochSchema = lazySchema(() => z.iso.datetime({ offset: true }))
const roleSchema = lazySchema(
  () => z.pick(liveSessionTicketClaimsDtoSchema, { role: true }).shape.role
)

export const liveSessionTransientMemberSchema = lazySchema(() =>
  z.strictObject({
    membershipEpoch: membershipEpochSchema,
    role: roleSchema,
    userId: uuidSchema
  })
)

/** The presented Scene as a capture reports it: its presentation, header and ACTIVE bound Encounter. */
const presentedSceneCaptureSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    presentation: z.nullable(campaignScenePresentationDtoSchema),
    sceneHeader: z.nullable(sceneLiveStateHeaderSchema),
    /** The Campaign's ACTIVE Encounter, when bound to the presented Scene. */
    sceneEncounterId: z.nullable(uuidSchema)
  })
)

/** Cold admission: proves the presenting user's identity and membership. */
export const liveSessionTransientCaptureInputSchema = lazySchema(() =>
  z.extend(liveSessionJoinOptionsDtoSchema, {
    expectedRole: roleSchema,
    expectedUserId: uuidSchema
  })
)

export const liveSessionTransientCaptureSchema = lazySchema(() =>
  z.extend(presentedSceneCaptureSchema, {
    origin: liveSessionTransientMemberSchema
  })
)

/**
 * The room's Scene cache refresh, authorized by the room's active epoch rather than a member's
 * token. The cache is shared by every member, so it names no origin or recipients.
 */
export const liveSessionRoomSceneCaptureInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    epoch: uuidSchema,
    observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema
  })
)

export const liveSessionRoomSceneCaptureSchema = lazySchema(() =>
  z.extend(presentedSceneCaptureSchema, {
    systemId: postgresUuidSchema,
    observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema,
    visionFreshness: z.nullable(sceneSessionVisionFreshnessSchema)
  })
)

export type LiveSessionTransientCapture = z.infer<typeof liveSessionTransientCaptureSchema>
export type LiveSessionTransientCaptureInput = z.infer<
  typeof liveSessionTransientCaptureInputSchema
>
export type LiveSessionRoomSceneCapture = z.infer<typeof liveSessionRoomSceneCaptureSchema>
export type LiveSessionRoomSceneCaptureInput = z.infer<
  typeof liveSessionRoomSceneCaptureInputSchema
>
export type LiveSessionTransientMember = z.infer<typeof liveSessionTransientMemberSchema>
