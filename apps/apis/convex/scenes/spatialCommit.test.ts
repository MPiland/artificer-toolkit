import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterTimelineDto } from '@artificer-toolkit/schema/api/encounters'
import { sceneGeometryCommandResultSchema } from '@artificer-toolkit/schema/api/sceneGeometry'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import { storedRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { planSpatialTerminalFixture } from '../../tests/fixtures/spatialPreparation'
import { internal } from '../_generated/api'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { readEncounterReplayReceipt } from '@artificer-toolkit/encounter-persistence/replayReceipts'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readGeometrySave } from './geometryDocuments'
import { commitLiveMovement } from '../liveSessions/encounterMovementCommit'
import type { QueryCtx } from '../_generated/server'
import {
  expectedMovementScene,
  nextExternalAuthority
} from '../../tests/fixtures/liveSessionWorker'
import type { LiveSessionMovementCommitInput } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'

const timeline = makeFunctionReference<
  'query',
  { encounterId: string; limit: number },
  EncounterTimelineDto
>('encounters/timelineReads:timeline')

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 'spatial-commit-test-secret-at-least-32-bytes'))
afterEach(() => vi.unstubAllEnvs())

/** The room's commit input for the planned move, with the next authority advance. */
async function commitInput(
  ctx: QueryCtx,
  value: Awaited<ReturnType<typeof planSpatialTerminalFixture>>,
  finish: Partial<LiveSessionMovementCommitInput['finish']> = {}
): Promise<LiveSessionMovementCommitInput> {
  return {
    ...value.plan.commit,
    finish: { ...value.plan.commit.finish, ...finish },
    authority: await nextExternalAuthority(ctx, value.base.campaign.id),
    expectedScene: await expectedMovementScene(ctx, value.saveId, value.plan.outcome)
  }
}

/** Commits the planned move as the room does; a retry replays the published command. */
async function finish(
  value: Awaited<ReturnType<typeof planSpatialTerminalFixture>>,
  hints: Partial<LiveSessionMovementCommitInput['finish']> = {}
) {
  const { scene } = await value.base.owner.caller.run(async (ctx) =>
    commitLiveMovement(ctx, await commitInput(ctx, value, hints))
  )
  return scene
}

function stageFog(value: Awaited<ReturnType<typeof planSpatialTerminalFixture>>) {
  return value.base.owner.caller.mutation(internal.scenes.geometryStaging.stageFog, {
    saveId: value.saveId,
    layer: {
      ownerUserId: value.base.owner.userId,
      width: 32,
      height: 32,
      chunks: [
        {
          index: 0,
          x: 0,
          y: 0,
          width: 32,
          height: 32,
          data: Buffer.alloc(128, 255).toString('base64')
        }
      ]
    }
  })
}

async function current(value: Awaited<ReturnType<typeof planSpatialTerminalFixture>>) {
  return value.base.owner.caller.run(async (ctx) => {
    const { save } = await readGeometrySave(ctx, value.saveId)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const state = readRunState(row)
    const projection = await readEncounterGmProjection(encounterReadTransaction(ctx), state)
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: state.id,
      sceneId: value.base.sceneId
    })
    const actor = await readRunActor(ctx, state, value.base.run.actors[0]!.id)
    if (actor.kind === 'CHARACTER') throw new Error('Expected a custom spatial actor.')
    return {
      save,
      actor,
      effects: await scope!.list(),
      runVersion: state.version,
      projection,
      occurrences: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id))
        .collect(),
      receipts: await ctx.db.query('encounterRuleReceipts').collect(),
      commands: await ctx.db
        .query('encounterRunCommands')
        .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
        .collect(),
      liveStates: await ctx.db.query('sceneLiveStates').collect(),
      liveEntities: await ctx.db.query('sceneLiveEntities').collect(),
      liveCommands: await ctx.db.query('sceneLiveCommands').collect(),
      fogSaves: await ctx.db.query('sceneFogSaves').collect(),
      fogChunks: await ctx.db.query('sceneFogChunks').collect(),
      fogLayers: await ctx.db.query('sceneFogLayers').collect()
    }
  })
}

it('publishes a terminal movement once with its Run receipt and timeline entry', async () => {
  const value = await planSpatialTerminalFixture()
  const before = await current(value)
  const first = await finish(value)
  const after = await current(value)

  expect(first.occurrence).toMatchObject({
    occurrenceId: value.preparation.occurrenceId,
    status: 'COMPLETE'
  })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.projection.version).toBe(before.projection.version + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  const occurrences = after.occurrences.filter(
    (occurrence) => occurrence.id === value.preparation.occurrenceId
  )
  expect(occurrences).toMatchObject([
    { state: 'COMPLETED', version: 0, rootCommandId: value.input.commandId }
  ])
  expect(occurrences).toHaveLength(1)
  const receipts = after.receipts.filter((receipt) => receipt.commandId === value.input.commandId)
  expect(receipts).toMatchObject([
    {
      occurrenceId: value.preparation.occurrenceId,
      commandType: 'MOVE_SCENE_TOKEN',
      encounterVersion: after.runVersion
    }
  ])
  expect(receipts).toHaveLength(1)
  expect(
    after.commands.filter((command) => command.commandType === 'MOVE_SCENE_TOKEN')
  ).toHaveLength(1)
  const history = await value.base.other.caller.query(timeline, {
    encounterId: value.base.run.id,
    limit: 20
  })
  expect(history.entries.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toHaveLength(
    1
  )

  const playerHistory = await value.base.owner.caller.query(timeline, {
    encounterId: value.base.run.id,
    limit: 20
  })
  expect(playerHistory.entries.filter((entry) => entry.commandType === 'MOVE_SCENE_TOKEN')).toEqual(
    []
  )
  expect(
    after.projection.actors.find((actor) => actor.id === after.actor.id)?.currentHitPoints
  ).toBe(after.actor.currentHitPoints)
  expect(await finish(value)).toEqual({ ...first, replayed: true })
  expect(await current(value)).toEqual(after)
})

it('commits a planned terminal movement and its fog in one Scene transaction', async () => {
  const value = await planSpatialTerminalFixture()
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const terminal = value.preparation.outcome.result
  await stageFog(value)
  const before = await current(value)
  const result = await finish(value)
  const after = await current(value)

  expect(result).toMatchObject({
    replayed: false,
    delta: {
      kind: 'TOKEN_MOVED',
      tokenId: value.tokenId,
      position: terminal.terminalPosition
    },
    occurrence: {
      occurrenceId: value.preparation.occurrenceId,
      occurrenceVersion: 0,
      status: 'COMPLETE'
    }
  })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toMatchObject([
    {
      collection: 'tokens',
      entityId: value.tokenId,
      value: {
        entity: {
          position: terminal.terminalPosition
        }
      }
    }
  ])
  expect(after.liveCommands).toHaveLength(1)
  expect(after.fogSaves).toMatchObject([{ status: 'PUBLISHED' }])
  expect(after.fogLayers).toHaveLength(1)
  expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(
    after.commands.filter((command) => command.commandType === 'MOVE_SCENE_TOKEN')
  ).toHaveLength(1)

  const replay = await finish(value)
  expect(replay).toEqual({ ...result, replayed: true })
  expect(await current(value)).toEqual(after)
})

it('rolls back terminal publication when a later staged fog save is malformed', async () => {
  const value = await planSpatialTerminalFixture()
  await stageFog(value)
  await value.base.owner.caller.run(async (ctx) => {
    const fogSave = await ctx.db.query('sceneFogSaves').unique()
    if (!fogSave) throw new Error('Staged fog save missing')
    await ctx.db.patch(fogSave._id, { status: 'PUBLISHED' })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('Stored geometry fog save is inconsistent.')

  expect(await current(value)).toEqual(before)
})

it('rejects a checksum-consistent tampered Scene delta during terminal replay', async () => {
  const value = await planSpatialTerminalFixture()
  const result = await finish(value)
  await value.base.owner.caller.run(async (ctx) => {
    const command = await ctx.db
      .query('sceneLiveCommands')
      .withIndex('by_sceneId_commandId', (q) =>
        q.eq('sceneId', value.base.sceneId).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!command || command.encoding !== 'GEOMETRY')
      throw new Error('Terminal Scene command missing')
    if (command.result.delta?.kind !== 'TOKEN_MOVED') throw new Error('Expected token delta')
    const tampered = sceneGeometryCommandResultSchema.parse({
      ...command.result,
      delta: { ...command.result.delta, position: { x: 999, y: 999 } }
    })
    await ctx.db.patch(command._id, {
      result: tampered,
      resultChecksum: checksumCanonicalJson(tampered)
    })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('replay delta')

  expect(result.replayed).toBe(false)
  expect(await current(value)).toEqual(before)
})

it('refuses missing token source hints before publication writes', async () => {
  const value = await planSpatialTerminalFixture()
  const before = await current(value)

  await expect(finish(value, { tokenOrdinals: undefined })).rejects.toThrow()

  expect(await current(value)).toEqual(before)
})

it('refuses invalid token source hints before publication writes', async () => {
  const value = await planSpatialTerminalFixture()
  const before = await current(value)

  await expect(
    finish(value, { tokenOrdinals: [{ tokenId: value.tokenId, baseOrdinal: 1 }] })
  ).rejects.toThrow()

  expect(await current(value)).toEqual(before)
})

it.each([false, true])('publishes a stationary terminal with fog=%s', async (withFog) => {
  const value = await planSpatialTerminalFixture([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 }
  ])
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  if (withFog) await stageFog(value)
  const before = await current(value)
  const result = await finish(value)
  const after = await current(value)

  expect(result).toMatchObject({ replayed: false, version: withFog ? 1 : 0, delta: null })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toEqual(before.liveEntities)
  if (withFog) {
    expect(after.liveStates).toMatchObject([{ version: 1 }])
    expect(after.liveCommands).toHaveLength(1)
    expect(after.fogSaves).toMatchObject([{ status: 'PUBLISHED' }])
    expect(after.fogLayers).toHaveLength(1)
    const receipt = after.receipts.find(
      (candidate) => candidate.commandId === value.input.commandId
    )
    if (!receipt) throw new Error('Stationary receipt missing')
    const stored = storedRuleExecutionResultDtoSchema.parse(JSON.parse(receipt.resultJson))
    const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(
      JSON.parse(receipt.commandMetadataJson)
    )
    if (stored.status === 'BATCH_COMPLETE') {
      if (stored.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
        throw new Error('Spatial batch receipt missing')
    } else if (stored.status !== 'MOVEMENT_COMPLETE') throw new Error('Spatial receipt missing')
    if (metadata.transition !== 'SPATIAL_MOVEMENT')
      throw new Error('Spatial receipt metadata missing')
    expect(stored.sceneVersion).toBe(1)
    expect(metadata.sceneVersionTransition).toBe('ADVANCED')
    expect(metadata.changedAggregates).toContainEqual(
      expect.objectContaining({
        aggregateKind: 'SCENE',
        aggregateId: value.base.sceneId,
        beforeVersion: 0,
        version: 1
      })
    )
  } else {
    expect(value.preparation.outcome.result.sceneVersion).toBe(0)
    expect(after.liveStates).toEqual(before.liveStates)
    expect(after.liveCommands).toHaveLength(before.liveCommands.length + 1)
    expect(after.fogSaves).toEqual(before.fogSaves)
    expect(after.fogChunks).toEqual(before.fogChunks)
    expect(after.fogLayers).toEqual(before.fogLayers)
  }

  const replay = await finish(value)
  expect(replay).toEqual({ ...result, replayed: true })
  expect(await current(value)).toEqual(after)
})

it('rolls back terminal mechanics and all publication records when the parent transaction fails', async () => {
  const value = await planSpatialTerminalFixture()
  const before = await current(value)

  await expect(
    value.base.owner.caller.run(async (ctx) => {
      await commitLiveMovement(ctx, await commitInput(ctx, value))
      throw new Error('parent publication failed')
    })
  ).rejects.toThrow('parent publication failed')

  expect(await current(value)).toEqual(before)
})

it('rejects a tampered terminal receipt replay without new writes', async () => {
  const value = await planSpatialTerminalFixture()
  await finish(value)
  await value.base.owner.caller.run(async (ctx) => {
    const receipt = await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) =>
        q.eq('encounterId', value.base.run.id).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!receipt) throw new Error('Terminal receipt missing')
    await ctx.db.patch(receipt._id, { resultChecksum: '0'.repeat(64) })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('replay receipt is inconsistent')

  expect(await current(value)).toEqual(before)
})

it('rejects a terminal replay whose stored command omits its occurrence summary', async () => {
  const value = await planSpatialTerminalFixture()
  await finish(value)
  await value.base.owner.caller.run(async (ctx) => {
    const command = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', value.base.campaign.id).eq('commandId', value.input.commandId)
      )
      .unique()
    if (!command || command.commandType !== 'MOVE_SCENE_TOKEN')
      throw new Error('Terminal command missing')
    const tampered = { ...readEncounterReplayReceipt(command), occurrence: null }
    await ctx.db.patch(command._id, {
      replayReceiptJson: JSON.stringify(tampered),
      replayReceiptChecksum: checksumCanonicalJson(tampered)
    })
  })
  const before = await current(value)

  await expect(finish(value)).rejects.toThrow('replay summary is inconsistent')

  expect(await current(value)).toEqual(before)
})

it('rejects changed effect currentness before applying retained outcomes', async () => {
  const value = await planSpatialTerminalFixture()
  await value.base.owner.caller.run(async (ctx) => {
    const scope = await createSpatialRuleEffectStore(ctx).scope({
      encounterId: value.base.run.id,
      sceneId: value.base.sceneId
    })
    await scope!.updateCurrentStateCas({
      id: value.effect.id,
      expectedVersion: value.effect.version,
      lifecycle: { ...value.effect.lifecycle, remainingTicks: 2 },
      spatialState: value.effect.spatialState
    })
  })
  const before = await current(value)
  await expect(finish(value)).rejects.toThrow('stale')
  expect(await current(value)).toEqual(before)
})

it('rejects token control changes before mechanics publication', async () => {
  const value = await planSpatialTerminalFixture()
  await value.base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('sceneDefinitionEntities')
      .withIndex('by_saveId_collection_ordinal', (q) =>
        q.eq('saveId', value.base.saveId).eq('value.collection', 'tokens').eq('ordinal', 0)
      )
      .unique()
    if (!row || row.value.collection !== 'tokens') throw new Error('Fixture token missing')
    const locked = { ...row.value, entity: { ...row.value.entity, locked: true } }
    await ctx.db.patch(row._id, { value: locked, checksum: checksumCanonicalJson(locked) })
  })
  const before = await current(value)
  await expect(finish(value)).rejects.toThrow('token')
  expect(await current(value)).toEqual(before)
})

it('refuses a commit whose frozen preparation differs from the room plan', async () => {
  const value = await planSpatialTerminalFixture()
  if (value.preparation.outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const changed = {
    ...value.preparation,
    outcome: {
      ...value.preparation.outcome,
      result: { ...value.preparation.outcome.result, terminalPosition: { x: 9, y: 0 } }
    }
  }
  await value.base.owner.caller.run(async (ctx) => {
    const { row } = await readGeometrySave(ctx, value.saveId)
    await ctx.db.patch(row._id, {
      spatialPreparationJson: JSON.stringify(changed),
      spatialPreparationChecksum: checksumCanonicalJson(changed)
    })
  })
  const before = await current(value)
  // The commit freezes the room's plan first and never replaces different frozen evidence (D52).
  await expect(finish(value)).rejects.toThrow(
    'Spatial preparation cannot replace previously frozen evidence.'
  )
  expect(await current(value)).toEqual(before)
})

it.each(['root replay', 'pending occurrence'] as const)(
  'refuses %s before replaying mechanics',
  async (kind) => {
    const value = await planSpatialTerminalFixture()
    await value.base.owner.caller.run(async (ctx) => {
      const pending = kind === 'pending occurrence'
      const now = new Date().toISOString()
      await ctx.db.insert('encounterRuleOccurrences', {
        id: crypto.randomUUID(),
        campaignId: value.base.campaign.id,
        encounterId: value.base.run.id,
        rootCommandId: pending ? crypto.randomUUID() : value.input.commandId,
        state: pending ? 'PENDING' : 'COMPLETED',
        version: 0,
        expectedEncounterVersion: value.input.expectedEncounterVersion,
        // Even unreadable pending evidence must block a different command's mechanics.
        pendingSnapshotJson: pending ? '{}' : null,
        pendingSnapshotChecksum: pending ? checksumCanonicalJson({}) : null,
        completedAt: pending ? null : now,
        createdAt: now,
        updatedAt: now
      })
    })
    const before = await current(value)
    await expect(finish(value)).rejects.toThrow(
      kind === 'root replay'
        ? 'Spatial occurrence replay must use the published command.'
        : 'pending rule occurrence'
    )
    expect(await current(value)).toEqual(before)
  }
)
