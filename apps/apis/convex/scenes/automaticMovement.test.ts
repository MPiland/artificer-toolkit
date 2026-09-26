import { expect, it, vi } from 'vitest'
import { makeFunctionReference } from 'convex/server'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import {
  setupAutomaticSceneMovement,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (sides: number) => (sides === 20 ? 14 : 0) }))

const prepare = makeFunctionReference<
  'mutation',
  ReturnType<typeof sceneSpatialPrepareInputSchema.parse>,
  SceneSpatialPreparation
>('scenes/spatialPreparation:prepare')

// Assisted play offers each authored automatic reaction to its controller as Use/Decline; these
// tests use them as the GM (the reactors are Creatures).
it('prepares and publishes used authored automatic movement reactions once', async () => {
  const value = await setupAutomaticSceneMovement()
  const { publish, prepared } = await useMovementReactions(value)
  const before = await value.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    return run?.version
  })
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Automatic terminal was not prepared.')
  expect(prepared.outcome.result.reactionExecutions).toHaveLength(2)
  const first = await publish()
  const replay = await publish()
  expect(replay).toEqual({ ...first, replayed: true })
  const after = await value.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    return run?.version
  })
  expect(after).toBe((before ?? 0) + 1)
})

it('does not publish gameplay state during automatic preparation', async () => {
  const value = await setupAutomaticSceneMovement()
  const before = await value.owner.caller.run(async (ctx) => {
    const actors = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .take(10)
    return actors.map((actor) => actor.stateChecksum)
  })
  await value.owner.caller.mutation(prepare, value.request)
  const after = await value.owner.caller.run(async (ctx) => {
    const actors = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
      .take(10)
    return actors.map((actor) => actor.stateChecksum)
  })
  expect(after).toEqual(before)
})

it('publishes used automatic mechanics once before the next controller choice', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'CHOICE'],
    reactorPositions: [50, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const { publish, prepared } = await useMovementReactions(value, 1)
  expect(prepared.outcome.kind).toBe('PENDING')
  const before = await value.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    return run?.version
  })
  await publish()
  const after = await value.owner.caller.run(async (ctx) => {
    const run = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
    return run?.version
  })
  expect(after).toBe((before ?? 0) + 1)
})

it('retains sequential used automatic reactions at distinct boundaries', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'AUTOMATIC'],
    reactorPositions: [50, 150]
  })
  const { prepared } = await useMovementReactions(value)
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Automatic terminal was not prepared.')
  expect(prepared.outcome.result.reactionExecutions.map((entry) => entry.ordinal)).toEqual([0, 1])
})

it('settles a crossed spatial prefix before its used automatic reaction, with replay', async () => {
  const value = await setupAutomaticSceneMovement({
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const suffixEffect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 475, y: 50 },
    5
  )
  const { publish, prepared, responseCommandId } = await useMovementReactions(value)
  const snapshot = async () =>
    value.owner.caller.run(async (ctx) => ({
      actors: await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect(),
      effects: await ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
        )
        .collect(),
      receipts: await ctx.db
        .query('encounterRuleReceipts')
        .withIndex('by_encounterId_commandId', (q) =>
          q
            .eq('encounterId', value.base.run.id)
            .eq('commandId', responseCommandId ?? value.rootInput.commandId)
        )
        .collect()
    }))
  const before = await snapshot()
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL') throw new Error('Mixed terminal was not prepared.')
  expect(prepared.outcome.result.reactionExecutions).not.toHaveLength(0)
  if (
    prepared.outcome.result.status !== 'BATCH_COMPLETE' ||
    prepared.outcome.result.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT'
  )
    throw new Error('Mixed terminal spatial receipt was not retained.')
  const [prefixExecution, suffixExecution] = prepared.outcome.result.executions
  if (!prefixExecution || !suffixExecution) throw new Error('Expected both spatial executions.')
  const reactionDistances = prepared.outcome.result.reactionExecutions.map(
    (entry) => entry.option.candidate.pathDistance
  )
  expect(prefixExecution.candidate.candidate.pathDistance).toBeLessThan(
    Math.min(...reactionDistances)
  )
  expect(Math.max(...reactionDistances)).toBeLessThan(
    suffixExecution.candidate.candidate.pathDistance
  )
  expect(prepared.outcome.result.terminalPosition).toEqual({ x: 600, y: 50 })
  expect(await snapshot()).toEqual(before)
  const first = await publish()
  const after = await snapshot()
  expect(after.effects.find((entry) => entry.id === effect.id)).toBeUndefined()
  expect(after.effects.find((entry) => entry.id === suffixEffect.id)).toBeUndefined()
  expect(after.receipts).toHaveLength(1)
  expect(JSON.parse(after.receipts[0]!.resultJson)).toEqual(prepared.outcome.result)
  expect(await publish()).toEqual({
    ...first,
    replayed: true
  })
}, 30_000)

it('settles a spatial prefix between a used automatic reaction and later controller choice', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['AUTOMATIC', 'CHOICE'],
    reactorPositions: [50, 250],
    path: [
      { x: 150, y: 50 },
      { x: 700, y: 50 }
    ]
  })
  const effect = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 450, y: 50 },
    5
  )
  const { publish, prepared } = await useMovementReactions(value, 1)
  const before = await value.owner.caller.run(async (ctx) => ({
    effects: await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
  }))
  expect(prepared.outcome.kind).toBe('PENDING')
  if (prepared.outcome.kind !== 'PENDING') throw new Error('Expected later controller choice.')
  const context = prepared.outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected movement reaction context.')
  const prefix = context.appliedSpatialPrefix
  if (prefix?.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Expected applied spatial prefix.')
  const [reaction] = context.completedReactionExecutions
  const [execution] = prefix.executions
  const choice = context.reactionTimeline[0]
  if (!reaction || !execution || choice?.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected automatic, spatial, and choice stages.')
  expect(reaction.option.candidate.pathDistance).toBeLessThan(
    execution.candidate.candidate.pathDistance
  )
  expect(execution.candidate.candidate.pathDistance).toBeLessThan(choice.group.pathDistance)
  expect(await publish()).toMatchObject({
    occurrence: { status: 'PENDING' }
  })
  const after = await value.owner.caller.run(async (ctx) => ({
    effect: await ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .filter((q) => q.eq(q.field('id'), effect.id))
      .unique(),
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique()
  }))
  expect(after.effect).toBeNull()
  expect(after.run?.version).toBe((before.run?.version ?? 0) + 1)
}, 30_000)
