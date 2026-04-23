import { z } from 'zod'

import {
  modifierGrantDtoSchema,
  proficiencyGrantDtoSchema,
  senseGrantDtoSchema,
  spellGrantDtoSchema
} from '../grants/index.js'
import { effectDtoSchema } from '../effects/index.js'
import { featureDtoSchema } from '../features/index.js'
import { chargeDtoSchema, facetDtoSchema } from '../shared/index.js'
import { authoredRecordStatusSchema } from '../shared/enums.js'

const featAuthoredDtoSchemaBase: z.ZodTypeAny = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  status: authoredRecordStatusSchema.optional(),
  detail: z.string().optional(),
  prerequisites: facetDtoSchema.optional(),
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

export type FeatAuthoredDto = z.infer<typeof featAuthoredDtoSchemaBase>
export const featAuthoredDtoSchema = featAuthoredDtoSchemaBase


