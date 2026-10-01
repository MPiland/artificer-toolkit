import { z, lazySchema } from '../zod.js'
import {
  characterSheetReadInputSchema,
  characterSheetCommandResultDtoSchema
} from './characterSheet.js'

export const characterHistoryEntryDtoSchema = lazySchema(() =>
  z.object({
    eventId: z.string(),
    occurredAt: z.string(),
    actorId: z.string(),
    eventType: z.string(),
    summary: z.string(),
    result: z.optional(characterSheetCommandResultDtoSchema)
  })
)

export const characterHistoryResponseDtoSchema = lazySchema(() =>
  z.object({
    characterId: z.string(),
    entries: z.array(characterHistoryEntryDtoSchema)
  })
)

export const characterHistoryInputSchema = lazySchema(() =>
  z.extend(characterSheetReadInputSchema, {
    paginationOpts: z.strictObject({
      numItems: z.number().check(z.int()).check(z.gte(1)).check(z.lte(48)),
      cursor: z.nullable(z.string().check(z.maxLength(1024)))
    })
  })
)

/** Opaque application cursor; scoped to the authorized Character owner and chronological index. */
export const characterHistoryCursorSchema = lazySchema(() =>
  z.strictObject({
    version: z.literal(1),
    characterId: z.uuid(),
    actorId: z.uuid(),
    occurredAt: z.iso.datetime(),
    id: z.uuid()
  })
)

export const characterHistoryPageSchema = lazySchema(() =>
  z.strictObject({
    characterId: z.uuid(),
    page: z.array(characterHistoryEntryDtoSchema),
    isDone: z.boolean(),
    continueCursor: z.string()
  })
)

export type CharacterHistoryInput = z.infer<typeof characterHistoryInputSchema>
export type CharacterHistoryPage = z.infer<typeof characterHistoryPageSchema>
export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
