import { z } from 'zod'

import {
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'
import { capabilityDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { chargeDtoSchema } from '../shared/index.js'

const featAuthoredDtoSchemaBase: z.ZodTypeAny = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  detail: z.string().optional(),
  capabilities: z.array(capabilityDtoSchema).optional(),
  effects: z.array(capabilityDtoSchema).optional(),
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

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchemaBase>
export const featAuthoredDtoSchema = featAuthoredDtoSchemaBase
