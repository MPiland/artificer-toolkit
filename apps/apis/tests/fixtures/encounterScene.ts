import { makeFunctionReference } from 'convex/server'

import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import type {
  BindEncounterToPresentedSceneInputDto,
  SceneDefinitionDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  CreateEncounterInputDto,
  EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'

import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { bindEncounterToPresentedScene } from '@artificer-toolkit/encounter-persistence/sceneBindingPersistence'
import type { MutationCtx } from '../../convex/_generated/server'
import { requireCampaignAuthority } from '../../convex/campaigns/authority'
import { createConvexEncounterStore } from '../../convex/lib/convexEncounterStore'
import { requireIdentity } from '../../convex/lib/identity'
import { readyCharacterFixture } from './readyCharacter'

export const createCampaign = makeFunctionReference<
  'mutation',
  CreateCampaignInput,
  CampaignDetailDto
>('campaigns/create:create')

const createBlueprint = makeFunctionReference<
  'mutation',
  {
    gameSystemId: string
    name: string
    commandId: string
    enemies: { kind: 'CUSTOM'; label: string; maxHitPoints: number }[]
  },
  { id: string }
>('encounters/blueprints:create')
export const createRun = makeFunctionReference<
  'mutation',
  CreateEncounterInputDto,
  EncounterGmProjectionDto
>('encounters/runs:create')
export async function createEncounterSceneFixture(
  characterOptions: Parameters<typeof readyCharacterFixture>[0] = {}
) {
  const base = await readyCharacterFixture(characterOptions)
  const campaign = await base.other.caller.mutation(createCampaign, {
    name: 'Scene binding tests',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: campaign.id,
      userId: base.owner.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: campaign.createdAt,
      joinedAt: campaign.createdAt,
      leftAt: null
    })
  )
  const blueprint = await base.other.caller.mutation(createBlueprint, {
    gameSystemId: campaign.gameSystemId,
    name: 'Binding target',
    commandId: crypto.randomUUID(),
    enemies: [
      { kind: 'CUSTOM', label: 'Dummy', maxHitPoints: 1 },
      { kind: 'CUSTOM', label: 'Second dummy', maxHitPoints: 1 }
    ]
  })
  const run = await base.other.caller.mutation(createRun, {
    campaignId: campaign.id,
    blueprintId: blueprint.id,
    commandId: crypto.randomUUID()
  })
  const now = new Date().toISOString()
  const sceneId = crypto.randomUUID()
  const saveId = crypto.randomUUID()
  const tokens = [crypto.randomUUID(), crypto.randomUUID()].map(
    (id, ordinal): SceneDefinitionDto['tokens'][number] => ({
      id,
      assetId: null,
      controlledByUserIds: [],
      height: 1,
      hidden: false,
      label: `Token ${ordinal}`,
      locked: false,
      position: { x: ordinal, y: 0 },
      rotationDegrees: 0,
      senses: [],
      vision: null,
      width: 1
    })
  )
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        id: sceneId,
        definitionId: crypto.randomUUID(),
        definitionVersion: 1,
        definitionSaveId: saveId,
        version: 0,
        materializationCommandId: crypto.randomUUID(),
        materializationCommandFingerprint: '0'.repeat(64),
        campaignId: campaign.id,
        name: 'Bound Scene',
        ambientIllumination: 'BRIGHT',
        daylight: false,
        fogMode: 'PER_PLAYER',
        visionRevealMode: 'ON_DRAG',
        grid: { kind: 'GRIDLESS', pixelsPerUnit: 50, unit: 'FEET' },
        map: { assetId: crypto.randomUUID(), width: 64, height: 64, tileManifestAssetId: null },
        createdAt: now,
        updatedAt: now
      })
    )
    for (const [ordinal, entity] of tokens.entries()) {
      const value = { collection: 'tokens' as const, entity }
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId,
          entityId: entity.id,
          ordinal,
          value,
          checksum: checksumCanonicalJson(value)
        })
      )
    }
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: campaign.id,
        sceneId,
        version: 0,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
  })
  return { ...base, campaign, blueprint, run, sceneId, saveId, tokens }
}

/**
 * Runs the room's binding logic against Convex storage as the calling identity, fenced to the
 * Campaign's current presentation, so a test can start from a bound Run. Product binding is
 * room-only (D47).
 */
export async function bindPresentedScene(
  ctx: MutationCtx,
  input: BindEncounterToPresentedSceneInputDto
) {
  const readPresentation = (campaignId: string) =>
    ctx.db
      .query('campaignScenePresentations')
      .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
      .unique()
  const encounter = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId.toLowerCase()))
    .unique()
  const presentation = encounter ? await readPresentation(encounter.campaignId) : null
  return bindEncounterToPresentedScene(
    {
      db: createConvexEncounterStore(ctx),
      ports: {
        requireIdentity: () => requireIdentity(ctx),
        requireCampaignAuthority: (id, userId) => requireCampaignAuthority(ctx, id, userId)
      }
    },
    input,
    {
      sceneId: presentation?.sceneId ?? '',
      expectedPresentationVersion: presentation?.version ?? 0
    },
    {
      readPresentation,
      readScene: (sceneId) =>
        ctx.db
          .query('campaignScenes')
          .withIndex('by_publicId', (q) => q.eq('id', sceneId))
          .unique()
    }
  )
}

/** Publishes the fixture Scene's source save, which a room needs to read the presented Scene. */
export async function publishSceneSource(
  base: Awaited<ReturnType<typeof createEncounterSceneFixture>>
) {
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene.')
    const counts = {
      annotations: 0,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: base.tokens.length
    }
    await ctx.db.insert(
      'sceneDefinitionSaves',
      sceneStoredDefinitionSaveSchema.parse({
        id: base.saveId,
        commandId: scene.materializationCommandId,
        commandFingerprint: '0'.repeat(64),
        ownerUserId: base.other.userId,
        definitionId: scene.definitionId,
        expectedVersion: null,
        settings: {
          campaignId: scene.campaignId,
          name: scene.name,
          ambientIllumination: scene.ambientIllumination,
          daylight: scene.daylight,
          fogMode: scene.fogMode,
          visionRevealMode: scene.visionRevealMode,
          grid: scene.grid,
          map: scene.map
        },
        counts,
        received: counts,
        status: 'PUBLISHED',
        liveSceneId: scene.id,
        entitiesRemoved: false,
        createdAt: scene.createdAt,
        expiresAt: Date.now() + 60_000
      })
    )
  })
}
