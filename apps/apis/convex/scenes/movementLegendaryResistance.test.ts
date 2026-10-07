import { expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  readCheckpointedTokenPosition,
  setupReactionMovementScene,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { api } from '../_generated/api'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

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

// The planner's cumulative spatial history at the terminal reaction (which effects were executed, and
// that the prefix settled before the reaction's contact) is read here as the effects the room removed
// and the token's final position; the prefix-before-contact ordering is covered by the producer test
// "settles a crossed spatial prefix before the first reaction contact" in apps/session-worker
// apps/session-worker/test/nativeMovementPlanning.test.ts.
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
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
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
    const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    const choice = initial?.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected a movement reaction choice.')
    const resisted = await executeInRoom(value.owner.caller, {
      command: command({
        encounterId: base.run.id,
        pending: choice,
        resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
      })
    })
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
      executeInRoom(value.player.caller, { command: resistanceCommand })
    ).rejects.toThrow()
    const completed = await executeInRoom(value.owner.caller, { command: resistanceCommand })
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    if (selection === 'DECLINE')
      expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
        x: 300,
        y: 50
      })
    await checkpointLiveRoom(base.campaign.id)
    const remaining = await value.owner.caller.run((ctx) =>
      ctx.db
        .query('encounterSpatialRuleEffects')
        .withIndex('by_encounterId_sceneId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('sceneId', value.sceneId)
        )
        .collect()
    )
    expect(remaining.map((entry) => entry.id)).toEqual(selection === 'USE' ? [] : [suffix.id])
    // The prefix settled when the move reached the reaction, so neither outcome leaves it behind.
    expect(remaining.map((entry) => entry.id)).not.toContain(prefix.id)
  },
  30_000
)

it('issues and settles Legendary Resistance for a used automatic Scene reaction', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', true)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
  const used = await useMovementReactionsInRoom(value)
  const pending = used.occurrence?.pending
  if (!pending || pending.kind !== 'LEGENDARY_RESISTANCE_CHOICE' || !pending.options[0])
    throw new Error('Expected a Legendary Resistance choice after the reaction Use.')
  const completed = await executeInRoom(value.owner.caller, {
    command: command({
      encounterId: base.run.id,
      pending,
      resolution: { kind: 'OPTION', optionId: pending.options[0].optionId }
    })
  })
  expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
}, 30_000)

it('retains assisted TEST evidence before issuing Legendary Resistance', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
    outcomeDice: true
  })
  await setAutoRollDice(base.t, base.owner.userId, false)
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
  const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
  const choice = initial?.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
    throw new Error('Expected reaction choice.')
  const selected = await executeInRoom(value.owner.caller, {
    command: command({
      encounterId: base.run.id,
      pending: choice,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    })
  })
  expect(selected.occurrence).toMatchObject({ status: 'PENDING' })
  const evidence = selected.occurrence?.pending
  if (!evidence || evidence.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted TEST evidence.')
  const rolled = await executeInRoom(value.owner.caller, {
    command: command({
      encounterId: base.run.id,
      pending: evidence,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: evidence.request.requestId,
        rawFaces: evidence.request.rollMode === 'NORMAL' ? [1] : [1, 1],
        rollMode: evidence.request.rollMode
      }
    })
  })
  expect(rolled.occurrence).toMatchObject({ status: 'PENDING' })
  const resistance = rolled.occurrence?.pending
  if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
    throw new Error('Expected Legendary Resistance choice.')
  // App rolls post to the table roll log, which needs a username.
  await value.owner.caller.mutation(api.account.updateProfile, {
    username: 'MovementGm',
    bio: null
  })
  let result = await executeInRoom(value.owner.caller, {
    command: command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
  })
  let outcomeRequests = 0
  for (let index = 0; result.occurrence?.status !== 'COMPLETE'; index++) {
    expect(index).toBeLessThan(20)
    const pending = result.occurrence?.pending
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
    result = await executeInRoom(value.owner.caller, {
      command: command({
        encounterId: base.run.id,
        pending,
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: pending.request.requestId,
          rollId: appRoll.evidenceRoll.rollId
        }
      })
    })
  }
  expect(outcomeRequests).toBeGreaterThan(0)
}, 30_000)
