import { replaceReceiptRecord } from '../../tests/fixtures/receiptRecords'
import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  RemoveEncounterSceneActorTokenBindingInputDto,
  EncounterActorTokenBindingCommandInputDto
} from '@artificer-toolkit/schema/api/vttScenes'
import { sceneStoredDefinitionSaveSchema } from '@artificer-toolkit/schema/projections/sceneDefinitionPersistence'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  bindPresentedScene,
  createEncounterSceneFixture as setup,
  createRun
} from '../../tests/fixtures/encounterScene'
import { seedLiveToken } from '../../tests/fixtures/liveSceneToken'
import {
  attachFixtureRoom,
  bindActorTokenInRoom,
  checkpointLiveRoom,
  insertActiveLiveAuthority,
  readEncounterHistory,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { execute as registeredExecute } from './actorTokenBindings'

useLocalRoomWorker()

const execute = makeFunctionReference<
  'mutation',
  { input: EncounterActorTokenBindingCommandInputDto },
  EncounterCommandResultDto
>('encounters/actorTokenBindings:execute')

it('exports object-form mutation arguments for Convex deployment packaging', () => {
  const registered: unknown = registeredExecute
  if (
    typeof registered !== 'function' ||
    !('exportArgs' in registered) ||
    typeof registered.exportArgs !== 'function'
  )
    throw new Error('Registered mutation does not expose Convex exportArgs.')
  const exported: unknown = JSON.parse(registered.exportArgs())
  expect(exported).toHaveProperty('type', 'object')
})

it('removes a bound actor token atomically, versions the Run, and replays its receipt', async () => {
  const base = await setup()
  await base.other.caller.run((ctx) =>
    bindPresentedScene(ctx, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
  )
  const actorId = base.run.actors[0]?.id
  if (!actorId) throw new Error('Missing Encounter actor')
  const tokenId = crypto.randomUUID()
  await base.t.run((ctx) =>
    ctx.db.insert(
      'encounterActorTokenBindings',
      encounterActorTokenBindingSchema.parse({
        encounterId: base.run.id,
        actorId,
        sceneId: base.sceneId,
        tokenId
      })
    )
  )
  const input: RemoveEncounterSceneActorTokenBindingInputDto = {
    type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    expectedEncounterVersion: base.run.version,
    actorId,
    sceneId: base.sceneId
  }
  const result = await base.other.caller.mutation(execute, { input })
  expect(result.projection.version).toBe(base.run.version + 1)
  expect(await base.other.caller.mutation(execute, { input })).toEqual(result)
  expect(await base.t.run((ctx) => ctx.db.query('encounterActorTokenBindings').collect())).toEqual(
    []
  )
}, 60000)

async function boundFixture() {
  const base = await setup()
  await base.other.caller.run((ctx) =>
    bindPresentedScene(ctx, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: base.run.id
    })
  )
  const input: EncounterActorTokenBindingCommandInputDto = {
    type: 'SET_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    actorId: base.run.actors[0]!.id,
    sceneId: base.sceneId,
    tokenId: base.tokens[0]!.id,
    expectedEncounterVersion: base.run.version
  }
  return { ...base, input }
}

async function publishFixtureSceneSource(base: Awaited<ReturnType<typeof boundFixture>>) {
  await base.t.run(async (ctx) => {
    const scene = await ctx.db
      .query('campaignScenes')
      .withIndex('by_publicId', (q) => q.eq('id', base.sceneId))
      .unique()
    if (!scene) throw new Error('Missing fixture Scene')
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

async function snapshot(base: Awaited<ReturnType<typeof boundFixture>>) {
  return base.t.run(async (ctx) => ({
    receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
    receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
    runs: await ctx.db.query('encounterRuns').collect(),
    scenes: await ctx.db.query('campaignScenes').collect(),
    tokens: await ctx.db.query('sceneDefinitionEntities').collect(),
    liveStates: await ctx.db.query('sceneLiveStates').collect(),
    liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
    bindings: await ctx.db.query('encounterActorTokenBindings').collect(),
    // Only meaningful while Convex holds the Run's history: once a room holds the Run, its command
    // rows live in the room and this read stays empty.
    commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect()
  }))
}

it('binds a token supplied only by the current Scene override without changing Scene state', async () => {
  const base = await boundFixture()
  const overrideToken = { ...base.tokens[0]!, id: crypto.randomUUID() }
  await seedLiveToken(base, overrideToken.id, overrideToken)
  const before = await snapshot(base)
  const result = await base.other.caller.mutation(execute, {
    input: { ...base.input, tokenId: overrideToken.id }
  })
  expect(result.projection.version).toBe(base.run.version + 1)
  const after = await snapshot(base)
  expect(after.liveStates).toEqual(before.liveStates)
  expect(after.liveEntities).toEqual(before.liveEntities)
  expect(after.scenes).toEqual(before.scenes)
  expect(after.bindings).toMatchObject([{ tokenId: overrideToken.id }])
})

it('rejects a current Scene tombstone over a base token atomically', async () => {
  const base = await boundFixture()
  await seedLiveToken(base, base.tokens[0]!.id.toLowerCase(), null)
  const before = await snapshot(base)
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'Scene token was not found.'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('rejects future-version live token overrides atomically', async () => {
  const base = await boundFixture()
  await seedLiveToken(base, base.tokens[0]!.id.toLowerCase(), base.tokens[0]!, 1, 2)
  const before = await snapshot(base)
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'Stored live Scene entity is inconsistent.'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('rejects corrupt live token overrides atomically', async () => {
  const base = await boundFixture()
  await seedLiveToken(base, base.tokens[0]!.id.toLowerCase(), base.tokens[0]!)
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneLiveEntities')
      .withIndex('by_sceneId_collection_entityId', (q) =>
        q
          .eq('sceneId', base.sceneId)
          .eq('collection', 'tokens')
          .eq('entityId', base.tokens[0]!.id.toLowerCase())
      )
      .unique()
    if (!row) throw new Error('Missing live token')
    await ctx.db.patch(row._id, { checksum: '0'.repeat(64) })
  })
  const before = await snapshot(base)
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'Stored live Scene entity is inconsistent.'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('replays a committed binding receipt after its Scene token is tombstoned', async () => {
  const base = await boundFixture()
  const first = await base.other.caller.mutation(execute, { input: base.input })
  await seedLiveToken(base, base.tokens[0]!.id.toLowerCase(), null)
  expect(await base.other.caller.mutation(execute, { input: base.input })).toEqual(first)
})

it('follows live Scene token removal and restoration for Encounter binding', async () => {
  const base = await boundFixture()
  const first = await base.other.caller.mutation(execute, { input: base.input })
  const tokenId = base.tokens[0]!.id
  await seedLiveToken(base, tokenId.toLowerCase(), null)
  const preserved = await base.t.run((ctx) => ctx.db.query('encounterActorTokenBindings').collect())
  expect(preserved).toMatchObject([{ actorId: base.input.actorId, tokenId: tokenId.toLowerCase() }])
  await expect(
    base.other.caller.mutation(execute, {
      input: {
        ...base.input,
        commandId: crypto.randomUUID(),
        expectedEncounterVersion: first.projection.version
      }
    })
  ).rejects.toThrow('Scene token was not found.')
  expect(await base.t.run((ctx) => ctx.db.query('encounterActorTokenBindings').collect())).toEqual(
    preserved
  )
  await seedLiveToken(base, tokenId.toLowerCase(), base.tokens[0]!, 2)
  const rebound = await base.other.caller.mutation(execute, {
    input: {
      ...base.input,
      commandId: crypto.randomUUID(),
      expectedEncounterVersion: first.projection.version
    }
  })
  expect(rebound.projection.version).toBe(first.projection.version + 1)
  expect(await base.other.caller.mutation(execute, { input: base.input })).toEqual({
    ...first,
    projection: rebound.projection
  })
  expect(
    await base.t.run((ctx) => ctx.db.query('encounterActorTokenBindings').collect())
  ).toMatchObject([{ actorId: base.input.actorId, tokenId: tokenId.toLowerCase() }])
}, 60000)

it('sets and replaces tokens and replays the first receipt', async () => {
  const base = await boundFixture()
  const before = await snapshot(base)
  const first = await base.other.caller.mutation(execute, { input: base.input })
  expect(first.projection.version).toBe(base.run.version + 1)
  const replaced = await base.other.caller.mutation(execute, {
    input: {
      ...base.input,
      commandId: crypto.randomUUID(),
      tokenId: base.tokens[1]!.id,
      expectedEncounterVersion: first.projection.version
    }
  })
  expect(replaced.projection.version).toBe(first.projection.version + 1)
  expect(
    await base.other.caller.mutation(execute, {
      input: {
        ...base.input,
        commandId: base.input.commandId.toUpperCase(),
        actorId: base.input.actorId.toUpperCase(),
        encounterId: base.run.id.toUpperCase(),
        sceneId: base.sceneId.toUpperCase(),
        tokenId: base.tokens[0]!.id.toLowerCase()
      }
    })
  ).toEqual({ ...first, projection: replaced.projection })
  const after = await snapshot(base)
  expect(after.bindings).toMatchObject([
    { actorId: base.input.actorId, tokenId: base.tokens[1]!.id }
  ])
  expect(after.scenes).toEqual(before.scenes)
  expect(after.tokens).toEqual(before.tokens)
  expect(after.commands).toHaveLength(before.commands.length + 2)
  expect(
    after.commands.filter((command) => command.commandType.includes('TOKEN_BINDING'))
  ).toHaveLength(2)
  const removed = await base.other.caller.mutation(execute, {
    input: {
      type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
      commandId: crypto.randomUUID(),
      actorId: base.input.actorId,
      encounterId: base.run.id,
      sceneId: base.sceneId,
      expectedEncounterVersion: replaced.projection.version
    }
  })
  expect(removed.projection.version).toBe(replaced.projection.version + 1)
  expect((await snapshot(base)).bindings).toEqual([])
})

it('enforces token uniqueness within a Run and allows stable token identity across Runs', async () => {
  const base = await boundFixture()
  const first = await base.other.caller.mutation(execute, { input: base.input })
  const before = await snapshot(base)
  await expect(
    base.other.caller.mutation(execute, {
      input: {
        ...base.input,
        commandId: crypto.randomUUID(),
        actorId: base.run.actors[1]!.id,
        expectedEncounterVersion: first.projection.version
      }
    })
  ).rejects.toThrow('already bound')
  expect(await snapshot(base)).toEqual(before)
  const second = await base.other.caller.mutation(createRun, {
    campaignId: base.campaign.id,
    blueprintId: base.blueprint.id,
    commandId: crypto.randomUUID()
  })
  await base.other.caller.run((ctx) =>
    bindPresentedScene(ctx, {
      type: 'BIND_ENCOUNTER_TO_PRESENTED_SCENE',
      commandId: crypto.randomUUID(),
      encounterId: second.id
    })
  )
  await base.other.caller.mutation(execute, {
    input: {
      ...base.input,
      commandId: crypto.randomUUID(),
      encounterId: second.id,
      actorId: second.actors[0]!.id,
      expectedEncounterVersion: second.version
    }
  })
  expect((await snapshot(base)).bindings).toHaveLength(2)
  expect((await snapshot(base)).scenes).toEqual(before.scenes)
})

it('rejects stale, divergent, missing and corrupt inputs and atomically rolls back nested writes', async () => {
  const base = await boundFixture()
  const before = await snapshot(base)
  const createReceipt = before.commands.find((row) => row.commandType === 'CREATE')!
  for (const input of [
    { ...base.input, expectedEncounterVersion: 999 },
    { ...base.input, commandId: createReceipt.commandId },
    { ...base.input, actorId: crypto.randomUUID() },
    { ...base.input, tokenId: crypto.randomUUID() },
    { ...base.input, sceneId: crypto.randomUUID() }
  ]) {
    await expect(base.other.caller.mutation(execute, { input })).rejects.toThrow()
    expect(await snapshot(base)).toEqual(before)
  }
  await expect(
    base.other.caller.run(async (ctx) => {
      await ctx.runMutation(execute, { input: base.input })
      throw new Error('Injected binding rollback')
    })
  ).rejects.toThrow('Injected binding rollback')
  expect(await snapshot(base)).toEqual(before)
  const token = before.tokens.find((row) => row.entityId === base.tokens[0]!.id)!
  await base.t.run((ctx) => ctx.db.patch(token._id, { checksum: '0'.repeat(64) }))
  const corrupted = await snapshot(base)
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'inconsistent'
  )
  expect(await snapshot(base)).toEqual(corrupted)
  await base.t.run((ctx) => ctx.db.patch(token._id, { checksum: token.checksum }))
  const duplicateId = await base.t.run((ctx) =>
    ctx.db.insert('sceneDefinitionEntities', {
      saveId: token.saveId,
      entityId: token.entityId.toLowerCase(),
      ordinal: 2,
      value: token.value,
      checksum: token.checksum
    })
  )
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'token was not found'
  )
  await base.t.run((ctx) => ctx.db.delete(duplicateId))
  await base.other.caller.mutation(execute, { input: base.input })
  await expect(
    base.other.caller.mutation(execute, { input: { ...base.input, tokenId: base.tokens[1]!.id } })
  ).rejects.toThrow('different input')
  const receipt = (await snapshot(base)).commands.find(
    (row) => row.commandId === base.input.commandId
  )!
  await base.t.run((ctx) =>
    replaceReceiptRecord(ctx, 'encounterRunCommands', receipt._id, {
      replayReceiptChecksum: '0'.repeat(64)
    })
  )
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'receipt mismatch'
  )
})

it('rejects anonymous, player, revoked, pending and completed fresh writes', async () => {
  const base = await boundFixture()
  const before = await snapshot(base)
  await expect(base.t.mutation(execute, { input: base.input })).rejects.toThrow('Unauthenticated')
  await expect(base.owner.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'Only the GM can do that.'
  )
  expect(await snapshot(base)).toEqual(before)
  const pending = await base.t.run((ctx) =>
    ctx.db.insert('encounterRuleOccurrences', {
      id: crypto.randomUUID(),
      campaignId: base.campaign.id,
      encounterId: base.run.id,
      rootCommandId: crypto.randomUUID(),
      state: 'PENDING',
      version: 0,
      expectedEncounterVersion: base.run.version,
      pendingSnapshotChecksum: '0'.repeat(64),
      completedAt: null,
      createdAt: base.run.createdAt,
      updatedAt: base.run.updatedAt
    })
  )
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'pending'
  )
  expect((await snapshot(base)).bindings).toEqual([])
  await base.t.run((ctx) => ctx.db.delete(pending))
  const first = await base.other.caller.mutation(execute, { input: base.input })
  const run = (await snapshot(base)).runs[0]!
  const state = { ...encounterRunStateSchema.parse(JSON.parse(run.stateJson)), status: 'COMPLETED' }
  await base.t.run((ctx) =>
    ctx.db.patch(run._id, {
      status: 'COMPLETED',
      stateJson: JSON.stringify(state),
      stateChecksum: checksumCanonicalJson(state)
    })
  )
  await expect(
    base.other.caller.mutation(execute, {
      input: {
        ...base.input,
        commandId: crypto.randomUUID(),
        expectedEncounterVersion: first.projection.version
      }
    })
  ).rejects.toThrow('Completed')
  expect(await base.other.caller.mutation(execute, { input: base.input })).toEqual({
    ...first,
    projection: { ...first.projection, status: 'COMPLETED' }
  })
  await base.t.run(async (ctx) => {
    const member = await ctx.db
      .query('campaignMemberships')
      .withIndex('by_campaignId_userId', (q) =>
        q.eq('campaignId', base.campaign.id).eq('userId', base.other.userId)
      )
      .unique()
    if (!member) throw new Error('Missing owner')
    await ctx.db.patch(member._id, { status: 'LEFT' })
  })
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'Campaign not found'
  )
})

it('refuses Convex binding writes while the live table holds the Run', async () => {
  const base = await boundFixture()
  await base.t.run((ctx) =>
    insertActiveLiveAuthority(ctx, {
      campaignId: base.campaign.id,
      epoch: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    })
  )
  const before = await snapshot(base)
  await expect(base.other.caller.mutation(execute, { input: base.input })).rejects.toThrow(
    'currently owned by its Campaign live table'
  )
  expect(await snapshot(base)).toEqual(before)
})

it('binds and unbinds an actor token in the real room', async () => {
  const base = await boundFixture()
  await publishFixtureSceneSource(base)
  await attachFixtureRoom(base.t, base.campaign.id)
  const bound = await bindActorTokenInRoom(base.other.caller, base.input)
  expect(bound.projection.version).toBe(base.run.version + 1)
  await checkpointLiveRoom(base.campaign.id)
  expect((await snapshot(base)).bindings).toMatchObject([
    { actorId: base.input.actorId, tokenId: base.tokens[0]!.id.toLowerCase() }
  ])
  expect(await bindActorTokenInRoom(base.other.caller, base.input)).toEqual(bound)
  await bindActorTokenInRoom(base.other.caller, {
    type: 'REMOVE_ENCOUNTER_SCENE_ACTOR_TOKEN_BINDING',
    commandId: crypto.randomUUID(),
    encounterId: base.run.id,
    expectedEncounterVersion: bound.projection.version,
    actorId: base.input.actorId,
    sceneId: base.sceneId
  })
  await checkpointLiveRoom(base.campaign.id)
  expect((await snapshot(base)).bindings).toEqual([])
}, 60000)
