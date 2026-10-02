import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { QueryCtx } from '../_generated/server'
import { readSceneVisionRevision } from '../scenes/visionFreshness'

export async function readLiveSessionRulesRevisions(
  ctx: QueryCtx,
  input: { systemId: string; campaignId: string; characterId?: string }
): Promise<LiveSessionRulesRevisions> {
  const scopes: Array<Pick<LiveSessionRulesRevisions[number], 'scope' | 'id'>> = [
    { scope: 'SYSTEM', id: input.systemId },
    { scope: 'CAMPAIGN', id: input.campaignId },
    { scope: 'PLAY', id: input.campaignId }
  ]
  if (input.characterId) scopes.push({ scope: 'CHARACTER', id: input.characterId })
  return Promise.all(
    scopes.map(async (scope) => ({
      ...scope,
      revision: await readSceneVisionRevision(ctx, scope.scope, scope.id)
    }))
  )
}
