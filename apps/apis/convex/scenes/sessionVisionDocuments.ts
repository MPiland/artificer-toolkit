import type {
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { QueryCtx } from '../_generated/server'
import { readLiveScene } from './liveDocuments'
import { readSceneVisionFreshness } from './visionFreshness'

export async function readPresentedVisionScene(
  ctx: QueryCtx,
  input: Pick<SceneSessionVisionCaptureInput, 'campaignId' | 'sceneId'>
) {
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', input.campaignId))
    .unique()
  if (!presentation || presentation.sceneId !== input.sceneId)
    throw new Error('Scene vision presentation is stale.')
  return { presentation }
}

export async function readSessionVisionScope(
  ctx: QueryCtx,
  input: SceneSessionVisionScope | SceneSessionVisionCaptureInput,
  current?: Pick<Awaited<ReturnType<typeof readLiveScene>>, 'campaign' | 'header' | 'userId'> &
    Awaited<ReturnType<typeof readPresentedVisionScene>>
) {
  const scene = current ?? (await readLiveScene(ctx, input.sceneId, 'MEMBER'))
  const { header, campaign, userId } = scene
  if (header.id !== input.sceneId) throw new Error('Scene vision Scene identity does not match.')
  if (campaign.id !== input.campaignId || campaign.gameSystemId !== input.systemId)
    throw new Error('Scene vision Campaign identity does not match.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (header.version !== input.expectedSceneVersion)
    throw new Error('Scene vision Scene version is stale.')
  const { presentation } = current ?? (await readPresentedVisionScene(ctx, input))
  if (
    presentation.campaignId !== input.campaignId ||
    presentation.sceneId !== input.sceneId ||
    presentation.version !== input.expectedPresentationVersion
  )
    throw new Error('Scene vision presentation is stale.')
  const freshness = await readSceneVisionFreshness(ctx, input)
  if (
    'freshness' in input &&
    (input.freshness.system !== freshness.system ||
      input.freshness.campaign !== freshness.campaign ||
      input.freshness.play !== freshness.play)
  )
    throw new Error('Scene vision dependencies changed; capture a fresh play snapshot.')
  return { header, campaign, presentation, userId, freshness }
}
