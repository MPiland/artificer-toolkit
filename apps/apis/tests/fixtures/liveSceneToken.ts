import {
  sceneStoredLiveEntitySchema,
  sceneStoredLiveStateSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { createEncounterSceneFixture } from './encounterScene'

type SceneFixture = Awaited<ReturnType<typeof createEncounterSceneFixture>>

/** A live Scene head with no overrides beyond the given token counts, as a room checkpoint writes it. */
export function liveSceneHead(
  sceneId: string,
  options: {
    version: number
    tokens?: number
    nextToken?: number
    fogLayers?: number
    ambientIllumination?: 'BRIGHT' | 'DIM'
  }
) {
  const tokens = options.tokens ?? 0
  return sceneStoredLiveStateSchema.parse({
    sceneId,
    version: options.version,
    fogLayerCount: options.fogLayers ?? 0,
    nextFogOrdinal: options.fogLayers ?? 0,
    settings: {
      ambientIllumination: {
        value: options.ambientIllumination ?? 'BRIGHT',
        daylight: false,
        version: options.ambientIllumination === 'DIM' ? options.version : 0
      },
      visionRevealMode: { value: 'ON_DRAG', version: 0 },
      fogMode: { value: 'PER_PLAYER', version: 0 }
    },
    counts: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens,
      measurements: 0
    },
    nextOrdinals: {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: options.nextToken ?? tokens,
      measurements: 0
    }
  })
}

/**
 * Writes the live Scene's token override (or tombstone for `null`) directly, as the room's
 * checkpoint leaves it, replacing any head or override this fixture wrote before.
 */
export async function seedLiveToken(
  base: Pick<SceneFixture, 't' | 'tokens'> & { sceneId: string },
  tokenId: string,
  value: SceneFixture['tokens'][number] | null,
  version = 1,
  entityVersion = version
) {
  const baseIndex = base.tokens.findIndex(
    (token) => token.id.toLowerCase() === tokenId.toLowerCase()
  )
  const tokenCount =
    base.tokens.length + (value && baseIndex < 0 ? 1 : !value && baseIndex >= 0 ? -1 : 0)
  const head = liveSceneHead(base.sceneId, {
    version,
    tokens: tokenCount,
    nextToken: base.tokens.length + (value && baseIndex < 0 ? 1 : 0)
  })
  await base.t.run(async (ctx) => {
    const previousHead = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', base.sceneId))
      .unique()
    if (previousHead) await ctx.db.delete(previousHead._id)
    const previousEntity = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q
          .eq('sceneId', base.sceneId)
          .eq('collection', 'tokens')
          .eq('entityId', tokenId.toLowerCase())
      )
      .unique()
    if (previousEntity) await ctx.db.delete(previousEntity._id)
    await ctx.db.insert('sceneLiveStates', head)
    const change = {
      sceneId: base.sceneId,
      collection: 'tokens' as const,
      entityId: tokenId.toLowerCase(),
      value: value
        ? { collection: 'tokens' as const, entity: { ...value, id: tokenId.toLowerCase() } }
        : null,
      ordinal: value ? (baseIndex < 0 ? base.tokens.length : baseIndex) : null,
      version: entityVersion
    }
    await ctx.db.insert(
      'sceneLiveEntities',
      sceneStoredLiveEntitySchema.parse({ ...change, checksum: checksumCanonicalJson(change) })
    )
  })
}
