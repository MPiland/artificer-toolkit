import {
  liveSessionRulesRevisionsSchema,
  type LiveSessionRulesRevisions
} from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { readSceneVisionRevision } from '../scenes/visionFreshness'

export async function readLiveSessionRulesRevisions(
  ctx: QueryCtx,
  input: { systemId: string; campaignId: string; sessionId: string; characterId?: string }
): Promise<LiveSessionRulesRevisions> {
  const scopes: Array<Pick<LiveSessionRulesRevisions[number], 'scope' | 'id'>> = [
    { scope: 'SYSTEM', id: input.systemId },
    { scope: 'CAMPAIGN', id: input.campaignId },
    { scope: 'SESSION', id: input.sessionId }
  ]
  if (input.characterId) scopes.push({ scope: 'CHARACTER', id: input.characterId })
  return Promise.all(
    scopes.map(async (scope) => ({
      ...scope,
      revision: await readSceneVisionRevision(ctx, scope.scope, scope.id)
    }))
  )
}

/**
 * Call once before settlement writes, in the same transaction. The caller supplies the complete
 * authorized scope from current stored state and still owns identity, epoch and command replay.
 */
export async function assertLiveSessionRulesRevisions(
  ctx: MutationCtx,
  observed: LiveSessionRulesRevisions,
  scope: {
    systemId: string
    campaignId: string
    sessionId: string
    characterIds: readonly string[]
  }
) {
  const revisions = liveSessionRulesRevisionsSchema.parse(observed)
  const required = new Set([
    `SYSTEM:${scope.systemId}`,
    `CAMPAIGN:${scope.campaignId}`,
    `SESSION:${scope.sessionId}`,
    ...scope.characterIds.map((id) => `CHARACTER:${id}`)
  ])
  if (revisions.length !== required.size)
    throw new Error('Live rules revision scope is incomplete or duplicated.')
  for (const revision of revisions) {
    if (!required.delete(`${revision.scope}:${revision.id}`))
      throw new Error('Live rules revision scope does not match the command.')
  }
  const current = await Promise.all(
    revisions.map(({ scope, id }) => readSceneVisionRevision(ctx, scope, id))
  )
  if (current.some((revision, index) => revision !== revisions[index]!.revision))
    throw new Error('Live rules inputs changed before commit.')
}
