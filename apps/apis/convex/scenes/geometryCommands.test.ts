import { makeFunctionReference } from 'convex/server'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  AppendSceneDefinitionInput,
  BeginSceneDefinitionInput,
  SceneDefinitionSaveProgress
} from '@artificer-toolkit/schema/api/sceneDefinitionSave'
import type {
  SceneGeometryCommandResult,
  SceneGeometryExecuteInput,
  SceneNativeGeometryCommandInput,
  SceneGeometryPage,
  SceneGeometryPageInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneFogAppendInput,
  SceneFogChunksPage,
  SceneFogPatchInput,
  SceneFogSaveProgress,
  SceneFogCommandResult
} from '@artificer-toolkit/schema/api/sceneFog'
import type {
  SceneGeometryCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneBarrier,
  SceneFogChunk,
  SceneFogLayer,
  SceneToken
} from '@artificer-toolkit/shared/vtt/scene'
import {
  canonicalizeSceneFogLayer,
  canLightPassBetween,
  canMoveBetween,
  deriveSceneCommandExplorationDeltas,
  measureSceneDistance
} from '@artificer-toolkit/shared/vtt'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { api, internal } from '../_generated/api'

afterEach(() => vi.useRealTimers())

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
const execute = makeFunctionReference<
  'action',
  { input: SceneGeometryCommandInputDto },
  SceneGeometryCommandResult
>('scenes/geometryActions:execute')
const fastExecute = makeFunctionReference<
  'mutation',
  SceneGeometryExecuteInput,
  SceneGeometryCommandResult
>('scenes/geometryFastCommands:execute')
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const commandChunks = makeFunctionReference<
  'query',
  {
    sceneId: string
    commandId: string
    ownerUserId: string | null
    offset: number
    numItems: number
  },
  { page: SceneFogChunk[]; isDone: boolean; nextOffset: number }
>('scenes/geometryReads:commandChunks')
const fogBegin = makeFunctionReference<
  'mutation',
  { input: SceneFogPatchInput },
  SceneFogSaveProgress
>('scenes/fogCommands:begin')
const fogAppend = makeFunctionReference<
  'mutation',
  { input: SceneFogAppendInput },
  SceneFogSaveProgress
>('scenes/fogCommands:append')
const fogPublish = makeFunctionReference<'mutation', { saveId: string }, SceneFogCommandResult>(
  'scenes/fogCommands:publish'
)
const fogChunks = makeFunctionReference<
  'query',
  {
    sceneId: string
    ownerUserId: string | null
    expectedVersion: number
    offset: number
    numItems: number
  },
  SceneFogChunksPage
>('scenes/fogReads:chunks')

const derivedLayer: SceneFogLayer = {
  ownerUserId: null,
  width: 1,
  height: 1,
  chunks: [{ index: 0, x: 0, y: 0, width: 1, height: 1, data: 'AQ==' }]
}

type MovementInput = Extract<SceneNativeGeometryCommandInput, { type: 'MOVE_SCENE_TOKEN' }>

const token = (id: string = crypto.randomUUID()): SceneToken => ({
  assetId: null,
  controlledByUserIds: [],
  height: 1,
  hidden: false,
  id,
  label: 'Token',
  locked: false,
  position: { x: 10, y: 20 },
  rotationDegrees: 0,
  vision: null,
  width: 1
})

const door = (id: string = crypto.randomUUID()): SceneBarrier => ({
  a: { x: 0, y: 0 },
  b: { x: 10, y: 0 },
  blocksLightWhenClosed: true,
  blocksMovementWhenClosed: true,
  id,
  initialState: 'CLOSED',
  kind: 'DOOR',
  openAngleDegrees: 90
})

async function published(
  base: Awaited<ReturnType<typeof createSceneDefinitionFixture>>,
  tokens: SceneToken[] = [],
  barriers: SceneBarrier[] = []
) {
  const save = await base.owner.caller.mutation(begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: tokens.length, barriers: barriers.length }
  })
  for (let offset = 0; offset < tokens.length; offset += 8)
    await base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        offset,
        collection: 'tokens',
        entities: tokens.slice(offset, offset + 8)
      }
    })
  for (let offset = 0; offset < barriers.length; offset += 8)
    await base.owner.caller.mutation(append, {
      input: {
        saveId: save.saveId,
        offset,
        collection: 'barriers',
        entities: barriers.slice(offset, offset + 8)
      }
    })
  await base.owner.caller.mutation(publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene')
  return { save, sceneId: save.liveSceneId }
}

it('commits a compact no-vision door command in one mutation with exact replay semantics', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const scene = await published(base, [], [initialDoor])
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'SET_SCENE_DOOR_STATE',
    barrierId: initialDoor.id,
    state: 'OPEN'
  }

  await expect(base.other.caller.mutation(fastExecute, { input })).rejects.toThrow('owner')
  const committed = await base.owner.caller.mutation(fastExecute, { input })
  expect(committed).toMatchObject({
    version: 1,
    replayed: false,
    delta: { kind: 'DOOR_STATE_SET', barrierId: initialDoor.id, state: 'OPEN' },
    fogPatches: []
  })
  await expect(base.owner.caller.mutation(fastExecute, { input })).resolves.toEqual({
    ...committed,
    replayed: true
  })
  await expect(
    base.owner.caller.mutation(fastExecute, { input: { ...input, state: 'CLOSED' } })
  ).rejects.toThrow('already used')
  await expect(
    base.owner.caller.mutation(fastExecute, {
      input: { ...input, commandId: crypto.randomUUID(), state: 'CLOSED' }
    })
  ).rejects.toThrow('target changed')

  await base.t.run(async (ctx) => {
    const saves = await ctx.db.query('sceneGeometrySaves').collect()
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({
      status: 'PUBLISHED',
      commandId: input.commandId,
      inputChecksum: checksumCanonicalJson(input),
      snapshotVersion: 0,
      fogSaves: []
    })
    const heads = await ctx.db.query('sceneLiveStates').collect()
    expect(heads).toHaveLength(1)
    expect(heads).toMatchObject([{ sceneId: scene.sceneId, version: 1 }])
    const entities = await ctx.db.query('sceneLiveEntities').collect()
    expect(entities).toHaveLength(1)
    expect(entities).toMatchObject([
      {
        sceneId: scene.sceneId,
        collection: 'barriers',
        entityId: initialDoor.id,
        doorState: 'OPEN',
        ordinal: 0,
        version: 1
      }
    ])
    const entity = entities[0]!
    expect(entity.checksum).toBe(
      checksumCanonicalJson({
        sceneId: entity.sceneId,
        collection: entity.collection,
        entityId: entity.entityId,
        value: entity.value,
        doorState: entity.doorState,
        ordinal: entity.ordinal,
        version: entity.version
      })
    )
    const commands = await ctx.db.query('sceneLiveCommands').collect()
    expect(commands).toHaveLength(1)
    expect(commands).toMatchObject([
      {
        encoding: 'GEOMETRY',
        sceneId: scene.sceneId,
        commandId: input.commandId,
        inputChecksum: checksumCanonicalJson(input),
        result: committed,
        resultChecksum: checksumCanonicalJson(committed)
      }
    ])
  })
}, 20_000)

it('validates current presentation and owner before replaying ahead of fast eligibility', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const scene = await published(base, [], [initialDoor])
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
  const request: SceneGeometryExecuteInput = {
    input: {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'SET_SCENE_DOOR_STATE',
      barrierId: initialDoor.id,
      state: 'OPEN'
    },
    presentation: { expectedPresentationVersion: presentation.version }
  }

  await expect(
    base.owner.caller.mutation(fastExecute, {
      ...request,
      presentation: { expectedPresentationVersion: presentation.version + 1 }
    })
  ).rejects.toThrow('presentation is stale')
  const committed = await base.owner.caller.mutation(fastExecute, request)
  await base.t.run((ctx) =>
    ctx.db.insert('encounterSceneBindings', {
      encounterId: crypto.randomUUID(),
      campaignId: base.campaign.id,
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: checksumCanonicalJson({ sceneId: scene.sceneId }),
      createdAt: new Date().toISOString()
    })
  )
  await expect(base.owner.caller.mutation(fastExecute, request)).resolves.toEqual({
    ...committed,
    replayed: true
  })

  const cleared = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: presentation.version,
    campaignId: base.campaign.id,
    sceneId: null
  })
  await expect(
    base.owner.caller.mutation(fastExecute, {
      ...request,
      presentation: { expectedPresentationVersion: cleared.version }
    })
  ).rejects.toThrow('presentation is stale')
  const restored = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: cleared.version,
    campaignId: base.campaign.id,
    sceneId: scene.sceneId
  })
  const currentRequest: SceneGeometryExecuteInput = {
    ...request,
    presentation: { expectedPresentationVersion: restored.version }
  }
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const nextOwner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    const priorOwner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    if (!campaign || !nextOwner || !priorOwner) throw new Error('Missing transfer fixture.')
    await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
    await ctx.db.patch(nextOwner._id, { role: 'OWNER' })
    await ctx.db.patch(priorOwner._id, { role: 'PLAYER' })
  })
  await expect(base.owner.caller.mutation(fastExecute, currentRequest)).rejects.toThrow('owner')
  await expect(base.other.caller.mutation(fastExecute, currentRequest)).resolves.toEqual({
    ...committed,
    replayed: true
  })
}, 20_000)

it('leaves an existing receiving save for staged completion', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const scene = await published(base, [], [initialDoor])
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'SET_SCENE_DOOR_STATE',
    barrierId: initialDoor.id,
    state: 'OPEN'
  }
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  expect(staged).toMatchObject({ kind: 'READY' })

  await expect(base.owner.caller.mutation(fastExecute, { input })).rejects.toMatchObject({
    data: 'SCENE_GEOMETRY_STAGED_REQUIRED'
  })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneGeometrySaves').collect()).toMatchObject([
      { status: 'RECEIVING', commandId: input.commandId }
    ])
    expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
  })
}, 20_000)
it('rolls back the fast mutation and uses staged geometry when token vision is affected', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const visible: SceneToken = {
    ...token(),
    controlledByUserIds: [base.owner.userId],
    vision: {
      enabled: true,
      brightRange: 30,
      dimRange: 60,
      angleDegrees: 360,
      directionDegrees: 0
    }
  }
  const scene = await published(base, [visible], [initialDoor])
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'SET_SCENE_DOOR_STATE',
    barrierId: initialDoor.id,
    state: 'OPEN'
  }

  await expect(base.owner.caller.mutation(fastExecute, { input })).rejects.toMatchObject({
    data: 'SCENE_GEOMETRY_STAGED_REQUIRED'
  })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneGeometrySaves').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
  })
  await expect(base.owner.caller.action(execute, { input })).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'DOOR_STATE_SET', barrierId: initialDoor.id, state: 'OPEN' },
    fogPatches: [{ ownerUserId: base.owner.userId, mode: 'REPLACE' }]
  })
}, 20_000)

it('rolls back the fast mutation and uses staged geometry for any Encounter Scene binding', async () => {
  const base = await createSceneDefinitionFixture()
  const initialDoor = door()
  const scene = await published(base, [], [initialDoor])
  await base.t.run((ctx) =>
    ctx.db.insert('encounterSceneBindings', {
      encounterId: crypto.randomUUID(),
      campaignId: base.campaign.id,
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      commandFingerprint: checksumCanonicalJson({ sceneId: scene.sceneId }),
      createdAt: new Date().toISOString()
    })
  )
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'SET_SCENE_DOOR_STATE',
    barrierId: initialDoor.id,
    state: 'OPEN'
  }

  await expect(base.owner.caller.mutation(fastExecute, { input })).rejects.toMatchObject({
    data: 'SCENE_GEOMETRY_STAGED_REQUIRED'
  })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneGeometrySaves').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
  })
  await expect(base.owner.caller.action(execute, { input })).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'DOOR_STATE_SET', barrierId: initialDoor.id, state: 'OPEN' },
    fogPatches: []
  })
}, 20_000)

it('commits a bounded standalone token move with exact replay and stored records', async () => {
  const base = await createSceneDefinitionFixture()
  const moving = {
    ...token(),
    controlledByUserIds: [base.other.userId]
  }
  const scene = await published(base, [moving])
  const input: MovementInput = {
    type: 'MOVE_SCENE_TOKEN',
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    tokenId: moving.id,
    path: [moving.position, { x: 40, y: 20 }]
  }

  const committed = await base.other.caller.mutation(fastExecute, { input })
  expect(committed).toEqual({
    sceneId: scene.sceneId,
    commandId: input.commandId,
    version: 1,
    occurrence: null,
    replayed: false,
    delta: { kind: 'TOKEN_MOVED', tokenId: moving.id, position: { x: 40, y: 20 } },
    fogPatches: []
  })
  await expect(base.other.caller.mutation(fastExecute, { input })).resolves.toEqual({
    ...committed,
    replayed: true
  })
  await expect(
    base.other.caller.mutation(fastExecute, {
      input: { ...input, path: [moving.position, { x: 50, y: 20 }] }
    })
  ).rejects.toThrow('already used')
  await expect(
    base.other.caller.mutation(fastExecute, {
      input: {
        ...input,
        commandId: crypto.randomUUID(),
        path: [
          { x: 40, y: 20 },
          { x: 50, y: 20 }
        ]
      }
    })
  ).rejects.toThrow('target changed')

  await base.t.run(async (ctx) => {
    const saves = await ctx.db.query('sceneGeometrySaves').collect()
    expect(saves).toHaveLength(1)
    expect(saves[0]).toMatchObject({
      actorUserId: base.other.userId,
      commandId: input.commandId,
      inputChecksum: checksumCanonicalJson(input),
      snapshotVersion: 0,
      status: 'PUBLISHED',
      fogSaves: []
    })
    expect(await ctx.db.query('sceneLiveStates').collect()).toMatchObject([
      { sceneId: scene.sceneId, version: 1 }
    ])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toMatchObject([
      {
        sceneId: scene.sceneId,
        collection: 'tokens',
        entityId: moving.id,
        ordinal: 0,
        version: 1,
        value: { entity: { position: { x: 40, y: 20 } } }
      }
    ])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toMatchObject([
      {
        encoding: 'GEOMETRY',
        actorUserId: base.other.userId,
        commandId: input.commandId,
        inputChecksum: checksumCanonicalJson(input),
        result: committed,
        resultChecksum: checksumCanonicalJson(committed)
      }
    ])
    expect(await ctx.db.query('sceneFogLayers').collect()).toEqual([])

    const membership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!membership) throw new Error('Missing movement membership.')
    await ctx.db.patch(membership._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(base.other.caller.mutation(fastExecute, { input })).rejects.toThrow(
    'Campaign not found'
  )
}, 20_000)

it('allows the owner to move an unlocked hidden token without a controller', async () => {
  const base = await createSceneDefinitionFixture()
  const moving = { ...token(), hidden: true }
  const scene = await published(base, [moving])
  const input: MovementInput = {
    type: 'MOVE_SCENE_TOKEN',
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    tokenId: moving.id,
    path: [moving.position, { x: 40, y: 20 }]
  }

  await expect(base.owner.caller.mutation(fastExecute, { input })).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: moving.id, position: { x: 40, y: 20 } },
    fogPatches: []
  })
}, 20_000)

it.each(['locked', 'uncontrolled'] as const)(
  'rejects fast movement of a %s token without writing',
  async (kind) => {
    const base = await createSceneDefinitionFixture()
    const moving = {
      ...token(),
      controlledByUserIds: [base.owner.userId, base.other.userId],
      locked: kind === 'locked'
    }
    if (kind === 'uncontrolled') moving.controlledByUserIds = [base.owner.userId]
    const scene = await published(base, [moving])
    const input: MovementInput = {
      type: 'MOVE_SCENE_TOKEN',
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId: moving.id,
      path: [moving.position, { x: 40, y: 20 }]
    }

    await expect(base.other.caller.mutation(fastExecute, { input })).rejects.toThrow(
      kind === 'locked' ? 'missing or locked' : 'control'
    )
    await base.t.run(async (ctx) => {
      expect(await ctx.db.query('sceneGeometrySaves').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
    })
  },
  20_000
)

it.each(['origin', 'bounds', 'barrier', 'zero'] as const)(
  'rejects a fast movement with an invalid %s path and rolls back',
  async (kind) => {
    const base = await createSceneDefinitionFixture()
    const moving = { ...token(), controlledByUserIds: [base.other.userId] }
    const blocking: SceneBarrier = {
      id: crypto.randomUUID(),
      kind: 'WALL',
      a: { x: 25, y: 0 },
      b: { x: 25, y: 100 },
      blocksLight: true,
      blocksMovement: true
    }
    const scene = await published(base, [moving], kind === 'barrier' ? [blocking] : [])
    const path =
      kind === 'origin'
        ? [
            { x: 11, y: 20 },
            { x: 40, y: 20 }
          ]
        : kind === 'bounds'
          ? [moving.position, { x: base.input.settings.map.width + 1, y: 20 }]
          : kind === 'zero'
            ? [moving.position, moving.position]
            : [moving.position, { x: 40, y: 20 }]
    const input: MovementInput = {
      type: 'MOVE_SCENE_TOKEN',
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      expectedEncounterVersion: null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId: moving.id,
      path
    }

    await expect(base.other.caller.mutation(fastExecute, { input })).rejects.toThrow()
    await base.t.run(async (ctx) => {
      expect(await ctx.db.query('sceneGeometrySaves').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
    })
  },
  20_000
)

it.each(['vision', 'bound', 'encounter', 'over-limit', 'receiving'] as const)(
  'requires staged movement for %s without partial fast writes',
  async (kind) => {
    const base = await createSceneDefinitionFixture()
    const moving: SceneToken = {
      ...token(),
      controlledByUserIds: [base.other.userId],
      vision:
        kind === 'vision'
          ? {
              enabled: true,
              brightRange: 30,
              dimRange: 60,
              angleDegrees: 360,
              directionDegrees: 0
            }
          : null
    }
    const tokens =
      kind === 'over-limit'
        ? [
            moving,
            ...Array.from({ length: 16 }, (_, index) => ({
              ...token(),
              position: { x: 60 + index * 10, y: 60 }
            }))
          ]
        : [moving]
    const scene = await published(base, tokens)
    const input: MovementInput = {
      type: 'MOVE_SCENE_TOKEN',
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      expectedEncounterVersion: kind === 'bound' ? 0 : null,
      correlationId: null,
      movementKind: 'VOLUNTARY',
      tokenId: moving.id,
      path: [moving.position, { x: 40, y: 20 }]
    }
    if (kind === 'encounter')
      await base.t.run((ctx) =>
        ctx.db.insert('encounterSceneBindings', {
          encounterId: crypto.randomUUID(),
          campaignId: base.campaign.id,
          sceneId: scene.sceneId,
          commandId: crypto.randomUUID(),
          commandFingerprint: checksumCanonicalJson({ sceneId: scene.sceneId }),
          createdAt: new Date().toISOString()
        })
      )
    if (kind === 'receiving')
      await base.other.caller.mutation(internal.scenes.geometryStaging.begin, { input })

    await expect(base.other.caller.mutation(fastExecute, { input })).rejects.toMatchObject({
      data: 'SCENE_GEOMETRY_STAGED_REQUIRED'
    })
    await base.t.run(async (ctx) => {
      const saves = await ctx.db.query('sceneGeometrySaves').collect()
      if (kind === 'receiving')
        expect(saves).toMatchObject([{ status: 'RECEIVING', commandId: input.commandId }])
      else expect(saves).toEqual([])
      expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
    })
  },
  30_000
)
it('commits each geometry command atomically against current Scene state', async () => {
  const base = await createSceneDefinitionFixture()
  const initialToken = token()
  const initialDoor = door()
  const scene = await published(base, [initialToken], [initialDoor])
  const addedToken = { ...token(), position: { x: 160, y: 220 } }
  const addedDoor = door()
  const readGeometry = async () => {
    const header = await base.owner.caller.query(api.scenes.liveReads.header, {
      sceneId: scene.sceneId
    })
    const readCollection = async (collection: 'tokens' | 'barriers') => {
      const rows: SceneGeometryPage['page'] = []
      let next: SceneGeometryPage['next'] = { phase: 'BASE', afterOrdinal: null }
      while (next) {
        const pageInput: SceneGeometryPageInput = {
          sceneId: scene.sceneId,
          definitionSaveId: header.definitionSaveId,
          expectedVersion: header.version,
          collection,
          phase: next.phase,
          afterOrdinal: next.afterOrdinal,
          numItems: 8
        }
        const page = await base.owner.caller.query(
          internal.scenes.geometryReads.entities,
          pageInput
        )
        rows.push(...page.page)
        next = page.next
      }
      return rows
    }
    const [tokens, barriers] = await Promise.all([
      readCollection('tokens'),
      readCollection('barriers')
    ])
    return {
      header,
      tokens,
      barriers,
      doorStates: Object.fromEntries(
        barriers.flatMap((row) =>
          row.value.collection === 'barriers' && row.value.entity.kind === 'DOOR'
            ? [[row.value.entity.id, row.doorState ?? row.value.entity.initialState]]
            : []
        )
      )
    }
  }
  const assertGeometry = async (expectedLineOfSight: boolean) => {
    const current = await readGeometry()
    const barriers = current.barriers.map((row) => {
      if (row.value.collection !== 'barriers') throw new Error('Missing persisted barrier.')
      return row.value.entity
    })
    const state = {
      barriers,
      doorStates: current.doorStates
    }
    expect(canMoveBetween(state, { x: 5, y: -10 }, { x: 5, y: 10 })).toBe(expectedLineOfSight)
    expect(canLightPassBetween(state, { x: 5, y: -10 }, { x: 5, y: 10 })).toBe(expectedLineOfSight)
    return current
  }
  const initial = await assertGeometry(false)
  expect(initial.barriers.map((row) => row.value.entity.id)).toEqual([initialDoor.id])
  expect(initial.doorStates).toEqual({ [initialDoor.id]: 'CLOSED' })
  const commands: SceneGeometryCommandInputDto[] = [
    {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'UPSERT_SCENE_TOKEN',
      token: addedToken
    },
    {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'REMOVE_SCENE_TOKEN',
      tokenId: initialToken.id
    },
    {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'SET_SCENE_DOOR_STATE',
      barrierId: initialDoor.id,
      state: 'OPEN'
    },
    {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'UPSERT_SCENE_BARRIER',
      barrier: addedDoor
    },
    {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'REMOVE_SCENE_BARRIER',
      barrierId: initialDoor.id
    }
  ]
  const expectedLineOfSight = [false, false, true, false, false]
  for (const [index, input] of commands.entries()) {
    const result = await base.owner.caller.action(execute, {
      input: { ...input, expectedSceneVersion: index }
    })
    expect(result).toMatchObject({
      sceneId: scene.sceneId,
      commandId: input.commandId.toLowerCase(),
      version: index + 1,
      occurrence: null,
      replayed: false,
      fogPatches: []
    })
    const current = await assertGeometry(expectedLineOfSight[index]!)
    if (index === 0) {
      const hydratedToken = current.tokens.find((row) => row.value.entity.id === addedToken.id)
      if (!hydratedToken || hydratedToken.value.collection !== 'tokens')
        throw new Error('Missing persisted added token.')
      expect(
        measureSceneDistance(
          current.header.grid,
          initialToken.position,
          hydratedToken.value.entity.position
        )
      ).toBe(5)
    }
    if (index === 2) expect(current.doorStates).toEqual({ [initialDoor.id]: 'OPEN' })
    if (index === 3) {
      expect(current.barriers.map((row) => row.value.entity.id)).toEqual(
        expect.arrayContaining([initialDoor.id, addedDoor.id])
      )
      expect(current.doorStates[addedDoor.id]).toBe('CLOSED')
    }
    if (index === 4) {
      expect(current.barriers.map((row) => row.value.entity.id)).toEqual([addedDoor.id])
      expect(current.doorStates).toEqual({ [addedDoor.id]: 'CLOSED' })
    }
  }
})

it('checks current owner authority before replay and rejects command collisions', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const committed = await base.owner.caller.action(execute, { input })
  await expect(base.owner.caller.action(execute, { input })).resolves.toEqual({
    ...committed,
    replayed: true
  })
  await expect(
    base.owner.caller.action(execute, {
      input: { ...input, token: { ...input.token, label: 'Collision' } }
    })
  ).rejects.toThrow('already used')
  await base.t.run(async (ctx) => {
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    const memberships = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    const ownerMembership = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    if (!campaign || !memberships || !ownerMembership) throw new Error('Missing transfer fixture.')
    await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
    await ctx.db.patch(memberships._id, { role: 'OWNER' })
    await ctx.db.patch(ownerMembership._id, { role: 'PLAYER' })
  })
  await expect(base.owner.caller.action(execute, { input })).rejects.toThrow('owner')
  await expect(base.other.caller.action(execute, { input })).resolves.toEqual({
    ...committed,
    replayed: true
  })
})

it('rejects a stale target while allowing an unrelated stale rebase', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const first = token()
  await base.owner.caller.action(execute, {
    input: {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 0,
      type: 'UPSERT_SCENE_TOKEN',
      token: first
    }
  })
  await expect(
    base.owner.caller.action(execute, {
      input: {
        sceneId: scene.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        type: 'UPSERT_SCENE_TOKEN',
        token: { ...first, label: 'Stale' }
      }
    })
  ).rejects.toThrow('target changed')
  await expect(
    base.owner.caller.action(execute, {
      input: {
        sceneId: scene.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        type: 'UPSERT_SCENE_TOKEN',
        token: token()
      }
    })
  ).resolves.toMatchObject({ version: 2, replayed: false })
})

it('normalizes uppercase immutable identities before removing a base token', async () => {
  const base = await createSceneDefinitionFixture()
  const uppercase = token('A0000000-0000-4000-8000-000000000001')
  const scene = await published(base, [uppercase])
  await expect(
    base.owner.caller.action(execute, {
      input: {
        sceneId: scene.sceneId.toUpperCase(),
        commandId: crypto.randomUUID().toUpperCase(),
        expectedSceneVersion: 0,
        type: 'REMOVE_SCENE_TOKEN',
        tokenId: uppercase.id.toLowerCase()
      }
    })
  ).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'TOKEN_REMOVED', tokenId: uppercase.id.toLowerCase() }
  })
})

it('keeps an unfinished staged command invisible and restarts it on a changed snapshot', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const staged: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const first = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: staged
  })
  expect(first).toMatchObject({ kind: 'READY' })
  await expect(
    base.owner.caller.action(execute, {
      input: {
        sceneId: scene.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: 0,
        type: 'UPSERT_SCENE_TOKEN',
        token: token()
      }
    })
  ).resolves.toMatchObject({ version: 1 })
  const restarted = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, {
    input: staged
  })
  expect(restarted).toMatchObject({ kind: 'READY', input: { commandId: staged.commandId } })
  if (first.kind !== 'READY' || restarted.kind !== 'READY') throw new Error('Missing staged save.')
  expect(restarted.saveId).not.toBe(first.saveId)
  await base.t.run(async (ctx) => {
    const rows = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', scene.sceneId).eq('collection', 'tokens').eq('entityId', staged.token.id)
      )
      .collect()
    expect(rows).toHaveLength(0)
  })
})

it('denies direct geometry staging and finish calls to a non-owner', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  await expect(
    base.other.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  ).rejects.toThrow('owner')
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  if (staged.kind !== 'READY') throw new Error('Expected staging save.')
  await expect(
    base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: null
    })
  ).rejects.toThrow('owner')
})

it('publishes staged fog atomically and exposes its historical chunks', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  if (staged.kind !== 'READY') throw new Error('Expected geometry staging save.')
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: staged.saveId,
    layer: derivedLayer
  })
  const child = await base.t.run((ctx) => ctx.db.query('sceneFogSaves').unique())
  if (!child) throw new Error('Missing derived child.')
  await expect(base.owner.caller.mutation(fogBegin, { input: child.input })).rejects.toThrow(
    'manually'
  )
  await expect(
    base.owner.caller.mutation(fogAppend, {
      input: { saveId: child.id, offset: 0, chunks: derivedLayer.chunks }
    })
  ).rejects.toThrow('manually')
  await expect(base.owner.caller.mutation(fogPublish, { saveId: child.id })).rejects.toThrow(
    'manually'
  )
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneFogLayers').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
  })
  const result = await base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
    saveId: staged.saveId,
    baseOrdinal: null
  })
  expect(result.fogPatches).toHaveLength(1)
  await expect(
    base.owner.caller.query(commandChunks, {
      sceneId: scene.sceneId,
      commandId: input.commandId,
      ownerUserId: null,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: [derivedLayer.chunks[0]], nextOffset: 1, isDone: true })
})

it('rolls back every geometry and fog write when a later staged child is corrupt', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const staged = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  if (staged.kind !== 'READY') throw new Error('Expected geometry staging save.')
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: staged.saveId,
    layer: derivedLayer
  })
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: staged.saveId,
    layer: { ...derivedLayer, ownerUserId: base.owner.userId }
  })
  await base.t.run(async (ctx) => {
    const children = await ctx.db.query('sceneFogSaves').collect()
    const child = children.find(
      (row) =>
        row.geometrySaveId === staged.saveId && row.input.layer.ownerUserId === base.owner.userId
    )
    if (!child) throw new Error('Missing second staged fog save.')
    await ctx.db.patch(child._id, { receivedChunks: 0 })
  })
  await expect(
    base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: null
    })
  ).rejects.toThrow('inconsistent')
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneLiveStates').collect()).toHaveLength(0)
    expect(await ctx.db.query('sceneLiveEntities').collect()).toHaveLength(0)
    expect(await ctx.db.query('sceneLiveCommands').collect()).toHaveLength(0)
    expect(await ctx.db.query('sceneFogLayers').collect()).toHaveLength(0)
    const children = await ctx.db.query('sceneFogSaves').collect()
    expect(
      children
        .filter((row) => row.geometrySaveId === staged.saveId)
        .every((row) => row.status === 'RECEIVING')
    ).toBe(true)
  })
})

it('runs public token vision through exploration staging and history', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const visible: SceneToken = {
    ...token(),
    controlledByUserIds: [base.owner.userId],
    vision: {
      enabled: true,
      brightRange: 30,
      dimRange: 60,
      angleDegrees: 360,
      directionDegrees: 0
    }
  }
  const delta = { kind: 'TOKEN_UPSERTED' as const, token: visible }
  const expected = deriveSceneCommandExplorationDeltas(
    { barriers: [] },
    {
      map: base.input.settings.map,
      grid: base.input.settings.grid,
      fogMode: base.input.settings.fogMode,
      tokens: [visible],
      barriers: [],
      doorStates: {},
      fogLayers: []
    },
    delta
  )
  const patch = expected[0]?.kind === 'FOG_CHUNKS_PATCHED' ? expected[0].layer : null
  const layer = patch ? canonicalizeSceneFogLayer(patch) : null
  if (!layer) throw new Error('Expected derived exploration layer.')
  const commandId = crypto.randomUUID()
  const result = await base.owner.caller.action(execute, {
    input: {
      sceneId: scene.sceneId,
      commandId,
      expectedSceneVersion: 0,
      type: 'UPSERT_SCENE_TOKEN',
      token: visible
    }
  })
  expect(result.fogPatches).toMatchObject([
    { ownerUserId: base.owner.userId, chunkCount: layer.chunks.length, mode: 'REPLACE' }
  ])
  const history: SceneFogChunk[] = []
  let offset = 0
  let done = false
  while (!done) {
    const page = await base.owner.caller.query(commandChunks, {
      sceneId: scene.sceneId,
      commandId,
      ownerUserId: base.owner.userId,
      offset,
      numItems: 8
    })
    history.push(...page.page)
    offset = page.nextOffset
    done = page.isDone
  }
  expect(history).toEqual(layer.chunks)
})

it('preserves manually explored fog while replacing canonical geometry fog', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const bytes = new Uint8Array((64 * 32) / 8)
  bytes[7] = 0b10000000
  const manual: SceneFogChunk = {
    index: 0,
    x: 0,
    y: 0,
    width: 64,
    height: 32,
    data: Buffer.from(bytes).toString('base64')
  }
  const fogInput: SceneFogPatchInput = {
    type: 'PATCH_SCENE_FOG',
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    layer: { ownerUserId: base.owner.userId, width: 64, height: 32 },
    chunkManifest: [{ index: 0, checksum: checksumCanonicalJson(manual) }]
  }
  const saved = await base.owner.caller.mutation(fogBegin, { input: fogInput })
  await base.owner.caller.mutation(fogAppend, {
    input: { saveId: saved.saveId, offset: 0, chunks: [manual] }
  })
  await base.owner.caller.mutation(fogPublish, { saveId: saved.saveId })
  const visible: SceneToken = {
    ...token(),
    controlledByUserIds: [base.owner.userId],
    position: { x: 125, y: 250 },
    vision: {
      enabled: true,
      brightRange: 0.8,
      dimRange: 0.8,
      angleDegrees: 360,
      directionDegrees: 0
    }
  }
  const result = await base.owner.caller.action(execute, {
    input: {
      sceneId: scene.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: 1,
      type: 'UPSERT_SCENE_TOKEN',
      token: visible
    }
  })
  expect(result.fogPatches).toMatchObject([{ ownerUserId: base.owner.userId, mode: 'REPLACE' }])
  const current = await base.owner.caller.query(fogChunks, {
    sceneId: scene.sceneId,
    ownerUserId: base.owner.userId,
    expectedVersion: 2,
    offset: 0,
    numItems: 8
  })
  expect(current.page).toHaveLength(2)
  const right = current.page.find((chunk) => chunk.x === 32 && chunk.y === 0)
  const left = current.page.find((chunk) => chunk.x === 0 && chunk.y === 0)
  if (!right || !left) throw new Error('Missing canonical fog tiles.')
  expect(Buffer.from(right.data, 'base64')[3]! & 128).toBe(128)
  expect(Buffer.from(left.data, 'base64')[33]! & 1).toBe(1)
  const original = await base.owner.caller.query(api.scenes.fogReads.commandChunks, {
    sceneId: scene.sceneId,
    commandId: fogInput.commandId,
    offset: 0,
    numItems: 8
  })
  expect(original.page).toEqual([manual])
})

it('publishes only one competing geometry and fog snapshot and retains exact winner replay', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const target = token()
  const inputs: SceneGeometryCommandInputDto[] = ['Left', 'Right'].map((label) => ({
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: { ...target, label }
  }))
  const saves = []
  for (const input of inputs) {
    const save = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
    if (save.kind !== 'READY') throw new Error('Expected receiving geometry save.')
    await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
      saveId: save.saveId,
      layer: derivedLayer
    })
    saves.push(save)
  }
  const results = await Promise.allSettled(
    saves.map((save) =>
      base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
        saveId: save.saveId,
        baseOrdinal: null
      })
    )
  )
  expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
  const winner = results.findIndex((result) => result.status === 'fulfilled')
  const committed = results[winner]!
  if (committed.status !== 'fulfilled') throw new Error('Missing winner.')
  await expect(base.owner.caller.action(execute, { input: inputs[winner]! })).resolves.toEqual({
    ...committed.value,
    replayed: true
  })
  await expect(base.owner.caller.action(execute, { input: inputs[1 - winner]! })).rejects.toThrow(
    'target changed'
  )
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneLiveStates').collect()).toMatchObject([
      { version: 1, counts: { tokens: 1 } }
    ])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toMatchObject([
      { value: { entity: { id: target.id, label: winner === 0 ? 'Left' : 'Right' } }, version: 1 }
    ])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toMatchObject([
      { commandId: inputs[winner]!.commandId }
    ])
    const layers = await ctx.db.query('sceneFogLayers').collect()
    expect(layers).toHaveLength(1)
    expect(layers[0]!.chunks).toMatchObject([{ saveId: committed.value.fogPatches[0]!.saveId }])
    const children = await ctx.db.query('sceneFogSaves').collect()
    expect(children.filter((child) => child.status === 'PUBLISHED')).toHaveLength(1)
    expect(children.filter((child) => child.status === 'RECEIVING')).toHaveLength(1)
  })
})

it('deduplicates concurrent completion and keeps published history through cleanup', async () => {
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const save = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  if (save.kind !== 'READY') throw new Error('Expected receiving geometry save.')
  await Promise.all(
    [0, 1].map(() =>
      base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
        saveId: save.saveId,
        layer: derivedLayer
      })
    )
  )
  const results = await Promise.all(
    [0, 1].map(() =>
      base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
        saveId: save.saveId,
        baseOrdinal: null
      })
    )
  )
  expect(results.map((result) => result.replayed).sort()).toEqual([false, true])
  expect(results[0]).toEqual({ ...results[1], replayed: results[0]!.replayed })
  await base.t.mutation(internal.scenes.geometryStaging.cleanup, { saveId: save.saveId })
  await base.t.mutation(internal.scenes.fogCommands.cleanup, {
    saveId: results[0]!.fogPatches[0]!.saveId
  })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneGeometrySaves').collect()).toMatchObject([
      { status: 'PUBLISHED' }
    ])
    expect(await ctx.db.query('sceneFogSaves').collect()).toMatchObject([
      { status: 'PUBLISHED', receivedChunks: 1 }
    ])
    expect(await ctx.db.query('sceneFogChunks').collect()).toHaveLength(1)
    expect(await ctx.db.query('sceneLiveCommands').collect()).toHaveLength(1)
  })
  await expect(
    base.owner.caller.query(commandChunks, {
      sceneId: scene.sceneId,
      commandId: input.commandId,
      ownerUserId: null,
      offset: 0,
      numItems: 8
    })
  ).resolves.toMatchObject({ page: derivedLayer.chunks })
})

it('expires hidden geometry parents and removes child chunks in bounded retry-safe batches', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  const base = await createSceneDefinitionFixture()
  const scene = await published(base)
  const input: SceneGeometryCommandInputDto = {
    sceneId: scene.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    type: 'UPSERT_SCENE_TOKEN',
    token: token()
  }
  const save = await base.owner.caller.mutation(internal.scenes.geometryStaging.begin, { input })
  if (save.kind !== 'READY') throw new Error('Expected receiving geometry save.')
  const layer: SceneFogLayer = {
    ownerUserId: null,
    width: 288,
    height: 32,
    chunks: Array.from({ length: 9 }, (_, index) => ({
      index,
      x: index * 32,
      y: 0,
      width: 32,
      height: 32,
      data: Buffer.alloc(128, 255).toString('base64')
    }))
  }
  await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: save.saveId,
    layer
  })
  const child = await base.t.run((ctx) => ctx.db.query('sceneFogSaves').unique())
  if (!child) throw new Error('Missing derived child.')
  await base.t.mutation(internal.scenes.geometryStaging.cleanup, { saveId: save.saveId })
  vi.setSystemTime(child.expiresAt + 1)
  await base.t.mutation(internal.scenes.geometryStaging.cleanup, { saveId: save.saveId })
  await base.t.mutation(internal.scenes.fogCommands.cleanup, { saveId: child.id })
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneGeometrySaves').collect()).toMatchObject([
      { status: 'EXPIRED' }
    ])
    expect(await ctx.db.query('sceneFogChunks').collect()).toHaveLength(1)
    expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
    expect(await ctx.db.query('sceneFogLayers').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
  })
  for (let retry = 0; retry < 2; retry++) {
    await base.t.mutation(internal.scenes.geometryStaging.cleanup, { saveId: save.saveId })
    await base.t.mutation(internal.scenes.fogCommands.cleanup, { saveId: child.id })
  }
  vi.useRealTimers()
  await expect(base.owner.caller.action(execute, { input })).rejects.toThrow('expired')
  await expect(
    base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: save.saveId,
      baseOrdinal: null
    })
  ).rejects.toThrow('expired')
  expect(await base.t.run((ctx) => ctx.db.query('sceneFogChunks').collect())).toEqual([])
})
