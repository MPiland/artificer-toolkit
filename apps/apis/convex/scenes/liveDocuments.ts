import { sceneLiveStateHeaderSchema } from '@artificer-toolkit/schema/api/sceneLiveState'
import {
  sceneStoredInitialStateSchema,
  sceneStoredDefinitionSaveSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredLiveStateSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { parseSceneLiveEntity } from '@artificer-toolkit/encounter-persistence/sceneLiveState'
import type { Doc } from '../_generated/dataModel'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { QueryCtx } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority, type CampaignInternalScope } from '../campaigns/authority'

function stored<T extends { _id: unknown; _creationTime: unknown }>(row: T) {
  const { _id, _creationTime, ...value } = row
  return value
}

export function parseLiveEntity(row: Doc<'sceneLiveEntities'>, version: number) {
  return parseSceneLiveEntity(stored(row), version)
}
/**
 * D87: how far the GM has revealed a Scene to players. PRESENTED is the Campaign's presented Scene
 * and grants every player read. SHOWN is a Scene shown as a view-only image and grants only its
 * header, map and fog, never its entities (`VIEWER` scope).
 */
export type SceneReveal = 'PRESENTED' | 'SHOWN'

async function readSceneReveal(
  ctx: QueryCtx,
  campaignId: string,
  sceneId: string
): Promise<SceneReveal | null> {
  const [presentation, showing] = await Promise.all([
    ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique(),
    ctx.db
      .query('campaignSceneShowings')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
  ])
  if (presentation?.sceneId === sceneId) return 'PRESENTED'
  return showing?.sceneId === sceneId ? 'SHOWN' : null
}

/** `MEMBER` reads the live Scene; `VIEWER` also reads a Scene shown as an image (header and fog only). */
export type LiveSceneScope = 'OWNER' | 'MEMBER' | 'VIEWER'

export async function readLiveScene(ctx: QueryCtx, sceneId: string, scope: LiveSceneScope) {
  const { userId } = await requireIdentity(ctx)
  return readLiveSceneForUser(ctx, sceneId, scope, userId)
}

/** `reveal` is what the caller may read: the Campaign owner always reads everything (PRESENTED). */
export async function readLiveSceneForUser(
  ctx: QueryCtx,
  sceneId: string,
  scope: LiveSceneScope,
  userId: string,
  authorityScope?: CampaignInternalScope
) {
  const row = await ctx.db
    .query('campaignScenes')
    .withIndex('by_publicId', (q) => q.eq('id', sceneId.toLowerCase()))
    .unique()
  if (!row) throw new Error('Live Scene is unavailable.')
  const { campaign, membership } = await requireCampaignAuthority(
    ctx,
    row.campaignId,
    userId,
    authorityScope
  )
  if (scope === 'OWNER' && membership.role !== 'OWNER')
    throw new Error('Live Scene preparation is only available to the Campaign owner.')
  const reveal: SceneReveal | null =
    membership.role === 'OWNER' ? 'PRESENTED' : await readSceneReveal(ctx, campaign.id, row.id)
  if (reveal === null || (reveal === 'SHOWN' && scope !== 'VIEWER'))
    throw new Error('Live Scene is unavailable.')
  const scene = sceneStoredInitialStateSchema.parse(stored(row))
  const saveRow = await ctx.db
    .query('sceneDefinitionSaves')
    .withIndex('by_publicId', (q) => q.eq('id', scene.definitionSaveId))
    .unique()
  if (!saveRow) throw new Error('Live Scene source snapshot is unavailable.')
  const save = sceneStoredDefinitionSaveSchema.parse(stored(saveRow))
  if (
    save.status !== 'PUBLISHED' ||
    save.entitiesRemoved ||
    save.liveSceneId !== scene.id ||
    save.commandId !== scene.materializationCommandId ||
    save.definitionId !== scene.definitionId ||
    (save.expectedVersion ?? 0) + 1 !== scene.definitionVersion ||
    save.settings.campaignId !== campaign.id ||
    checksumCanonicalJson(save.counts) !== checksumCanonicalJson(save.received) ||
    checksumCanonicalJson({ ...scene, ...save.settings }) !== checksumCanonicalJson(scene)
  )
    throw new Error('Live Scene source snapshot is inconsistent.')
  const liveRow = await ctx.db
    .query('sceneLiveStates')
    .withIndex('by_sceneId', (q) => q.eq('sceneId', scene.id))
    .unique()
  const live = liveRow ? sceneStoredLiveStateSchema.parse(stored(liveRow)) : null
  if (
    live &&
    (live.settings.ambientIllumination.version > live.version ||
      live.settings.visionRevealMode.version > live.version ||
      live.settings.fogMode.version > live.version)
  )
    throw new Error('Stored live Scene settings are inconsistent.')
  const header = sceneLiveStateHeaderSchema.parse({
    ...save.settings,
    ambientIllumination:
      live?.settings.ambientIllumination.value ?? save.settings.ambientIllumination,
    daylight: live?.settings.ambientIllumination.daylight ?? save.settings.daylight,
    visionRevealMode: live?.settings.visionRevealMode.value ?? save.settings.visionRevealMode,
    fogMode: live?.settings.fogMode.value ?? save.settings.fogMode,
    id: scene.id,
    definitionId: scene.definitionId,
    definitionVersion: scene.definitionVersion,
    definitionSaveId: scene.definitionSaveId,
    version: live?.version ?? 0,
    fogLayerCount: live?.fogLayerCount ?? 0,
    counts: save.counts,
    currentCounts: live?.counts ?? { ...save.counts, measurements: 0 }
  })
  return { header, campaign, membership, userId, liveRow, live, reveal }
}
