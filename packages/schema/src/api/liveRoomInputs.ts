import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reusableDefinitionCurrentDtoSchema } from '../shared/reusableDefinitions.js'
import { systemVocabularySnapshotSchema } from '../projections/systemVocabulary.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import { characterSheetCurrencyOptionDtoSchema } from './characterSheetData.js'
import { liveSessionCharacterInputsSchema } from './liveSessionCharacterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { sceneVisionRevisionSchema } from '../projections/sceneVisionRevisions.js'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from './liveRoomInputsBatch.js'
import { contentSnapshotManifestDtoSchema } from './contentSnapshots.js'
import { liveSessionCheckpointSceneSourceSchema } from './liveSessionCheckpointScenes.js'
import { sceneLiveStateHeaderSchema } from './sceneLiveState.js'
import { sceneStoredDefinitionEntitySchema } from '../projections/sceneDefinitionPersistence.js'

const nonNegativeInt = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
/** Campaign authority does not depend on the room-owned PLAY revision. */
export const liveRoomAuthorityRevisionsSchema = lazySchema(() =>
  z
    .array(z.extend(sceneVisionRevisionSchema, { revision: z.nullable(postgresUuidSchema) }))
    .check(z.minLength(2))
    .check(z.maxLength(2))
    .check(
      z.refine(
        (revisions) =>
          revisions.some((revision) => revision.scope === 'SYSTEM') &&
          revisions.some((revision) => revision.scope === 'CAMPAIGN')
      )
    )
)
const MAX_ROOM_INPUT_CHARACTERS = 128

/**
 * Where a paged read resumes: the position in the read's fixed order (a Run table, or a Character
 * in the request's list) and that position's Convex pagination cursor. `null` starts at the first.
 */
const roomInputsCursorSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      position: nonNegativeInt,
      paginationCursor: z.nullable(z.string().check(z.maxLength(8192)))
    })
  )
)

/** The five Scene families, with a saved fog body's native chunk cursor when needed. */
export const liveRoomSceneInputsCursorSchema = lazySchema(() =>
  z.nullable(
    z.strictObject({
      position: z.number().check(z.int()).check(z.nonnegative()).check(z.lte(4)),
      paginationCursor: z.nullable(z.string().check(z.maxLength(8192))),
      fogSave: z.nullable(
        z.strictObject({
          id: postgresUuidSchema,
          nextCursor: z.nullable(z.string().check(z.maxLength(8192))),
          isLast: z.boolean()
        })
      )
    })
  )
)

/**
 * One scope of the inputs the room's rules engine reads (ADR 0035, Amendment 11). AUTHORITY, RUN,
 * SCENE, CHARACTERS and DEFINITIONS page; other scopes are cached single documents.
 */
export const liveRoomInputsScopeSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CAMPAIGN_PLAY') }),
    z.strictObject({ kind: z.literal('AUTHORITY'), cursor: roomInputsCursorSchema }),
    z.strictObject({ kind: z.literal('CHAT_METADATA'), cursor: roomInputsCursorSchema }),
    z.strictObject({
      kind: z.literal('RUN'),
      encounterId: postgresUuidSchema,
      cursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE'),
      sceneId: postgresUuidSchema,
      cursor: liveRoomSceneInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE_DEFINITION'),
      sceneId: postgresUuidSchema,
      cursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('CHARACTERS'),
      characterIds: z
        .array(postgresUuidSchema)
        .check(z.minLength(1))
        .check(z.maxLength(MAX_ROOM_INPUT_CHARACTERS)),
      cursor: roomInputsCursorSchema
    }),
    z.strictObject({ kind: z.literal('DEFINITIONS'), cursor: roomInputsCursorSchema }),
    z.strictObject({ kind: z.literal('SYSTEM'), part: z.enum(['SYSTEM', 'VOCABULARY']) }),
    z.strictObject({ kind: z.literal('CAMPAIGN_CLOCK') })
  ])
)

/** Authorized by the Worker secret and the Campaign's `DO_ACTIVE` epoch; the reader is derived. */
export const liveRoomInputsInputSchema = lazySchema(() =>
  z.strictObject({
    campaignId: postgresUuidSchema,
    epoch: postgresUuidSchema,
    scope: liveRoomInputsScopeSchema
  })
)

/**
 * The part of a stored Run actor's state the room reads to find the Characters whose inputs it
 * loads; the rest of the actor is the Run engine's, not this contract's. A Character actor with a
 * `frozenState` no longer reads its Character (it left the Campaign or the Run completed), so the
 * room loads no inputs for it.
 */
export const liveRoomActorSourceSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('CHARACTER'),
      sourceId: postgresUuidSchema,
      frozenState: z.nullable(z.record(z.string(), z.unknown()))
    }),
    z.object({ kind: z.enum(['CREATURE', 'CUSTOM']) })
  ])
)

/**
 * A stored document with its identity, keyed by table. The Worker validates `fields` against the
 * `encounterStoreSchemas` entry for `table` when it loads them, and refuses an unknown table.
 */
export const liveRoomInputsDocumentSchema = lazySchema(() =>
  z.strictObject({
    table: z.string().check(z.maxLength(64)),
    id: z.string().check(z.maxLength(64)),
    creationTime: z.number(),
    fields: z.record(z.string(), z.unknown())
  })
)

const pagedDocuments = lazySchema(() =>
  z.array(liveRoomInputsDocumentSchema).check(z.maxLength(MAX_ROOM_INPUT_RESPONSE_DOCUMENTS))
)

/**
 * One Character's part of a CHARACTERS response. A Character the Campaign no longer has assigned
 * reads as UNASSIGNED rather than failing the read: its Run actor holds its frozen state. One that
 * no longer exists reads as DELETED, so the room removes its actors as account deletion does (D74).
 * A Character with many documents arrives in several parts, the inputs and revisions on the first.
 */
export const liveRoomCharacterPartSchema = lazySchema(() =>
  z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('UNASSIGNED'), characterId: postgresUuidSchema }),
    z.strictObject({ status: z.literal('DELETED'), characterId: postgresUuidSchema }),
    z.strictObject({
      status: z.literal('ASSIGNED'),
      characterId: postgresUuidSchema,
      revisions: liveSessionRulesRevisionsSchema,
      /** The stored Character inputs on the Character's first part only. */
      inputs: z.nullable(liveSessionCharacterInputsSchema),
      /** Authorized SOURCE and CAMPAIGN heads on the first Character part only. */
      contentSnapshots: z.nullable(contentSnapshotManifestDtoSchema),
      documents: pagedDocuments
    })
  ])
)

/** All definitions readable as the Campaign owner, including unpublished owned roots. */
export const liveRoomDefinitionSchema = lazySchema(() =>
  z.strictObject({
    id: postgresUuidSchema,
    sourceKind: z.enum(['PLATFORM', 'USER']),
    definition: z.nullable(reusableDefinitionCurrentDtoSchema)
  })
)

export const liveRoomInputsResponseSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CHAT_METADATA'),
      /** Conversations, access cutoffs and nonce headers; excludes historical text and rolls. */
      documents: pagedDocuments,
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('AUTHORITY'),
      revisions: liveRoomAuthorityRevisionsSchema,
      /** Account profiles still present for the members in this page, including LEFT members. */
      accountUserIds: z.array(postgresUuidSchema).check(z.maxLength(10_000)),
      documents: pagedDocuments,
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('CAMPAIGN_PLAY'),
      revisions: liveSessionRulesRevisionsSchema,
      contentSnapshots: contentSnapshotManifestDtoSchema,
      campaign: z.strictObject({
        id: postgresUuidSchema,
        gameSystemId: postgresUuidSchema,
        ownerUserId: postgresUuidSchema,
        contentMaturity: z.enum(['STANDARD', 'MATURE']),
        attunementSlotOverride: z.nullable(nonNegativeInt),
        currencyOptions: z.array(characterSheetCurrencyOptionDtoSchema)
      })
    }),
    z.strictObject({
      kind: z.literal('RUN'),
      /** The Run's version when this page was read; a change between pages means a torn read. */
      encounterVersion: nonNegativeInt,
      /** The Campaign's ACTIVE Run when this page was read; the room starts no second one. */
      activeEncounterId: z.nullable(postgresUuidSchema),
      /**
       * The Characters holding each maintained state's dependents, read with the first page (null on
       * later pages). Effects load with their Character, so the room loads a detached owner by this.
       */
      maintenanceCharacterOwners: z.nullable(
        z.array(
          z.strictObject({ maintainedStateId: postgresUuidSchema, characterId: postgresUuidSchema })
        )
      ),
      documents: pagedDocuments,
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE'),
      source: liveSessionCheckpointSceneSourceSchema,
      /** Includes raw counters, tombstones, save references and receipts; no composed token vision. */
      sceneVersion: nonNegativeInt,
      documents: pagedDocuments,
      continueCursor: liveRoomSceneInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('SCENE_DEFINITION'),
      source: liveSessionCheckpointSceneSourceSchema,
      header: sceneLiveStateHeaderSchema,
      entities: z
        .array(sceneStoredDefinitionEntitySchema)
        .check(z.maxLength(MAX_ROOM_INPUT_RESPONSE_DOCUMENTS)),
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('CHARACTERS'),
      parts: z.array(liveRoomCharacterPartSchema),
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('DEFINITIONS'),
      /** Content and owner access change independently of room-owned PLAY. */
      revisions: liveRoomAuthorityRevisionsSchema,
      definitions: z
        .array(liveRoomDefinitionSchema)
        .check(z.maxLength(MAX_ROOM_INPUT_RESPONSE_DOCUMENTS)),
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('SYSTEM'),
      revisions: liveSessionRulesRevisionsSchema,
      system: z.nullable(systemAuthoredDtoSchema),
      vocabulary: z.nullable(systemVocabularySnapshotSchema)
    }),
    z.strictObject({
      kind: z.literal('CAMPAIGN_CLOCK'),
      /**
       * The Campaign clock's absolute minute now, `null` without a clock (D151). Read fresh and never
       * cached: the clock is not room-owned and moves between Runs.
       */
      absoluteMinute: z.nullable(nonNegativeInt)
    })
  ])
)

export type LiveRoomInputsScope = z.infer<typeof liveRoomInputsScopeSchema>
export type LiveRoomInputsCursor = z.infer<typeof roomInputsCursorSchema>
export type LiveRoomSceneInputsCursor = z.infer<typeof liveRoomSceneInputsCursorSchema>
export type LiveRoomInputsInput = z.infer<typeof liveRoomInputsInputSchema>
export type LiveRoomInputsDocument = z.infer<typeof liveRoomInputsDocumentSchema>
export type LiveRoomInputsResponse = z.infer<typeof liveRoomInputsResponseSchema>
export type LiveRoomCharacterPart = z.infer<typeof liveRoomCharacterPartSchema>
export type LiveRoomDefinition = z.infer<typeof liveRoomDefinitionSchema>
