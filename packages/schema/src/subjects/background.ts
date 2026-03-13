import { z } from 'zod'

import {
  detailDtoSchema,
  startingEquipmentDtoSchema
} from '../shared/index.js'
import { featureDtoSchema } from '../features/index.js'
import { proficiencyGrantDtoSchema } from '../grants/index.js'

export const backgroundAuthoredDtoSchema = z.object({
  kind: z.literal('BACKGROUND'),
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  details: z.array(detailDtoSchema).optional(),
  startingEquipment: startingEquipmentDtoSchema.optional(),
  proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

export type BackgroundAuthoredDto = z.infer<typeof backgroundAuthoredDtoSchema>
