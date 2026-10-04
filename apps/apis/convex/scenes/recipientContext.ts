import { sceneRecipientCaptureSchema } from '@artificer-toolkit/schema/api/sceneRecipient'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene, readLiveSceneForUser, type LiveSceneScope } from './liveDocuments'
import { readSceneVisionRevision } from './visionFreshness'

/** Reuse userId only when this invocation already resolved it through requireIdentity. */
export async function readRecipientContext(
  ctx: QueryCtx,
  sceneId: string,
  expectedVersion?: number,
  userId?: string,
  scope: Exclude<LiveSceneScope, 'OWNER'> = 'MEMBER'
) {
  const scene =
    userId === undefined
      ? await readLiveScene(ctx, sceneId, scope)
      : await readLiveSceneForUser(ctx, sceneId, scope, userId)
  const { header, membership } = scene
  if (expectedVersion !== undefined && header.version !== expectedVersion)
    throw new Error('Live Scene snapshot changed before recipient hydration.')
  const capture = sceneRecipientCaptureSchema.parse({
    header,
    viewer: { role: membership.role === 'OWNER' ? 'GM' : 'PLAYER', userId: scene.userId },
    campaignRevision: await readSceneVisionRevision(ctx, 'CAMPAIGN', header.campaignId)
  })
  return { capture, scene }
}
