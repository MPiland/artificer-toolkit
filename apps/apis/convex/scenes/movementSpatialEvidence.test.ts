import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  setupAutomaticSceneMovement,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { api } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import {
  executeInRoom,
  planMovementDecisionInRoom,
  planStagedMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

function response(input: {
  encounterId: string
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number }
  resolution: ResolveRuleOccurrenceInputDto['resolution']
}): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId: input.encounterId,
    expectedVersion: input.pending.encounterVersion,
    occurrenceId: input.pending.occurrenceId,
    expectedOccurrenceVersion: input.pending.occurrenceVersion,
    correlationId: null,
    resolution: input.resolution
  }
}

async function mechanics(value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>) {
  return value.base.t.run(async (ctx) => ({
    runs: await ctx.db.query('encounterRuns').collect(),
    actors: await ctx.db.query('encounterRunActors').collect(),
    occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
    receipts: await ctx.db.query('encounterRuleReceipts').collect(),
    commands: await ctx.db.query('encounterRunCommands').collect(),
    sceneCommands: await ctx.db.query('sceneLiveCommands').collect()
  }))
}

async function effects(value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>) {
  return value.base.t.run((ctx) =>
    ctx.db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
      )
      .collect()
  )
}

async function publish(value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>) {
  const before = await mechanics(value)
  const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  expect(await mechanics(value)).toEqual(before)
  return { root, published: { prepared: { outcome: root.outcome }, result: await root.publish() } }
}

function stage(
  value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  return planMovementDecisionInRoom(
    value.owner.caller,
    response({ encounterId: value.base.run.id, pending, resolution })
  )
}

async function decide(plan: Awaited<ReturnType<typeof stage>>) {
  return { prepared: { outcome: plan.outcome }, result: await plan.publish() }
}

it('publishes two assisted spatial save contacts before both retained reactions', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  const firstEffect = await seedSpatialSaveEffect(value, {
    center: { x: 250, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const secondEffect = await seedSpatialSaveEffect(value, {
    center: { x: 325, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const beforeTarget = (await mechanics(value)).actors.find(
    (actor) => actor.id === value.base.mover.id
  )
  if (!beforeTarget) throw new Error('Expected mover state.')

  const staged = await publish(value)
  let published = staged.published
  let plan: Awaited<ReturnType<typeof stage>>
  expect(published.prepared.outcome.kind).toBe('PENDING')
  let pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected first spatial save evidence at contact 195.')
  plan = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected second spatial save evidence at contact 270.')
  plan = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected first retained reaction after spatial evidence.')
  plan = await stage(value, pending, { kind: 'DECLINE' })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second retained reaction.')
  plan = await stage(value, pending, { kind: 'DECLINE' })
  published = await decide(plan)
  expect(published.prepared.outcome.kind).toBe('TERMINAL')
  expect(published.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(firstEffect.id)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(secondEffect.id)
  const complete = await mechanics(value)
  const target = complete.actors.find((actor) => actor.id === value.base.mover.id)
  if (!target) throw new Error('Expected completed mover state.')
  const targetState = encounterRunActorStateSchema.parse(JSON.parse(target.stateJson))
  const beforeTargetState = encounterRunActorStateSchema.parse(JSON.parse(beforeTarget.stateJson))
  if (targetState.kind === 'CHARACTER' || beforeTargetState.kind === 'CHARACTER')
    throw new Error('Expected a non-Character mover.')
  expect(targetState.currentHitPoints).toBe(beforeTargetState.currentHitPoints - 2)
  await expect(plan.publish()).resolves.toMatchObject({
    replayed: true,
    occurrence: { status: 'COMPLETE', pending: null }
  })
  await expect(staged.root.publish()).resolves.toMatchObject({
    occurrence: { status: 'COMPLETE', pending: null }
  })
  expect(await mechanics(value)).toEqual(complete)
}, 30_000)

it('retains entered prefix dice through reactions and consumes the suffix save once', async () => {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  await setAutoRollDice(value.base.t, value.base.owner.userId, false)
  const prefix = await seedSpatialSaveEffect(value, {
    center: { x: 275, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const suffix = await seedSpatialSaveEffect(value, {
    center: { x: 475, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const random = vi.spyOn(rollRandom, 'nextRollInt')
  const beforeTarget = (await mechanics(value)).actors.find(
    (actor) => actor.id === value.base.mover.id
  )
  if (!beforeTarget) throw new Error('Expected mover state.')
  let { published } = await publish(value)
  let plan: Awaited<ReturnType<typeof stage>>
  let pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected prefix spatial evidence at contact 220.')
  plan = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error(
      `Expected reaction after the entered prefix save; received ${pending?.kind ?? 'none'}.`
    )
  if (
    published.prepared.outcome.kind !== 'PENDING' ||
    published.prepared.outcome.pendingSnapshot.applicationContext.kind !==
      'ENCOUNTER_MOVEMENT_REACTION'
  )
    throw new Error('Expected retained reaction context after prefix spatial evidence.')
  const reactionContext = published.prepared.outcome.pendingSnapshot.applicationContext
  const firstReaction = reactionContext.reactionTimeline[0]
  if (!firstReaction || firstReaction.kind !== 'CONTROLLER_CHOICE')
    throw new Error('Expected first retained controller choice.')
  expect(reactionContext.completedSpatialExecutions[0]?.candidate.candidate.pathDistance).toBe(70)
  expect(reactionContext.root.pathStartDistance).toBe(250)
  expect(firstReaction.group.pathDistance).toBe(250)
  expect(reactionContext.remainingSpatialCandidates[0]?.candidate.pathDistance).toBe(270)
  plan = await stage(value, pending, { kind: 'DECLINE' })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second reaction after the entered prefix save.')
  plan = await stage(value, pending, { kind: 'DECLINE' })
  published = await decide(plan)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected suffix SPATIAL_EVIDENCE after the reaction boundary.')
  // App rolls post to the table roll log, which needs a username.
  await value.owner.caller.mutation(api.account.updateProfile, {
    username: 'MovementGm',
    bio: null
  })
  const beforeSystemRoll = random.mock.calls.length
  // "Roll dice" rolls the save once on the server; the response only settles with that app roll.
  const appRoll = await executeInRoom(value.owner.caller, {
    command: {
      type: 'ROLL_RULE_EVIDENCE',
      encounterId: value.base.run.id,
      commandId: crypto.randomUUID(),
      expectedVersion: pending.encounterVersion,
      occurrenceId: pending.occurrenceId,
      expectedOccurrenceVersion: pending.occurrenceVersion,
      requestId: pending.request.requestId,
      rollMode: null
    }
  })
  if (!appRoll.evidenceRoll) throw new Error('Expected the recorded suffix save roll.')
  expect(appRoll.evidenceRoll).toMatchObject({
    rollMode: pending.request.rollMode,
    derivedRollMode: pending.request.rollMode
  })
  const rolled = beforeSystemRoll + appRoll.evidenceRoll.faces.length
  expect(random).toHaveBeenCalledTimes(rolled)
  plan = await stage(value, pending, {
    kind: 'SYSTEM_ROLL',
    requestId: pending.request.requestId,
    rollId: appRoll.evidenceRoll.rollId
  })
  expect(random).toHaveBeenCalledTimes(rolled)
  expect(plan.outcome.kind).toBe('TERMINAL')
  const completed = await plan.publish()
  expect(random).toHaveBeenCalledTimes(rolled)
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(prefix.id)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(suffix.id)
  const complete = await mechanics(value)
  const target = complete.actors.find((actor) => actor.id === value.base.mover.id)
  if (!target) throw new Error('Expected completed mover state.')
  const targetState = encounterRunActorStateSchema.parse(JSON.parse(target.stateJson))
  const beforeTargetState = encounterRunActorStateSchema.parse(JSON.parse(beforeTarget.stateJson))
  if (targetState.kind === 'CHARACTER' || beforeTargetState.kind === 'CHARACTER')
    throw new Error('Expected a non-Character mover.')
  expect(targetState.currentHitPoints).toBe(beforeTargetState.currentHitPoints - 2)
  await expect(plan.publish()).resolves.toMatchObject({
    replayed: true,
    occurrence: { status: 'COMPLETE', pending: null }
  })
  expect(await mechanics(value)).toEqual(complete)
}, 30_000)

it('retains spatial executions across used automatic reactions before one suffix save roll', async () => {
  const value = await setupAutomaticSceneMovement({
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const prefix = await seedSpatialEffect(
    { ...value.base, sceneId: value.sceneId },
    { x: 275, y: 50 },
    5
  )
  const suffix = await seedSpatialSaveEffect(value, {
    center: { x: 475, y: 50 },
    radius: 5,
    targetActorId: value.base.mover.id
  })
  const random = vi.spyOn(rollRandom, 'nextRollInt')
  // Assisted play offers both authored automatic reactions as Use/Decline; the GM uses each.
  const { publish, prepared } = await useMovementReactions(value)
  const before = await mechanics(value)
  const beforeEffects = await effects(value)
  expect(prepared.outcome.kind).toBe('TERMINAL')
  if (prepared.outcome.kind !== 'TERMINAL' || prepared.outcome.result.status !== 'BATCH_COMPLETE')
    throw new Error('Expected retained automatic spatial terminal.')
  const [prefixExecution, suffixExecution] = prepared.outcome.result.executions
  if (!prefixExecution || !suffixExecution) throw new Error('Expected both spatial executions.')
  const reactionDistances = prepared.outcome.result.reactionExecutions.map(
    (entry) => entry.option.candidate.pathDistance
  )
  expect(prefixExecution.candidate.candidate.pathDistance).toBe(70)
  expect(reactionDistances).toEqual([250, 250])
  expect(suffixExecution.candidate.candidate.pathDistance).toBe(270)
  expect(suffixExecution.d20?.rawFaces).toEqual([1])
  const preparedRolls = random.mock.calls.length
  expect(preparedRolls).toBeGreaterThan(0)
  expect(await mechanics(value)).toEqual(before)
  expect(await effects(value)).toEqual(beforeEffects)
  const first = await publish()
  expect(random).toHaveBeenCalledTimes(preparedRolls)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(prefix.id)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(suffix.id)
  const complete = await mechanics(value)
  await expect(publish()).resolves.toEqual({
    ...first,
    replayed: true
  })
  expect(random).toHaveBeenCalledTimes(preparedRolls)
  expect(await mechanics(value)).toEqual(complete)
}, 30_000)
