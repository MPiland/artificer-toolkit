import { z } from '../zod.js'
import { postgresUuidSchema } from '../shared/postgresUuid.js'
import { characterSheetCommandInputDtoSchema } from './characterSheetCommandInputs.js'
import { characterSheetConditionDtoSchema } from './characterSheetCondition.js'

/** Private transaction input; identity is inherited from the authenticated caller. */
export const characterEncounterCommandInputSchema = z.strictObject({
  campaignId: postgresUuidSchema,
  characterId: postgresUuidSchema,
  command: characterSheetCommandInputDtoSchema
})

export const characterEncounterCommandResultSchema = z.strictObject({
  historyEventId: postgresUuidSchema,
  streamVersion: z.number().check(z.int()).check(z.nonnegative()),
  currentHitPoints: z.number().check(z.int()),
  maxHitPoints: z.number().check(z.int()),
  tempHitPoints: z.number().check(z.int()),
  conditions: z.array(characterSheetConditionDtoSchema)
})

export type CharacterEncounterCommandInput = z.infer<typeof characterEncounterCommandInputSchema>
export type CharacterEncounterCommandResult = z.infer<typeof characterEncounterCommandResultSchema>
