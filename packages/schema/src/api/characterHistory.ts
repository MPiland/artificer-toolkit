import { z } from '../zod.js'
import { authoredDraftListInputSchema, authoredDraftListPageSchema } from './authoredDrafts.js'
import {
  characterSheetReadInputSchema,
  characterSheetCommandResultDtoSchema
} from './characterSheet.js'

export const characterHistoryEntryDtoSchema = z.object({
  eventId: z.string(),
  occurredAt: z.string(),
  actorId: z.string(),
  eventType: z.string(),
  summary: z.string(),
  result: z.optional(characterSheetCommandResultDtoSchema)
})

export const characterHistoryResponseDtoSchema = z.object({
  characterId: z.string(),
  entries: z.array(characterHistoryEntryDtoSchema)
})

export const characterHistoryInputSchema = z.extend(characterSheetReadInputSchema, {
  paginationOpts: authoredDraftListInputSchema.shape.paginationOpts
})

export const characterHistoryPageSchema = z.extend(authoredDraftListPageSchema, {
  characterId: z.uuid(),
  page: z.array(characterHistoryEntryDtoSchema)
})

export type CharacterHistoryInput = z.infer<typeof characterHistoryInputSchema>
export type CharacterHistoryPage = z.infer<typeof characterHistoryPageSchema>
export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
