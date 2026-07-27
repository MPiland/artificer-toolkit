import { z } from 'zod'

import { castingTimeDtoSchema } from './shared.js'
import { effectDtoSchema } from '../effects/index.js'
import {
  authoredRecordStatusSchema,
  spellAttributeSchema,
  spellComponentSchema
} from '../shared/enums.js'

export const spellAuthoredDtoSchema = z.object({
  kind: z.literal('SPELL'),
  id: z.string(),
  label: z.string(),
  status: authoredRecordStatusSchema.optional(),
  attributes: z.array(spellAttributeSchema).optional(),
  components: z.array(spellComponentSchema).optional(),
  description: z.string(),
  castingTime: castingTimeDtoSchema,
  effects: z.array(effectDtoSchema).optional(),
  level: z.number().int(),
  classIds: z.array(z.string()),
  magicSchoolId: z.string(),
  materialDescription: z.string().optional(),
  userId: z.string(),
  systemId: z.string()
})

export type SpellAuthoredDto = z.infer<typeof spellAuthoredDtoSchema>

export const spellAuthoringInputDtoSchema = spellAuthoredDtoSchema.extend({
  userId: z.string().optional()
})

export type SpellAuthoringInputDto = z.infer<typeof spellAuthoringInputDtoSchema>
