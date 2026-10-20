import { z, lazySchema } from '../zod.js'

import { featureBaseDtoObject } from './base.js'
import { featureReferenceDtoSchema } from './reference.js'
import { featureOptionDtoSchema } from './option.js'
import { attackSlotSetDtoSchema } from './attackSlots.js'
import { authoredNestedCollectionSchema } from '../shared/authoredLimits.js'

export const featureOptionChoiceDtoSchema = lazySchema(() =>
  z.object({
    level: z.number().check(z.int()),
    count: z.number().check(z.int()),
    replaceCount: z.optional(z.nullable(z.number().check(z.int())))
  })
)

export const featureDtoSchema = lazySchema(() =>
  z.extend(featureBaseDtoObject, {
    section: featureReferenceDtoSchema.shape.section,
    optionChoices: z.optional(authoredNestedCollectionSchema(featureOptionChoiceDtoSchema)),
    options: z.optional(authoredNestedCollectionSchema(featureOptionDtoSchema)),
    availableAtLevel: z.optional(z.number().check(z.int())),
    /** A Creature's Multiattack-style feature: the attack slots it opens for the turn (D93). */
    attackSlots: z.optional(attackSlotSetDtoSchema)
  })
)

export type FeatureDto = z.infer<typeof featureDtoSchema>
