import { v } from 'convex/values'
import { liveSessionEncounterConcentrationCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterConcentration'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { persistEncounterConcentrationResponse } from '@artificer-toolkit/encounter-persistence/concentrationResponsePersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { persistLiveEncounterConcentrationChildren } from './encounterConcentrationChildrenCommit'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { applyLiveConcentrationCleanup } from './concentrationCleanupCommit'
import { readLiveCharacterStreamVersion } from './encounterMovementTargetState'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Commits the planned check through the owning Convex transaction and native freshness readers. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterConcentrationCommitInputSchema.parse(args)
    return persistEncounterConcentrationResponse(encounterWriteTransaction(ctx), input, {
      currentCharacterStreamVersion: (state, id) => readLiveCharacterStreamVersion(ctx, state, id),
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
      applyCleanup: (cleanup) => applyLiveConcentrationCleanup(ctx, cleanup),
      persistConcentrationChildren: (children) =>
        persistLiveEncounterConcentrationChildren(ctx, children)
    })
  }
})
