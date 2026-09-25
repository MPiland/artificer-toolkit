'use node'

import { v } from 'convex/values'
import { makeFunctionReference } from 'convex/server'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import {
  liveSessionEncounterCommandInputSchema,
  type LiveSessionEncounterCommandInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalAction } from '../_generated/server'
import { executeNativeEncounterCommand } from '../encounters/commandActions'

const admit = makeFunctionReference<'query', LiveSessionEncounterCommandInput, null>(
  'liveSessions/encounterCommandAdmission:admit'
)

/** Runs a room-forwarded Encounter command through the unchanged native implementation. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const execute = internalAction({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterCommandInputSchema.parse(args)
    await ctx.runQuery(admit, input)
    return executeNativeEncounterCommand(ctx, { command: input.command })
  }
})
