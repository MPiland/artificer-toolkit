import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import {
  CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES,
  liveSessionEncounterCommandInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterCommand'
import { internalMutation } from '../lib/mutations'
import { recordEncounterCommand } from '@artificer-toolkit/encounter-persistence/commands'
import { requireLiveEncounterRun } from './encounterCommandAdmission'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

const recordedCommandTypes = new Set<string>(CONVEX_RECORDED_ENCOUNTER_COMMAND_TYPES)

/**
 * Records a GM tool the room forwards (D41), in the same transaction as its live admission.
 * Everything else is planned or rolled in the room, so Convex never evaluates it here.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const execute = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const { command, ...scope } = liveSessionEncounterCommandInputSchema.parse(args)
    const { userId } = await requireLiveEncounterRun(ctx, {
      ...scope,
      encounterId: command.encounterId
    })
    if (!recordedCommandTypes.has(command.type))
      throw new Error('The Encounter command is planned in the Session room.')
    return recordEncounterCommand(encounterWriteTransaction(ctx), command, userId, () => {
      throw new Error('Encounter dice are rolled in the Session room.')
    })
  }
})
