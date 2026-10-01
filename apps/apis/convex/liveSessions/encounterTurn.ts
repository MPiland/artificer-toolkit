import { v } from 'convex/values'
import { liveSessionEncounterTurnPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { persistEncounterTurnPending } from '@artificer-toolkit/encounter-persistence/turnPendingPersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { assertLiveTurnRevisions } from './encounterTurnAdmission'

/** Stores one DO-prepared pending turn without advancing the Run or Character state. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitPending = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterTurnPendingInputSchema.parse(args)
    return persistEncounterTurnPending(
      encounterWriteTransaction(ctx),
      input,
      (state, actors, fencedInput) => assertLiveTurnRevisions(ctx, state, actors, fencedInput)
    )
  }
})
