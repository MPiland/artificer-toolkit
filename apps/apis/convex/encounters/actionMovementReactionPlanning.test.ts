import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  reactionInput,
  reactionRecords,
  setupCreatureReactionRun
} from '../../tests/fixtures/movementReaction'
import { createRulesRuntime } from '../rules/runtime'
import {
  executeNativeMovementReactionAction,
  planNativeMovementReactionAction,
  prepareNativeMovementReactionAction,
  settleNativeMovementReactionAction
} from './actionMovementReactions'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'
import { loadMovementTargets } from './movementTargets'

async function issuedReaction(base: Awaited<ReturnType<typeof setupCreatureReactionRun>>) {
  const input = reactionInput({
    encounterId: base.run.id,
    expectedEncounterVersion: base.run.version,
    reactorActorId: base.reactor.id,
    movingActorId: base.mover.id,
    occurrenceId: crypto.randomUUID()
  })
  const discovered = await base.owner.caller.run((ctx) =>
    discoverNativeMovementReactions(ctx, input)
  )
  const entry = discovered.reactionTimeline[0]
  if (!entry || entry.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing movement reaction.')
  const option = entry.group.options[0]
  if (!option) throw new Error('Missing movement reaction option.')
  return { input, option }
}

async function reactionRecordsInContext(
  ctx: Parameters<typeof prepareNativeMovementReactionAction>[0],
  encounterId: string
) {
  return {
    run: await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (query) => query.eq('id', encounterId))
      .unique(),
    actors: await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (query) => query.eq('encounterId', encounterId))
      .collect()
  }
}

describe('native movement reaction action planning', () => {
  it('predicts Creature damage settlement exactly without writing', async () => {
    const base = await setupCreatureReactionRun(null, true)
    const { input, option } = await issuedReaction(base)
    const before = await reactionRecords(base.t, base.run.id)
    const commandId = crypto.randomUUID()
    const occurredAt = '2026-09-13T12:00:00.000Z'
    const settled = await base.owner.caller.run(async (ctx) => {
      const prepared = await prepareNativeMovementReactionAction(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        movementKind: input.movementKind,
        occurrenceId: input.occurrenceId,
        option,
        actorIdByTokenId: input.actorIdByTokenId,
        tokens: input.tokens,
        resolvePerception: input.resolvePerception
      })
      const execution = await executeNativeMovementReactionAction(ctx, {
        runtime: await createRulesRuntime(ctx, base.owner.userId),
        occurrenceId: input.occurrenceId,
        automationMode: 'AUTOMATIC',
        prepared,
        random: (maximum) => maximum - 1
      })
      if (execution.kind !== 'COMPLETE') throw new Error('Expected automatic reaction completion.')
      const sourceAndTargetFacts = structuredClone({
        actor: prepared.prepared.actor,
        target: prepared.prepared.target,
        sourceFacts: prepared.prepared.sourceFacts,
        targetFacts: prepared.prepared.targetFacts
      })
      const beforePlan = await reactionRecordsInContext(ctx, base.run.id)
      const plan = planNativeMovementReactionAction(
        {
          prepared,
          occurrenceId: input.occurrenceId,
          commandId,
          ordinal: 0,
          occurredAt,
          execution
        },
        base.owner.userId
      )
      expect({
        actor: prepared.prepared.actor,
        target: prepared.prepared.target,
        sourceFacts: prepared.prepared.sourceFacts,
        targetFacts: prepared.prepared.targetFacts
      }).toEqual(sourceAndTargetFacts)
      expect(await reactionRecordsInContext(ctx, base.run.id)).toEqual(beforePlan)
      const result = await settleNativeMovementReactionAction(ctx, {
        prepared,
        occurrenceId: input.occurrenceId,
        commandId,
        ordinal: 0,
        occurredAt,
        execution
      })
      expect(result).toEqual({
        application: plan.application,
        reactionExecution: plan.reactionExecution
      })
      const after = await reactionRecordsInContext(ctx, base.run.id)
      const source = after.actors.find((actor) => actor.id === base.reactor.id)
      const target = after.actors.find((actor) => actor.id === base.mover.id)
      if (!source || !target) throw new Error('Missing settled reaction actors.')
      expect(encounterRunActorStateSchema.parse(JSON.parse(source.stateJson))).toEqual(
        plan.sourceActor
      )
      expect(encounterRunActorStateSchema.parse(JSON.parse(target.stateJson))).toEqual(
        plan.targetPlan.updatedActor
      )
      const currentTargets = await loadMovementTargets(ctx, {
        encounterId: base.run.id,
        expectedEncounterVersion: base.run.version,
        targetActorIds: [base.reactor.id, base.mover.id],
        includeReactionSources: true
      })
      for (const actorId of [base.reactor.id, base.mover.id]) {
        const current = currentTargets.get(actorId)
        const projected = plan.projectedTargets.get(actorId)
        if (!current || !projected) throw new Error('Projected movement target is unavailable.')
        expect(projected.actor).toEqual(current.actor)
        expect(projected.state).toEqual(current.state)
        expect(projected.targetDerivedFacts).toEqual(current.targetDerivedFacts)
        expect(projected.effectiveRulePolicyOutput).toEqual(current.effectiveRulePolicyOutput)
      }
      return result
    })
    expect(await reactionRecords(base.t, base.run.id)).not.toEqual(before)
    expect(settled.application.kind).toBe('ENCOUNTER_ACTOR_MECHANICS_BATCH')
  }, 30000)
})
