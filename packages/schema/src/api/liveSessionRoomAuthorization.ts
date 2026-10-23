import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { MAX_ENCOUNTER_ACTORS } from '../shared/authoredLimits.js'
import { campaignCharacterControllerUserIdsSchema } from './campaignCore.js'
import { encounterGmActorDtoSchema } from './encounterData.js'
import { characterPartyVisibilityDtoSchema, healthDisplayLevelDtoSchema } from './healthDisplay.js'
import { rollVisibilityDtoSchema } from './rolls.js'
import { liveSessionTransientMemberSchema } from './liveSessionTransient.js'
import { sceneSessionVisionCharacterRevisionsSchema } from './sceneSessionVision.js'

const uuidSchema = lazySchema(() => z.string().check(z.uuid()))
const MAX_ROOM_MEMBERS = 10_000

/**
 * What the room's authorization cache was loaded from (ADR 0035 Amendment 14): the SYSTEM, CAMPAIGN and
 * PLAY revisions, each assigned Character's CHARACTER revision, and a digest of the members'
 * auto-roll preferences and canonical author usernames. Equal revisions mean cached sections are current.
 */
export const liveSessionRoomAuthorizationRevisionsSchema = lazySchema(() =>
  z.strictObject({
    system: z.nullable(postgresUuidSchema),
    campaign: z.nullable(postgresUuidSchema),
    play: z.nullable(postgresUuidSchema),
    characters: sceneSessionVisionCharacterRevisionsSchema,
    preferences: z.string().check(z.regex(/^[a-f0-9]{64}$/))
  })
)

/** Membership, roles and Campaign Character assignments; changes with the CAMPAIGN revision. */
const liveSessionRoomCampaignAuthorizationSchema = lazySchema(() =>
  z.strictObject({
    ownerUserId: uuidSchema,
    /** Current ACTIVE members only; an archived Campaign has none. */
    members: z.array(liveSessionTransientMemberSchema).check(z.maxLength(MAX_ROOM_MEMBERS)),
    assignments: z
      .array(
        z.strictObject({
          characterId: uuidSchema,
          userId: uuidSchema,
          /** GM-granted controllers of the Character (D162); absent means none. */
          controllerUserIds: z.optional(campaignCharacterControllerUserIdsSchema)
        })
      )
      .check(z.maxLength(MAX_ROOM_MEMBERS))
  })
)

/** One assigned Character's owner and party visibility ("Party can view" and health display). */
const liveSessionRoomCharacterAuthorizationSchema = lazySchema(() =>
  z.strictObject({
    characterId: uuidSchema,
    ownerUserId: uuidSchema,
    partyVisibility: characterPartyVisibilityDtoSchema
  })
)

const liveSessionRoomPreferenceSchema = lazySchema(() =>
  z.strictObject({
    userId: uuidSchema,
    autoRollDice: z.boolean(),
    gmRollVisibility: rollVisibilityDtoSchema,
    username: z.nullable(z.string())
  })
)

/**
 * The actor control and health display of the Encounter bound to the presented Scene, if any;
 * changes with the PLAY revision. Controllers are GM grants; a Character actor's assigned player
 * controls it too (ADR 0034 decision 1).
 */
export const liveSessionRoomPlayAuthorizationSchema = lazySchema(() =>
  z.strictObject({
    encounter: z.nullable(
      z.strictObject({
        encounterId: uuidSchema,
        sceneId: uuidSchema,
        healthDisplayDefault: healthDisplayLevelDtoSchema,
        actors: z
          .array(
            z.pick(encounterGmActorDtoSchema, {
              id: true,
              kind: true,
              sourceId: true,
              controllerUserIds: true,
              owner: true,
              healthDisplay: true
            })
          )
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS)),
        tokens: z
          .array(z.strictObject({ tokenId: uuidSchema, actorId: uuidSchema }))
          .check(z.maxLength(MAX_ENCOUNTER_ACTORS))
      })
    )
  })
)

/** The room's whole authorization cache. */
export const liveSessionRoomAuthorizationSchema = lazySchema(() =>
  z.strictObject({
    revisions: liveSessionRoomAuthorizationRevisionsSchema,
    campaign: liveSessionRoomCampaignAuthorizationSchema,
    characters: z
      .array(liveSessionRoomCharacterAuthorizationSchema)
      .check(z.maxLength(MAX_ROOM_MEMBERS)),
    preferences: z.array(liveSessionRoomPreferenceSchema).check(z.maxLength(MAX_ROOM_MEMBERS)),
    play: liveSessionRoomPlayAuthorizationSchema
  })
)

/**
 * The room's authorization read, authorized by the Worker secret and its `DO_ACTIVE` epoch. `known`
 * holds the revisions the room already caches (`null` loads everything).
 */
export const liveSessionRoomAuthorizationInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: uuidSchema,
    epoch: uuidSchema,
    known: z.nullable(liveSessionRoomAuthorizationRevisionsSchema)
  })
)

/**
 * The current revisions plus only the sections that changed from `known`: an omitted section is
 * unchanged, and `characters` lists only Characters whose revision changed or is new.
 */
export const liveSessionRoomAuthorizationResponseSchema = lazySchema(() =>
  z.strictObject({
    revisions: liveSessionRoomAuthorizationRevisionsSchema,
    campaign: z.optional(liveSessionRoomCampaignAuthorizationSchema),
    characters: z
      .array(liveSessionRoomCharacterAuthorizationSchema)
      .check(z.maxLength(MAX_ROOM_MEMBERS)),
    preferences: z.optional(
      z.array(liveSessionRoomPreferenceSchema).check(z.maxLength(MAX_ROOM_MEMBERS))
    ),
    play: z.optional(liveSessionRoomPlayAuthorizationSchema)
  })
)

export type LiveSessionRoomAuthorizationRevisions = z.infer<
  typeof liveSessionRoomAuthorizationRevisionsSchema
>
export type LiveSessionRoomAuthorization = z.infer<typeof liveSessionRoomAuthorizationSchema>
export type LiveSessionRoomAuthorizationInput = z.infer<
  typeof liveSessionRoomAuthorizationInputSchema
>
export type LiveSessionRoomAuthorizationResponse = z.infer<
  typeof liveSessionRoomAuthorizationResponseSchema
>
