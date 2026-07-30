import { z } from 'zod'

import { chargeUseDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { facetDtoSchema } from '../shared/facet.js'
import { featureAttributeSchema } from '../shared/enums.js'
import { effectDtoSchema } from '../effects/effect.js'
import {
  featGrantDtoSchema,
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'

const featureGrantsDtoSchemaBase = z.object({
  feats: z.array(featGrantDtoSchema).optional(),
  modifiers: z.array(modifierGrantDtoSchema).optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  senses: z.array(senseGrantDtoSchema).optional(),
  spells: z.array(spellGrantDtoSchema).optional()
})

export type FeatureGrantsDto = z.infer<typeof featureGrantsDtoSchemaBase>
export const featureGrantsDtoSchema: z.ZodType<FeatureGrantsDto> = featureGrantsDtoSchemaBase

const featureBaseDtoSchemaBase = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  attributes: z.array(featureAttributeSchema).optional(),
  detail: z.never().optional(),
  details: z.array(detailDtoSchema).optional(),
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeUseDtoSchema.optional(),
  grants: featureGrantsDtoSchema.optional(),
  restrictions: facetDtoSchema.optional(),
  order: z.number().int()
})

export type FeatureBaseDto = z.infer<typeof featureBaseDtoSchemaBase>
export const featureBaseDtoSchema: z.ZodType<FeatureBaseDto> = featureBaseDtoSchemaBase
export const featureBaseDtoObject = featureBaseDtoSchemaBase
