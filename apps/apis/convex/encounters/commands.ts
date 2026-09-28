import { zodToConvex } from 'convex-helpers/server/zod4'
import type { Validator } from 'convex/values'
import type { z } from 'zod'
import {
  encounterCommandResultDtoSchema,
  encounterExecuteInputSchema,
  type EncounterCommandResultDto,
  type EncounterExecuteInput
} from '@artificer-toolkit/schema/api/encounters'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { encounterWriteTransaction } from './encounterPorts'

const resultValidator: Validator<EncounterCommandResultDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterCommandResultDto>
>(encounterCommandResultDtoSchema)
const inputValidator: Validator<EncounterExecuteInput, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterExecuteInput>
>(encounterExecuteInputSchema)

/** Internal: a GM tool the room forwards for Convex to record (D41). */
export const execute = internalMutation({
  args: inputValidator,
  returns: resultValidator,
  handler: async (ctx, args): Promise<EncounterCommandResultDto> => {
    const { userId } = await requireIdentity(ctx)
    return recordEncounterCommand(
      encounterWriteTransaction(ctx),
      encounterExecuteInputSchema.parse(args).command,
      userId,
      () => {
        throw new Error('Encounter dice are rolled in the Session room.')
      }
    )
  }
})
