import type {
  SceneSessionVisionCaptureInput,
  SceneSessionVisionScope
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { QueryCtx } from '../_generated/server'
import { requireSession } from '../campaigns/sessionDocuments'
import { readLiveScene } from './liveDocuments'
import { readSceneVisionFreshness } from './visionFreshness'

export async function readPresentedVisionSession(
  ctx: QueryCtx,
  input: Pick<SceneSessionVisionCaptureInput, 'campaignId' | 'sessionId' | 'sceneId'>
) {
  const session = await requireSession(ctx, input.campaignId, input.sessionId)
  if (session.status !== 'OPEN') throw new Error('Scene vision Session is not current and open.')
  const presentation = await ctx.db
    .query('campaignScenePresentations')
    .withIndex('by_campaignId_sessionId', (q) =>
      q.eq('campaignId', input.campaignId).eq('sessionId', session.id)
    )
    .unique()
  if (presentation?.sceneId !== input.sceneId)
    throw new Error('Scene vision presentation is stale.')
  return { session, presentation }
}

export async function readSessionVisionScope(
  ctx: QueryCtx,
  input: SceneSessionVisionScope | SceneSessionVisionCaptureInput,
  current?: Pick<Awaited<ReturnType<typeof readLiveScene>>, 'campaign' | 'header' | 'userId'> &
    Awaited<ReturnType<typeof readPresentedVisionSession>>
) {
  const scene = current ?? (await readLiveScene(ctx, input.sceneId, 'MEMBER'))
  const { header, campaign, userId } = scene
  if (header.id !== input.sceneId) throw new Error('Scene vision Scene identity does not match.')
  if (campaign.id !== input.campaignId || campaign.gameSystemId !== input.systemId)
    throw new Error('Scene vision Campaign identity does not match.')
  if (campaign.status !== 'ACTIVE') throw new Error('Archived Campaigns are read-only.')
  if (header.version !== input.expectedSceneVersion)
    throw new Error('Scene vision Scene version is stale.')
  const { session, presentation } = current ?? (await readPresentedVisionSession(ctx, input))
  if (
    session.id !== input.sessionId ||
    session.campaignId !== input.campaignId ||
    session.status !== 'OPEN' ||
    session.version !== input.expectedSessionVersion
  )
    throw new Error('Scene vision Session is not current and open.')
  if (
    presentation.campaignId !== input.campaignId ||
    presentation.sessionId !== input.sessionId ||
    presentation.sceneId !== input.sceneId ||
    presentation.version !== input.expectedPresentationVersion
  )
    throw new Error('Scene vision presentation is stale.')
  const freshness = await readSceneVisionFreshness(ctx, input)
  if (
    'freshness' in input &&
    (input.freshness.system !== freshness.system ||
      input.freshness.campaign !== freshness.campaign ||
      input.freshness.session !== freshness.session)
  )
    throw new Error('Scene vision dependencies changed; capture a fresh Session snapshot.')
  return { header, campaign, session, userId, freshness }
}
