import { z } from 'zod'

import { detailDtoSchema, startingEquipmentDtoSchema } from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

export const backgroundAuthoredDtoSchema = z.object({
  kind: z.literal('BACKGROUND'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  details: z.array(detailDtoSchema).optional(),
  startingEquipment: startingEquipmentDtoSchema.optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

export type BackgroundAuthoredDto = z.infer<typeof backgroundAuthoredDtoSchema>

export const backgroundAuthoringInputDtoSchema = backgroundAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export type BackgroundAuthoringInputDto = z.infer<typeof backgroundAuthoringInputDtoSchema>
