import { z } from '../zod.js'
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
import { campaignSceneStateDtoSchema, campaignScenePresentationDtoSchema } from './vttScenes.js'

const uuidSchema = z.string().check(z.uuid())
const membershipEpochSchema = z.iso.datetime({ offset: true })
const roleSchema = z.pick(liveSessionTicketClaimsDtoSchema, { role: true }).shape.role

export const liveSessionTransientMemberSchema = z.strictObject({
  membershipEpoch: membershipEpochSchema,
  role: roleSchema,
  userId: uuidSchema
})

export const liveSessionTransientCaptureInputSchema = z.extend(liveSessionJoinOptionsDtoSchema, {
  expectedRole: roleSchema,
  expectedUserId: uuidSchema,
  mode: z.optional(z.enum(['AUTHORITY', 'FULL'])),
  observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema,
  recipientUserIds: z
    .array(uuidSchema)
    .check(z.maxLength(10_000))
    .check(z.refine((ids) => new Set(ids).size === ids.length, 'Recipients must be unique.'))
})

export const liveSessionTransientCaptureSchema = z.strictObject({
  campaignId: uuidSchema,
  systemId: postgresUuidSchema,
  observedCharacterRevisions: sceneSessionVisionCharacterRevisionsSchema,
  origin: liveSessionTransientMemberSchema,
  presentation: z.nullable(campaignScenePresentationDtoSchema),
  recipients: z.array(liveSessionTransientMemberSchema).check(z.maxLength(10_000)),
  sceneHeader: z.nullable(sceneLiveStateHeaderSchema),
  sceneEncounterBound: z.boolean(),
  /**
   * For a player origin on an Encounter-bound Scene: each Encounter-bound token and whether the
   * origin controls its bound actor. Bound tokens follow actor control, never the Scene token's
   * `controlledByUserIds` (ADR 0034). Empty for the GM and for unbound Scenes.
   */
  originBoundTokenControl: z
    .array(z.strictObject({ tokenId: uuidSchema, controlled: z.boolean() }))
    .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
  sceneSnapshot: z.optional(z.nullable(campaignSceneStateDtoSchema)),
  visionFreshness: z.nullable(sceneSessionVisionFreshnessSchema)
})

export type LiveSessionTransientCapture = z.infer<typeof liveSessionTransientCaptureSchema>
export type LiveSessionTransientCaptureInput = z.infer<
  typeof liveSessionTransientCaptureInputSchema
>
export type LiveSessionTransientMember = z.infer<typeof liveSessionTransientMemberSchema>
