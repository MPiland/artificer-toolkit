import { z } from 'zod'

import { chargeDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { facetDtoSchema } from '../shared/facet.js'
import { effectDtoSchema } from '../effects/effect.js'
import {
  featGrantDtoSchema,
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'

export const featureGrantsDtoSchema = z.object({
  feats: z.array(featGrantDtoSchema).optional(),
  modifiers: z.array(modifierGrantDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  senses: z.array(senseGrantDtoSchema).optional(),
  spells: z.array(spellGrantDtoSchema).optional()
})

export const featureBaseDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  attributes: z.array(z.string()).optional(),
  detail: z.union([z.string(), detailDtoSchema]).optional(),
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  grants: featureGrantsDtoSchema.optional(),
  restrictions: facetDtoSchema.optional(),
  order: z.number().int()
})

export type FeatureBaseDto = z.infer<typeof featureBaseDtoSchema>
