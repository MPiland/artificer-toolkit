import { z } from 'zod'

import {
  castingTimeDtoSchema
} from './shared.js'
import { capabilityDtoSchema } from '../effects/index.js'
import { spellAttributeSchema } from '../shared/enums.js'

export const spellAuthoredDtoSchema = z.object({
  kind: z.literal('SPELL'),
  id: z.string(),
  label: z.string(),
  attributes: z.array(spellAttributeSchema).optional(),
  description: z.string(),
  castingTime: castingTimeDtoSchema,
  capabilities: z.array(capabilityDtoSchema).optional(),
  level: z.number().int(),
  classIds: z.array(z.string()),
  magicSchoolId: z.string(),
  effects: z.array(capabilityDtoSchema).optional(),
  materialDescription: z.string().optional(),
  userId: z.string(),
  systemId: z.string()
})

export type SpellAuthoredDto = z.infer<typeof spellAuthoredDtoSchema>
