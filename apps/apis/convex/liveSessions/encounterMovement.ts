import { zodToConvex } from 'convex-helpers/server/zod4'
import type { z } from 'zod'
import {
  liveSessionMovementBeginInputSchema,
  type LiveSessionMovementBeginInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterMovement'
import {
  sceneGeometryBeginResultSchema,
  sceneGeometryCommandResultSchema,
  type SceneGeometryBeginResult,
  type SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import { internalMutation } from '../lib/mutations'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { beginSceneGeometry } from '../scenes/geometryStaging'
import { beginMovementResolution } from '../scenes/movementResolutionStaging'
import {
  liveSessionMovementPrepareInputSchema,
  liveSessionMovementCommitInputSchema,
  type LiveSessionMovementPrepareInput,
  type LiveSessionMovementCommitInput
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import {
  sceneSpatialPreparationSchema,
  type SceneSpatialPreparation
} from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { persistSpatialPreparation } from '../scenes/spatialPreparationPersistence'
import { readLiveMovementWriteAdmission } from './encounterMovementWriteAdmission'
import { commitLiveMovement } from './encounterMovementCommit'

/** Stages the existing Scene command; the DO prepares rules before the atomic finish. */
export const begin = internalMutation({
  args: zodToConvex<z.core.$ZodType<LiveSessionMovementBeginInput>>(
    liveSessionMovementBeginInputSchema
  ),
  returns: zodToConvex<z.core.$ZodType<SceneGeometryBeginResult>>(sceneGeometryBeginResultSchema),
  handler: async (ctx, args): Promise<SceneGeometryBeginResult> => {
    const input = liveSessionMovementBeginInputSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    if (
      userId !== input.expectedUserId ||
      ('session' in input && input.session.sessionId !== input.sessionId)
    )
      throw new Error('Live movement identity or Session mismatch.')
    const { membership } = await requireCampaignAuthority(ctx, input.campaignId, userId)
    if (membership.role !== input.expectedRole) throw new Error('Live Session role mismatch.')
    const authority = {
      campaignId: input.campaignId,
      sessionId: input.sessionId,
      epoch: input.authorityEpoch
    }
    if (input.command.type === 'RESOLVE_RULE_OCCURRENCE') {
      const result = await beginMovementResolution(ctx, input.command, authority)
      if (!result) throw new Error('Live movement response requires a movement occurrence.')
      return result
    }
    if (!('session' in input)) throw new Error('Live movement requires a Session context.')
    return beginSceneGeometry(
      ctx,
      { input: input.command, session: input.session },
      undefined,
      true,
      authority
    )
  }
})

/** Freezes DO evidence before existing fog staging; this does not settle gameplay outcomes. */
export const prepare = internalMutation({
  args: zodToConvex<z.core.$ZodType<LiveSessionMovementPrepareInput>>(
    liveSessionMovementPrepareInputSchema
  ),
  returns: zodToConvex<z.core.$ZodType<SceneSpatialPreparation>>(sceneSpatialPreparationSchema),
  handler: async (ctx, args): Promise<SceneSpatialPreparation> => {
    const input = liveSessionMovementPrepareInputSchema.parse(args)
    await readLiveMovementWriteAdmission(ctx, input)
    return persistSpatialPreparation(ctx, input.movement.saveId, input.preparation)
  }
})

export const commit = internalMutation({
  args: zodToConvex<z.core.$ZodType<LiveSessionMovementCommitInput>>(
    liveSessionMovementCommitInputSchema
  ),
  returns: zodToConvex<z.core.$ZodType<SceneGeometryCommandResult>>(
    sceneGeometryCommandResultSchema
  ),
  handler: async (ctx, args): Promise<SceneGeometryCommandResult> => commitLiveMovement(ctx, args)
})
