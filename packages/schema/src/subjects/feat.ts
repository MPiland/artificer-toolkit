import { z } from 'zod'

import {
  featGrantDtoSchema,
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'
import { effectDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { chargeDtoSchema, detailDtoSchema, facetDtoSchema } from '../shared/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const featAuthoredDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  status: authoredRecordStatusSchema.optional(),
  detail: z.never().optional(),
  details: z.array(detailDtoSchema).optional(),
  prerequisites: facetDtoSchema.optional(),
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  grants: z
    .object({
      feats: z.array(featGrantDtoSchema).optional(),
      modifiers: z.array(modifierGrantDtoSchema).optional(),
      proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
      senses: z.array(senseGrantDtoSchema).optional(),
      spells: z.array(spellGrantDtoSchema).optional()
    })
    .optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchema>

export const featAuthoringInputDtoSchema = featAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export type FeatAuthoringInputDto = z.infer<typeof featAuthoringInputDtoSchema>
