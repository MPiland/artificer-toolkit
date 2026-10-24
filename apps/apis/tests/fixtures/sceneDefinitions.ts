import { makeFunctionReference } from 'convex/server'
import type {
  AppendSceneDefinitionInput,
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type { SceneBarrier, SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { sceneStoredPresentationSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from './characters'

const begin = makeFunctionReference<
  'mutation',
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
>('scenes/definitions:begin')
const append = makeFunctionReference<
  'mutation',
  { input: AppendSceneDefinitionInput },
  SceneDefinitionSaveProgress
>('scenes/definitions:append')
const publish = makeFunctionReference<'mutation', { saveId: string }, SceneDefinitionSaveProgress>(
  'scenes/definitions:publish'
)
const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)

export async function createSceneDefinitionFixture() {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Scene definitions',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const mapId = crypto.randomUUID()
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'mediaAssets',
      vttMapStoredAssetSchema.parse({
        id: mapId,
        ownerUserId: base.owner.userId,
        storageAssetId: mapId,
        profileClass: 'VTT_MAP',
        contentHash: null,
        upload: {
          originalFileName: 'map.png',
          declaredMimeType: 'image/png',
          declaredBytes: 1,
          idempotencyKey: crypto.randomUUID()
        },
        status: 'READY',
        rawObjectKey: null,
        uploadExpiresAt: 0,
        chargedBytes: 3,
        width: 1000,
        height: 1000,
        operation: null,
        cleanupAt: Date.now() + 86_400_000,
        variants: [
          {
            kind: 'DISPLAY',
            objectKey: `ready/${mapId}/display.webp`,
            byteSize: 1,
            width: 1000,
            height: 1000,
            mimeType: 'image/webp'
          },
          {
            kind: 'THUMBNAIL',
            objectKey: `ready/${mapId}/thumbnail.webp`,
            byteSize: 1,
            width: 320,
            height: 320,
            mimeType: 'image/webp'
          },
          {
            kind: 'TILE',
            objectKey: `ready/${mapId}/tile-0-0.webp`,
            byteSize: 1,
            width: 1000,
            height: 1000,
            mimeType: 'image/webp',
            row: 0,
            column: 0
          }
        ]
      })
    )
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture profile.')
    await ctx.db.patch(profile._id, { mediaBytes: 3 })
  })
  const input: BeginSceneDefinitionInput = {
    commandId: crypto.randomUUID(),
    sceneId: null,
    expectedVersion: null,
    settings: {
      campaignId: campaign.id,
      name: 'Courtyard',
      ambientIllumination: 'BRIGHT',
      daylight: false,
      fogMode: 'PER_PLAYER',
      visionRevealMode: 'ON_DRAG',
      grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
      map: { assetId: mapId, width: 1000, height: 1000, tileManifestAssetId: null }
    },
    counts: { annotations: 0, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 }
  }
  return { ...base, campaign, input }
}

/** Publishes the Scene with these tokens and barriers in its definition (live version 0). */
export async function publishScene(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  geometry: { tokens?: SceneToken[]; barriers?: SceneBarrier[] } = {}
) {
  const tokens = geometry.tokens ?? []
  const barriers = geometry.barriers ?? []
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: tokens.length, barriers: barriers.length }
  })
  // Barriers first, so a token's first view stops at a closed door.
  if (barriers.length)
    await base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, collection: 'barriers', offset: 0, entities: barriers }
    })
  if (tokens.length)
    await base.owner.caller.mutation(append, {
      input: { saveId: save.saveId, collection: 'tokens', offset: 0, entities: tokens }
    })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  return { save, sceneId: save.liveSceneId }
}

export function publishEmptyScene(base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>) {
  return publishScene(base)
}

/** Makes the Scene its Campaign's presented Scene, which is what a player may read (D87). */
export async function presentFixtureScene(
  base: Pick<Awaited<ReturnType<typeof createSceneDefinitionFixture>>, 't' | 'campaign'>,
  sceneId: string
) {
  const now = new Date().toISOString()
  await base.t.run((ctx) =>
    ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
  )
}
