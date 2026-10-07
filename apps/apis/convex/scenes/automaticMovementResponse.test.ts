import { expect, it } from 'vitest'
import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  readCheckpointedHitPoints,
  readCheckpointedTokenPosition,
  setupAutomaticSceneMovement,
  useMovementReactionsInRoom
} from '../../tests/fixtures/automaticSceneMovement'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import {
  checkpointLiveRoom,
  executeInRoom,
  executeSceneInRoom,
  queueRoomRolls,
  readEncounterHistory,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()

// Reaction order, ordinals and source commands are room-held history, pinned in
// apps/session-worker/test/nativeMovementEvidence.test.ts ("used automatic reactions of a Creature walking east").
it.each(['DECLINE', 'OPTION'] as const)(
  'continues %s into a used automatic reaction at the next contact',
  async (selection) => {
    const value = await setupAutomaticSceneMovement({
      policies: ['CHOICE', 'AUTOMATIC'],
      reactorPositions: [50, 150],
      path: [
        { x: 150, y: 50 },
        { x: 450, y: 50 }
      ]
    })
    await queueRoomRolls(value.base.campaign.id, {
      rolls: Array.from({ length: 2 }, () => [14, 0, 0]).flat(),
      repeat: 0
    })
    /** Convex's rows, after the room checkpoints what it holds (a Run's history is the room's until then, D85). */
    const snapshot = async () => {
      await checkpointLiveRoom(value.base.campaign.id)
      return value.base.t.run(async (ctx) => ({
        runs: await ctx.db.query('encounterRuns').collect(),
        actors: await ctx.db.query('encounterRunActors').collect(),
        occurrences: await ctx.db.query('encounterRuleOccurrences').collect(),
        receiptLedgers: await ctx.db.query('receiptLedgers').collect(),
        receiptLedgerParts: await ctx.db.query('receiptLedgerParts').collect(),
        receipts: await (await readEncounterHistory(ctx)).query('encounterRuleReceipts').collect(),
        commands: await (await readEncounterHistory(ctx)).query('encounterRunCommands').collect(),
        scenes: await ctx.db.query('campaignScenes').collect(),
        entities: await ctx.db.query('sceneLiveEntities').collect()
      }))
    }
    const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    const choice = initial?.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected the authored first controller choice.')
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution:
        selection === 'DECLINE'
          ? { kind: 'DECLINE' }
          : { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const startHitPoints = await readCheckpointedHitPoints(value, value.base.mover.id)
    // Assisted play offers the next authored automatic reaction as Use/Decline; the GM uses it.
    const decided = await executeInRoom(value.owner.caller, { command })
    expect(decided.occurrence).toMatchObject({ status: 'PENDING' })
    const before = await snapshot()
    const used = await useMovementReactionsInRoom(value, 10, decided)
    expect(used.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect(await readCheckpointedTokenPosition(value, value.moverTokenId)).toEqual({
      x: 450,
      y: 50
    })
    const after = await snapshot()
    expect(after.runs[0]!.version).toBe(before.runs[0]!.version + 1)
    // Declining spends one reaction (the automatic one); using the first spends both.
    expect(await readCheckpointedHitPoints(value, value.base.mover.id)).toBe(
      startHitPoints - (selection === 'DECLINE' ? 4 : 8)
    )
    // A fresh answer to the settled decision is stale (D78).
    await expect(
      executeInRoom(value.owner.caller, {
        command: { ...command, commandId: crypto.randomUUID() }
      })
    ).rejects.toMatchObject({ data: { reason: 'VERSION_STALE' } })
    expect(await snapshot()).toEqual(after)
  },
  30_000
)

it.each(['DECLINE', 'OPTION'] as const)(
  'commits a crossed prefix once before %s and preserves it through the next choice',
  async (selection) => {
    const value = await setupAutomaticSceneMovement({
      policies: ['CHOICE', 'CHOICE'],
      reactorPositions: [150, 150],
      path: [
        { x: 150, y: 50 },
        { x: 450, y: 50 }
      ]
    })
    const effect = await seedSpatialEffect(
      { ...value.base, sceneId: value.sceneId },
      { x: 275, y: 50 },
      5
    )
    await queueRoomRolls(value.base.campaign.id, { rolls: [], repeat: 0 })
    const effects = async () => {
      await checkpointLiveRoom(value.base.campaign.id)
      return value.base.t.run((ctx) =>
        ctx.db
          .query('encounterSpatialRuleEffects')
          .withIndex('by_encounterId_sceneId_id', (q) =>
            q.eq('encounterId', value.base.run.id).eq('sceneId', value.sceneId)
          )
          .collect()
      )
    }
    const initial = (await executeSceneInRoom(value.owner.caller, value.rootInput)).result
    expect(initial?.occurrence).toMatchObject({ status: 'PENDING' })
    const choice = initial?.occurrence?.pending
    if (!choice || choice.kind !== 'MOVEMENT_REACTION' || !choice.choice.options[0])
      throw new Error('Expected first mixed movement choice.')
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    const command: ResolveRuleOccurrenceInputDto = {
      type: 'RESOLVE_RULE_OCCURRENCE',
      commandId: crypto.randomUUID(),
      encounterId: value.base.run.id,
      expectedVersion: choice.encounterVersion,
      occurrenceId: choice.occurrenceId,
      expectedOccurrenceVersion: choice.occurrenceVersion,
      correlationId: null,
      resolution:
        selection === 'DECLINE'
          ? { kind: 'DECLINE' }
          : { kind: 'OPTION', optionId: choice.choice.options[0].optionId }
    }
    const next = await executeInRoom(value.owner.caller, { command })
    expect(next.occurrence).toMatchObject({ status: 'PENDING' })
    const nextChoice = next.occurrence?.pending
    if (!nextChoice || nextChoice.kind !== 'MOVEMENT_REACTION')
      throw new Error('Expected the second mixed movement choice.')
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    const terminal = await executeInRoom(value.owner.caller, {
      command: {
        type: 'RESOLVE_RULE_OCCURRENCE',
        commandId: crypto.randomUUID(),
        encounterId: value.base.run.id,
        expectedVersion: nextChoice.encounterVersion,
        occurrenceId: nextChoice.occurrenceId,
        expectedOccurrenceVersion: nextChoice.occurrenceVersion,
        correlationId: null,
        resolution: { kind: 'DECLINE' }
      }
    })
    expect(terminal.occurrence).toMatchObject({ status: 'COMPLETE', pending: null })
    expect((await effects()).find((entry) => entry.id === effect.id)).toBeUndefined()
    if (initial?.delta?.kind !== 'TOKEN_MOVED')
      throw new Error('Expected a committed first segment.')
    expect(initial.delta.position).not.toEqual(value.rootInput.path[0])
  },
  30_000
)
