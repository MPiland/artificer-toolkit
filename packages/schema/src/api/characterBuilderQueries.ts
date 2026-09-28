import { characterDraftSaveInputSchema } from './characterDrafts.js'
import {
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderCommitReceiptDtoSchema
} from './characterBuilder.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { z, lazySchema } from '../zod.js'

/** Candidate commands are bound to an owned draft generation; the server owns its active baseline. */
export const characterBuilderResolveInputSchema = lazySchema(() =>
  z.pick(characterDraftSaveInputSchema, {
    character: true,
    mode: true,
    expectedDraftId: true
  })
)

// Current-source repair does not expose the retired authored-version upgrade workflow.
export const characterBuilderPreviewOutputSchema = lazySchema(() =>
  z.omit(characterBuilderPreviewPayloadDtoSchema, {
    authoredContentUpgrade: true
  })
)

// Current-source finalization has no retired mechanics projection or authored-version pins.
export const characterBuilderCommitOutputSchema = lazySchema(() =>
  z.omit(characterBuilderCommitReceiptDtoSchema, {
    mechanicsProjectionChecksum: true
  })
)

/**
 * Commit validates on the server from referenced content only (ADR 0036 S7). A feature whose
 * acquisition names no root (a MANUAL grant, say) carries the root the client found it in; the
 * server verifies that the root is readable and holds the feature.
 */
export const characterBuilderFeatureSourceHintSchema = lazySchema(() =>
  z.strictObject({ featureId: postgresUuidSchema, rootId: postgresUuidSchema })
)

export const characterBuilderCommitInputSchema = lazySchema(() =>
  z.extend(characterBuilderResolveInputSchema, {
    featureSourceHints: z.optional(
      z.array(characterBuilderFeatureSourceHintSchema).check(z.maxLength(500))
    )
  })
)

/** `ConvexError` data when commit cannot read content the Character references. */
export const characterBuilderCommitErrorDataSchema = lazySchema(() =>
  z.strictObject({
    code: z.literal('SOURCE_UNAVAILABLE'),
    subjectId: z.string().check(z.minLength(1)),
    message: z.string().check(z.minLength(1))
  })
)

export type CharacterBuilderResolveInput = z.infer<typeof characterBuilderResolveInputSchema>
export type CharacterBuilderFeatureSourceHint = z.infer<
  typeof characterBuilderFeatureSourceHintSchema
>
export type CharacterBuilderCommitInput = z.infer<typeof characterBuilderCommitInputSchema>
export type CharacterBuilderCommitErrorData = z.infer<typeof characterBuilderCommitErrorDataSchema>
export type CharacterBuilderPreviewOutput = z.infer<typeof characterBuilderPreviewOutputSchema>
export type CharacterBuilderCommitOutput = z.infer<typeof characterBuilderCommitOutputSchema>
