import { makeFunctionReference } from 'convex/server'
import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type {
  SceneGeometryBeginResult,
  SceneGeometryCommandResult
} from '@artificer-toolkit/schema/api/sceneGeometry'
import type { sceneSpatialPrepareInputSchema } from '@artificer-toolkit/schema/api/sceneMovementPerception'
import type { SceneSpatialPreparation } from '@artificer-toolkit/schema/projections/sceneSpatialPreparation'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  setupAutomaticSceneMovement,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'
import { executeEncounterCommand } from '../../tests/fixtures/playerControl'
import { api } from '../_generated/api'
import * as rollRandom from '../lib/rollRandom'
import { commitPreparedMovementResponse } from './movementResolutionCommit.helper'
import { readResponse } from './movementResolutionDocuments'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

type Request = ReturnType<typeof sceneSpatialPrepareInputSchema.parse>
const prepare = makeFunctionReference<'mutation', Request, SceneSpatialPreparation>(
  'scenes/spatialPreparation:prepare'
)
const finish = makeFunctionReference<'mutation', Request, SceneGeometryCommandResult>(
  'scenes/geometryCommands:finish'
)
const begin = makeFunctionReference<
  'mutation',
  ResolveRuleOccurrenceInputDto,
  SceneGeometryBeginResult | null
>('scenes/movementResolutionStaging:begin')
const observe = makeFunctionReference<
  'mutation',
  { saveId: string; characterRevisions: [] },
  { saveId: string }
>('scenes/geometryStaging:observe')

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

async function publish(
  value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>,
  request: Request
) {
  await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
  const before = await mechanics(value)
  const prepared = await value.owner.caller.mutation(prepare, request)
  expect(await mechanics(value)).toEqual(before)
  return { prepared, result: await value.owner.caller.mutation(finish, request) }
}

async function stage(
  value: Awaited<ReturnType<typeof setupAutomaticSceneMovement>>,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  const started = await value.owner.caller.mutation(
    begin,
    response({ encounterId: value.base.run.id, pending, resolution })
  )
  if (!started || started.kind !== 'READY') throw new Error('Expected response geometry staging.')
  return { ...value.request, saveId: started.saveId }
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

  let request: Request = value.request
  let published = await publish(value, request)
  expect(published.prepared.outcome.kind).toBe('PENDING')
  let pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected first spatial save evidence at contact 195.')
  request = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await publish(value, request)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected second spatial save evidence at contact 270.')
  request = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await publish(value, request)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected first retained reaction after spatial evidence.')
  request = await stage(value, pending, { kind: 'DECLINE' })
  published = await publish(value, request)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second retained reaction.')
  request = await stage(value, pending, { kind: 'DECLINE' })
  published = await publish(value, request)
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
  await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
    replayed: true,
    occurrence: { status: 'COMPLETE', pending: null }
  })
  await expect(value.owner.caller.mutation(finish, value.request)).resolves.toMatchObject({
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
  let request: Request = value.request
  let published = await publish(value, request)
  let pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected prefix spatial evidence at contact 220.')
  request = await stage(value, pending, {
    kind: 'ENTER_DICE',
    requestId: pending.request.requestId,
    rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
    rollMode: pending.request.rollMode
  })
  published = await publish(value, request)
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
  request = await stage(value, pending, { kind: 'DECLINE' })
  published = await publish(value, request)
  pending = published.result.occurrence?.pending
  if (!pending || pending.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected second reaction after the entered prefix save.')
  request = await stage(value, pending, { kind: 'DECLINE' })
  published = await publish(value, request)
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
  const appRoll = await value.owner.caller.mutation(executeEncounterCommand, {
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
  request = await stage(value, pending, {
    kind: 'SYSTEM_ROLL',
    requestId: pending.request.requestId,
    rollId: appRoll.evidenceRoll.rollId
  })
  expect(random).toHaveBeenCalledTimes(rolled)
  await value.owner.caller.mutation(observe, { saveId: request.saveId, characterRevisions: [] })
  const beforePrepare = await mechanics(value)
  const beforeEffects = await effects(value)
  const prepared = await value.owner.caller.mutation(prepare, request)
  expect(random).toHaveBeenCalledTimes(rolled)
  expect(await mechanics(value)).toEqual(beforePrepare)
  expect(await effects(value)).toEqual(beforeEffects)
  const rollbackGeometry = {
    ...value.geometry,
    sceneTokens: value.geometry.sceneTokens.map((token) =>
      token.id === value.moverTokenId ? { ...token, position: { x: 420, y: 50 } } : token
    )
  }
  await expect(
    value.owner.caller.run(async (ctx) => {
      await commitPreparedMovementResponse(
        ctx,
        request,
        await readResponse(ctx, request.saveId, rollbackGeometry)
      )
      throw new Error('Rollback prepared movement response.')
    })
  ).rejects.toThrow('Rollback prepared movement response.')
  expect(random).toHaveBeenCalledTimes(rolled)
  expect(await mechanics(value)).toEqual(beforePrepare)
  expect(await effects(value)).toEqual(beforeEffects)
  expect(prepared.outcome.kind).toBe('TERMINAL')
  const completed = await value.owner.caller.mutation(finish, request)
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
  await expect(value.owner.caller.mutation(finish, request)).resolves.toMatchObject({
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
  const { request } = await useMovementReactions(value)
  const before = await mechanics(value)
  const beforeEffects = await effects(value)
  const prepared = await value.owner.caller.mutation(prepare, request)
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
  const first = await value.owner.caller.mutation(finish, request)
  expect(random).toHaveBeenCalledTimes(preparedRolls)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(prefix.id)
  expect((await effects(value)).map((entry) => entry.id)).not.toContain(suffix.id)
  const complete = await mechanics(value)
  await expect(value.owner.caller.mutation(finish, request)).resolves.toEqual({
    ...first,
    replayed: true
  })
  expect(random).toHaveBeenCalledTimes(preparedRolls)
  expect(await mechanics(value)).toEqual(complete)
}, 30_000)
