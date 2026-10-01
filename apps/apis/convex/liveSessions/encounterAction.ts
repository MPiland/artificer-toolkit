import { v } from 'convex/values'
import { liveSessionEncounterActionPendingInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { persistEncounterActionPending } from '@artificer-toolkit/encounter-persistence/actionPendingPersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Stores only the Worker-computed pending root; terminal mechanics remain a separate transaction. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitPending = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterActionPendingInputSchema.parse(args)
    return persistEncounterActionPending(encounterWriteTransaction(ctx), input, {
      readMaintenanceCapture: (state, request) =>
        readEncounterMaintenanceCapture(ctx, state, request),
      readActionSceneInputs: (state, action, role) =>
        readNativeActionSceneInputs(ctx, state, action, role),
      validateReadFence: (state, characterIds, revisions) =>
        assertLiveSessionRulesRevisions(ctx, revisions, {
          systemId: state.gameSystemId,
          campaignId: state.campaignId,
          characterIds
        })
    })
  }
})
