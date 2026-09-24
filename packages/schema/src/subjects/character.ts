import { z } from '../zod.js'

import { authoredRecordStatusSchema } from '../shared/enums.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterIntentDtoSchema, characterProfileAuthoredDtoSchema } from './characterIntent.js'
import { characterStateDtoSchema } from './characterState.js'

export * from './characterIntent.js'
export { characterStateDtoSchema } from './characterState.js'
export type { CharacterStateDto } from './characterState.js'

const characterAuthoredDtoSchemaRaw = z.object({
  id: z.string(),
  label: z.string(),
  description: z.optional(z.string()),
  status: z.optional(authoredRecordStatusSchema),
  profile: characterProfileAuthoredDtoSchema,
  intent: characterIntentDtoSchema,
  state: characterStateDtoSchema,
  systemId: postgresUuidSchema,
  // Accepted only by the transitional SQL contract; native inputs omit this retired binding.
  primaryRulesCatalogueId: z.optional(postgresUuidSchema),
  userId: z.string()
})

export type CharacterAuthoredDto = z.infer<typeof characterAuthoredDtoSchemaRaw>

export const characterAuthoredDtoSchema = characterAuthoredDtoSchemaRaw
