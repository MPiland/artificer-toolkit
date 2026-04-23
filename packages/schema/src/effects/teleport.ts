import { z } from 'zod'
import { rangeDtoSchema } from '../shared/range.js'

export const teleportDtoSchema = z.object({
  id: z.string(),
  effectKind: z.literal('TELEPORT'),
  targetKind: z.enum(['SELF', 'TARGET', 'CHOSEN_CREATURES']),
  destinationKind: z.enum(['SELF', 'VISIBLE', 'SPECIFIED_POINT', 'LINKED_LOCATION', 'SPECIAL']),
  distance: rangeDtoSchema.optional()
})

export type TeleportDto = z.infer<typeof teleportDtoSchema>
