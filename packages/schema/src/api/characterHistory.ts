import { z, lazySchema } from '../zod.js'
import { characterSheetCommandResultDtoSchema } from './characterSheet.js'

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

export type CharacterHistoryEntryDto = z.infer<typeof characterHistoryEntryDtoSchema>
export type CharacterHistoryResponseDto = z.infer<typeof characterHistoryResponseDtoSchema>
