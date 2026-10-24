import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { campaignLiveScenePresentationReceiptDtoSchema } from '@artificer-toolkit/schema/api/vttScenes'
import { vttMapStoredAssetSchema } from '@artificer-toolkit/schema/projections/vttMapPersistence'
import { campaignStoredEventSchema } from '@artificer-toolkit/schema/projections/campaignEventPersistence'
import {
  sceneStoredDefinitionEntitySchema,
  sceneStoredDefinitionSaveSchema,
  sceneStoredDefinitionSchema,
  sceneStoredInitialStateSchema,
  sceneStoredPresentationSchema
} from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { sceneStoredFogSaveSchema } from '@artificer-toolkit/schema/projections/sceneFogPersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { liveSceneHead } from '../../tests/fixtures/liveSceneToken'
import { components } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const removeFixtureState = makeFunctionReference<
  'mutation',
  { ownerUserId: string; campaignId: string },
  null
>('scenes/developmentScene:removeFixtureState')

async function setup() {
  const base = await fixture()
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    if (!profile) throw new Error('Missing fixture profile.')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: 'draft_123456abcdef@example.invalid' }
      }
    })
  })
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'Encounter execution fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  return { ...base, campaign }
}

function sceneSettings(campaignId: string) {
  return {
    campaignId,
    name: 'Fixture Scene',
    ambientIllumination: 'BRIGHT' as const,
    daylight: false,
    fogMode: 'PER_PLAYER' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: {
      kind: 'GRIDLESS' as const,
      pixelsPerUnit: 50,
      unit: 'FEET' as const
    },
    map: {
      assetId: crypto.randomUUID(),
      width: 100,
      height: 100,
      tileManifestAssetId: null
    }
  }
}

function save(ownerUserId: string, campaignId: string, definitionId: string = crypto.randomUUID()) {
  const now = new Date().toISOString()
  return sceneStoredDefinitionSaveSchema.parse({
    id: crypto.randomUUID(),
    commandId: crypto.randomUUID(),
    commandFingerprint: '0'.repeat(64),
    ownerUserId,
    definitionId,
    expectedVersion: null,
    settings: sceneSettings(campaignId),
    counts: {
      annotations: 1,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 0
    },
    received: {
      annotations: 1,
      barriers: 0,
      darknessZones: 0,
      lights: 0,
      tokens: 0
    },
    status: 'PUBLISHED',
    liveSceneId: crypto.randomUUID(),
    entitiesRemoved: false,
    createdAt: now,
    expiresAt: Date.now() + 60_000
  })
}

function map(ownerUserId: string, id: string) {
  return vttMapStoredAssetSchema.parse({
    id,
    ownerUserId,
    storageAssetId: id,
    profileClass: 'VTT_MAP',
    upload: {
      originalFileName: 'fixture-map.png',
      declaredMimeType: 'image/png',
      declaredBytes: 1,
      idempotencyKey: crypto.randomUUID()
    },
    status: 'READY',
    rawObjectKey: null,
    uploadExpiresAt: 0,
    chargedBytes: 3,
    contentHash: null,
    width: 100,
    height: 100,
    variants: [],
    operation: null,
    cleanupAt: null,
    hasSceneReferences: true
  })
}

async function seedOwnerScene(
  base: Awaited<ReturnType<typeof setup>>,
  initial = save(base.owner.userId, base.campaign.id),
  edited = save(base.owner.userId, base.campaign.id, initial.definitionId)
) {
  const now = new Date().toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert('mediaAssets', map(base.owner.userId, initial.settings.map.assetId))
    await ctx.db.insert('mediaAssets', map(base.owner.userId, edited.settings.map.assetId))
    for (const current of [initial, edited]) {
      await ctx.db.insert('sceneDefinitionSaves', current)
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          saveId: current.id,
          entityId: crypto.randomUUID(),
          ordinal: 0,
          value: {
            collection: 'annotations',
            entity: {
              id: crypto.randomUUID(),
              position: { x: 1, y: 1 },
              text: 'Fixture entity',
              visibility: 'GM_ONLY'
            }
          },
          checksum: '0'.repeat(64)
        })
      )
    }
    await ctx.db.insert(
      'sceneDefinitions',
      sceneStoredDefinitionSchema.parse({
        ...edited.settings,
        id: edited.definitionId,
        saveId: edited.id,
        version: 2,
        counts: edited.counts,
        createdAt: now,
        updatedAt: now
      })
    )
    await ctx.db.insert(
      'campaignScenes',
      sceneStoredInitialStateSchema.parse({
        ...initial.settings,
        id: initial.liveSceneId!,
        definitionId: initial.definitionId,
        definitionVersion: 1,
        definitionSaveId: initial.id,
        version: 0,
        materializationCommandId: initial.commandId,
        materializationCommandFingerprint: '0'.repeat(64),
        createdAt: now,
        updatedAt: now
      })
    )
  })
  return { initial, edited }
}

async function state(base: Awaited<ReturnType<typeof setup>>) {
  return base.t.run(async (ctx) => ({
    saves: await ctx.db.query('sceneDefinitionSaves').collect(),
    entities: await ctx.db.query('sceneDefinitionEntities').collect(),
    definitions: await ctx.db.query('sceneDefinitions').collect(),
    liveScenes: await ctx.db.query('campaignScenes').collect(),
    presentations: await ctx.db.query('campaignScenePresentations').collect(),
    receipts: await ctx.db.query('campaignEvents').collect()
  }))
}

async function seedPresentation(
  base: Awaited<ReturnType<typeof setup>>,
  sceneId: string,
  malformed = false,
  history: Array<string | null> = [sceneId]
) {
  const now = new Date().toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sceneId: history[history.length - 1],
        version: history.length - 1,
        activeMapAssetId: null,
        createdAt: now,
        updatedAt: now
      })
    )
    for (const [version, selectedSceneId] of history.entries()) {
      const commandId = crypto.randomUUID()
      const receipt = malformed
        ? {}
        : campaignLiveScenePresentationReceiptDtoSchema.parse({
            commandFingerprint: '0'.repeat(64),
            result: {
              commandId,
              replayed: false,
              campaignId: base.campaign.id,
              sceneId: selectedSceneId,
              version
            }
          })
      await ctx.db.insert(
        'campaignEvents',
        campaignStoredEventSchema.parse({
          ...encodeCampaignEvent({
            id: crypto.randomUUID(),
            campaignId: base.campaign.id,
            type: 'SESSION_SCENE_PRESENTATION_SET',
            visibility: 'TABLE',
            subjectCharacterId: null,
            payload: receipt,
            createdAt: now
          }),
          actorUserId: base.owner.userId,
          visibleInHistory: true,
          commandId,
          inputFingerprint: '0'.repeat(64)
        })
      )
    }
  })
}

async function seedFogSave(
  base: Awaited<ReturnType<typeof setup>>,
  sceneId: string,
  actorUserId: string
) {
  const input = {
    type: 'PATCH_SCENE_FOG' as const,
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    layer: { ownerUserId: null, width: 8, height: 8 },
    chunkManifest: []
  }
  const save = sceneStoredFogSaveSchema.parse({
    id: crypto.randomUUID(),
    sceneId,
    commandId: input.commandId,
    actorUserId,
    input,
    inputChecksum: checksumCanonicalJson(input),
    status: 'RECEIVING',
    receivedChunks: 0,
    expiresAt: Date.now() + 60_000,
    chunksRemoved: false
  })
  await base.t.run((ctx) => ctx.db.insert('sceneFogSaves', save))
}

it('cleans a stored live Scene head', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
  await base.t.run((ctx) =>
    ctx.db.insert('sceneLiveStates', liveSceneHead(sceneId, { version: 1 }))
  )
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await base.t.run((ctx) => ctx.db.query('sceneLiveStates').collect())).toEqual([])
  expect((await state(base)).liveScenes).toEqual([])
})

it.each([false, true])('removes exact presentation history ending cleared=%s', async (cleared) => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
  await seedPresentation(base, sceneId, false, cleared ? [sceneId, null] : [sceneId, null, sceneId])
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await state(base)).toEqual({
    saves: [],
    entities: [],
    definitions: [],
    liveScenes: [],
    presentations: [],
    receipts: []
  })
})

// The lifecycle proof presents Scenes five times and a sixth when its racing presentation lands after
// the binding, so cleanup must hold the whole history either way (RELIABILITY-13.T1).
it.each([6, 16])('removes a presentation history of %s changes', async (changes) => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
  await seedPresentation(
    base,
    sceneId,
    false,
    Array.from({ length: changes }, (_, index) => (index % 2 === 0 ? sceneId : null))
  )
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await state(base)).toEqual({
    saves: [],
    entities: [],
    definitions: [],
    liveScenes: [],
    presentations: [],
    receipts: []
  })
})

it('rejects a presentation history beyond sixteen changes without partial deletion', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
  await seedPresentation(
    base,
    sceneId,
    false,
    Array.from({ length: 17 }, (_, index) => (index % 2 === 0 ? sceneId : null))
  )
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('bounds or ownership mismatch')
  expect(await state(base)).toEqual(before)
})

it.each(['duplicate-version', 'foreign-scene', 'wrong-fingerprint'])(
  'rejects %s presentation history before deletion',
  async (kind) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    await seedPresentation(base, initial.liveSceneId!, false, [
      initial.liveSceneId!,
      null,
      initial.liveSceneId!
    ])
    await base.t.run(async (ctx) => {
      const receipts = await ctx.db
        .query('campaignEvents')
        .withIndex('by_campaignId_id', (q) => q.eq('campaignId', base.campaign.id))
        .take(4)
      const middle = receipts.find(
        (receipt) =>
          campaignLiveScenePresentationReceiptDtoSchema.parse(JSON.parse(receipt.payloadJson))
            .result.version === 1
      )!
      const value = campaignLiveScenePresentationReceiptDtoSchema.parse(
        JSON.parse(middle.payloadJson)
      )
      if (kind === 'duplicate-version') value.result.version = 0
      else if (kind === 'foreign-scene') value.result.sceneId = crypto.randomUUID()
      else value.commandFingerprint = '1'.repeat(64)
      await ctx.db.patch(middle._id, { payloadJson: JSON.stringify(value) })
    })
    const before = await state(base)
    await expect(
      base.t.mutation(removeFixtureState, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id
      })
    ).rejects.toThrow('presentation receipt')
    expect(await state(base)).toEqual(before)
  }
)

it('rejects retained Encounter bindings before removing Scene state', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const encounterId = crypto.randomUUID()
  const binding = await base.t.run(async (ctx) => {
    await ctx.db.insert('encounterRuns', {
      id: encounterId,
      campaignId: base.campaign.id,
      gameSystemId: base.campaign.gameSystemId,
      status: 'PREPARED',
      version: 0,
      stateJson: '{}',
      stateChecksum: '0'.repeat(64),
      createCommandId: crypto.randomUUID(),
      createCommandFingerprint: '0'.repeat(64),
      concentrationCasterCharacterIds: [],
      createdAt: base.campaign.createdAt,
      updatedAt: base.campaign.createdAt
    })
    return ctx.db.insert('encounterSceneBindings', {
      encounterId,
      campaignId: base.campaign.id,
      sceneId: initial.liveSceneId!,
      commandId: crypto.randomUUID(),
      commandFingerprint: '0'.repeat(64),
      createdAt: base.campaign.createdAt
    })
  })
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('retained Encounter bindings')
  expect(await state(base)).toEqual(before)
  expect(await base.t.run((ctx) => ctx.db.get(binding))).not.toBeNull()
})

it('removes initial and edited owner Scene saves and entities, then safely retries', async () => {
  const base = await setup()
  const { initial, edited } = await seedOwnerScene(base)
  await seedPresentation(base, initial.liveSceneId!)

  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await state(base)).toEqual({
    saves: [],
    entities: [],
    definitions: [],
    liveScenes: [],
    presentations: [],
    receipts: []
  })
  expect(
    await base.t.run(async (ctx) =>
      Promise.all(
        [initial.settings.map.assetId, edited.settings.map.assetId].map((assetId) =>
          ctx.db
            .query('mediaAssets')
            .withIndex('by_publicId', (q) => q.eq('id', assetId))
            .unique()
        )
      )
    )
  ).toEqual([
    expect.objectContaining({ hasSceneReferences: false }),
    expect.objectContaining({ hasSceneReferences: false })
  ])
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await state(base)).toEqual({
    saves: [],
    entities: [],
    definitions: [],
    liveScenes: [],
    presentations: [],
    receipts: []
  })
})

it('rejects a nonfixture account without deleting Scene state', async () => {
  const base = await setup()
  await seedOwnerScene(base)
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.owner.userId))
      .unique()
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile!.authUserId }],
        update: { email: 'owner@example.invalid' }
      }
    })
  })
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('Fixture account')
  expect(await state(base)).toEqual(before)
})

it('rejects a nonfixture or wrong-Campaign cleanup without deleting Scene state', async () => {
  const base = await setup()
  await seedOwnerScene(base)
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: crypto.randomUUID()
    })
  ).rejects.toThrow('missing')
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    await ctx.db.patch(campaign!._id, { name: 'Not a fixture' })
  })
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('ownership')
  expect(await state(base)).toEqual(before)
})

it('rejects foreign selected-save references without partial deletion', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  await base.t.run(async (ctx) => {
    const now = new Date().toISOString()
    await ctx.db.insert(
      'sceneDefinitions',
      sceneStoredDefinitionSchema.parse({
        ...initial.settings,
        campaignId: crypto.randomUUID(),
        id: initial.definitionId,
        saveId: initial.id,
        version: 1,
        counts: initial.counts,
        createdAt: now,
        updatedAt: now
      })
    )
  })
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('foreign reference')
  expect(await state(base)).toEqual(before)
})

it('rejects malformed native presentation receipts without partial deletion', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  await seedPresentation(base, initial.liveSceneId!, true)
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('presentation receipt')
  expect(await state(base)).toEqual(before)
})

it('rejects more than sixteen entities for one selected save without partial deletion', async () => {
  const base = await setup()
  await seedOwnerScene(base)
  const first = (await state(base)).entities[0]!
  const { _id, _creationTime, ...stored } = first
  await base.t.run(async (ctx) => {
    for (let index = 1; index <= 16; index++) {
      const entityId = crypto.randomUUID()
      await ctx.db.insert(
        'sceneDefinitionEntities',
        sceneStoredDefinitionEntitySchema.parse({
          ...stored,
          entityId,
          ordinal: index,
          value: {
            ...stored.value,
            entity: { ...stored.value.entity, id: entityId }
          }
        })
      )
    }
  })
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('foreign reference')
  expect(await state(base)).toEqual(before)
})

it('cleans fixture-player fog saves only after exact Campaign fixture validation', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  if (!initial.liveSceneId) throw new Error('Missing live Scene')
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'ACTIVE',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: null
    })
  )
  await seedFogSave(base, initial.liveSceneId, base.other.userId)
  const snapshot = async () => ({
    scene: await state(base),
    children: await base.t.run(async (ctx) => ({
      fogSaves: await ctx.db.query('sceneFogSaves').collect()
    }))
  })
  const before = await snapshot()
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('Fixture account')
  expect(await snapshot()).toEqual(before)
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!profile || !membership) throw new Error('Missing player fixture.')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: 'draft_abcdef123456@example.invalid' }
      }
    })
    await ctx.db.delete(membership._id)
  })
  const withoutMembership = await snapshot()
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('outside this Campaign')
  expect(await snapshot()).toEqual(withoutMembership)
  await base.t.run((ctx) =>
    ctx.db.insert('campaignMemberships', {
      campaignId: base.campaign.id,
      userId: base.other.userId,
      role: 'PLAYER',
      status: 'LEFT',
      accessStartedAt: base.campaign.createdAt,
      joinedAt: base.campaign.createdAt,
      leftAt: base.campaign.createdAt
    })
  )
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect((await snapshot()).children).toEqual({ fogSaves: [] })
  expect((await state(base)).liveScenes).toEqual([])
})

it('rejects oversized saves without partial deletion', async () => {
  const base = await setup()
  await base.t.run(async (ctx) => {
    for (let index = 0; index < 9; index++)
      await ctx.db.insert('sceneDefinitionSaves', save(base.owner.userId, base.campaign.id))
  })
  const before = await state(base)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('save bounds')
  expect(await state(base)).toEqual(before)
})

it.each([3, 4])(
  'allows three Scene definitions/live Scenes and rejects a fourth atomically',
  async (count) => {
    const base = await setup()
    for (let index = 0; index < count; index++) await seedOwnerScene(base)
    const before = await state(base)

    if (count === 4) {
      await expect(
        base.t.mutation(removeFixtureState, {
          ownerUserId: base.owner.userId,
          campaignId: base.campaign.id
        })
      ).rejects.toThrow('bounds or ownership mismatch')
      expect(await state(base)).toEqual(before)
      return
    }

    await base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
    expect(await state(base)).toEqual({
      saves: [],
      entities: [],
      definitions: [],
      liveScenes: [],
      presentations: [],
      receipts: []
    })
  }
)
