import { z } from '../zod.js'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema
} from '../shared/authoredLimits.js'
import { detailDtoSchema } from '../shared/detail.js'
import { startingEquipmentDtoSchema } from '../shared/startingEquipment.js'
import { featureDtoSchema } from '../features/feature.js'
import { proficiencyGrantDtoSchema } from '../grants/proficiency.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const backgroundAuthoredDtoSchema = z.object({
  kind: z.literal('BACKGROUND'),
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: z.optional(authoredRichTextSchema),
  status: z.optional(authoredRecordStatusSchema),
  details: z.optional(authoredNestedCollectionSchema(detailDtoSchema)),
  startingEquipment: z.optional(startingEquipmentDtoSchema),
  proficiencies: z.optional(authoredNestedCollectionSchema(proficiencyGrantDtoSchema)),
  features: z.optional(authoredNestedCollectionSchema(featureDtoSchema)),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

export type BackgroundAuthoredDto = z.infer<typeof backgroundAuthoredDtoSchema>

export const backgroundAuthoringInputDtoSchema = z.extend(backgroundAuthoredDtoSchema, {
  userId: z.optional(authoredIdentifierSchema)
})

export type BackgroundAuthoringInputDto = z.infer<typeof backgroundAuthoringInputDtoSchema>
