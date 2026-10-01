import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import {
  liveSessionEncounterDisarmCommitInputSchema,
  liveSessionEncounterDisarmPendingInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterDisarm'
import {
  persistEncounterDisarmPending,
  persistEncounterDisarmCommit
} from '@artificer-toolkit/encounter-persistence/disarmPersistence'
import { internalMutation } from '../lib/mutations'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Stores the room's paused Disarm through the owning transaction and native freshness readers. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitPending = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterDisarmPendingInputSchema.parse(args)
    return persistEncounterDisarmPending(encounterWriteTransaction(ctx), input, {
      readActionSceneInputs: (state, command, role) =>
        readNativeActionSceneInputs(ctx, state, command, role),
      validateReadFence: (state, characterIds, revisions) =>
        assertLiveSessionRulesRevisions(ctx, revisions, {
          systemId: state.gameSystemId,
          campaignId: state.campaignId,
          characterIds
        })
    })
  }
})

/** Records the room's settled Disarm through the owning transaction and native freshness readers. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterDisarmCommitInputSchema.parse(args)
    return persistEncounterDisarmCommit(encounterWriteTransaction(ctx), input, {
      readActionSceneInputs: (state, command, role) =>
        readNativeActionSceneInputs(ctx, state, command, role),
      validateReadFence: (state, characterIds, revisions) =>
        assertLiveSessionRulesRevisions(ctx, revisions, {
          systemId: state.gameSystemId,
          campaignId: state.campaignId,
          characterIds
        })
    })
  }
})
