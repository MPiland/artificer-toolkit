import { z } from '../zod.js'

import { featGrantDtoSchema } from '../grants/feat.js'
import { modifierGrantDtoSchema } from '../grants/modifier.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { senseGrantDtoSchema } from '../grants/sense.js'
import { spellGrantDtoSchema } from '../grants/spell.js'
import { effectDtoSchema } from '../effects/effect.js'
import { featureDtoSchema } from '../features/feature.js'
import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { chargeDtoSchema } from '../shared/charge.js'
import { detailDtoSchema } from '../shared/detail.js'
import { facetDtoSchema } from '../shared/facet.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const featAuthoredDtoSchema = z.object({
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema,
  status: z.optional(authoredRecordStatusSchema),
  detail: z.optional(z.never()),
  details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
  prerequisites: z.optional(facetDtoSchema),
  effects: z.optional(authoredNestedCollectionSchema(effectDtoSchema)),
  charges: z.optional(chargeDtoSchema),
  grants: z.optional(
    z.object({
      feats: z.optional(authoredNestedCollectionSchema(featGrantDtoSchema)),
      modifiers: z.optional(authoredNestedCollectionSchema(modifierGrantDtoSchema)),
      proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
      senses: z.optional(authoredNestedCollectionSchema(senseGrantDtoSchema)),
      spells: z.optional(authoredNestedCollectionSchema(spellGrantDtoSchema))
    })
  ),
  features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchema>

export const featAuthoringInputDtoSchema = z.extend(featAuthoredDtoSchema, {
  userId: z.optional(authoredIdentifierSchema)
})

export type FeatAuthoringInputDto = z.infer<typeof featAuthoringInputDtoSchema>
