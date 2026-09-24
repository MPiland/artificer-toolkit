import type { SceneVisionRevision } from '@artificer-toolkit/schema/projections/sceneVisionRevisions'
import type {
  SceneSessionVisionCaptureInput,
  SceneSessionVisionFreshness,
  SceneSessionVisionComposition
} from '@artificer-toolkit/schema/api/sceneSessionVision'
import type { QueryCtx } from '../_generated/server'

export async function readSceneVisionRevision(
  ctx: QueryCtx,
  scope: SceneVisionRevision['scope'],
  id: string
): Promise<string | null> {
  const row = await ctx.db
    .query('sceneVisionRevisions')
    .withIndex('by_scope_id', (q) => q.eq('scope', scope).eq('id', id))
    .unique()
  return row?.revision ?? null
}

export async function readSceneVisionFreshness(
  ctx: QueryCtx,
  input: Pick<SceneSessionVisionCaptureInput, 'systemId' | 'campaignId'>
): Promise<SceneSessionVisionFreshness> {
  const [system, campaign, play] = await Promise.all([
    readSceneVisionRevision(ctx, 'SYSTEM', input.systemId),
    readSceneVisionRevision(ctx, 'CAMPAIGN', input.campaignId),
    readSceneVisionRevision(ctx, 'PLAY', input.campaignId)
  ])
  return { system, campaign, play }
}

export async function assertSceneVisionCharacters(
  ctx: QueryCtx,
  revisions: SceneSessionVisionComposition['characterRevisions']
) {
  if (new Set(revisions.map((entry) => entry.characterId)).size !== revisions.length)
    throw new Error('Scene geometry Character observations are duplicated.')
  for (const observed of revisions) {
    if (
      (await readSceneVisionRevision(ctx, 'CHARACTER', observed.characterId)) !== observed.revision
    )
      throw new Error('Scene vision Character changed before geometry publication.')
  }
}
