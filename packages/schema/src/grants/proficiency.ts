import { z } from 'zod'

import { staticGrantBaseDtoSchema } from './grant.js'
import {
  authoringSelectionKindSchema,
  proficiencyKindSchema,
  roundingCodeSchema,
  scalingAmountKindSchema
} from '../shared/enums.js'

const proficiencyScalingDtoSchema = z.union([
  z.object({
    level: z.literal(scalingAmountKindSchema.enum.HALF),
    rounding: roundingCodeSchema
  }),
  z.object({
    level: z.enum([
      scalingAmountKindSchema.enum.DOUBLE,
      scalingAmountKindSchema.enum.FULL
    ])
  })
])

export const proficiencyGrantDtoSchema = staticGrantBaseDtoSchema.extend({
  grantKind: z.literal('PROFICIENCY_GRANT'),
  proficiencyKind: proficiencyKindSchema,
  selectionKind: authoringSelectionKindSchema,
  count: z.number().int().optional()
}).and(proficiencyScalingDtoSchema)

export type ProficiencyGrantDto = z.infer<typeof proficiencyGrantDtoSchema>
