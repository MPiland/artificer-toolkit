import { makeFunctionReference } from 'convex/server'
import { expect, it } from 'vitest'
import type {
  PendingEncounterRuleOccurrenceSummaryDto,
  ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounters'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import {
  readCheckpointedTokenPosition,
  setupReactionMovementScene
} from '../../tests/fixtures/automaticSceneMovement'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readRoomTimeline,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

const pendingRuleOccurrence = makeFunctionReference<
  'query',
  { encounterId: string },
  PendingEncounterRuleOccurrenceSummaryDto | null
>('encounters/pendingReads:pendingRuleOccurrence')

type Setup = Awaited<ReturnType<typeof setupReactionMovementScene>>

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

/** Every actor's state checksum as Convex holds it once the room checkpoints. */
async function actorChecksums(value: Setup) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) =>
    (
      await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) => q.eq('encounterId', value.base.run.id))
        .collect()
    ).map((actor) => actor.stateChecksum)
  )
}

async function reactorChecksum(value: Setup, reactorId: string) {
  await checkpointLiveRoom(value.base.campaign.id)
  return value.base.t.run(async (ctx) => {
    const reactor = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', value.base.run.id).eq('id', reactorId)
      )
      .unique()
    if (!reactor) throw new Error('Missing reactor actor.')
    return reactor.stateChecksum
  })
}

it.each(['PROMPT', 'AUTO_ROLL'] as const)(
  'offers a System-automatic reaction to its controller as Use/Decline in Assisted mode, then applies it on Use (%s dice)',
  async (rolls) => {
    const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
      outcomeDice: true
    })
    // The GM controls both Creatures, so it answers the choice and rolls the reaction dice.
    if (rolls === 'PROMPT') await setAutoRollDice(base.t, base.owner.userId, false)
    const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
    const beforePause = await actorChecksums(value)
    const root = await executeSceneInRoom(value.owner.caller, value.rootInput)
    const choice = root.result?.occurrence?.pending
    expect(root.result?.occurrence?.status).toBe('PENDING')
    expect(await actorChecksums(value)).toEqual(beforePause)
    if (!choice || choice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the Assisted Use/Decline choice for the automatic reaction.')
    expect(choice.choice).toMatchObject({
      reactorActorId: base.reactor.id,
      options: [expect.objectContaining({ actionSourceKind: 'ENCOUNTER_FEATURE' })]
    })
    expect(choice.choice.options).toHaveLength(1)
    // The decision is addressed to the reactor's controller (the GM), not the mover's token player.
    expect(
      await value.owner.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
    ).toEqual(choice)
    expect(
      await value.player.caller.query(pendingRuleOccurrence, { encounterId: base.run.id })
    ).toBeNull()
    const use = command({
      encounterId: base.run.id,
      pending: choice,
      resolution: { kind: 'OPTION', optionId: choice.choice.options[0]!.optionId }
    })
    await expect(executeInRoom(value.player.caller, { command: use })).rejects.toThrow()
    const used = await executeInRoom(value.owner.caller, { command: use })
    const initial = used.occurrence?.pending
    expect(used.occurrence?.status).toBe('PENDING')
    expect(await actorChecksums(value)).toEqual(beforePause)
    let resistance = initial
    if (rolls === 'PROMPT') {
      if (!initial || initial.kind !== 'D20_EVIDENCE')
        throw new Error('Expected TEST evidence for the used automatic reaction.')
      const enterTest = command({
        encounterId: base.run.id,
        pending: initial,
        resolution: {
          kind: 'ENTER_DICE',
          requestId: initial.request.requestId,
          rawFaces: initial.request.rollMode === 'NORMAL' ? [1] : [1, 1],
          rollMode: initial.request.rollMode
        }
      })
      await expect(executeInRoom(value.player.caller, { command: enterTest })).rejects.toThrow()
      const rolled = await executeInRoom(value.owner.caller, { command: enterTest })
      expect(rolled.occurrence?.status).toBe('PENDING')
      resistance = rolled.occurrence?.pending
      expect(await actorChecksums(value)).toEqual(beforePause)
    }
    if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected the reaction consequence choice after its TEST.')
    const declineCommand = command({
      encounterId: base.run.id,
      pending: resistance,
      resolution: { kind: 'DECLINE' }
    })
    let result = await executeInRoom(value.owner.caller, { command: declineCommand })
    let outcomeEvidenceCount = 0
    for (let index = 0; index < 20 && result.occurrence?.status !== 'COMPLETE'; index++) {
      const outcomeEvidence = result.occurrence?.pending
      if (!outcomeEvidence || outcomeEvidence.kind !== 'ACTION_OUTCOME_EVIDENCE')
        throw new Error('Expected Assisted OUTCOME evidence.')
      expect(await actorChecksums(value)).toEqual(beforePause)
      outcomeEvidenceCount++
      result = await executeInRoom(value.owner.caller, {
        command: command({
          encounterId: base.run.id,
          pending: outcomeEvidence,
          resolution: {
            kind: 'ENTER_INTEGER',
            requestId: outcomeEvidence.request.requestId,
            value: outcomeEvidence.request.min
          }
        })
      })
    }
    if (result.occurrence?.status !== 'COMPLETE')
      throw new Error('Assisted automatic reaction did not complete.')
    if (rolls === 'PROMPT') expect(outcomeEvidenceCount).toBeGreaterThan(0)
    else expect(outcomeEvidenceCount).toBe(0)
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 450,
      y: 50
    })
    // The room journals the command's effects once; a replay answers with the current table state.
    // The decision result carries no `replayed` flag; the room's timeline not growing is its proof.
    const settledChecksums = await actorChecksums(value)
    const settledTimeline = await readRoomTimeline(value.owner.caller, base.campaign.id)
    const replayed = await executeInRoom(value.owner.caller, { command: declineCommand })
    expect(replayed.projection.version).toBe(result.projection.version)
    expect(await actorChecksums(value)).toEqual(settledChecksums)
    expect(await readRoomTimeline(value.owner.caller, base.campaign.id)).toEqual(settledTimeline)
    await expect(
      executeInRoom(value.owner.caller, {
        command: {
          ...declineCommand,
          commandId: crypto.randomUUID(),
          expectedOccurrenceVersion: declineCommand.expectedOccurrenceVersion + 1
        }
      })
    ).rejects.toThrow()
  },
  30_000
)

it('skips a declined System-automatic reaction in Assisted mode without rolling or spending it', async () => {
  const base = await setupCreatureReactionRun(null, false, false, 'AUTOMATIC', 'AUTOMATIC', {
    outcomeDice: true
  })
  const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
  await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
  const reactorBefore = await reactorChecksum(value, base.reactor.id)
  const root = await executeSceneInRoom(value.owner.caller, value.rootInput)
  const choice = root.result?.occurrence?.pending
  if (!choice || choice.kind !== 'MOVEMENT_REACTION')
    throw new Error('Expected the Assisted Use/Decline choice for the automatic reaction.')
  const complete = await executeInRoom(value.owner.caller, {
    command: command({ encounterId: base.run.id, pending: choice, resolution: { kind: 'DECLINE' } })
  })
  expect(complete.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
  expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({ x: 450, y: 50 })
  expect(await reactorChecksum(value, base.reactor.id)).toBe(reactorBefore)
}, 30_000)
