import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const featGrantTargetDtoSchema = z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    featIds: z.array(z.string())
  })
])
const featGrantProgressionFieldsDtoSchema = createGrantProgressionFieldsDtoSchema(
  featGrantTargetDtoSchema
)

export const featGrantDtoSchema = scalingGrantBaseDtoSchema.extend({
  grantKind: z.literal('FEAT_GRANT'),
  charges: chargeDtoSchema.optional()
}).and(featGrantTargetDtoSchema).and(z.union([
  z.object({
    scalingKind: z.literal('NONE')
  }),
  z.object({
    scalingKind: z.literal('PER_LEVEL')
  }).and(featGrantProgressionFieldsDtoSchema)
])).superRefine(validateGrantProgressionSelectionFields)

export type FeatGrantDto = z.infer<typeof featGrantDtoSchema>
