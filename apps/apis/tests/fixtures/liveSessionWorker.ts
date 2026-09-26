import { vi } from 'vitest'
import type {
  LiveSessionExpectedScene,
  LiveSessionExternalAuthority
} from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { preparedMovementSceneDelta } from '@artificer-toolkit/rules-runtime/encounterMovementPublication'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx, QueryCtx } from '../../convex/_generated/server'
import { parseGeometrySave } from '../../convex/scenes/geometryDocuments'

export function workerEnvironment(secret: string) {
  return { CONVEX_SITE_URL: 'https://convex.example.test', LIVE_SESSION_WORKER_SECRET: secret }
}

/** Routes the Worker's Convex site requests by pathname, typically into a convex-test caller. */
export function stubLiveSessionFetch(
  route: (pathname: string, init?: RequestInit) => Promise<Response> | Response
) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string | URL | Request, init?: RequestInit) =>
      route(new URL(url instanceof Request ? url.url : url.toString()).pathname, init)
    )
  )
}

export function insertActiveLiveAuthority(
  ctx: MutationCtx,
  { campaignId, epoch, createdAt }: { campaignId: string; epoch: string; createdAt: string }
) {
  return ctx.db.insert('campaignLiveAuthorities', {
    campaignId,
    epoch,
    phase: 'DO_ACTIVE',
    activationFingerprint: '0'.repeat(64),
    persistedSequence: 0,
    persistedStateChecksum: '0'.repeat(64),
    createdAt,
    updatedAt: createdAt
  })
}

/** The room's next authority advance for a Convex-first commit (D27). */
export async function nextExternalAuthority(
  ctx: QueryCtx,
  campaignId: string
): Promise<LiveSessionExternalAuthority> {
  const authority = await ctx.db
    .query('campaignLiveAuthorities')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .unique()
  if (!authority) throw new Error('Live authority fixture is missing.')
  const sequence = authority.persistedSequence + 1
  return {
    sequence,
    expectedStateChecksum: authority.persistedStateChecksum,
    stateChecksum: checksumCanonicalJson({ campaignId, sequence })
  }
}

/** The Scene result a staged move publishes with its prepared outcome, as the room predicts it. */
export async function expectedMovementScene(
  ctx: QueryCtx,
  saveId: string,
  outcome: SceneSpatialPreparation['outcome'] | null
): Promise<LiveSessionExpectedScene> {
  const row = await ctx.db
    .query('sceneGeometrySaves')
    .withIndex('by_publicId', (q) => q.eq('id', saveId))
    .unique()
  if (!row) throw new Error('Geometry save fixture is missing.')
  const save = parseGeometrySave(row)
  if (save.input.type !== 'MOVE_SCENE_TOKEN') throw new Error('Expected a staged token move.')
  const delta = preparedMovementSceneDelta({
    tokenId: save.input.tokenId,
    path: save.input.path,
    outcome,
    sceneVersion: save.snapshotVersion
  })
  return {
    sceneId: save.sceneId,
    version: save.snapshotVersion + (delta || save.fogSaves.length ? 1 : 0),
    delta
  }
}
