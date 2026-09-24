import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type { SceneCommandInputDto } from '@artificer-toolkit/schema/api/vttScenes'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { SceneToken, SceneBarrier, SceneFogChunk } from '@artificer-toolkit/shared/vtt/scene'
import { isScenePointExplored } from '@artificer-toolkit/shared/vtt'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { api, internal } from '../_generated/api'

type Movement = Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>
const execute = makeFunctionReference<'action', { input: Movement }, SceneGeometryCommandResult>(
  'scenes/geometryActions:execute'
)
const beginMovement = makeFunctionReference<
  'mutation',
  { input: Movement },
  SceneGeometryBeginResult
>('scenes/geometryStaging:begin')

async function fixture(
  options: { locked?: boolean; controlled?: boolean; barrier?: boolean; uppercase?: boolean } = {}
) {
  const base = await createSceneDefinitionFixture()
  const token: SceneToken = {
    id: options.uppercase ? crypto.randomUUID().toUpperCase() : crypto.randomUUID(),
    assetId: null,
    label: 'Scout',
    width: 1,
    height: 1,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    hidden: false,
    locked: options.locked ?? false,
    controlledByUserIds:
      options.controlled === false
        ? []
        : [base.owner.userId, base.other.userId].map((id) =>
            options.uppercase ? id.toUpperCase() : id
          ),
    vision: { enabled: true, brightRange: 1, dimRange: 1, angleDegrees: 360, directionDegrees: 0 }
  }
  const barriers: SceneBarrier[] = options.barrier
    ? [
        {
          id: crypto.randomUUID(),
          kind: 'WALL',
          a: { x: 300, y: 0 },
          b: { x: 300, y: 1000 },
          blocksLight: true,
          blocksMovement: true
        }
      ]
    : []
  const save = await base.owner.caller.mutation(api.scenes.definitions.begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: 1, barriers: barriers.length }
  })
  await base.owner.caller.mutation(api.scenes.definitions.append, {
    input: { saveId: save.saveId, collection: 'tokens', offset: 0, entities: [token] }
  })
  if (barriers.length)
    await base.owner.caller.mutation(api.scenes.definitions.append, {
      input: { saveId: save.saveId, collection: 'barriers', offset: 0, entities: barriers }
    })
  await base.owner.caller.mutation(api.scenes.definitions.publish, { saveId: save.saveId })
  if (!save.liveSceneId) throw new Error('Missing live Scene.')
  const input: Movement = {
    type: 'MOVE_SCENE_TOKEN',
    sceneId: save.liveSceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: 0,
    expectedEncounterVersion: null,
    correlationId: null,
    movementKind: 'VOLUNTARY',
    tokenId: token.id,
    path: [
      token.position,
      { x: 300, y: 100 },
      { x: 500, y: 100 },
      { x: 500, y: 300 },
      { x: 500, y: 500 }
    ]
  }
  return { ...base, token, input, map: base.input.settings.map }
}

it.each(['owner', 'other'] as const)(
  'atomically commits %s movement and exploration at every authoritative path sample',
  async (who) => {
    const base = await fixture()
    const caller = base[who].caller
    const result = await caller.action(execute, { input: base.input })
    expect(result).toMatchObject({
      version: 1,
      replayed: false,
      occurrence: null,
      delta: { kind: 'TOKEN_MOVED', tokenId: base.token.id, position: { x: 500, y: 500 } }
    })
    for (const ownerUserId of [base.owner.userId, base.other.userId]) {
      const layers = await base.owner.caller.query(api.scenes.fogReads.layers, {
        sceneId: base.input.sceneId,
        expectedVersion: 1,
        paginationOpts: { cursor: null, numItems: 8 }
      })
      const layer = layers.page.find((entry) => entry.ownerUserId === ownerUserId)
      if (!layer) throw new Error('Missing movement exploration.')
      const chunks: SceneFogChunk[] = []
      let offset = 0
      let done = false
      while (!done) {
        const page = await base.owner.caller.query(api.scenes.fogReads.chunks, {
          sceneId: base.input.sceneId,
          ownerUserId,
          expectedVersion: 1,
          offset,
          numItems: 8
        })
        chunks.push(...page.page)
        offset = page.nextOffset
        done = page.isDone
      }
      const fog = { map: base.map, fogLayers: [{ ...layer, chunks }] }
      expect(isScenePointExplored(fog, ownerUserId, { x: 300, y: 100 })).toBe(true)
      expect(isScenePointExplored(fog, ownerUserId, { x: 500, y: 300 })).toBe(true)
      expect(isScenePointExplored(fog, ownerUserId, { x: 300, y: 500 })).toBe(false)
    }
    await expect(caller.action(execute, { input: base.input })).resolves.toEqual({
      ...result,
      replayed: true
    })
    await expect(
      caller.action(execute, {
        input: { ...base.input, path: [base.token.position, { x: 600, y: 100 }] }
      })
    ).rejects.toThrow()
    await base.t.run(async (ctx) => {
      const state = await ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', base.input.sceneId))
        .unique()
      expect(state?.version).toBe(1)
      const token = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q
            .eq('sceneId', base.input.sceneId)
            .eq('collection', 'tokens')
            .eq('entityId', base.token.id)
        )
        .unique()
      expect(token?.value).toMatchObject({
        collection: 'tokens',
        entity: { position: { x: 500, y: 500 } }
      })
    })
    await expect(
      base.other.caller.query(api.scenes.fogReads.chunks, {
        sceneId: base.input.sceneId,
        ownerUserId: base.owner.userId,
        expectedVersion: 1,
        offset: 0,
        numItems: 8
      })
    ).rejects.toThrow('unavailable')
  },
  30000
)

it('moves immutable uppercase token and controller identities through canonical hydration', async () => {
  const base = await fixture({ uppercase: true })
  await expect(base.other.caller.action(execute, { input: base.input })).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: base.token.id.toLowerCase() }
  })
})

it('allows the owner to move an unlocked token without a controller assignment', async () => {
  const base = await fixture({ controlled: false })
  await expect(base.owner.caller.action(execute, { input: base.input })).resolves.toMatchObject({
    version: 1,
    delta: { kind: 'TOKEN_MOVED', tokenId: base.token.id }
  })
})

it.each(['locked', 'uncontrolled', 'barrier', 'origin', 'bounds', 'encounter'] as const)(
  'rejects %s movement without publishing token or fog state',
  async (kind) => {
    const base = await fixture({
      locked: kind === 'locked',
      controlled: kind !== 'uncontrolled',
      barrier: kind === 'barrier'
    })
    const input: Movement = {
      ...base.input,
      ...(kind === 'origin'
        ? {
            path: [
              { x: 90, y: 100 },
              { x: 500, y: 100 }
            ]
          }
        : {}),
      ...(kind === 'bounds' ? { path: [base.token.position, { x: 1001, y: 100 }] } : {}),
      ...(kind === 'encounter' ? { expectedEncounterVersion: 0 } : {})
    }
    await expect(base.other.caller.action(execute, { input })).rejects.toThrow()
    await base.t.run(async (ctx) => {
      expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
      expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
      expect(await ctx.db.query('sceneFogLayers').collect()).toEqual([])
    })
  }
)

it('rolls back movement and an earlier fog publication when a later staged layer is invalid', async () => {
  const base = await fixture()
  const staged = await base.owner.caller.mutation(beginMovement, { input: base.input })
  if (staged.kind !== 'READY') throw new Error('Expected staged movement.')
  for (const ownerUserId of [base.owner.userId, base.other.userId]) {
    await base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
      saveId: staged.saveId,
      layer: {
        ownerUserId,
        width: 1,
        height: 1,
        chunks: [{ index: 0, x: 0, y: 0, width: 1, height: 1, data: 'AQ==' }]
      }
    })
  }
  await base.t.run(async (ctx) => {
    const child = (await ctx.db.query('sceneFogSaves').collect()).find(
      (row) =>
        row.geometrySaveId === staged.saveId && row.input.layer.ownerUserId === base.other.userId
    )
    if (!child) throw new Error('Missing later fog layer.')
    await ctx.db.patch(child._id, { receivedChunks: 0 })
  })
  await expect(
    base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: 0
    })
  ).rejects.toThrow('inconsistent')
  await base.t.run(async (ctx) => {
    expect(await ctx.db.query('sceneLiveStates').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveEntities').collect()).toEqual([])
    expect(await ctx.db.query('sceneLiveCommands').collect()).toEqual([])
    expect(await ctx.db.query('sceneFogLayers').collect()).toEqual([])
    expect(
      (await ctx.db.query('sceneFogSaves').collect()).every((row) => row.status === 'RECEIVING')
    ).toBe(true)
  })
})

it('rechecks membership before replay and before publishing a staged movement', async () => {
  const base = await fixture()
  const result = await base.other.caller.action(execute, { input: base.input })
  const next: Movement = {
    ...base.input,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: result.version,
    path: [
      { x: 500, y: 500 },
      { x: 600, y: 500 }
    ]
  }
  const staged = await base.other.caller.mutation(beginMovement, { input: next })
  if (staged.kind !== 'READY') throw new Error('Expected staged movement.')
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!row) throw new Error('Missing membership.')
    await ctx.db.patch(row._id, { status: 'LEFT', leftAt: new Date().toISOString() })
  })
  await expect(base.other.caller.action(execute, { input: base.input })).rejects.toThrow()
  await expect(
    base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: staged.saveId,
      baseOrdinal: 0
    })
  ).rejects.toThrow()
  const header = await base.owner.caller.query(api.scenes.liveReads.header, {
    sceneId: base.input.sceneId
  })
  expect(header.version).toBe(1)
})

it('rejects a competing staged move after the first publication changes the Scene', async () => {
  const base = await fixture()
  const first = await base.owner.caller.mutation(beginMovement, { input: base.input })
  const competing = await base.other.caller.mutation(beginMovement, {
    input: {
      ...base.input,
      commandId: crypto.randomUUID(),
      path: [base.token.position, { x: 600, y: 100 }]
    }
  })
  if (first.kind !== 'READY' || competing.kind !== 'READY')
    throw new Error('Missing staged movement.')
  await base.owner.caller.mutation(internal.scenes.geometryCommands.finish, {
    saveId: first.saveId,
    baseOrdinal: 0
  })
  await expect(
    base.other.caller.mutation(internal.scenes.geometryCommands.finish, {
      saveId: competing.saveId,
      baseOrdinal: 0
    })
  ).rejects.toThrow('changed')
  await base.t.run(async (ctx) => {
    const commands = await ctx.db.query('sceneLiveCommands').collect()
    expect(commands).toHaveLength(1)
    expect(commands[0]?.commandId).toBe(base.input.commandId)
    const state = await ctx.db
      .query('sceneLiveStates')
      .withIndex('by_sceneId', (q) => q.eq('sceneId', base.input.sceneId))
      .unique()
    expect(state?.version).toBe(1)
  })
})
