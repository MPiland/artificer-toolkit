import { z } from 'zod'

import { featureBaseDtoObject } from './base.js'
import { featureOptionDtoSchema } from './option.js'
import { authoredNestedCollectionSchema } from '../shared/authoredLimits.js'

export const featureOptionChoiceDtoSchema = z.object({
  level: z.number().int(),
  count: z.number().int(),
  replaceCount: z.number().int().nullable().optional()
})

export const featureDtoSchema = featureBaseDtoObject.extend({
  section: z
    .enum([
      'TRAIT',
      'ACTION',
      'BONUS_ACTION',
      'REACTION',
      'LEGENDARY_ACTION',
      'LAIR_ACTION',
      'REGIONAL_EFFECT',
      'OTHER'
    ])
    .optional(),
  optionChoices: authoredNestedCollectionSchema(featureOptionChoiceDtoSchema).optional(),
  options: authoredNestedCollectionSchema(featureOptionDtoSchema).optional(),
  availableAtLevel: z.number().int().optional()
})

export type FeatureDto = z.infer<typeof featureDtoSchema>
