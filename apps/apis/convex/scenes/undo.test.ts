import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  SceneCommandInputDto,
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  SCENE_GEOMETRY_STAGED_REQUIRED,
  type SceneGeometryCommandResult,
  type SceneGeometryExecuteInput
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type {
  SceneUndoExecuteInput,
  SceneUndoCommandResult
} from '@artificer-toolkit/schema/api/sceneUndo'
import type { SceneToken } from '@artificer-toolkit/shared/vtt/scene'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { sceneStoredGeometryCommandSchema } from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { createSceneDefinitionFixture } from '../../tests/fixtures/sceneDefinitions'
import { api, internal } from '../_generated/api'

type Move = Extract<SceneCommandInputDto, { type: 'MOVE_SCENE_TOKEN' }>
const move = makeFunctionReference<'action', SceneGeometryExecuteInput, SceneGeometryCommandResult>(
  'scenes/geometryActions:execute'
)
const undo = makeFunctionReference<'action', SceneUndoExecuteInput, SceneUndoCommandResult>(
  'scenes/undo:execute'
)
const setPresentation = makeFunctionReference<
  'mutation',
  SetCampaignLiveScenePresentationInputDto,
  SetCampaignLiveScenePresentationResultDto
>('scenes/presentations:set')
const fastUndo = makeFunctionReference<'mutation', SceneUndoExecuteInput, SceneUndoCommandResult>(
  'scenes/undo:executeFast'
)

async function fixture(explored = false, vision = true) {
  const base = await createSceneDefinitionFixture()
  const token: SceneToken = {
    id: crypto.randomUUID(),
    assetId: null,
    label: 'Scout',
    width: 1,
    height: 1,
    position: { x: 100, y: 100 },
    rotationDegrees: 0,
    hidden: false,
    locked: false,
    controlledByUserIds: vision ? [base.owner.userId, base.other.userId] : [],
    vision: vision
      ? { enabled: true, brightRange: 1, dimRange: 1, angleDegrees: 360, directionDegrees: 0 }
      : null
  }
  const saved = await base.owner.caller.mutation(api.scenes.definitions.begin, {
    ...base.input,
    counts: { ...base.input.counts, tokens: 1 }
  })
  await base.owner.caller.mutation(api.scenes.definitions.append, {
    input: { saveId: saved.saveId, collection: 'tokens', offset: 0, entities: [token] }
  })
  await base.owner.caller.mutation(api.scenes.definitions.publish, { saveId: saved.saveId })
  if (!saved.liveSceneId) throw new Error('Missing Scene.')
  const sceneId = saved.liveSceneId
  let version = 0
  if (explored) {
    const result = await base.owner.caller.action(api.scenes.geometryActions.execute, {
      input: {
        sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: version,
        type: 'UPSERT_SCENE_TOKEN',
        token
      }
    })
    version = result.version
  }
  const input: Move = {
    sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: version,
    expectedEncounterVersion: null,
    correlationId: null,
    type: 'MOVE_SCENE_TOKEN',
    tokenId: token.id,
    movementKind: 'VOLUNTARY',
    path: [token.position, { x: 200, y: 100 }, { x: 300, y: 100 }]
  }
  return { ...base, sceneId, token, version, movement: input }
}

async function fogSnapshot(base: Awaited<ReturnType<typeof fixture>>) {
  return base.t.run(async (ctx) =>
    (await ctx.db.query('sceneFogLayers').collect())
      .map((row) => ({
        ownerUserId: row.ownerUserId,
        width: row.width,
        height: row.height,
        ordinal: row.ordinal,
        chunks: row.chunks
      }))
      .sort((a, b) => String(a.ownerUserId).localeCompare(String(b.ownerUserId)))
  )
}

it('atomically undoes a simple no-fog move and replays the exact receipt', async () => {
  const base = await fixture(false, false)
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const request: SceneUndoExecuteInput = {
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    }
  }

  const result = await base.owner.caller.mutation(fastUndo, request)
  expect(result).toMatchObject({
    version: moved.version + 1,
    replayed: false,
    occurrence: null,
    delta: {
      kind: 'TOKEN_MOVE_UNDONE',
      tokenId: base.token.id,
      position: base.token.position,
      undoneCommandId: base.movement.commandId
    },
    restoredFogOwners: []
  })
  await expect(base.owner.caller.mutation(fastUndo, request)).resolves.toEqual({
    ...result,
    replayed: true
  })

  await base.t.run(async (ctx) => {
    const receipts = (await ctx.db.query('sceneLiveCommands').collect()).filter(
      (row) => row.encoding === 'UNDO'
    )
    expect(receipts).toHaveLength(1)
    expect(receipts[0]).toMatchObject({
      commandId: request.input.commandId,
      undoneCommandId: base.movement.commandId,
      result
    })
  })
}, 10_000)

it('deduplicates concurrent fast undo submissions without restoring twice', async () => {
  const base = await fixture(false, false)
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const request: SceneUndoExecuteInput = {
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    }
  }

  const results = await Promise.all([
    base.owner.caller.mutation(fastUndo, request),
    base.owner.caller.mutation(fastUndo, request)
  ])
  expect(results.map((result) => result.replayed).sort()).toEqual([false, true])
  expect(results[0]).toEqual({ ...results[1], replayed: results[0]!.replayed })

  const header = await base.owner.caller.query(api.scenes.liveReads.header, {
    sceneId: base.sceneId
  })
  expect(header.version).toBe(moved.version + 1)
})

it('rolls back a fast undo when the stored movement save is corrupt', async () => {
  const base = await fixture(false, false)
  const moved = await base.owner.caller.action(move, { input: base.movement })
  await base.t.run(async (ctx) => {
    const save = await ctx.db
      .query('sceneGeometrySaves')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', base.sceneId).eq('commandId', base.movement.commandId)
      )
      .unique()
    if (!save) throw new Error('Missing movement save.')
    await ctx.db.patch(save._id, { inputChecksum: '0'.repeat(64) })
  })

  await expect(
    base.owner.caller.mutation(fastUndo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: moved.version
      }
    })
  ).rejects.toThrow('Stored Scene geometry save is inconsistent.')

  const header = await base.owner.caller.query(api.scenes.liveReads.header, {
    sceneId: base.sceneId
  })
  expect(header.version).toBe(moved.version)
  await base.t.run(async (ctx) => {
    expect(
      (await ctx.db.query('sceneLiveCommands').collect()).some((row) => row.encoding === 'UNDO')
    ).toBe(false)
  })
})

it('rolls back a fast undo when the moved token is no longer current', async () => {
  const base = await fixture(false, false)
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const changed = await base.owner.caller.action(api.scenes.geometryActions.execute, {
    input: {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version,
      token: { ...base.token, label: 'Later edit', position: { x: 500, y: 500 } }
    }
  })

  await expect(
    base.owner.caller.mutation(fastUndo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: changed.version
      }
    })
  ).rejects.toThrow('The latest token move can no longer be safely undone.')

  const header = await base.owner.caller.query(api.scenes.liveReads.header, {
    sceneId: base.sceneId
  })
  expect(header.version).toBe(changed.version)
  await base.t.run(async (ctx) => {
    const token = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', base.sceneId).eq('collection', 'tokens').eq('entityId', base.token.id)
      )
      .unique()
    expect(token?.value).toMatchObject({
      collection: 'tokens',
      entity: { label: 'Later edit', position: { x: 500, y: 500 } }
    })
    expect(
      (await ctx.db.query('sceneLiveCommands').collect()).some((row) => row.encoding === 'UNDO')
    ).toBe(false)
  })
})

it('falls back before writes for fog and presentation-captured movement history', async () => {
  const fog = await fixture()
  const fogMove = await fog.owner.caller.action(move, { input: fog.movement })
  await expect(
    fog.owner.caller.mutation(fastUndo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: fog.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: fogMove.version
      }
    })
  ).rejects.toMatchObject({ data: SCENE_GEOMETRY_STAGED_REQUIRED })

  const captured = await fixture(false, false)
  const presentation = await captured.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: captured.campaign.id,
    sceneId: captured.sceneId
  })
  const presentationInput = { expectedPresentationVersion: presentation.version }
  const capturedMove = await captured.owner.caller.action(move, {
    input: captured.movement,
    presentation: presentationInput
  })
  await expect(
    captured.owner.caller.mutation(fastUndo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: captured.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: capturedMove.version
      },
      presentation: presentationInput
    })
  ).rejects.toMatchObject({ data: SCENE_GEOMETRY_STAGED_REQUIRED })

  for (const [base, version] of [
    [fog, fogMove.version],
    [captured, capturedMove.version]
  ] as const) {
    const header = await base.owner.caller.query(api.scenes.liveReads.header, {
      sceneId: base.sceneId
    })
    expect(header.version).toBe(version)
  }
})

it.each([false, true])(
  'restores the exact pre-move fog references (existing layers: %s) without rewriting history',
  async (explored) => {
    const base = await fixture(explored)
    const before = await fogSnapshot(base)
    const committed = await base.owner.caller.action(move, { input: base.movement })
    const receiptBefore = await base.t.run((ctx) =>
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', base.sceneId).eq('commandId', base.movement.commandId)
        )
        .unique()
    )
    const input: SceneUndoExecuteInput = {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: committed.version
      }
    }
    const result = await base.owner.caller.action(undo, input)
    expect(result).toMatchObject({
      version: committed.version + 1,
      replayed: false,
      occurrence: null,
      delta: {
        kind: 'TOKEN_MOVE_UNDONE',
        tokenId: base.token.id,
        position: base.token.position,
        undoneCommandId: base.movement.commandId
      }
    })
    expect([...result.restoredFogOwners].sort()).toEqual(
      [base.owner.userId, base.other.userId].sort()
    )
    expect(await fogSnapshot(base)).toEqual(before)
    await expect(base.owner.caller.action(undo, input)).resolves.toEqual({
      ...result,
      replayed: true
    })
    await base.t.run(async (ctx) => {
      const token = await ctx.db
        .query('sceneLiveEntities')
        .withIndex('by_sceneId_collection_entityId', (q) =>
          q.eq('sceneId', base.sceneId).eq('collection', 'tokens').eq('entityId', base.token.id)
        )
        .unique()
      expect(token?.value).toMatchObject({
        collection: 'tokens',
        entity: { position: base.token.position }
      })
      expect(token?.version).toBe(result.version)
      const state = await ctx.db
        .query('sceneLiveStates')
        .withIndex('by_sceneId', (q) => q.eq('sceneId', base.sceneId))
        .unique()
      expect(state?.fogLayerCount).toBe(before.length)
      const receipt = await ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', base.sceneId).eq('commandId', base.movement.commandId)
        )
        .unique()
      expect(receipt).toEqual(receiptBefore)
    })
    for (const patch of committed.fogPatches)
      await base.t.mutation(internal.scenes.fogCommands.cleanup, { saveId: patch.saveId })
    expect(await fogSnapshot(base)).toEqual(before)
    await expect(
      base.owner.caller.action(undo, {
        input: { ...input.input, expectedSceneVersion: result.version }
      })
    ).rejects.toThrow()
  }
)

it.each([false, true])(
  'preserves undo history across null-delta receipts (latest fog-only: %s)',
  async (fogOnly) => {
    const base = await fixture(false, fogOnly)
    const moved = await base.owner.caller.action(move, { input: base.movement })
    const actual = await base.t.run((ctx) =>
      ctx.db
        .query('sceneLiveCommands')
        .withIndex('by_sceneId_commandId', (q) =>
          q.eq('sceneId', base.sceneId).eq('commandId', base.movement.commandId)
        )
        .unique()
    )
    if (!actual || actual.encoding !== 'GEOMETRY') throw new Error('Movement receipt missing')
    await base.t.run(async (ctx) => {
      for (let index = 0; index < 9; index += 1) {
        const commandId = crypto.randomUUID()
        const input = {
          ...base.movement,
          commandId,
          expectedEncounterVersion: 0,
          expectedSceneVersion: moved.version - (fogOnly && index === 8 ? 1 : 0)
        }
        const result = {
          ...actual.result,
          commandId,
          delta: null,
          fogPatches: fogOnly && index === 8 ? actual.result.fogPatches : [],
          occurrence: {
            occurrenceId: crypto.randomUUID(),
            occurrenceVersion: 0,
            status: 'COMPLETE',
            outcome: null,
            pending: null
          },
          replayed: false
        }
        await ctx.db.insert(
          'sceneLiveCommands',
          sceneStoredGeometryCommandSchema.parse({
            encoding: 'GEOMETRY',
            sceneId: base.sceneId,
            commandId,
            actorUserId: base.owner.userId,
            input,
            inputChecksum: checksumCanonicalJson(input),
            result,
            resultChecksum: checksumCanonicalJson(result)
          })
        )
      }
    })
    const request: SceneUndoExecuteInput = {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: moved.version
      }
    }
    if (fogOnly) {
      await expect(base.owner.caller.action(undo, request)).rejects.toThrow(
        'The latest token move is invalid.'
      )
      return
    }
    const result = await base.owner.caller.action(undo, request)
    expect(result.delta).toMatchObject({
      kind: 'TOKEN_MOVE_UNDONE',
      undoneCommandId: base.movement.commandId,
      position: base.token.position
    })
  }
)

it('requires current owner authority before new undo and replay', async () => {
  const base = await fixture()
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const request: SceneUndoExecuteInput = {
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    }
  }
  await expect(base.other.caller.action(undo, request)).rejects.toThrow()
  const committed = await base.owner.caller.action(undo, request)
  await base.t.run(async (ctx) => {
    const owner = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.owner.userId)
      )
      .unique()
    const replacement = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    const campaign = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', base.campaign.id))
      .unique()
    if (!owner || !replacement || !campaign) throw new Error('Missing authority fixture.')
    await ctx.db.patch(owner._id, { role: 'PLAYER' })
    await ctx.db.patch(replacement._id, { role: 'OWNER' })
    await ctx.db.patch(campaign._id, { ownerUserId: base.other.userId })
  })
  await expect(base.owner.caller.action(undo, request)).rejects.toThrow()
  await expect(base.other.caller.action(undo, request)).resolves.toEqual({
    ...committed,
    replayed: true
  })
})

it('deduplicates concurrent undo submissions without restoring the movement twice', async () => {
  const base = await fixture()
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const request: SceneUndoExecuteInput = {
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    }
  }
  const results = await Promise.all([
    base.owner.caller.action(undo, request),
    base.owner.caller.action(undo, request)
  ])
  expect(results.map((result) => result.replayed).sort()).toEqual([false, true])
  expect(results[0]).toEqual({ ...results[1], replayed: results[0]!.replayed })
  const header = await base.owner.caller.query(api.scenes.liveReads.header, {
    sceneId: base.sceneId
  })
  expect(header.version).toBe(moved.version + 1)
})

it('fences a new undo by presentation version and still replays after a Campaign Session finishes', async () => {
  const base = await fixture()
  const session = await base.owner.caller.mutation(api.campaigns.sessions.create, {
    campaignId: base.campaign.id
  })
  const presentation = await base.owner.caller.mutation(setPresentation, {
    type: 'SET_CAMPAIGN_LIVE_SCENE_PRESENTATION',
    commandId: crypto.randomUUID(),
    expectedPresentationVersion: null,
    campaignId: base.campaign.id,
    sceneId: base.sceneId
  })
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const request: SceneUndoExecuteInput = {
    input: {
      type: 'UNDO_LAST_SCENE_MOVE',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version
    },
    presentation: { expectedPresentationVersion: presentation.version }
  }
  await expect(
    base.owner.caller.action(undo, {
      ...request,
      presentation: { expectedPresentationVersion: presentation.version + 1 }
    })
  ).rejects.toThrow('presentation is stale')
  const undone = await base.owner.caller.action(undo, request)
  await base.owner.caller.mutation(api.campaigns.sessionFinish.finish, {
    campaignId: base.campaign.id,
    sessionId: session.id,
    expectedVersion: session.version,
    commandId: crypto.randomUUID()
  })
  await expect(base.owner.caller.action(undo, request)).resolves.toEqual({
    ...undone,
    replayed: true
  })
})

it.each(['token', 'fog'] as const)(
  'rejects later conflicting %s changes instead of undoing an older move',
  async (kind) => {
    const base = await fixture()
    const moved = await base.owner.caller.action(move, { input: base.movement })
    const change = await base.owner.caller.action(api.scenes.geometryActions.execute, {
      input: {
        type: 'UPSERT_SCENE_TOKEN',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: moved.version,
        token: {
          ...base.token,
          id: kind === 'token' ? base.token.id : crypto.randomUUID(),
          label: 'Later edit',
          position: { x: 500, y: 500 }
        }
      }
    })
    const before = await fogSnapshot(base)
    await expect(
      base.owner.caller.action(undo, {
        input: {
          type: 'UNDO_LAST_SCENE_MOVE',
          sceneId: base.sceneId,
          commandId: crypto.randomUUID(),
          expectedSceneVersion: change.version
        }
      })
    ).rejects.toThrow()
    expect(await fogSnapshot(base)).toEqual(before)
    const header = await base.owner.caller.query(api.scenes.liveReads.header, {
      sceneId: base.sceneId
    })
    expect(header.version).toBe(change.version)
  }
)

it('preserves unrelated later geometry but rejects stale undo versions', async () => {
  const base = await fixture()
  const moved = await base.owner.caller.action(move, { input: base.movement })
  const other = {
    ...base.token,
    id: crypto.randomUUID(),
    vision: null,
    controlledByUserIds: [],
    position: { x: 600, y: 600 }
  }
  const changed = await base.owner.caller.action(api.scenes.geometryActions.execute, {
    input: {
      type: 'UPSERT_SCENE_TOKEN',
      sceneId: base.sceneId,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: moved.version,
      token: other
    }
  })
  const input: SceneUndoExecuteInput['input'] = {
    type: 'UNDO_LAST_SCENE_MOVE',
    sceneId: base.sceneId,
    commandId: crypto.randomUUID(),
    expectedSceneVersion: moved.version
  }
  await expect(base.owner.caller.action(undo, { input })).rejects.toThrow()
  await base.owner.caller.action(undo, {
    input: { ...input, expectedSceneVersion: changed.version }
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', base.sceneId).eq('collection', 'tokens').eq('entityId', other.id)
      )
      .unique()
    expect(row?.value).toEqual({ collection: 'tokens', entity: other })
    expect(row?.version).toBe(changed.version)
  })
})

it('finds older eligible moves beyond an exhausted page of already-undone moves', async () => {
  const base = await fixture(false, false)
  let version = base.version
  const commands: string[] = []
  for (let index = 0; index < 10; index += 1) {
    const token = { ...base.token, id: crypto.randomUUID() }
    const added = await base.owner.caller.action(api.scenes.geometryActions.execute, {
      input: {
        type: 'UPSERT_SCENE_TOKEN',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: version,
        token
      }
    })
    const input = {
      ...base.movement,
      tokenId: token.id,
      commandId: crypto.randomUUID(),
      expectedSceneVersion: added.version
    }
    const moved = await base.owner.caller.action(move, { input })
    version = moved.version
    commands.push(input.commandId)
  }
  for (const [index, commandId] of commands.reverse().entries()) {
    if (index === 8) {
      await expect(
        base.owner.caller.mutation(fastUndo, {
          input: {
            type: 'UNDO_LAST_SCENE_MOVE',
            sceneId: base.sceneId,
            commandId: crypto.randomUUID(),
            expectedSceneVersion: version
          }
        })
      ).rejects.toMatchObject({ data: SCENE_GEOMETRY_STAGED_REQUIRED })
    }
    const result = await base.owner.caller.action(undo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: version
      }
    })
    expect(result.delta.undoneCommandId).toBe(commandId)
    version = result.version
  }
  await expect(
    base.owner.caller.action(undo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: version
      }
    })
  ).rejects.toThrow()
})

it('does not partially restore token or fog when a later historical layer is corrupt', async () => {
  const base = await fixture(true)
  const moved = await base.owner.caller.action(move, { input: base.movement })
  expect(moved.fogPatches).toHaveLength(2)
  const before = await fogSnapshot(base)
  await base.t.run(async (ctx) => {
    const child = await ctx.db
      .query('sceneFogSaves')
      .withIndex('by_publicId', (q) => q.eq('id', moved.fogPatches[1]!.saveId))
      .unique()
    if (!child?.previousLayer) throw new Error('Missing historical layer.')
    await ctx.db.patch(child._id, {
      previousLayer: { ...child.previousLayer, checksum: '0'.repeat(64) }
    })
  })
  await expect(
    base.owner.caller.action(undo, {
      input: {
        type: 'UNDO_LAST_SCENE_MOVE',
        sceneId: base.sceneId,
        commandId: crypto.randomUUID(),
        expectedSceneVersion: moved.version
      }
    })
  ).rejects.toThrow()
  expect(await fogSnapshot(base)).toEqual(before)
  await base.t.run(async (ctx) => {
    const token = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q.eq('sceneId', base.sceneId).eq('collection', 'tokens').eq('entityId', base.token.id)
      )
      .unique()
    expect(token?.value).toMatchObject({
      collection: 'tokens',
      entity: { position: { x: 300, y: 100 } }
    })
    expect(token?.version).toBe(moved.version)
    expect(
      (await ctx.db.query('sceneLiveCommands').collect()).some((row) => row.encoding === 'UNDO')
    ).toBe(false)
  })
})
