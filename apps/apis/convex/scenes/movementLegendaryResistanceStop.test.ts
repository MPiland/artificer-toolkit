import { expect, it } from 'vitest'
import { z } from 'zod'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import { setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'
import {
  readCheckpointedHitPoints,
  readCheckpointedTokenPosition,
  setupReactionMovementScene
} from '../../tests/fixtures/automaticSceneMovement'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'
import { readTestActor } from '../../tests/fixtures/storedActors'

useLocalRoomWorker()

const featureChargesSchema = z.object({ featureCharges: z.record(z.string(), z.number()) })

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

// The authored STOP binding, the ON_SAVE_FAIL result path, the Legendary Resistance use and its
// charge receipt are room-held history, pinned in apps/session-worker/test/nativeMovementEvidence.test.ts
// ("a failed movement-reaction save against Legendary Resistance"). Here they read as their
// member-visible effects: where the token ends (the contact at 200 on a failed save, the destination
// on a resisted one), the mover's hit points (the failed-save damage) and its spent charge.
it.each(['USE', 'DECLINE'] as const)(
  'applies authored failed-save STOP after Scene LR %s',
  async (selection) => {
    const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
      outcomeDice: true,
      stopOnFailedSave: true
    })
    const value = await setupReactionMovementScene(base, [base.reactor, base.mover], [50])
    await queueRoomRolls(base.campaign.id, { rolls: [], repeat: 0 })
    const startHitPoints = await readCheckpointedHitPoints(value, base.mover.id)
    const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    const reactionChoice = initial?.occurrence?.pending
    if (
      !reactionChoice ||
      reactionChoice.kind !== 'MOVEMENT_REACTION' ||
      !reactionChoice.choice.options[0]
    )
      throw new Error('Expected issued Scene reaction choice.')
    const resisted = await executeInRoom(value.owner.caller, {
      command: command({
        encounterId: base.run.id,
        pending: reactionChoice,
        resolution: { kind: 'OPTION', optionId: reactionChoice.choice.options[0].optionId }
      })
    })
    const resistance = resisted.occurrence?.pending
    if (!resistance || resistance.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
      throw new Error('Expected issued Scene LR choice.')
    const completed = await executeInRoom(value.owner.caller, {
      command: command({
        encounterId: base.run.id,
        pending: resistance,
        resolution:
          selection === 'USE'
            ? { kind: 'OPTION', optionId: resistance.options[0]!.optionId }
            : { kind: 'DECLINE' }
      })
    })
    expect(completed.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual(
      selection === 'USE' ? { x: 450, y: 50 } : { x: 200, y: 50 }
    )
    const hitPoints = await readCheckpointedHitPoints(value, base.mover.id)
    if (selection === 'USE') expect(hitPoints).toBe(startHitPoints)
    // A failed save deals the bite's minimum, 2d4 + 2.
    else expect(hitPoints).toBe(startHitPoints - 4)
    await checkpointLiveRoom(base.campaign.id)
    const spentCharges = await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (q) =>
          q.eq('encounterId', base.run.id).eq('id', base.mover.id)
        )
        .unique()
      if (!row) throw new Error('Missing Run actor.')
      const parsed = featureChargesSchema.safeParse((await readTestActor(ctx, row)).resources)
      return parsed.success ? Object.values(parsed.data.featureCharges) : []
    })
    expect(spentCharges).toEqual(selection === 'USE' ? [1] : [])
  },
  30_000
)
