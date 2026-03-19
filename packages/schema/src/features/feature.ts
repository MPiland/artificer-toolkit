import { z } from 'zod'

import { featureBaseDtoObject } from './base.js'
import { featureOptionDtoSchema } from './option.js'

export const featureOptionChoiceDtoSchema = z.object({
  level: z.number().int(),
  count: z.number().int(),
  replaceCount: z.number().int().nullable().optional()
})

export const featureDtoSchema = featureBaseDtoObject.extend({
  optionChoices: z.array(featureOptionChoiceDtoSchema).optional(),
  options: z.array(featureOptionDtoSchema).optional(),
  availableAtLevel: z.number().int().optional()
})

export type FeatureDto = z.infer<typeof featureDtoSchema>
