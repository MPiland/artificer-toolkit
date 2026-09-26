import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionEncounterVoidInputSchema,
  liveSessionEncounterVoidPreparedSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalMutation } from '../lib/mutations'
import {
  prepareRuleOccurrenceVoid,
  recordDeclinedRuleOccurrenceVoid
} from '../encounters/occurrenceVoid'
import { requireLiveEncounterRun } from './encounterCommandAdmission'

/**
 * A room GM void that declines nothing: a paused action cancelled whole, or a refusal. It evaluates
 * no rules; a declining void is planned by the room and only recorded here.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const prepare = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown) => {
    const { command, ...scope } = liveSessionEncounterVoidInputSchema.parse(args)
    await requireLiveEncounterRun(ctx, { ...scope, encounterId: command.encounterId })
    const prepared = await prepareRuleOccurrenceVoid(ctx, command)
    if (prepared.kind === 'DECLINE') throw new Error('A declining void is planned by the room.')
    return liveSessionEncounterVoidPreparedSchema.parse(prepared)
  }
})

/** Records the "Voided by the GM" entry once the room committed the void's decline. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const record = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const { command, ...scope } = liveSessionEncounterVoidInputSchema.parse(args)
    await requireLiveEncounterRun(ctx, { ...scope, encounterId: command.encounterId })
    return recordDeclinedRuleOccurrenceVoid(ctx, command)
  }
})
