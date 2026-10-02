import { expect, it, vi } from 'vitest'
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
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { api } from '../_generated/api'
import {
  executeInRoom,
  planMovementDecisionInRoom,
  planMovementInRoom
} from '../../tests/fixtures/liveSessionWorker'

vi.mock('../lib/rollRandom', () => ({ nextRollInt: (maximum: number) => maximum - 1 }))

async function effects(base: Awaited<ReturnType<typeof setupCreatureReactionRun>>) {
  return base.t.run((ctx) =>
    ctx.db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', base.run.id))
      .take(16)
  )
}

async function publish(scene: Awaited<ReturnType<typeof setupReactionMovementScene>>) {
  const prepared = await planMovementInRoom(scene.owner.caller, scene.rootInput)
  const result = await prepared.publish()
  return { prepared, result }
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

/** Answers a movement decision through the room and publishes it. */
async function answer(
  scene: Awaited<ReturnType<typeof setupReactionMovementScene>>,
  command: ResolveRuleOccurrenceInputDto
) {
  const plan = await planMovementDecisionInRoom(scene.owner.caller, command)
  return {
    prepared: { outcome: plan.outcome },
    result: await plan.publish(),
    command
  }
}

function moverConditionIds(stateJson: string) {
  const actor = encounterRunActorStateSchema.parse(JSON.parse(stateJson))
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
  const before = await reactionRecords(base.t, base.run.id)
  const choice = await publish(scene)
  const published = await useAutomaticReaction(scene, choice.result.occurrence?.pending)

  expect(published.prepared.outcome?.kind).toBe('TERMINAL')
  expect(published.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  const created = await effects(base)
  expect(created).toHaveLength(1)
  expect(created[0]).toMatchObject({
    encounterId: base.run.id,
    targetActorId: base.mover.id
  })
  const actor = (await reactionRecords(base.t, base.run.id)).actors.find(
    (entry) => entry.id === base.mover.id
  )
  if (!actor) throw new Error('Movement reaction target missing.')
  expect(moverConditionIds(actor.stateJson)).not.toEqual([])
  expect(before.actors).not.toEqual((await reactionRecords(base.t, base.run.id)).actors)
}, 30_000)

it('offers an automatic reaction as Use/Decline and keeps it inert until entered dice, then replays one created effect', async () => {
  const base = await setupCreatureReactionRun(null, true, false, 'AUTOMATIC')
  const frightened = srdSystemRecord.conditionTypes.find(
    (condition) => condition.code === 'FRIGHTENED'
  )
  if (!frightened) throw new Error('Expected the System Frightened condition.')
  await setAutoRollDice(base.t, base.owner.userId, false)
  const scene = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  const before = await reactionRecords(base.t, base.run.id)
  const prepared = await planMovementInRoom(scene.owner.caller, scene.rootInput)
  expect(prepared.outcome.kind).toBe('PENDING')
  expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  expect(await effects(base)).toEqual([])

  const choice = await prepared.publish()
  expect(await effects(base)).toEqual([])
  const attack = await useAutomaticReaction(scene, choice.occurrence?.pending)
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
  await expect(
    planMovementDecisionInRoom(scene.owner.caller, {
      ...stale,
      expectedVersion: stale.expectedVersion - 1
    })
  ).rejects.toThrow()
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
    if (current.prepared.outcome?.kind === 'TERMINAL') {
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
  expect(completed.prepared.outcome?.kind).toBe('TERMINAL')
  expect(completed.result.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(await effects(base)).toHaveLength(1)
  const settled = await reactionRecords(base.t, base.run.id)
  await expect(
    executeInRoom(scene.owner.caller, { command: completed.command })
  ).resolves.toMatchObject({ occurrence: { status: 'COMPLETE', pending: null } })
  expect(await reactionRecords(base.t, base.run.id)).toEqual(settled)
  expect(await effects(base)).toHaveLength(1)

  let projection = await scene.owner.caller.query(api.encounters.projectionReads.get, {
    encounterId: base.run.id
  })
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
      const target = (await reactionRecords(base.t, base.run.id)).actors.find(
        (actor) => actor.id === base.mover.id
      )
      if (!target) throw new Error('Expiry target actor missing.')
      expect(moverConditionIds(target.stateJson)).toContain(frightened.id)
    }
  }
  expect(targetTurns).toBe(2)
  expect(await effects(base)).toEqual([])
  const expiredTarget = (await reactionRecords(base.t, base.run.id)).actors.find(
    (actor) => actor.id === base.mover.id
  )
  if (!expiredTarget) throw new Error('Expired target actor missing.')
  expect(moverConditionIds(expiredTarget.stateJson)).not.toContain(frightened.id)
}, 30_000)
