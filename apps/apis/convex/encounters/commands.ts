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
import { readLiveCampaignAuthority } from '../liveSessions/authorityGuard'

const resultValidator: Validator<EncounterCommandResultDto, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterCommandResultDto>
>(encounterCommandResultDtoSchema)
const inputValidator: Validator<EncounterExecuteInput, 'required', string> = zodToConvex<
  z.core.$ZodType<EncounterExecuteInput>
>(encounterExecuteInputSchema)

/** Outside-live commands; epoch-authorized transitional Worker writes use liveSessions endpoints. */
export const execute = internalMutation({
  args: inputValidator,
  returns: resultValidator,
  handler: async (ctx, args): Promise<EncounterCommandResultDto> => {
    const { userId } = await requireIdentity(ctx)
    const { command } = encounterExecuteInputSchema.parse(args)
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', command.encounterId.toLowerCase()))
      .unique()
    if (run && (await readLiveCampaignAuthority(ctx, run.campaignId)))
      throw new Error('This Encounter is currently owned by its Campaign live table.')
    return recordEncounterCommand(encounterWriteTransaction(ctx), command, userId, () => {
      throw new Error('Encounter dice are rolled in the Session room.')
    })
  }
})
