import { characterDraftSaveInputSchema } from './characterDrafts.js'
import {
  characterBuilderPreviewPayloadDtoSchema,
  characterBuilderCommitReceiptDtoSchema
} from './characterBuilder.js'
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

export type CharacterBuilderResolveInput = z.infer<typeof characterBuilderResolveInputSchema>
export type CharacterBuilderPreviewOutput = z.infer<typeof characterBuilderPreviewOutputSchema>
export type CharacterBuilderCommitOutput = z.infer<typeof characterBuilderCommitOutputSchema>
