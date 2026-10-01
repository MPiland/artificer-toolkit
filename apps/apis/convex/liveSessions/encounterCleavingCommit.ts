import { v } from 'convex/values'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { liveSessionEncounterCleavingCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterCleaving'
import { persistEncounterCleavingResponse } from '@artificer-toolkit/encounter-persistence/cleavingResponsePersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import {
  bindLiveConcentrationApplications,
  persistLiveEncounterConcentrationChildren
} from './encounterConcentrationChildrenCommit'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Commits the planned answer through the owning transaction and native freshness readers. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterCleavingCommitInputSchema.parse(args)
    return persistEncounterCleavingResponse(encounterWriteTransaction(ctx), input, {
      readMaintenanceCapture: (state, request) =>
        readEncounterMaintenanceCapture(ctx, state, request),
      readActionSceneInputs: (state, action, role) =>
        readNativeActionSceneInputs(ctx, state, action, role),
      validateReadFence: (state, characterIds, revisions) =>
        assertLiveSessionRulesRevisions(ctx, revisions, {
          systemId: state.gameSystemId,
          campaignId: state.campaignId,
          characterIds
        }),
      applyMechanics: (batch) => applyLiveEncounterMechanicsBatch(ctx, batch),
      bindConcentrationApplications: (state, applications) =>
        bindLiveConcentrationApplications(ctx, state, applications),
      persistConcentrationChildren: (children) =>
        persistLiveEncounterConcentrationChildren(ctx, children)
    })
  }
})
