import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import {
  liveSessionJoinOptionsDtoSchema,
  liveSessionTicketClaimsDtoSchema
} from './liveSessionIdentity.js'
import {
  sceneSessionVisionCharacterRevisionsSchema,
  sceneSessionVisionFreshnessSchema
} from './sceneSessionVision.js'
import { sceneLiveStateHeaderSchema } from './sceneLiveState.js'
import { sceneBaseOrdinalsSchema } from './sceneGeometry.js'
import { campaignSceneStateDtoSchema, campaignScenePresentationDtoSchema } from './vttScenes.js'

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

export const liveSessionTransientCaptureInputSchema = lazySchema(() =>
  z.extend(liveSessionJoinOptionsDtoSchema, {
    expectedRole: roleSchema,
    expectedUserId: uuidSchema,
    mode: z.optional(z.enum(['AUTHORITY', 'FULL'])),
    observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema,
    recipientUserIds: z
      .array(uuidSchema)
      .check(z.maxLength(10_000))
      .check(z.refine((ids) => new Set(ids).size === ids.length, 'Recipients must be unique.'))
  })
)

export const liveSessionTransientCaptureSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    systemId: postgresUuidSchema,
    observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema,
    origin: liveSessionTransientMemberSchema,
    presentation: z.nullable(campaignScenePresentationDtoSchema),
    recipients: z.array(liveSessionTransientMemberSchema).check(z.maxLength(10_000)),
    sceneHeader: z.nullable(sceneLiveStateHeaderSchema),
    /** The Encounter bound to the presented Scene, if any. */
    sceneEncounterId: z.nullable(uuidSchema),
    /** Whether that Encounter waits on a movement decision planned against this Scene (D26). */
    sceneMovementDecisionPending: z.boolean(),
    /**
     * For a player origin on an Encounter-bound Scene: each Encounter-bound token and whether the
     * origin controls its bound actor. Bound tokens follow actor control, never the Scene token's
     * `controlledByUserIds` (ADR 0034). Empty for the GM and for unbound Scenes.
     */
    originBoundTokenControl: z
      .array(z.strictObject({ tokenId: uuidSchema, controlled: z.boolean() }))
      .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
    /** The room's shared Scene cache: every entity, never filtered for the origin member. */
    sceneSnapshot: z.optional(
      z.nullable(
        z.strictObject({
          scene: campaignSceneStateDtoSchema,
          baseOrdinals: sceneBaseOrdinalsSchema
        })
      )
    ),
    visionFreshness: z.nullable(sceneSessionVisionFreshnessSchema)
  })
)

/**
 * A drag preview's check of the Character revisions its cached Scene vision was composed from
 * (D33): one small authorized read instead of a full capture.
 */
export const liveSessionVisionRevisionsInputSchema = lazySchema(() =>
  z.pick(liveSessionTransientCaptureInputSchema, {
    campaignId: true,
    expectedRole: true,
    expectedUserId: true,
    observedCharacterRevisions: true
  })
)

export const liveSessionVisionRevisionsSchema = lazySchema(() =>
  z.strictObject({ current: z.boolean() })
)

export type LiveSessionVisionRevisionsInput = z.infer<typeof liveSessionVisionRevisionsInputSchema>
export type LiveSessionVisionRevisions = z.infer<typeof liveSessionVisionRevisionsSchema>
export type LiveSessionTransientCapture = z.infer<typeof liveSessionTransientCaptureSchema>
export type LiveSessionTransientCaptureInput = z.infer<
  typeof liveSessionTransientCaptureInputSchema
>
export type LiveSessionTransientMember = z.infer<typeof liveSessionTransientMemberSchema>
