import { describe, expect, it } from 'vitest'
import { NO_DEATH_SAVES } from '@artificer-toolkit/schema/subjects/characterState'
import { targetTransitionChecksum } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { FrozenMovementReactionRemainder } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { readMovementTargets } from '../../tests/fixtures/movementTargets'
import { planNativeSpatialMovementPrefix } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPlan'
import { DND5E_UNCONSCIOUS_CONDITION_DEFINITION_ID as UNCONSCIOUS } from '@artificer-toolkit/rules-runtime/systems/dnd5e/identity'
import { applyEncounterMechanicsBatch } from '../../tests/fixtures/mechanicsBatch'
import { setupAutomaticSceneMovement } from '../../tests/fixtures/automaticSceneMovement'
import { executeSceneInRoom, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { readRoomPendingSnapshot } from '../../tests/fixtures/roomPendingSnapshots'
import { setAutoRollDice } from '../../tests/fixtures/rollPreferences'
import { seedSpatialEffect } from '../../tests/fixtures/spatialEffect'
import { seedSpatialSaveEffect } from '../../tests/fixtures/spatialSaveEffect'

useLocalRoomWorker()

type SpatialExecution = FrozenMovementReactionRemainder['completedSpatialExecutions'][number]

/**
 * The spatial execution the real room stored in a move's pause for the hazard the mover crossed
 * before a later save hazard asked for evidence (nothing applied yet), with the stored Run version.
 */
async function completedExecution() {
  const value = await setupAutomaticSceneMovement({
    policies: ['CHOICE', 'CHOICE'],
    reactorPositions: [150, 150],
    path: [
      { x: 150, y: 50 },
      { x: 600, y: 50 }
    ]
  })
  const { base } = value
  const first = await seedSpatialEffect({ ...base, sceneId: value.sceneId }, { x: 250, y: 50 }, 5)
  await seedSpatialSaveEffect(value, {
    center: { x: 300, y: 50 },
    radius: 5,
    targetActorId: base.mover.id
  })
  await setAutoRollDice(base.t, base.owner.userId, false)
  await executeSceneInRoom(value.owner.caller, value.rootInput)
  const snapshot = await readRoomPendingSnapshot(base.t, {
    campaignId: base.campaign.id,
    encounterId: base.run.id,
    rootCommandId: value.rootInput.commandId
  })
  if (snapshot?.applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION')
    throw new Error('Fixture spatial execution is unavailable.')
  const execution = snapshot.applicationContext.completedSpatialExecutions[0]
  if (execution?.candidate.candidate.effectId !== first.id)
    throw new Error('Fixture spatial execution is unavailable.')
  const version = await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', base.run.id))
      .unique()
    if (!row) throw new Error('Missing fixture Run.')
    return row.version
  })
  return {
    base,
    version,
    input: {
      occurrenceId: crypto.randomUUID(),
      executionCommandId: value.rootInput.commandId,
      occurredAt: '2026-09-14T00:00:00.000Z'
    },
    execution
  }
}

describe('planNativeSpatialMovementPrefix', () => {
  it('folds multiple spatial applications once and retains unaffected targets', async () => {
    const { base, version, input, execution } = await completedExecution()
    const targetActorId = execution.candidate.candidate.targetActorId
    const untouchedActorId = base.run.actors.find((actor) => actor.id !== targetActorId)?.id
    if (!untouchedActorId) throw new Error('Fixture Run has no second actor.')
    await base.other.caller.run(async (ctx) => {
      const targets = await readMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        targetActorIds: base.run.actors.map((actor) => actor.id)
      })
      const conditionId = crypto.randomUUID()
      const before = JSON.stringify(targets)
      const second = {
        ...execution,
        targetTransition: {
          checksum: targetTransitionChecksum(targetActorId, execution.targetTransition.after),
          before: execution.targetTransition.after,
          after: { ...execution.targetTransition.after, conditionIds: [conditionId] }
        },
        applications: [
          {
            ordinal: 0,
            sourceNodeId: 'condition',
            sourceOperationKey: 'condition.apply',
            authoredPath: null,
            resolvedPath: 'TEST',
            kind: 'CONDITION_APPLY' as const,
            conditionId,
            beforePresent: false,
            afterPresent: true,
            applied: true
          }
        ]
      } satisfies SpatialExecution
      const result = planNativeSpatialMovementPrefix({
        targets,
        executions: [execution, second],
        encounterId: base.run.id,
        expectedEncounterVersion: version,
        campaignId: base.campaign.id,
        gameSystemId: base.campaign.gameSystemId,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.executionCommandId,
        occurredAt: input.occurredAt,
        userId: base.other.userId
      })
      expect(result.settlements).toHaveLength(1)
      expect(result.settlements[0]!.plan.receiptApplications).toHaveLength(2)
      expect(result.projectedTargets.get(targetActorId)!.state).toEqual({
        current: execution.targetTransition.after.currentHitPoints,
        temporary: execution.targetTransition.after.temporaryHitPoints,
        conditions: [conditionId],
        deathSaves: null
      })
      expect(result.projectedTargets.get(untouchedActorId)).toBe(targets.get(untouchedActorId))
      expect(JSON.stringify(targets)).toBe(before)
      expect(
        planNativeSpatialMovementPrefix({
          targets,
          executions: [execution, second],
          encounterId: base.run.id,
          expectedEncounterVersion: version,
          campaignId: base.campaign.id,
          gameSystemId: base.campaign.gameSystemId,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.executionCommandId,
          occurredAt: input.occurredAt,
          userId: base.other.userId,
          projectTargets: false
        }).projectedTargets.get(targetActorId)
      ).toBe(targets.get(targetActorId))
    })
  })

  it('advances and projects Character facts, while rejecting stale or missing targets', async () => {
    const { execution } = await completedExecution()
    const base = await setupCharacterRun()
    await base.owner.caller.run(async (ctx) => {
      const targets = await readMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.actor.id],
        includeReactionSources: true
      })
      const target = targets.get(base.actor.id)
      const conditionId =
        target?.characterFacts?.prepared.context.registry.system?.conditionTypes[0]?.id
      if (!target || !conditionId) throw new Error('Fixture Character target is unavailable.')
      const after = {
        currentHitPoints: 0,
        temporaryHitPoints: target.state.temporary,
        maximumHitPoints: target.effectiveMaximumHitPoints,
        conditionIds: [conditionId],
        scalarValues: target.effectiveScalarValues,
        deathSaves: target.state.deathSaves
      }
      const characterExecution = {
        ...execution,
        candidate: {
          ...execution.candidate,
          candidate: { ...execution.candidate.candidate, targetActorId: base.actor.id }
        },
        targetTransition: {
          checksum: targetTransitionChecksum(base.actor.id, {
            ...after,
            currentHitPoints: target.state.current,
            conditionIds: [...target.state.conditions]
          }),
          before: {
            currentHitPoints: target.state.current,
            temporaryHitPoints: target.state.temporary,
            maximumHitPoints: target.effectiveMaximumHitPoints,
            conditionIds: [...target.state.conditions],
            scalarValues: { ...target.effectiveScalarValues },
            deathSaves: target.state.deathSaves
          },
          after
        },
        applications: [
          {
            ordinal: 0,
            sourceNodeId: 'damage',
            sourceOperationKey: 'damage',
            authoredPath: null,
            resolvedPath: 'TEST',
            kind: 'DAMAGE' as const,
            requestedAmount: target.state.current,
            resolvedAmount: target.state.current,
            appliedAmount: target.state.current,
            beforeCurrentHitPoints: target.state.current,
            afterCurrentHitPoints: 0,
            beforeTemporaryHitPoints: target.state.temporary,
            afterTemporaryHitPoints: target.state.temporary,
            maximumHitPoints: target.effectiveMaximumHitPoints,
            damageTypeId: crypto.randomUUID(),
            damageDisposition: 'NORMAL' as const,
            incomingHalved: false,
            critical: false
          },
          {
            ordinal: 1,
            sourceNodeId: 'condition',
            sourceOperationKey: 'condition.apply',
            authoredPath: null,
            resolvedPath: 'TEST',
            kind: 'CONDITION_APPLY' as const,
            conditionId,
            beforePresent: false,
            afterPresent: true,
            applied: true
          }
        ]
      } satisfies SpatialExecution
      const input = {
        targets,
        executions: [characterExecution],
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        campaignId: base.campaign.id,
        gameSystemId: base.campaign.gameSystemId,
        occurrenceId: crypto.randomUUID(),
        sourceCommandId: crypto.randomUUID(),
        occurredAt: '2026-09-14T00:00:00.000Z',
        userId: base.owner.userId
      } satisfies Parameters<typeof planNativeSpatialMovementPrefix>[0]
      const result = planNativeSpatialMovementPrefix(input)
      const projected = result.projectedTargets.get(base.actor.id)!
      expect(result.settlements[0]!.plan.characterStreamVersion).toBe(
        base.characterStreamVersion + 1
      )
      expect(result.settlements[0]!.batch.expectedCharacterStreamVersion).toBe(
        base.characterStreamVersion
      )
      expect(projected.characterFacts?.active.play.streamVersion).toBe(
        base.characterStreamVersion + 1
      )
      // Dropping to 0 also makes the Character unconscious (D63).
      expect(projected.state).toEqual({
        current: 0,
        temporary: target.state.temporary,
        conditions: [conditionId, UNCONSCIOUS],
        deathSaves: NO_DEATH_SAVES
      })
      expect(projected.characterReactionSource?.activeConditionDefinitionIds).toEqual([
        conditionId,
        UNCONSCIOUS
      ])
      expect(() => planNativeSpatialMovementPrefix({ ...input, targets: new Map() })).toThrow(
        'target is unavailable'
      )
      expect(() =>
        planNativeSpatialMovementPrefix({
          ...input,
          executions: [
            {
              ...characterExecution,
              targetTransition: {
                ...characterExecution.targetTransition,
                checksum: 'stale'
              }
            }
          ]
        })
      ).toThrow('state is stale')
      const projectedAfter = { ...after, conditionIds: [conditionId, UNCONSCIOUS] }
      const secondExecution = {
        ...characterExecution,
        ordinal: 1,
        candidate: { ...characterExecution.candidate, ordinal: 1 },
        // The next segment starts from the projected Character, now also unconscious.
        targetTransition: {
          checksum: targetTransitionChecksum(base.actor.id, projectedAfter),
          before: projectedAfter,
          after: { ...after, conditionIds: [UNCONSCIOUS] }
        },
        applications: [
          {
            ordinal: 0,
            sourceNodeId: 'condition',
            sourceOperationKey: 'condition.remove',
            authoredPath: null,
            resolvedPath: 'TEST',
            kind: 'CONDITION_REMOVE',
            conditionId,
            sourceActiveEffectId: crypto.randomUUID(),
            beforePresent: true,
            afterPresent: false,
            applied: true
          }
        ]
      } satisfies SpatialExecution
      const nextInput = {
        ...input,
        targets: result.projectedTargets,
        executions: [secondExecution]
      }
      const second = planNativeSpatialMovementPrefix(nextInput)
      const firstBatch = result.settlements[0]!.batch
      const secondBatch = second.settlements[0]!.batch
      expect(secondBatch.commandId).not.toBe(firstBatch.commandId)
      expect(planNativeSpatialMovementPrefix(nextInput).settlements[0]!.batch.commandId).toBe(
        secondBatch.commandId
      )
      await applyEncounterMechanicsBatch(ctx, firstBatch)
      const secondWrite = await applyEncounterMechanicsBatch(ctx, secondBatch)
      expect(secondWrite.characterStreamVersion).toBe(base.characterStreamVersion + 2)
      expect(secondWrite.targetTransition.after.conditionIds).toEqual([UNCONSCIOUS])
    })
  })
})
