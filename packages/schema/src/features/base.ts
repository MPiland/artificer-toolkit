import { z } from 'zod'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredReferenceCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
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
  feats: authoredNestedCollectionSchema(featGrantDtoSchema).optional(),
  modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema).optional(),
  proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
  senses: authoredNestedCollectionSchema(senseGrantDtoSchema).optional(),
  spells: authoredNestedCollectionSchema(spellGrantDtoSchema).optional()
})

export type FeatureGrantsDto = z.infer<typeof featureGrantsDtoSchemaBase>
export const featureGrantsDtoSchema: z.ZodType<FeatureGrantsDto> = featureGrantsDtoSchemaBase

const featureBaseDtoSchemaBase = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  attributes: authoredReferenceCollectionSchema(featureAttributeSchema).optional(),
  detail: z.never().optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  effects: authoredNestedCollectionSchema(effectDtoSchema).optional(),
  charges: chargeUseDtoSchema.optional(),
  grants: featureGrantsDtoSchema.optional(),
  restrictions: facetDtoSchema.optional(),
  order: z.number().int()
})

export type FeatureBaseDto = z.infer<typeof featureBaseDtoSchemaBase>
export const featureBaseDtoSchema: z.ZodType<FeatureBaseDto> = featureBaseDtoSchemaBase
export const featureBaseDtoObject = featureBaseDtoSchemaBase
