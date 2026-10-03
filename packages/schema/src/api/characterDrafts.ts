import { z, lazySchema } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterAuthoredDtoSchema } from '../subjects/character.js'
import { authoredDraftListInputSchema } from './authoredDrafts.js'
import {
  characterBuilderDraftSaveRequestDtoSchema,
  characterBuilderDraftSummaryDtoSchema,
  characterDraftRequestDtoSchema
} from './characterBuilder.js'

const uuid = lazySchema(() =>
  z.pipe(
    z.uuid(),
    z.transform((value) => value.toLowerCase())
  )
)

export const characterDraftCreateInputSchema = lazySchema(() =>
  z.strictObject(
    z.extend(z.omit(characterDraftRequestDtoSchema, { primaryRulesCatalogueId: true }), {
      id: uuid,
      systemId: postgresUuidSchema
    }).shape
  )
)

export const characterDraftLookupInputSchema = lazySchema(() =>
  z.strictObject({
    id: z.string().check(z.minLength(1)).check(z.maxLength(240))
  })
)
export const characterDraftDiscardInputSchema = lazySchema(() =>
  z.extend(characterDraftLookupInputSchema, {
    expectedDraftId: uuid
  })
)

export const characterDraftSaveInputSchema = lazySchema(() =>
  z.strictObject(
    z.extend(characterBuilderDraftSaveRequestDtoSchema, {
      characterId: uuid,
      expectedDraftId: uuid,
      character: z.strictObject(
        z.extend(z.omit(characterAuthoredDtoSchema, { primaryRulesCatalogueId: true }), {
          id: uuid,
          systemId: postgresUuidSchema
        }).shape
      )
    }).shape
  )
)

/** `ConvexError` data when a save targets a draft that was finalized, discarded or reopened elsewhere. */
export const characterDraftSaveErrorDataSchema = lazySchema(() =>
  z.strictObject({
    code: z.literal('DRAFT_REPLACED'),
    message: z.string().check(z.minLength(1))
  })
)

export const characterDraftListInputSchema = lazySchema(() =>
  z.pick(authoredDraftListInputSchema, {
    paginationOpts: true
  })
)
export const characterDraftListPageSchema = lazySchema(() =>
  z.strictObject({
    page: z.array(characterBuilderDraftSummaryDtoSchema),
    isDone: z.boolean(),
    continueCursor: z.string(),
    splitCursor: z.optional(z.nullable(z.string())),
    pageStatus: z.optional(z.nullable(z.enum(['SplitRecommended', 'SplitRequired'])))
  })
)

export type CharacterDraftCreateInput = z.infer<typeof characterDraftCreateInputSchema>
export type CharacterDraftSaveInput = z.infer<typeof characterDraftSaveInputSchema>
export type CharacterDraftSaveErrorData = z.infer<typeof characterDraftSaveErrorDataSchema>
export type CharacterDraftDiscardInput = z.infer<typeof characterDraftDiscardInputSchema>
export type CharacterDraftLookupInput = z.infer<typeof characterDraftLookupInputSchema>
export type CharacterDraftListInput = z.infer<typeof characterDraftListInputSchema>
export type CharacterDraftListPage = z.infer<typeof characterDraftListPageSchema>
