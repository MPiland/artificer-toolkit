import { z } from 'zod'

import { authoredRecordStatusSchema } from '../shared/enums.js'
import { characterIntentDtoSchema, characterProfileAuthoredDtoSchema } from './characterIntent.js'
import { characterStateDtoSchema } from './characterState.js'

export * from './characterIntent.js'
export { characterStateDtoSchema } from './characterState.js'
export type { CharacterStateDto } from './characterState.js'

const characterAuthoredDtoSchemaRaw = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  status: authoredRecordStatusSchema.optional(),
  profile: characterProfileAuthoredDtoSchema,
  intent: characterIntentDtoSchema,
  state: characterStateDtoSchema,
  systemId: z.string(),
  userId: z.string()
})

export type CharacterAuthoredDto = z.infer<typeof characterAuthoredDtoSchemaRaw>

export const characterAuthoredDtoSchema = characterAuthoredDtoSchemaRaw
