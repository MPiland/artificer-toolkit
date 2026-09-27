import { expect, it, vi } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  setupReactionMovementScene,
  useMovementReactions
} from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { api } from '../_generated/api'
import { executeInRoom, planStagedMovementInRoom } from '../../tests/fixtures/liveSessionWorker'
import { planMovementDecisionInRoom } from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: () => 0 }))

function command(input: {
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

it.each(['USE', 'DECLINE'] as const)(
  'settles Scene Legendary Resistance %s once and retains spatial history at STOP',
  async (selection) => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
      outcomeDice: true,
      stopOnFailedSave: true
    })
    const value = await setupReactionMovementScene(
      base,
      [base.reactor, base.mover],
      [150],
      [
        { x: 150, y: 50 },
        { x: 600, y: 50 }
      ]
    )
    const prefix = await seedSpatialEffect(
      { ...base, sceneId: value.sceneId },
      { x: 275, y: 50 },
      5
    )
    const suffix = await seedSpatialEffect(
      { ...base, sceneId: value.sceneId },
      { x: 475, y: 50 },
      5
    )
    const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
    const initial = await root.publish()
    const choice = initial.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected a movement reaction choice.')
    const selectedRequest = await planMovementDecisionInRoom(
      value.owner.caller,
      command({
        encounterId: base.run.id,
        pending: choice,
        resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
      })
    )
    const resisted = await selectedRequest.publish()
    const pending = resisted.occurrence?.pending
    if (!pending || pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected a Legendary Resistance choice.')
    const resistanceCommand = command({
      encounterId: base.run.id,
      pending,
      resolution:
        selection === 'USE'
          ? { kind: 'OPTION', optionId: pending.options[0]!.optionId }
          : { kind: 'DECLINE' }
    })
    await expect(
      planMovementDecisionInRoom(value.player.caller, resistanceCommand)
    ).rejects.toThrow()
    const request = await planMovementDecisionInRoom(value.owner.caller, resistanceCommand)
    const prepared = { outcome: request.outcome }
    expect(prepared.outcome.kind).toBe('TERMINAL')
    if (prepared.outcome.kind !== 'TERMINAL' || prepared.outcome.result.status !== 'BATCH_COMPLETE')
      throw new Error('Expected cumulative spatial history at the terminal reaction.')
    expect(
      prepared.outcome.result.executions.map((entry) => entry.candidate.candidate.effectId)
    ).toEqual(selection === 'USE' ? [prefix.id, suffix.id] : [prefix.id])
    const reactionDistance =
      prepared.outcome.result.reactionExecutions[0]!.option.candidate.pathDistance
    expect(prepared.outcome.result.executions[0]!.candidate.candidate.pathDistance).toBeLessThan(
      reactionDistance
    )
    if (selection === 'DECLINE')
      expect(prepared.outcome.result.terminalPosition).toEqual({ x: 300, y: 50 })
    const completed = await request.publish()
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    const remaining = await value.owner.caller.run((ctx) =>
      ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('sceneId', value.sceneId)
        )
        .collect()
    )
    expect(remaining.map((entry) => entry.id)).toEqual(selection === 'USE' ? [] : [suffix.id])
    await expect(request.publish()).resolves.toMatchObject({
      replayed: true
    })
  },
  30_000
)

it('issues and settles Legendary Resistance for a used automatic Scene reaction', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', true)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  const used = await useMovementReactions(value)
  expect(used.prepared.outcome.kind).toBe('PENDING')
  const issued = await used.publish()
  const pending = issued.occurrence?.pending
  if (!pending || pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE' || !pending.options[0])
    throw new Error('Expected a Legendary Resistance choice after the reaction Use.')
  const request = await planMovementDecisionInRoom(
    value.owner.caller,
    command({
      encounterId: base.run.id,
      pending,
      resolution: { kind: 'OPTION', optionId: pending.options[0].optionId }
    })
  )
  expect(request.outcome.kind).toBe('TERMINAL')
  await expect(request.publish()).resolves.toMatchObject({
    occurrence: { status: 'COMPLETE', pending: null }
  })
}, 30_000)

it('retains assisted TEST evidence before issuing Legendary Resistance', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
    outcomeDice: true
  })
  await setAutoRollDice(base.t, base.owner.userId, false)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  const root = await planStagedMovementInRoom(value.owner.caller, value.saveId)
  const initial = await root.publish()
  const choice = initial.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected reaction choice.')
  const request = await planMovementDecisionInRoom(
    value.owner.caller,
    command({
      encounterId: base.run.id,
      pending: choice,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    })
  )
  expect(request.outcome.kind).toBe('PENDING')
  const evidence = (await request.publish()).occurrence?.pending
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted TEST evidence.')
  const rolledRequest = await planMovementDecisionInRoom(
    value.owner.caller,
    command({
      encounterId: base.run.id,
      pending: evidence,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: evidence.request.requestId,
        rawFaces: evidence.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: evidence.request.rollMode
      }
    })
  )
  expect(rolledRequest.outcome.kind).toBe('PENDING')
  const resistance = (await rolledRequest.publish()).occurrence?.pending
  if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error('Expected Legendary Resistance choice.')
  let replayRequest = await planMovementDecisionInRoom(
    value.owner.caller,
    command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
  )
  // App rolls post to the table roll log, which needs a username.
  await value.owner.caller.mutation(api.account.updateProfile, {
    username: 'MovementGm',
    bio: null
  })
  let outcomeRequests = 0
  for (let index = 0; ; index++) {
    expect(index).toBeLessThan(20)
    expect(['PENDING', 'TERMINAL']).toContain(replayRequest.outcome.kind)
    const completed = await replayRequest.publish()
    if (completed.occurrence?.status === 'COMPLETE') {
      expect(outcomeRequests).toBeGreaterThan(0)
      await expect(replayRequest.publish()).resolves.toMatchObject({
        replayed: true
      })
      break
    }
    const pending = completed.occurrence?.pending
    if (!pending || pending.kind !== 'ACTION_OUTCOME_EVIDENCE')
      throw new Error('Expected assisted OUTCOME evidence.')
    outcomeRequests++
    // The server rolls the OUTCOME die ("Roll dice"); the response settles with that app roll.
    const appRoll = await executeInRoom(value.owner.caller, {
      command: {
        type: 'ROLL_RULE_EVIDENCE',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: pending.encounterVersion,
        occurrenceId: pending.occurrenceId,
        expectedOccurrenceVersion: pending.occurrenceVersion,
        requestId: pending.request.requestId,
        rollMode: null
      }
    })
    if (!appRoll.evidenceRoll) throw new Error('Expected the recorded OUTCOME roll.')
    expect(appRoll.evidenceRoll).toMatchObject({ faces: [pending.request.min], rollMode: null })
    const rollId = appRoll.evidenceRoll.rollId
    replayRequest = await planMovementDecisionInRoom(
      value.owner.caller,
      command({
        encounterId: base.run.id,
        pending,
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: pending.request.requestId,
          rollId
        }
      })
    )
  }
}, 30_000)
