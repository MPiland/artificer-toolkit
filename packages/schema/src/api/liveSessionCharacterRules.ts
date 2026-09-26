import { z } from '../zod.js'
import {
  liveSessionActionCaptureScopeSchema,
  liveSessionTurnCaptureScopeSchema
} from './liveSessionCommandScopes.js'
import { characterAuthoredDtoSchema } from '../subjects/character.js'
import { characterSheetStateSchema } from '../projections/characterSheetState.js'
import { characterStoredRowSchema } from '../projections/characterPersistence.js'
import { campaignCharacterStateSchema } from '../projections/campaignCharacterState.js'
import { projectionChecksumSchema } from '../projections/identity.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { systemAuthoredDtoSchema } from '../vocabulary/system.js'
import { authoredCurrentSourceIdentitySchema } from './authoredPublication.js'
import { characterSheetCurrencyOptionDtoSchema } from './characterSheetData.js'
import { liveSessionBootstrapInputSchema } from './liveSessionState.js'
import { liveSessionRulesRevisionsSchema } from './liveSessionRulesRevisions.js'
import { resolveRuleOccurrenceInputDtoSchema } from './encounterRuleCommands.js'
import { liveSessionMovementCaptureScopeSchema } from './liveSessionEncounterMovement.js'

const ids = z.array(postgresUuidSchema).check(z.maxLength(500))
const sourceCursor = z.strictObject({
  kindIndex: z.number().check(z.int()).check(z.nonnegative()),
  sourceIndex: z.number().check(z.int()).check(z.nonnegative()),
  paginationCursor: z.nullable(z.string().check(z.maxLength(8192)))
})

/** Private Worker reads. These are authorized stored inputs, never evaluated rules or patches. */
export const liveSessionCharacterRulesRequestSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('INPUTS') }),
  z.strictObject({
    kind: z.literal('PUBLICATIONS'),
    subjectIds: ids,
    afterSubjectId: z.nullable(postgresUuidSchema)
  }),
  z.strictObject({
    kind: z.literal('FEATURE_SOURCES'),
    featureIds: ids,
    cursor: z.optional(sourceCursor)
  }),
  z.strictObject({ kind: z.literal('SPELL_CATALOGUE'), cursor: z.optional(sourceCursor) }),
  z.strictObject({ kind: z.literal('CLASS_CATALOGUE'), cursor: z.optional(sourceCursor) })
])

export const liveSessionCharacterRulesInputSchema = z.extend(liveSessionBootstrapInputSchema, {
  expectedRole: z.enum(['OWNER', 'PLAYER']),
  concentrationResponse: z.optional(resolveRuleOccurrenceInputDtoSchema),
  turnCommand: z.optional(liveSessionTurnCaptureScopeSchema),
  action: z.optional(liveSessionActionCaptureScopeSchema),
  movement: z.optional(
    z.extend(liveSessionMovementCaptureScopeSchema, { actorId: postgresUuidSchema })
  ),
  characterId: postgresUuidSchema,
  request: liveSessionCharacterRulesRequestSchema
})

/** A Character capture's INPUTS: the stored Character, its System and Campaign overlay. */
export const liveSessionCharacterInputsResponseSchema = z.strictObject({
  kind: z.literal('INPUTS'),
  revisions: liveSessionRulesRevisionsSchema,
  readChecksum: projectionChecksumSchema,
  character: characterAuthoredDtoSchema,
  movementOwner: z.optional(characterStoredRowSchema),
  updatedAt: z.iso.datetime(),
  characterChecksum: projectionChecksumSchema,
  streamVersion: z.number().check(z.int()).check(z.nonnegative()),
  sheetState: characterSheetStateSchema,
  system: systemAuthoredDtoSchema,
  campaign: z.strictObject({
    id: postgresUuidSchema,
    status: z.literal('ACTIVE'),
    contentMaturity: z.enum(['STANDARD', 'MATURE']),
    attunementSlotOverride: z.nullable(z.number().check(z.int()).check(z.nonnegative())),
    state: campaignCharacterStateSchema,
    currencyOptions: z.array(characterSheetCurrencyOptionDtoSchema)
  })
})

export const liveSessionCharacterRulesResponseSchema = z.discriminatedUnion('kind', [
  liveSessionCharacterInputsResponseSchema,
  z.strictObject({
    kind: z.literal('PUBLICATIONS'),
    readChecksum: projectionChecksumSchema,
    revisions: liveSessionRulesRevisionsSchema,
    continueAfter: z.nullable(postgresUuidSchema),
    publications: z.array(
      // The identity hashes storage; documentJson contains its validated, possibly normalized DTO.
      z.strictObject({
        identity: authoredCurrentSourceIdentitySchema,
        version: z.number().check(z.int()).check(z.positive()),
        documentJson: z.string(),
        campaignShared: z.boolean(),
        campaignParentAllowed: z.boolean(),
        storedParentId: z.optional(z.nullable(postgresUuidSchema))
      })
    )
  }),
  z.strictObject({
    kind: z.literal('SOURCE_INDEX'),
    readChecksum: projectionChecksumSchema,
    revisions: liveSessionRulesRevisionsSchema,
    continueCursor: z.nullable(sourceCursor),
    sources: z.array(
      z.extend(authoredCurrentSourceIdentitySchema, {
        campaignShared: z.boolean(),
        matches: z.boolean()
      })
    )
  })
])

export type LiveSessionCharacterRulesRequest = z.infer<
  typeof liveSessionCharacterRulesRequestSchema
>
export type LiveSessionCharacterRulesInput = z.infer<typeof liveSessionCharacterRulesInputSchema>
export type LiveSessionCharacterRulesResponse = z.infer<
  typeof liveSessionCharacterRulesResponseSchema
>
