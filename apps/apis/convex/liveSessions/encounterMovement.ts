import { v } from 'convex/values'
import { liveSessionMovementBeginInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import {
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { beginSceneGeometry } from '../scenes/geometryStaging'
import { beginMovementResolution } from '../scenes/movementResolutionStaging'
import { liveSessionMovementPrepareInputSchema } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { type SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { persistSpatialPreparation } from '../scenes/spatialPreparationPersistence'
import { readLiveMovementWriteAdmission } from './encounterMovementWriteAdmission'
import { commitLiveMovement } from './encounterMovementCommit'

/** Stages the existing Scene command; the DO prepares rules before the atomic finish. */
// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const begin = internalMutation({
  args: v.any(),
  handler: async (ctx, args: unknown): Promise<SceneGeometryBeginResult> => {
    const input = liveSessionMovementBeginInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    if (userId !== input.expectedUserId) throw new Error('Live movement identity mismatch.')
    const { membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
    const authority = {
      campaignId: input.campaignId,
      epoch: input.authorityEpoch
    }
    if (input.command.type === 'RESOLVE_RULE_OCCURRENCE') {
      const result = await beginMovementResolution(ctx, input.command, authority)
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
  handler: async (ctx, args: unknown): Promise<SceneGeometryCommandResult> =>
    commitLiveMovement(ctx, args)
})
