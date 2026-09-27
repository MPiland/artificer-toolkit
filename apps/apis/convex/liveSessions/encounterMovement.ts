import { v } from 'convex/values'
import { liveSessionMovementBeginInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import {
  liveSessionMovementPrepareInputSchema,
  liveSessionSceneGeometryCommitInputSchema,
  liveSessionSceneGeometryObserveInputSchema,
  liveSessionSceneGeometryStageFogInputSchema,
  type LiveSessionMovementCommitResponse
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { LiveSessionBootstrapInput } from '@artificer-toolkit/schema/api/liveSessionState'
import {
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { type SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { MutationCtx } from '../_generated/server'
import { internalMutation } from '../lib/mutations'
import { readRuleOccurrenceVoidDecline } from '../encounters/occurrenceVoid'
import { finishSceneGeometry } from '../scenes/geometryCommands'
import { readGeometrySave } from '../scenes/geometryDocuments'
import {
  beginSceneGeometry,
  observeSceneGeometry,
  stageSceneGeometryFog
} from '../scenes/geometryStaging'
import { beginMovementResolution } from '../scenes/movementResolutionStaging'
import { persistSpatialPreparation } from '../scenes/spatialPreparationPersistence'
import { requireLiveMember } from './liveMember'
import { readLiveMovementWriteAdmission } from './encounterMovementWriteAdmission'
import { commitLiveMovement } from './encounterMovementCommit'
import { publishWithAuthorityAdvance } from './externalCommit'

/** The member's own receiving room save in this Campaign. */
async function requireLiveSave(
  ctx: MutationCtx,
  input: LiveSessionBootstrapInput & { saveId: string }
) {
  const userId = await requireLiveMember(ctx, input)
  const current = await readGeometrySave(ctx, input.saveId)
  if (current.campaign.id !== input.campaignId.toLowerCase() || current.save.actorUserId !== userId)
    throw new Error('Live Scene save scope mismatch.')
  return current
}

/**
 * Stages a room Scene commit: a token move or door change, a movement decision's answer, or a GM
 * void, which declines the decision (D26). The DO prepares any rules before the atomic commit.
 */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const begin = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<SceneGeometryBeginResult> => {
    const input = liveSessionMovementBeginInputSchema.parse(args)
    await requireLiveMember(ctx, input)
    const authority = { campaignId: input.campaignId, epoch: input.authorityEpoch }
    if (
      input.command.type === 'RESOLVE_RULE_OCCURRENCE' ||
      input.command.type === 'VOID_RULE_OCCURRENCE'
    ) {
      const command =
        input.command.type === 'VOID_RULE_OCCURRENCE'
          ? await readRuleOccurrenceVoidDecline(ctx, input.command)
          : input.command
      const result = await beginMovementResolution(ctx, command, authority)
      if (!result) throw new Error('Live movement response requires a movement occurrence.')
      return result
    }
    if (!input.presentation) throw new Error('Live movement requires a presentation context.')
    return beginSceneGeometry(
      ctx,
      { input: input.command, presentation: input.presentation },
      undefined,
      true,
      authority
    )
  }
})

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const observe = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<{ saveId: string }> => {
    const input = liveSessionSceneGeometryObserveInputSchema.parse(args)
    await requireLiveSave(ctx, input)
    return observeSceneGeometry(ctx, {
      saveId: input.saveId,
      characterRevisions: input.characterRevisions
    })
  }
})

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const stageFog = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<{ saveId: string }> => {
    const input = liveSessionSceneGeometryStageFogInputSchema.parse(args)
    await requireLiveSave(ctx, input)
    return stageSceneGeometryFog(ctx, { saveId: input.saveId, layer: input.layer })
  }
})

/** Freezes DO evidence before existing fog staging; this does not settle gameplay outcomes. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const prepare = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<SceneSpatialPreparation> => {
    const input = liveSessionMovementPrepareInputSchema.parse(args)
    await readLiveMovementWriteAdmission(ctx, input)
    return persistSpatialPreparation(ctx, input.movement.saveId, input.preparation)
  }
})

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commit = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<LiveSessionMovementCommitResponse> =>
    commitLiveMovement(ctx, args)
})

/** Commits a room Scene change that carries no Encounter rules, advancing the room's sequence. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const commitScene = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<SceneGeometryCommandResult> => {
    const input = liveSessionSceneGeometryCommitInputSchema.parse(args)
    const current = await requireLiveSave(ctx, { ...input, saveId: input.finish.saveId })
    const { input: command } = current.save
    if (command.type === 'MOVE_SCENE_TOKEN' && command.expectedEncounterVersion !== null)
      throw new Error('Encounter-bound movement commits through its rules.')
    return publishWithAuthorityAdvance(ctx, input, () =>
      finishSceneGeometry(ctx, input.finish, current)
    )
  }
})
