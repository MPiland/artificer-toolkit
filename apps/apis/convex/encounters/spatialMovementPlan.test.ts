import { describe, expect, it } from 'vitest'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { FrozenMovementReactionRemainder } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementRuleService'
import { setupCharacterRun } from '../../tests/fixtures/encounterCharacter'
import { loadMovementTargets } from './movementTargets'
import { planNativeSpatialMovementPrefix } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPlan'
import { applyEncounterMechanicsBatch } from '../../tests/fixtures/mechanicsBatch'
import { planSpatialTerminalFixture } from '../../tests/fixtures/spatialPreparation'

type SpatialExecution = FrozenMovementReactionRemainder['completedSpatialExecutions'][number]

/** A spatial execution the room planned for a real move over one seeded hazard. */
async function completedExecution() {
  const { base, input, preparation } = await planSpatialTerminalFixture()
  if (
    preparation.outcome.kind !== 'TERMINAL' ||
    preparation.outcome.result.status !== 'BATCH_COMPLETE'
  )
    throw new Error('Fixture spatial execution is unavailable.')
  return {
    base,
    input: {
      occurrenceId: preparation.occurrenceId,
      executionCommandId: input.commandId,
      occurredAt: preparation.occurredAt
    },
    execution: preparation.outcome.result.executions[0]!
  }
}

describe('planNativeSpatialMovementPrefix', () => {
  it('folds multiple spatial applications once and retains unaffected targets', async () => {
    const { base, input, execution } = await completedExecution()
    await base.other.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: base.run.actors.map((actor) => actor.id)
      })
      const conditionId = crypto.randomUUID()
      const before = JSON.stringify(targets)
      const second = {
        ...execution,
        targetTransition: {
          checksum: checksumRuleDocument({
            targetActorId: base.run.actors[0]!.id,
            currentHitPoints: 0,
            temporaryHitPoints: 0,
            maximumHitPoints: 1,
            conditionIds: [],
            scalarValues: {}
          }),
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
        expectedEncounterVersion: base.run.version,
        campaignId: base.campaign.id,
        gameSystemId: base.campaign.gameSystemId,
        occurrenceId: input.occurrenceId,
        sourceCommandId: input.executionCommandId,
        occurredAt: input.occurredAt,
        userId: base.other.userId
      })
      expect(result.settlements).toHaveLength(1)
      expect(result.settlements[0]!.plan.receiptApplications).toHaveLength(2)
      expect(result.projectedTargets.get(base.run.actors[0]!.id)!.state).toEqual({
        current: 0,
        temporary: 0,
        conditions: [conditionId]
      })
      expect(result.projectedTargets.get(base.run.actors[1]!.id)).toBe(
        targets.get(base.run.actors[1]!.id)
      )
      expect(JSON.stringify(targets)).toBe(before)
      expect(
        planNativeSpatialMovementPrefix({
          targets,
          executions: [execution, second],
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version,
          campaignId: base.campaign.id,
          gameSystemId: base.campaign.gameSystemId,
          occurrenceId: input.occurrenceId,
          sourceCommandId: input.executionCommandId,
          occurredAt: input.occurredAt,
          userId: base.other.userId,
          projectTargets: false
        }).projectedTargets.get(base.run.actors[0]!.id)
      ).toBe(targets.get(base.run.actors[0]!.id))
    })
  })

  it('advances and projects Character facts, while rejecting stale or missing targets', async () => {
    const { execution } = await completedExecution()
    const base = await setupCharacterRun()
    await base.owner.caller.run(async (ctx) => {
      const targets = await loadMovementTargets(ctx, {
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
        scalarValues: target.effectiveScalarValues
      }
      const characterExecution = {
        ...execution,
        candidate: {
          ...execution.candidate,
          candidate: { ...execution.candidate.candidate, targetActorId: base.actor.id }
        },
        targetTransition: {
          checksum: checksumRuleDocument({
            targetActorId: base.actor.id,
            currentHitPoints: target.state.current,
            temporaryHitPoints: target.state.temporary,
            maximumHitPoints: target.effectiveMaximumHitPoints,
            conditionIds: target.state.conditions,
            scalarValues: target.effectiveScalarValues
          }),
          before: {
            currentHitPoints: target.state.current,
            temporaryHitPoints: target.state.temporary,
            maximumHitPoints: target.effectiveMaximumHitPoints,
            conditionIds: [...target.state.conditions],
            scalarValues: { ...target.effectiveScalarValues }
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
            damageDisposition: 'NORMAL' as const
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
      expect(projected.characterFacts?.active.streamVersion).toBe(base.characterStreamVersion + 1)
      expect(projected.state).toEqual({
        current: 0,
        temporary: target.state.temporary,
        conditions: [conditionId]
      })
      expect(projected.characterReactionSource?.activeConditionDefinitionIds).toEqual([conditionId])
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
      const secondExecution = {
        ...characterExecution,
        ordinal: 1,
        candidate: { ...characterExecution.candidate, ordinal: 1 },
        targetTransition: {
          checksum: checksumRuleDocument({ targetActorId: base.actor.id, ...after }),
          before: after,
          after: { ...after, conditionIds: [] }
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
      expect(secondWrite.targetTransition.after.conditionIds).toEqual([])
    })
  })
})
