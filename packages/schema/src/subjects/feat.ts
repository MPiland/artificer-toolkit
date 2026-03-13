import { z } from 'zod'

import {
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'
import { effectDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { chargeDtoSchema } from '../shared/index.js'

export const featAuthoredDtoSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  detail: z.string().optional(),
  effects: z.array(effectDtoSchema).optional(),
  charges: chargeDtoSchema.optional(),
  grants: z.object({
    modifiers: z.array(modifierGrantDtoSchema).optional(),
    proficiencies: z.array(proficiencyGrantDtoSchema).optional(),
    senses: z.array(senseGrantDtoSchema).optional(),
    spells: z.array(spellGrantDtoSchema).optional()
  }).optional(),
  features: z.array(featureDtoSchema).optional(),
  userId: z.string(),
  systemId: z.string()
})

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchema>
