import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { reusableDefinitionCurrentDtoSchema } from '../shared/reusableDefinitions.js'
import { systemVocabularySnapshotSchema } from '../projections/systemVocabulary.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import { characterSheetCurrencyOptionDtoSchema } from './characterSheetData.js'
import { liveSessionCharacterInputsResponseSchema } from './liveSessionCharacterRules.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { MAX_ROOM_INPUT_RESPONSE_DOCUMENTS } from './liveRoomInputsBatch.js'

const nonNegativeInt = lazySchema(() => z.number().check(z.int()).check(z.nonnegative()))
export const MAX_ROOM_INPUT_CHARACTERS = 128

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

/**
 * One scope of the inputs the room's rules engine reads (ADR 0035, Amendment 11). RUN and CHARACTERS
 * page; the others are single documents. The room caches each scope by its revision.
 */
export const liveRoomInputsScopeSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('CAMPAIGN_PLAY') }),
    z.strictObject({
      kind: z.literal('RUN'),
      encounterId: postgresUuidSchema,
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
    z.strictObject({ kind: z.literal('DEFINITION'), definitionId: postgresUuidSchema }),
    z.strictObject({ kind: z.literal('SYSTEM'), part: z.enum(['SYSTEM', 'VOCABULARY']) })
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
 * reads as UNASSIGNED rather than failing the read: its Run actor holds its frozen state. A
 * Character with many documents arrives in several parts, the inputs and revisions on the first.
 */
export const liveRoomCharacterPartSchema = lazySchema(() =>
  z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('UNASSIGNED'), characterId: postgresUuidSchema }),
    z.strictObject({
      status: z.literal('ASSIGNED'),
      characterId: postgresUuidSchema,
      revisions: liveSessionRulesRevisionsSchema,
      /** The stored Character inputs on the Character's first part only. */
      inputs: z.nullable(
        z.omit(liveSessionCharacterInputsResponseSchema, {
          kind: true,
          revisions: true,
          readChecksum: true,
          movementOwner: true,
          system: true
        })
      ),
      documents: pagedDocuments
    })
  ])
)

export const liveRoomInputsResponseSchema = lazySchema(() =>
  z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('CAMPAIGN_PLAY'),
      revisions: liveSessionRulesRevisionsSchema,
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
      documents: pagedDocuments,
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('CHARACTERS'),
      parts: z.array(liveRoomCharacterPartSchema),
      continueCursor: roomInputsCursorSchema
    }),
    z.strictObject({
      kind: z.literal('DEFINITION'),
      revisions: liveSessionRulesRevisionsSchema,
      definition: z.nullable(reusableDefinitionCurrentDtoSchema)
    }),
    z.strictObject({
      kind: z.literal('SYSTEM'),
      revisions: liveSessionRulesRevisionsSchema,
      system: z.nullable(systemAuthoredDtoSchema),
      vocabulary: z.nullable(systemVocabularySnapshotSchema)
    })
  ])
)

export type LiveRoomInputsScope = z.infer<typeof liveRoomInputsScopeSchema>
export type LiveRoomInputsCursor = z.infer<typeof roomInputsCursorSchema>
export type LiveRoomInputsInput = z.infer<typeof liveRoomInputsInputSchema>
export type LiveRoomInputsDocument = z.infer<typeof liveRoomInputsDocumentSchema>
export type LiveRoomInputsResponse = z.infer<typeof liveRoomInputsResponseSchema>
export type LiveRoomCharacterPart = z.infer<typeof liveRoomCharacterPartSchema>
