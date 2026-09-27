import { z, lazySchema } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNonnegativeNumberSchema
} from '../shared/authoredLimits.js'

export const armorClassFloorDtoSchema = lazySchema(() =>
  z.object({
    id: authoredIdentifierSchema,
    effectKind: z.literal('ARMOR_CLASS_FLOOR'),
    minimum: authoredNonnegativeNumberSchema
  })
)

export type ArmorClassFloorDto = z.infer<typeof armorClassFloorDtoSchema>
