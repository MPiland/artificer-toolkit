import { v } from 'convex/values'
import { liveSessionEncounterActionCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { persistEncounterActionCommit } from '@artificer-toolkit/encounter-persistence/actionCommitPersistence'
import { internalMutation } from '../lib/mutations'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { readNativeActionSceneInputs } from '../encounters/actionSceneInputs'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { applyLiveEncounterMechanicsBatch } from './encounterActionMechanics'
import { readLiveCharacterMaximumHitPoints } from './encounterMovementTargetState'
import {
  prepareLiveEncounterActionMaintenance,
  persistLiveEncounterActionEffects
} from './encounterActionEffectsCommit'
import { persistLiveEncounterActionChildren } from './encounterActionChildrenCommit'

/** The DO computes rules; this transaction validates current authority and applies bounded outcomes. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<EncounterCommandResultDto> => {
    const input = liveSessionEncounterActionCommitInputSchema.parse(args)
    return persistEncounterActionCommit(encounterWriteTransaction(ctx), input, {
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
      currentCharacterMaximumHitPoints: (state, id) =>
        readLiveCharacterMaximumHitPoints(ctx, state, id),
      prepareActionMaintenance: (effects) => prepareLiveEncounterActionMaintenance(ctx, effects),
      persistActionEffects: (effects) => persistLiveEncounterActionEffects(ctx, effects),
      persistActionChildren: (children) => persistLiveEncounterActionChildren(ctx, children)
    })
  }
})
