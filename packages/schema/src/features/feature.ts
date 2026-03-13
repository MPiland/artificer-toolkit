import { z } from 'zod'

import { featureBaseDtoSchema } from './base.js'
import { featureOptionDtoSchema } from './option.js'

export const optionsByLevelDtoSchema = z.object({
  level: z.number().int(),
  count: z.number().int(),
  replaceCount: z.number().int().nullable().optional()
})

export const featureDtoSchema = featureBaseDtoSchema.extend({
  optionsPerLevel: z.array(optionsByLevelDtoSchema).optional(),
  options: z.array(featureOptionDtoSchema).optional(),
  levelAvailable: z.string().optional()
})

export type FeatureDto = z.infer<typeof featureDtoSchema>
