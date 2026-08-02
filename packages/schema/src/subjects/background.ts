import { z } from 'zod'

import {
  authoredIdentifierSchema,
  authoredNestedCollectionSchema,
  authoredRichTextSchema,
  authoredShortTextSchema,
  detailDtoSchema,
  startingEquipmentDtoSchema
} from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const backgroundAuthoredDtoSchema = z.object({
  kind: z.literal('BACKGROUND'),
  id: authoredIdentifierSchema,
  label: authoredShortTextSchema,
  description: authoredRichTextSchema.optional(),
  status: authoredRecordStatusSchema.optional(),
  details: authoredNestedCollectionSchema(detailDtoSchema).optional(),
  startingEquipment: startingEquipmentDtoSchema.optional(),
  proficiencies: authoredNestedCollectionSchema(proficiencyGrantDtoSchema).optional(),
  features: authoredNestedCollectionSchema(featureDtoSchema).optional(),
  userId: authoredIdentifierSchema,
  systemId: authoredIdentifierSchema
})

export type BackgroundAuthoredDto = z.infer<typeof backgroundAuthoredDtoSchema>

export const backgroundAuthoringInputDtoSchema = backgroundAuthoredDtoSchema.extend({
  userId: authoredIdentifierSchema.optional()
})

export type BackgroundAuthoringInputDto = z.infer<typeof backgroundAuthoringInputDtoSchema>
