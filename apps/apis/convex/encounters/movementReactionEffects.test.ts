import { expect, it } from 'vitest'
import { readStoredRunActor } from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import type {
  EncounterExecuteInput,
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  setupCreatureReactionRun,
  reactionRecords
} from '../../tests/fixtures/movementReactionEffects'
import { setupReactionMovementScene } from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { readEncounterActorConditionState } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  roomErrorLogs,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

type Base = Awaited<ReturnType<typeof setupCreatureReactionRun>>

/** Convex's rows after the room checkpoints what it holds (a Run's state is the room's until then, D85). */
async function effects(base: Base) {
  await checkpointLiveRoom(base.campaign.id)
  return base.t.run((ctx) =>
    ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  )
}

async function records(base: Base) {
  await checkpointLiveRoom(base.campaign.id)
  return reactionRecords(base.t, base.run.id)
}

async function publish(scene: Awaited<ReturnType<typeof setupReactionMovementScene>>) {
  return (await executeSceneInRoom(scene.owner.caller, scene.rootInput)).result
}

function resolution(
  encounterId: string,
  pending: { encounterVersion: number; occurrenceId: string; occurrenceVersion: number },
  value: ResolveRuleOccurrenceInputDto['resolution']
): ResolveRuleOccurrenceInputDto {
  return {
    type: 'RESOLVE_RULE_OCCURRENCE',
    commandId: crypto.randomUUID(),
    encounterId,
    expectedVersion: pending.encounterVersion,
    occurrenceId: pending.occurrenceId,
    expectedOccurrenceVersion: pending.occurrenceVersion,
    correlationId: null,
    resolution: value
  }
}

// Assisted play offers an authored automatic reaction to its controller (the GM) as Use/Decline.
async function useAutomaticReaction(
  scene: Awaited<ReturnType<typeof setupReactionMovementScene>>,
  pending: PendingEncounterRuleOccurrenceSummaryDto | null | undefined
) {
  if (!pending || pending.kind !== 'MOVEMENT_REACTION' || !pending.choice.options[0])
    throw new Error('Expected the Assisted Use/Decline reaction choice.')
  return answer(
    scene,
    resolution(scene.base.run.id, pending, {
      kind: 'OPTION',
      optionId: pending.choice.options[0].optionId
    })
  )
}

/** Answers a movement decision through the room. */
async function answer(
  scene: Awaited<ReturnType<typeof setupReactionMovementScene>>,
  command: ResolveRuleOccurrenceInputDto
) {
  return { result: await executeInRoom(scene.owner.caller, { command }), command }
}

function moverConditionIds(row: Parameters<typeof readStoredRunActor>[0]) {
  const actor = readStoredRunActor(row)
  if (actor.kind === 'CHARACTER') throw new Error('Expected a non-Character movement target.')
  return readEncounterActorConditionState(actor.conditions).ids
}

function diceResponse(encounterId: string, input: unknown, face: number): EncounterExecuteInput {
  const result = encounterCommandResultDtoSchema.parse(input)
  const pending = result.occurrence?.pending
  if (!pending || pending.kind !== 'D20_EVIDENCE' || !pending.request)
    throw new Error('Expected repeated condition save evidence.')
  return {
    command: {
      type: 'RESOLVE_RULE_OCCURRENCE',
      encounterId,
      commandId: crypto.randomUUID(),
      expectedVersion: result.projection.version,
      correlationId: null,
      occurrenceId: result.occurrence!.occurrenceId,
      expectedOccurrenceVersion: result.occurrence!.occurrenceVersion,
      resolution: {
        kind: 'ENTER_DICE',
        requestId: pending.request.requestId,
        rawFaces: pending.request.rollMode === 'NORMAL' ? [face] : [face, face],
        rollMode: pending.request.rollMode
      }
    }
  }
}

it('publishes a real repeated-save condition from an Automatic Scene reaction', async () => {
  const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  // Queued values are zero-based and not clamped to the die: 19 is a natural 20 for the reaction's
  // attack, then 0s keep every later die at 1 (minimal damage, and the target's save fails).
  await queueRoomRolls(base.campaign.id, { rolls: [19], repeat: 0 })
  const before = await records(base)
  const choice = await publish(scene)
  const published = await useAutomaticReaction(scene, choice?.occurrence?.pending)

  expect(published.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const created = await effects(base)
  expect(created).toHaveLength(1)
  expect(created[0]).toMatchObject({
    encounterId: base.run.id,
    targetActorId: base.mover.id
  })
  const after = await records(base)
  const actor = after.actors.find((entry) => entry.id === base.mover.id)
  if (!actor) throw new Error('Movement reaction target missing.')
  expect(moverConditionIds(actor)).not.toEqual([])
  expect(before.actors).not.toEqual(after.actors)
}, 30_000)

it('offers an automatic reaction as Use/Decline and keeps it inert until entered dice, then replays one created effect', async () => {
  const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('Expected the System Frightened condition.')
  await setAutoRollDice(base.t, base.owner.userId, false)
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  const before = await records(base)
  const choice = await publish(scene)
  expect(choice?.occurrence).toMatchObject({ status: 'PENDING' })
  expect(await records(base)).toEqual(before)
  expect(await effects(base)).toEqual([])
  const attack = await useAutomaticReaction(scene, choice?.occurrence?.pending)
  const attackPending = attack.result.occurrence?.pending
  if (!attackPending || attackPending.kind !== 'D20_EVIDENCE')
    throw new Error('Expected assisted reaction attack evidence after Use.')
  expect(await effects(base)).toEqual([])
  const stale = resolution(base.run.id, attackPending, {
    kind: 'ENTER_DICE',
    requestId: attackPending.request.requestId,
    rawFaces: attackPending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
    rollMode: attackPending.request.rollMode
  })
  const logsBefore = roomErrorLogs().length
  await expect(
    executeInRoom(scene.owner.caller, {
      command: { ...stale, expectedVersion: stale.expectedVersion - 1 }
    })
  ).rejects.toMatchObject({
    data: {
      code: 'DOMAIN_REJECTED',
      reason: 'VERSION_STALE',
      message: 'Encounter version is stale.'
    }
  })
  // A stale answer is a domain refusal the member sees, not a failure inside the room.
  expect(roomErrorLogs()).toHaveLength(logsBefore)
  expect(await effects(base)).toEqual([])
  const outcome = await answer(
    scene,
    resolution(base.run.id, attackPending, {
      kind: 'ENTER_DICE',
      requestId: attackPending.request.requestId,
      rawFaces: attackPending.request.rollMode === 'NORMAL' ? [20] : [20, 20],
      rollMode: attackPending.request.rollMode
    })
  )
  const outcomePending = outcome.result.occurrence?.pending
  if (!outcomePending || outcomePending.kind !== 'ACTION_OUTCOME_EVIDENCE')
    throw new Error('Expected assisted reaction outcome evidence.')
  let current = await answer(
    scene,
    resolution(base.run.id, outcomePending, {
      kind: 'ENTER_INTEGER',
      requestId: outcomePending.request.requestId,
      value: outcomePending.request.max
    })
  )
  let completed: typeof current | null = null
  for (let step = 0; step < 10; step++) {
    if (current.result.occurrence?.status === 'COMPLETE') {
      completed = current
      break
    }
    const pending = current.result.occurrence?.pending
    if (!pending || (pending.kind !== 'D20_EVIDENCE' && pending.kind !== 'ACTION_OUTCOME_EVIDENCE'))
      throw new Error('Expected assisted immediate reaction evidence.')
    current = await answer(
      scene,
      resolution(
        base.run.id,
        pending,
        pending.kind === 'D20_EVIDENCE'
          ? {
              kind: 'ENTER_DICE',
              requestId: pending.request.requestId,
              rawFaces: pending.request.rollMode === 'NORMAL' ? [1] : [1, 1],
              rollMode: pending.request.rollMode
            }
          : {
              kind: 'ENTER_INTEGER',
              requestId: pending.request.requestId,
              value: pending.request.max
            }
      )
    )
  }
  if (!completed) throw new Error('Assisted immediate reaction did not complete.')
  expect(completed.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(await effects(base)).toHaveLength(1)
  const settled = await records(base)
  await expect(
    executeInRoom(scene.owner.caller, { command: completed.command })
  ).resolves.toMatchObject({ occurrence: { status: 'COMPLETE', pending: null } })
  expect(await records(base)).toEqual(settled)
  expect(await effects(base)).toHaveLength(1)

  let { projection } = completed.result
  let targetTurns = 0
  for (let advances = 0; advances < 12 && targetTurns < 2; advances++) {
    const advanced = await executeInRoom(scene.owner.caller, {
      command: {
        type: 'ADVANCE_TURN',
        encounterId: base.run.id,
        commandId: crypto.randomUUID(),
        expectedVersion: projection.version
      }
    })
    if (projection.currentActorId !== base.mover.id) {
      projection = advanced.projection
      continue
    }
    const resolved = await executeInRoom(
      scene.owner.caller,
      diceResponse(base.run.id, advanced, 20)
    )
    projection = resolved.projection
    targetTurns += 1
    if (targetTurns === 1) {
      expect(await effects(base)).toMatchObject([
        { lifecycle: { schemaVersion: 1, remainingTicks: 1 } }
      ])
      const target = (await records(base)).actors.find((actor) => actor.id === base.mover.id)
      if (!target) throw new Error('Expiry target actor missing.')
      expect(moverConditionIds(target)).toContain(frightened.id)
    }
  }
  expect(targetTurns).toBe(2)
  expect(await effects(base)).toEqual([])
  const expiredTarget = (await records(base)).actors.find((actor) => actor.id === base.mover.id)
  if (!expiredTarget) throw new Error('Expired target actor missing.')
  expect(moverConditionIds(expiredTarget)).not.toContain(frightened.id)
}, 30_000)
