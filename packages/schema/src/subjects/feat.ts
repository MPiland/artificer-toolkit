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
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema,
  chargeDtoSchema,
  detailDtoSchema,
  facetDtoSchema
} from '../shared/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const featAuthoredDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  status: authoredRecordStatusSchema.optional(),
  detail: z.never().optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  prerequisites: facetDtoSchema.optional(),
  effects: authoredNestedCollectionSchema(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  grants: z
    .object({
      feats: authoredNestedCollectionSchema(featGrantDtoSchema).optional(),
      modifiers: authoredNestedCollectionSchema(modifierGrantDtoSchema).optional(),
      proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
      senses: authoredNestedCollectionSchema(senseGrantDtoSchema).optional(),
      spells: authoredNestedCollectionSchema(spellGrantDtoSchema).optional()
    })
    .optional(),
  features: authoredNestedCollectionSchema(featureDtoSchema).optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchema>

export const featAuthoringInputDtoSchema = featAuthoredDtoSchema.extend({
  userId: authoredIdentifierSchema.optional()
})

export type FeatAuthoringInputDto = z.infer<typeof featAuthoringInputDtoSchema>
