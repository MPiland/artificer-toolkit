import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { encodeCampaignEvent } from '@artificer-toolkit/schema/api/campaignEventTransport'
import type {
  SceneFogPatchInput,
  SceneFogAppendInput,
  SceneFogSaveProgress,
  SceneFogCommandResult
} from '@artificer-toolkit/schema/api/sceneFog'
import type { SceneGeometryCommandResult } from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneGeometryCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  campaignLiveScenePresentationReceiptDtoSchema,
  type SceneLiveCommandInputDto,
  type SceneCommandResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
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
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { sceneStoredGeometryCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { components, internal } from '../_generated/api'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const executeLiveCommand = makeFunctionReference<
  'mutation',
  { input: SceneLiveCommandInputDto },
  SceneCommandResultDto
>('scenes/commands:execute')
const removeFixtureState = makeFunctionReference<
  'mutation',
  { ownerUserId: string; campaignId: string },
  null
>('scenes/developmentScene:removeFixtureState')
const executeGeometry = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')

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
    fogMode: 'PER_PLAYER' as const,
    visionRevealMode: 'ON_DRAG' as const,
    grid: { kind: 'GRIDLESS' as const, pixelsPerUnit: 50, unit: 'FEET' as const },
    map: { assetId: crypto.randomUUID(), width: 100, height: 100, tileManifestAssetId: null }
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
    counts: { annotations: 1, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
    received: { annotations: 1, barriers: 0, darknessZones: 0, lights: 0, tokens: 0 },
    status: 'PUBLISHED',
    liveSceneId: crypto.randomUUID(),
    entitiesRemoved: false,
    createdAt: now,
    expiresAt: Date.now() + 60_000
  })
}

function map(ownerUserId: string, campaignId: string, id: string) {
  return vttMapStoredAssetSchema.parse({
    id,
    ownerUserId,
    profile: 'VTT_MAP',
    campaignId,
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
    width: 100,
    height: 100,
    variants: [],
    crop: null,
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
    await ctx.db.insert(
      'mediaAssets',
      map(base.owner.userId, base.campaign.id, initial.settings.map.assetId)
    )
    await ctx.db.insert(
      'mediaAssets',
      map(base.owner.userId, base.campaign.id, edited.settings.map.assetId)
    )
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
  const sessionId = crypto.randomUUID()
  const now = new Date().toISOString()
  await base.t.run(async (ctx) => {
    await ctx.db.insert(
      'campaignScenePresentations',
      sceneStoredPresentationSchema.parse({
        campaignId: base.campaign.id,
        sessionId,
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
            result: { commandId, replayed: false, sessionId, sceneId: selectedSceneId, version }
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

async function seedNonadvancingMovementReceipt(
  base: Awaited<ReturnType<typeof setup>>,
  sceneId: string,
  snapshotVersion: number
) {
  const commandId = crypto.randomUUID()
  const input = {
    type: 'MOVE_SCENE_TOKEN' as const,
    sceneId,
    commandId,
    expectedSceneVersion: snapshotVersion,
    expectedEncounterVersion: 0,
    correlationId: null,
    movementKind: 'VOLUNTARY' as const,
    tokenId: crypto.randomUUID(),
    path: [
      { x: 1, y: 1 },
      { x: 2, y: 1 }
    ]
  }
  const result = {
    sceneId,
    commandId,
    version: snapshotVersion,
    occurrence: {
      occurrenceId: crypto.randomUUID(),
      occurrenceVersion: 0,
      status: 'COMPLETE' as const,
      outcome: null,
      pending: null
    },
    replayed: false,
    delta: null,
    fogPatches: []
  }
  const save = sceneStoredGeometrySaveSchema.parse({
    id: crypto.randomUUID(),
    sceneId,
    commandId,
    actorUserId: base.owner.userId,
    input,
    inputChecksum: checksumCanonicalJson(input),
    snapshotVersion,
    status: 'PUBLISHED',
    expiresAt: Date.now() + 60_000,
    fogSaves: []
  })
  const receipt = sceneStoredGeometryCommandSchema.parse({
    encoding: 'GEOMETRY',
    sceneId,
    commandId,
    actorUserId: base.owner.userId,
    input,
    inputChecksum: checksumCanonicalJson(input),
    result,
    resultChecksum: checksumCanonicalJson(result)
  })
  await base.t.run(async (ctx) => {
    await ctx.db.insert('sceneGeometrySaves', save)
    await ctx.db.insert('sceneLiveCommands', receipt)
  })
  return { save, receipt }
}

it.each([false, true])(
  'cleans unchanged-version movement evidence with head=%s',
  async (withHead) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    const sceneId = initial.liveSceneId!
    if (withHead)
      await base.owner.caller.mutation(executeLiveCommand, {
        input: {
          type: 'UPSERT_SCENE_ANNOTATION',
          sceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: 0,
          annotation: {
            id: crypto.randomUUID(),
            position: { x: 1, y: 1 },
            text: 'Fixture annotation',
            visibility: 'GM_ONLY'
          }
        }
      })
    await seedNonadvancingMovementReceipt(base, sceneId, withHead ? 1 : 0)
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
      await base.t.run(async (ctx) => ({
        geometrySaves: await ctx.db.query('sceneGeometrySaves').collect(),
        commands: await ctx.db.query('sceneLiveCommands').collect(),
        heads: await ctx.db.query('sceneLiveStates').collect()
      }))
    ).toEqual({ geometrySaves: [], commands: [], heads: [] })
  },
  15_000
)

it.each(['missing', 'duplicate'] as const)(
  'rejects %s advancing Scene receipt history atomically',
  async (history) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    const sceneId = initial.liveSceneId!
    await base.owner.caller.mutation(executeLiveCommand, {
      input: {
        type: 'UPSERT_SCENE_ANNOTATION',
        sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        annotation: {
          id: crypto.randomUUID(),
          position: { x: 1, y: 1 },
          text: 'Fixture annotation',
          visibility: 'GM_ONLY'
        }
      }
    })
    if (history === 'duplicate')
      await base.owner.caller.mutation(executeLiveCommand, {
        input: {
          type: 'UPSERT_SCENE_ANNOTATION',
          sceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: 1,
          annotation: {
            id: crypto.randomUUID(),
            position: { x: 2, y: 1 },
            text: 'Fixture annotation two',
            visibility: 'GM_ONLY'
          }
        }
      })
    await base.t.run(async (ctx) => {
      const commands = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) => q.eq('sceneId', sceneId))
        .take(3)
      const command = commands[0]
      if (!command) throw new Error('Missing advancing Scene command.')
      if (history === 'missing') await ctx.db.delete(command._id)
      else {
        const later = commands.find((candidate) => candidate.input.expectedSceneVersion === 1)
        if (!later || later.encoding !== 'INLINE')
          throw new Error('Missing later advancing Scene command.')
        const input = { ...later.input, expectedSceneVersion: 0 }
        const result = { ...later.result, version: 1 }
        await ctx.db.patch(later._id, {
          input,
          inputChecksum: checksumCanonicalJson(input),
          result,
          resultChecksum: checksumCanonicalJson(result)
        })
      }
    })
    const before = await base.t.run(async (ctx) => ({
      commands: await ctx.db.query('sceneLiveCommands').collect(),
      heads: await ctx.db.query('sceneLiveStates').collect()
    }))
    await expect(
      base.t.mutation(removeFixtureState, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id
      })
    ).rejects.toThrow('live Scene command')
    expect(
      await base.t.run(async (ctx) => ({
        commands: await ctx.db.query('sceneLiveCommands').collect(),
        heads: await ctx.db.query('sceneLiveStates').collect()
      }))
    ).toEqual(before)
  }
)

it.each(['receipt', 'parent', 'missing-parent'] as const)(
  'rejects a %s unchanged-version movement receipt atomically',
  async (damage) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    const sceneId = initial.liveSceneId!
    const { save, receipt } = await seedNonadvancingMovementReceipt(base, sceneId, 0)
    await base.t.run(async (ctx) => {
      if (damage === 'receipt') {
        const row = await ctx.db
          .query('sceneLiveCommands')
          .withIndex('by_sceneId_commandId', (q) =>
            q.eq('sceneId', sceneId).eq('commandId', receipt.commandId)
          )
          .unique()
        if (!row) throw new Error('Missing geometry receipt.')
        await ctx.db.patch(row._id, { resultChecksum: 'f'.repeat(64) })
      } else if (damage === 'parent') {
        const row = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', save.id))
          .unique()
        if (!row) throw new Error('Missing geometry parent.')
        await ctx.db.patch(row._id, { inputChecksum: 'f'.repeat(64) })
      } else {
        const row = await ctx.db
          .query('sceneGeometrySaves')
          .withIndex('by_publicId', (q) => q.eq('id', save.id))
          .unique()
        if (!row) throw new Error('Missing geometry parent.')
        await ctx.db.delete(row._id)
      }
    })
    const before = await base.t.run(async (ctx) => ({
      saves: await ctx.db.query('sceneGeometrySaves').collect(),
      commands: await ctx.db.query('sceneLiveCommands').collect()
    }))
    await expect(
      base.t.mutation(removeFixtureState, {
        ownerUserId: base.owner.userId,
        campaignId: base.campaign.id
      })
    ).rejects.toThrow('geometry')
    expect(
      await base.t.run(async (ctx) => ({
        saves: await ctx.db.query('sceneGeometrySaves').collect(),
        commands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    ).toEqual(before)
  }
)

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
  const binding = await base.t.run((ctx) =>
    ctx.db.insert('encounterSceneBindings', {
      encounterId: crypto.randomUUID(),
      campaignId: base.campaign.id,
      sceneId: initial.liveSceneId!,
      commandId: crypto.randomUUID(),
      commandFingerprint: '0'.repeat(64),
      createdAt: base.campaign.createdAt
    })
  )
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
          value: { ...stored.value, entity: { ...stored.value.entity, id: entityId } }
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

it('cleans fixture-player measurement receipts only after exact Campaign fixture validation', async () => {
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
  await base.other.caller.mutation(executeLiveCommand, {
    input: {
      type: 'UPSERT_SCENE_MEASUREMENT',
      sceneId: initial.liveSceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      measurement: {
        id: crypto.randomUUID(),
        createdByUserId: base.other.userId,
        label: 'Player distance',
        path: [
          { x: 0, y: 0 },
          { x: 10, y: 10 }
        ]
      }
    }
  })
  const snapshot = async () => ({
    scene: await state(base),
    children: await base.t.run(async (ctx) => ({
      heads: await ctx.db.query('sceneLiveStates').collect(),
      entities: await ctx.db.query('sceneLiveEntities').collect(),
      commands: await ctx.db.query('sceneLiveCommands').collect()
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
  expect((await snapshot()).children).toEqual({ heads: [], entities: [], commands: [] })
  expect((await state(base)).liveScenes).toEqual([])
})

it.each([1, 17])(
  'cleans bounded live entity children or rejects an oversized %i-command fixture atomically',
  async (count) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    if (!initial.liveSceneId) throw new Error('Missing live Scene')
    for (let version = 0; version < count; version++) {
      await base.owner.caller.mutation(executeLiveCommand, {
        input: {
          type: 'UPSERT_SCENE_ANNOTATION',
          sceneId: initial.liveSceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: version,
          annotation: {
            id: crypto.randomUUID(),
            position: { x: 1, y: 1 },
            text: 'Live note',
            visibility: 'GM_ONLY'
          }
        }
      })
    }
    await base.owner.caller.mutation(executeLiveCommand, {
      input: {
        type: 'SET_SCENE_VISION_REVEAL_MODE',
        sceneId: initial.liveSceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: count,
        mode: 'ON_DROP'
      }
    })
    const children = () =>
      base.t.run(async (ctx) => ({
        states: await ctx.db.query('sceneLiveStates').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect(),
        commands: await ctx.db.query('sceneLiveCommands').collect()
      }))
    const before = { scene: await state(base), children: await children() }
    const removal = base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
    if (count > 16) {
      await expect(removal).rejects.toThrow('live Scene command bounds')
      expect({ scene: await state(base), children: await children() }).toEqual(before)
    } else {
      await removal
      expect(await children()).toEqual({ states: [], entities: [], commands: [] })
      expect((await state(base)).liveScenes).toEqual([])
    }
  }
)

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

it('validates fog upload ownership before removing all fixture fog history and supports cleanup retry', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
  const begin = makeFunctionReference<
    'mutation',
    { input: SceneFogPatchInput },
    SceneFogSaveProgress
  >('scenes/fogCommands:begin')
  const append = makeFunctionReference<
    'mutation',
    { input: SceneFogAppendInput },
    SceneFogSaveProgress
  >('scenes/fogCommands:append')
  const publish = makeFunctionReference<'mutation', { saveId: string }, SceneFogCommandResult>(
    'scenes/fogCommands:publish'
  )
  const chunk = { index: 0, x: 0, y: 0, width: 1, height: 1, data: 'AA==' }
  const upload = await base.owner.caller.mutation(begin, {
    input: {
      type: 'PATCH_SCENE_FOG',
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      layer: { ownerUserId: null, width: 8, height: 8 },
      chunkManifest: [{ index: chunk.index, checksum: checksumCanonicalJson(chunk) }]
    }
  })
  await base.owner.caller.mutation(append, {
    input: { saveId: upload.saveId, offset: 0, chunks: [chunk] }
  })
  await base.owner.caller.mutation(publish, { saveId: upload.saveId })
  const children = () =>
    base.t.run(async (ctx) => ({
      saves: await ctx.db.query('sceneFogSaves').collect(),
      chunks: await ctx.db.query('sceneFogChunks').collect(),
      layers: await ctx.db.query('sceneFogLayers').collect(),
      heads: await ctx.db.query('sceneLiveStates').collect(),
      commands: await ctx.db.query('sceneLiveCommands').collect()
    }))
  const fogSave = (await children()).saves[0]!
  await base.t.run((ctx) => ctx.db.patch(fogSave._id, { actorUserId: base.other.userId }))
  const before = { scene: await state(base), children: await children() }
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('fog ownership')
  expect({ scene: await state(base), children: await children() }).toEqual(before)
  await base.t.run((ctx) => ctx.db.patch(fogSave._id, { actorUserId: base.owner.userId }))
  const layer = (await children()).layers[0]!
  const { _id, _creationTime, checksum, ...content } = layer
  const foreignReferences = layer.chunks.map((reference) => ({
    ...reference,
    saveId: crypto.randomUUID()
  }))
  await base.t.run((ctx) =>
    ctx.db.patch(layer._id, {
      chunks: foreignReferences,
      checksum: checksumCanonicalJson({ ...content, chunks: foreignReferences })
    })
  )
  const foreignState = { scene: await state(base), children: await children() }
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('fog reference')
  expect({ scene: await state(base), children: await children() }).toEqual(foreignState)
  await base.t.run((ctx) => ctx.db.patch(layer._id, { chunks: layer.chunks, checksum }))
  for (let retry = 0; retry < 2; retry++)
    await base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  expect(await children()).toEqual({ saves: [], chunks: [], layers: [], heads: [], commands: [] })
  expect(await state(base)).toEqual({
    saves: [],
    entities: [],
    definitions: [],
    liveScenes: [],
    presentations: [],
    receipts: []
  })
})

it.each(['RECEIVING', 'PUBLISHED'] as const)(
  'handles a derived fog save whose geometry parent is missing (%s)',
  async (status) => {
    const base = await setup()
    const { initial } = await seedOwnerScene(base)
    const sceneId = initial.liveSceneId!
    const geometrySaveId = crypto.randomUUID()
    const input = {
      type: 'PATCH_SCENE_FOG' as const,
      sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      layer: { ownerUserId: null, width: 8, height: 8 },
      chunkManifest: []
    }
    const fogSave = sceneStoredFogSaveSchema.parse({
      id: crypto.randomUUID(),
      sceneId,
      commandId: input.commandId,
      actorUserId: base.owner.userId,
      geometrySaveId,
      input,
      inputChecksum: checksumCanonicalJson(input),
      status,
      receivedChunks: 0,
      expiresAt: Date.now() + 60_000,
      chunksRemoved: false
    })
    await base.t.run((ctx) => ctx.db.insert('sceneFogSaves', fogSave))
    const before = await state(base)
    const remove = base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
    if (status === 'PUBLISHED') {
      await expect(remove).rejects.toThrow('published geometry fog parent')
      expect(await state(base)).toEqual(before)
    } else {
      await remove
      expect(await base.t.run((ctx) => ctx.db.query('sceneFogSaves').collect())).toEqual([])
    }
  }
)

it('cleans staged and published fixture-player MOVE geometry with its derived fog', async () => {
  const base = await setup()
  const { initial } = await seedOwnerScene(base)
  const sceneId = initial.liveSceneId!
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
  const createToken = async (id: string) =>
    base.owner.caller.action(executeGeometry, {
      input: {
        sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        type: 'UPSERT_SCENE_TOKEN',
        token: {
          assetId: null,
          controlledByUserIds: [base.other.userId],
          height: 1,
          hidden: false,
          id,
          label: 'Fixture token',
          locked: false,
          position: { x: 50, y: 50 },
          rotationDegrees: 0,
          vision: {
            angleDegrees: 360,
            brightRange: 10,
            dimRange: 20,
            directionDegrees: 0,
            enabled: true
          },
          width: 1
        }
      }
    })
  const move = (tokenId: string) => ({
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 1,
    type: 'MOVE_SCENE_TOKEN' as const,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY' as const,
    tokenId,
    path: [
      { x: 50, y: 50 },
      { x: 60, y: 50 }
    ]
  })
  const children = () =>
    base.t.run(async (ctx) => ({
      geometrySaves: await ctx.db.query('sceneGeometrySaves').collect(),
      fogSaves: await ctx.db.query('sceneFogSaves').collect(),
      commands: await ctx.db.query('sceneLiveCommands').collect(),
      heads: await ctx.db.query('sceneLiveStates').collect()
    }))
  const firstTokenId = crypto.randomUUID()
  await createToken(firstTokenId)
  const staged = await base.other.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: move(firstTokenId)
  })
  expect(staged.kind).toBe('READY')
  const partial = await children()
  expect(partial.geometrySaves).toHaveLength(2)
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('Fixture account')
  expect(await children()).toEqual(partial)
  await base.t.run(async (ctx) => {
    const profile = await ctx.db
      .query('userProfiles')
      .withIndex('by_userId', (q) => q.eq('userId', base.other.userId))
      .unique()
    if (!profile) throw new Error('Missing player profile.')
    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [{ field: '_id', value: profile.authUserId }],
        update: { email: 'draft_abcdef123456@example.invalid' }
      }
    })
  })
  const membership = await base.t.run((ctx) =>
    ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
  )
  if (!membership) throw new Error('Missing player membership.')
  await base.t.run((ctx) => ctx.db.delete(membership._id))
  await expect(
    base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  ).rejects.toThrow('outside this Campaign')
  expect(await children()).toEqual(partial)
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
  await base.t.mutation(removeFixtureState, {
    ownerUserId: base.owner.userId,
    campaignId: base.campaign.id
  })
  expect(await children()).toEqual({ geometrySaves: [], fogSaves: [], commands: [], heads: [] })

  const { initial: retried } = await seedOwnerScene(base)
  const retriedSceneId = retried.liveSceneId!
  const secondTokenId = crypto.randomUUID()
  await base.owner.caller.action(executeGeometry, {
    input: {
      sceneId: retriedSceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'UPSERT_SCENE_TOKEN',
      token: {
        assetId: null,
        controlledByUserIds: [base.other.userId],
        height: 1,
        hidden: false,
        id: secondTokenId,
        label: 'Fixture token',
        locked: false,
        position: { x: 50, y: 50 },
        rotationDegrees: 0,
        vision: {
          angleDegrees: 360,
          brightRange: 10,
          dimRange: 20,
          directionDegrees: 0,
          enabled: true
        },
        width: 1
      }
    }
  })
  const publishedStaging = await base.other.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: { ...move(secondTokenId), sceneId: retriedSceneId }
  })
  if (publishedStaging.kind !== 'READY') throw new Error('Expected staged player movement.')
  const playerFog = await base.t.run(async (ctx) => {
    const layer = await ctx.db
      .query('sceneFogLayers')
      .withIndex('by_sceneId_ownerUserId', (q) =>
        q.eq('sceneId', retriedSceneId).eq('ownerUserId', base.other.userId)
      )
      .unique()
    if (!layer) return null
    const chunks = []
    for (const reference of layer.chunks) {
      const row = await ctx.db
        .query('sceneFogChunks')
        .withIndex('by_saveId_ordinal', (q) =>
          q.eq('saveId', reference.saveId).eq('ordinal', reference.ordinal)
        )
        .unique()
      if (!row) throw new Error('Missing player fog chunk.')
      chunks.push(row.chunk)
    }
    return { width: layer.width, height: layer.height, chunks }
  })
  if (!playerFog) throw new Error('Missing player fog layer.')
  await base.other.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: publishedStaging.saveId,
    layer: {
      ownerUserId: base.other.userId,
      width: playerFog.width,
      height: playerFog.height,
      chunks: playerFog.chunks
    }
  })
  const publishedMove = await base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
    saveId: publishedStaging.saveId,
    baseOrdinal: 0
  })
  expect(publishedMove.version).toBe(2)
  expect((await children()).geometrySaves).toHaveLength(2)
  expect((await children()).fogSaves).toHaveLength(2)
  for (let retry = 0; retry < 2; retry++)
    await base.t.mutation(removeFixtureState, {
      ownerUserId: base.owner.userId,
      campaignId: base.campaign.id
    })
  expect(await children()).toEqual({ geometrySaves: [], fogSaves: [], commands: [], heads: [] })
})
