import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type { EncounterTimelineDto } from '@artificer-toolkit/schema/api/encounters'
import { planSpatialTerminalFixture } from '../../tests/fixtures/spatialPreparation'
import { readRunActor, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterGmProjection } from '@artificer-toolkit/encounter-persistence/nativeProjection'
import { encounterReadTransaction } from '../encounters/encounterPorts'
import { createSpatialRuleEffectStore } from '@artificer-toolkit/encounter-persistence/spatialEffectStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'

const timeline = makeFunctionReference<
  'query',
  { encounterId: string; limit: number },
  EncounterTimelineDto
>('encounters/timelineReads:timeline')

beforeEach(() => vi.stubEnv('BETTER_AUTH_SECRET', 'spatial-commit-test-secret-at-least-32-bytes'))
afterEach(() => vi.unstubAllEnvs())

async function current(value: Awaited<ReturnType<typeof planSpatialTerminalFixture>>) {
  return value.base.owner.caller.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    if (!row) throw new Error('Fixture Run missing')
    const state = readRunState(row)
    const projection = await readEncounterGmProjection(encounterReadTransaction(ctx), state)
    const scope = await createSpatialRuleEffectStore({ db: createConvexEncounterStore(ctx) }).scope(
      {
        encounterId: state.id,
        sceneId: value.base.sceneId
      }
    )
    const actor = await readRunActor(
      encounterReadTransaction(ctx),
      state,
      value.base.run.actors[0]!.id
    )
    if (actor.kind === 'CHARACTER') throw new Error('Expected a custom spatial actor.')
    return {
      actor,
      effects: await scope!.list(),
      runVersion: state.version,
      projection,
      occurrences: await ctx.db
        .query('encounterRuleOccurrences')
        .withIndex('by_encounterId_state', (q) => q.eq('encounterId', state.id))
        .collect(),
      receipts: await readReceiptHeaders(
        ctx,
        'encounterRuleReceipts',
        await ctx.db.query('encounterRuleReceipts').collect()
      ),
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

it('publishes a terminal movement once with its Scene move, Run receipt and timeline entry', async () => {
  const value = await planSpatialTerminalFixture()
  const { outcome } = value.plan
  if (outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const before = await current(value)
  const first = await value.plan.publish()
  const after = await current(value)

  expect(first).toMatchObject({
    replayed: false,
    delta: {
      kind: 'TOKEN_MOVED',
      tokenId: value.tokenId,
      position: outcome.result.terminalPosition
    },
    occurrence: {
      occurrenceId: outcome.result.occurrenceId,
      occurrenceVersion: 0,
      status: 'COMPLETE'
    }
  })
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.projection.version).toBe(before.projection.version + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toMatchObject([
    {
      collection: 'tokens',
      entityId: value.tokenId,
      value: { entity: { position: outcome.result.terminalPosition } }
    }
  ])
  expect(after.liveCommands).toHaveLength(1)
  const occurrences = after.occurrences.filter(
    (occurrence) => occurrence.id === outcome.result.occurrenceId
  )
  expect(occurrences).toMatchObject([
    { state: 'COMPLETED', version: 0, rootCommandId: value.input.commandId }
  ])
  expect(occurrences).toHaveLength(1)
  const receipts = after.receipts.filter((receipt) => receipt.commandId === value.input.commandId)
  expect(receipts).toMatchObject([
    {
      occurrenceId: outcome.result.occurrenceId,
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
})

it('publishes a stationary terminal without moving the token or advancing the Scene', async () => {
  const value = await planSpatialTerminalFixture([
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 0, y: 0 }
  ])
  const { outcome } = value.plan
  if (outcome.kind !== 'TERMINAL') throw new Error('Expected terminal fixture')
  const before = await current(value)
  const result = await value.plan.publish()
  const after = await current(value)

  expect(result).toMatchObject({ replayed: false, version: 0, delta: null })
  expect(outcome.result.sceneVersion).toBe(0)
  expect(after.runVersion).toBe(before.runVersion + 1)
  expect(after.actor.currentHitPoints).toBe(before.actor.currentHitPoints - 1)
  expect(after.effects).toEqual([])
  expect(after.liveEntities).toEqual(before.liveEntities)
  expect(after.liveStates).toEqual(before.liveStates)
  expect(after.liveCommands).toHaveLength(before.liveCommands.length + 1)
  expect(after.fogSaves).toEqual(before.fogSaves)
  expect(after.fogChunks).toEqual(before.fogChunks)
  expect(after.fogLayers).toEqual(before.fogLayers)
})
