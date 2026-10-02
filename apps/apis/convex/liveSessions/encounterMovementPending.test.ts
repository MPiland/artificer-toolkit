import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'
import { readReceiptHeaders } from '../lib/receiptLedgers'
// @vitest-environment node
import { expect, it } from 'vitest'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readPendingSnapshot } from '@artificer-toolkit/encounter-persistence/pendingSnapshots'
import { planMovementInRoom } from '../../tests/fixtures/liveSessionWorker'

type Fixture = Awaited<ReturnType<typeof setupAutomaticSceneMovement>>

async function records(value: Fixture) {
  return value.base.t.run(async (ctx) => ({
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', value.base.run.id))
      .unique(),
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
    occurrences: await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', value.base.run.id))
      .collect(),
    receipts: await ctx.db
      .query('encounterRuleReceipts')
      .withIndex('by_encounterId_commandId', (q) => q.eq('encounterId', value.base.run.id))
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRuleReceipts', headers)),
    runCommands: await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_campaignId_commandId', (q) =>
        q.eq('campaignId', value.base.campaign.id).eq('commandId', value.rootInput.commandId)
      )
      .collect()
      .then((headers) => readReceiptHeaders(ctx, 'encounterRunCommands', headers))
  }))
}
it('publishes an Assisted spatial evidence pause without settling retained no-input contact', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const first = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 250, y: 50 },
    5
  )
  const later = await seedSpatialSaveEffect(value, {
    center: { x: 300, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  const before = await records(value)
  const plan = await planMovementInRoom(value.owner.caller, value.rootInput)
  expect(await records(value)).toEqual(before)
  expect(plan.outcome.kind).toBe('PENDING')
  if (plan.outcome.kind !== 'PENDING') throw new Error('Expected spatial dice pause.')
  const context = plan.outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' || context.phase.kind !== 'SPATIAL_EVIDENCE')
    throw new Error('Expected pending spatial evidence before reaction choice.')
  expect(
    context.completedSpatialExecutions.map((entry) => entry.candidate.candidate.effectId)
  ).toEqual([first.id])
  expect(context.phase.currentCandidate.candidate.effectId).toBe(later.id)
  expect(context.appliedSpatialPrefix).toBeNull()
  const nextReaction = context.reactionTimeline[0]
  if (!nextReaction || nextReaction.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected later reaction choice after spatial evidence.')
  expect(context.completedSpatialExecutions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    context.phase.currentCandidate.candidate.pathDistance
  )
  expect(context.phase.currentCandidate.candidate.pathDistance).toBeLessThan(
    nextReaction.group.pathDistance
  )
  const published = await plan.publish()
  const after = await records(value)
  expect(published.occurrence).toMatchObject({ status: 'PENDING' })
  expect(after.run?.version).toBe(before.run?.version)
  expect(after.actors).toEqual(before.actors)
  expect(after.effects).toEqual(before.effects)
  expect(after.occurrences).toHaveLength(before.occurrences.length + 1)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(after.runCommands).toEqual(before.runCommands)
  const retained = after.occurrences.find(
    (entry) => entry.rootCommandId === value.rootInput.commandId
  )
  if (!retained) throw new Error('Pending spatial evidence was not stored.')
  expect(
    (
      await value.base.t.run((ctx) =>
        readPendingSnapshot({ db: createConvexEncounterStoreReader(ctx) }, retained)
      )
    )?.applicationContext
  ).toHaveProperty('completedSpatialExecutions', context.completedSpatialExecutions)
}, 60_000)

it('commits a spatial prefix once before a choice pause', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
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
  const before = await records(value)
  const plan = await planMovementInRoom(value.owner.caller, value.rootInput)
  expect(await records(value)).toEqual(before)
  expect(plan.outcome.kind).toBe('PENDING')
  if (plan.outcome.kind !== 'PENDING') throw new Error('Expected reaction choice pause.')
  const context = plan.outcome.pendingSnapshot.applicationContext
  if (context.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Expected reaction choice context.')
  const prefix = context.appliedSpatialPrefix
  if (prefix?.status !== 'BATCH_COMPLETE' || prefix.batchKind !== 'ENCOUNTER_SPATIAL_MOVEMENT')
    throw new Error('Expected applied spatial prefix.')
  expect(prefix.executions.map((entry) => entry.candidate.candidate.effectId)).toEqual([effect.id])
  expect(prefix.spatialEffectTransitions).toEqual([
    expect.objectContaining({
      effectId: effect.id,
      transition: expect.objectContaining({ kind: 'DELETE' })
    })
  ])
  const choice = context.reactionTimeline.find((entry) => entry.kind === 'CONTROLLER_CHOICE')
  if (!choice || choice.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected controller choice after the spatial contact.')
  expect(prefix.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
    choice.group.pathDistance
  )
  const published = await plan.publish()
  const after = await records(value)
  expect(published.occurrence).toMatchObject({ status: 'PENDING' })
  expect(after.run?.version).toBe(before.run!.version + 1)
  const beforeMover = before.actors.find((actor) => actor.id === value.base.mover.id)
  const afterMover = after.actors.find((actor) => actor.id === value.base.mover.id)
  if (!beforeMover || !afterMover) throw new Error('Spatial target actor is unavailable.')
  const beforeMoverState = encounterRunActorStateSchema.parse(JSON.parse(beforeMover.stateJson))
  const afterMoverState = encounterRunActorStateSchema.parse(JSON.parse(afterMover.stateJson))
  if (beforeMoverState.kind === 'CHARACTER' || afterMoverState.kind === 'CHARACTER')
    throw new Error('Expected a non-Character mover.')
  expect(afterMoverState.currentHitPoints).toBe(beforeMoverState.currentHitPoints - 1)
  expect(after.effects.map((entry) => entry.id)).not.toContain(effect.id)
  expect(after.receipts).toHaveLength(before.receipts.length + 1)
  expect(after.runCommands).toHaveLength(before.runCommands.length + 1)
}, 60_000)
