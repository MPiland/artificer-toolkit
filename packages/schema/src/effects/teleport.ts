import { z } from '../zod.js'
import { rangeDtoSchema } from '../shared/range.js'
import { authoredIdentifierSchema } from '../shared/authoredLimits.js'

export const teleportDtoSchema = z.object({
  id: authoredIdentifierSchema,
  effectKind: z.literal('TELEPORT'),
  targetKind: z.enum(['SELF', 'TARGET', 'CHOSEN_CREATURES']),
  destinationKind: z.enum(['SELF', 'VISIBLE', 'SPECIFIED_POINT', 'LINKED_LOCATION', 'SPECIAL']),
  distance: z.optional(rangeDtoSchema)
})

export type TeleportDto = z.infer<typeof teleportDtoSchema>
