import { z } from 'zod'

import { chargeUseDtoSchema } from '../shared/charge.js'
import { authoringModeKindSchema } from '../shared/enums.js'
import { rangeDtoSchema } from '../shared/range.js'
import {
  createGrantProgressionFieldsDtoSchema,
  scalingGrantBaseDtoSchema,
  validateGrantProgressionSelectionFields
} from './grant.js'

const senseGrantTargetDtoSchema = z.union([
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.ALL).optional()
  }),
  z.object({
    authoringModeKind: z.literal(authoringModeKindSchema.enum.SELECTED),
    senseIds: z.array(z.string())
  })
])
const senseGrantProgressionFieldsDtoSchema =
  createGrantProgressionFieldsDtoSchema(senseGrantTargetDtoSchema)

export const senseGrantDtoSchema = scalingGrantBaseDtoSchema
  .extend({
    grantKind: z.literal('SENSE_GRANT'),
    charges: chargeUseDtoSchema.optional(),
    range: rangeDtoSchema.optional()
  })
  .and(senseGrantTargetDtoSchema)
  .and(
    z.union([
      z.object({
        scalingKind: z.literal('NONE')
      }),
      z
        .object({
          scalingKind: z.literal('PER_LEVEL')
        })
        .and(senseGrantProgressionFieldsDtoSchema)
    ])
  )
  .superRefine(validateGrantProgressionSelectionFields)

export type SenseGrantDto = z.infer<typeof senseGrantDtoSchema>
