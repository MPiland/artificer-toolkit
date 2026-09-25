import { describe, expect, it } from 'vitest'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { withEncounterRuleUsageUsed } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { SRD_REACTION_ALLOWANCE_DEFINITION_ID } from '@artificer-toolkit/source-data/srd/ruleState.js'
import {
  reactionInput,
  reactionRecords,
  setupCreatureReactionRun
} from '../../tests/fixtures/movementReaction'
import { createRulesRuntime } from '../rules/runtime'
import {
  executeNativeMovementReactionAction,
  prepareNativeMovementReactionAction,
  settleNativeMovementReactionAction
} from './actionMovementReactions'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'

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

describe('native movement reaction action mechanics', () => {
  it('settles one automatic reaction and consumes its allowance with the target outcome', async () => {
    const base = await setupCreatureReactionRun(null, true)
    const { input, option } = await issuedReaction(base)
    const before = await reactionRecords(base.t, base.run.id)
    const commandId = crypto.randomUUID()
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
      return settleNativeMovementReactionAction(ctx, {
        prepared,
        occurrenceId: input.occurrenceId,
        commandId,
        ordinal: 0,
        occurredAt: new Date().toISOString(),
        execution
      })
    })
    const after = await reactionRecords(base.t, base.run.id)
    const beforeMover = before.actors.find((row) => row.id === base.mover.id)
    const afterMover = after.actors.find((row) => row.id === base.mover.id)
    const afterReactor = after.actors.find((row) => row.id === base.reactor.id)
    if (!beforeMover || !afterMover || !afterReactor)
      throw new Error('Missing movement reaction actor.')
    const moverBefore = encounterRunActorStateSchema.parse(JSON.parse(beforeMover.stateJson))
    const moverAfter = encounterRunActorStateSchema.parse(JSON.parse(afterMover.stateJson))
    if (moverBefore.kind === 'CHARACTER' || moverAfter.kind === 'CHARACTER')
      throw new Error('Expected a non-Character mover.')
    expect(moverAfter.currentHitPoints).toBeLessThan(moverBefore.currentHitPoints)
    expect(
      encounterRunActorStateSchema.parse(JSON.parse(afterReactor.stateJson)).resources
    ).toMatchObject({ ruleUsage: { [SRD_REACTION_ALLOWANCE_DEFINITION_ID]: 1 } })
    expect(settled.reactionExecution).toMatchObject({
      ordinal: 0,
      sourceCommandId: commandId,
      allowance: { beforeUsed: 0, afterUsed: 1 }
    })
    const phases = settled.reactionExecution.phaseReceipts
    expect(phases?.map((phase) => phase.phase)).toEqual(['TEST', 'OUTCOME'])
    expect(phases?.[0]?.boundFactsChecksum).toBe(settled.reactionExecution.initialFactsChecksum)
    expect(phases?.at(-1)?.execution.evidence).toEqual(settled.reactionExecution.execution.evidence)
    expect(phases?.at(-1)?.execution.outputs).toEqual(settled.reactionExecution.execution.outputs)
    expect(after.run).toEqual(before.run)
  }, 30000)

  it('refuses an exhausted issued reaction without writes', async () => {
    const base = await setupCreatureReactionRun(null, true)
    const { input, option } = await issuedReaction(base)
    await base.t.run(async (ctx) => {
      const row = await ctx.db
        .query('encounterRunActors')
        .withIndex('by_encounterId_id', (query) =>
          query.eq('encounterId', base.run.id).eq('id', base.reactor.id)
        )
        .unique()
      if (!row) throw new Error('Missing movement reaction reactor.')
      const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
      const exhausted = encounterRunActorStateSchema.parse({
        ...actor,
        resources: withEncounterRuleUsageUsed(actor, SRD_REACTION_ALLOWANCE_DEFINITION_ID, 1)
      })
      await ctx.db.patch(row._id, {
        stateJson: JSON.stringify(exhausted),
        stateChecksum: checksumCanonicalJson(exhausted)
      })
    })
    const before = await reactionRecords(base.t, base.run.id)
    await expect(
      base.owner.caller.run((ctx) =>
        prepareNativeMovementReactionAction(ctx, {
          encounterId: base.run.id,
          expectedEncounterVersion: base.run.version,
          movementKind: input.movementKind,
          occurrenceId: input.occurrenceId,
          option,
          actorIdByTokenId: input.actorIdByTokenId,
          tokens: input.tokens,
          resolvePerception: input.resolvePerception
        })
      )
    ).rejects.toThrow('no longer eligible')
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)

  it.each(['TEST', 'OUTCOME', 'INCOMPLETE', 'ROLLBACK'] as const)(
    'preserves exact state after %s reaction failure',
    async (failure) => {
      const base = await setupCreatureReactionRun(null, true)
      const { input, option } = await issuedReaction(base)
      const before = await reactionRecords(base.t, base.run.id)
      const attempt = base.owner.caller.run(async (ctx) => {
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
        if (execution.kind !== 'COMPLETE')
          throw new Error('Expected automatic reaction completion.')
        if (!('phaseReceipts' in execution) || !execution.phaseReceipts)
          throw new Error('Expected phased movement reaction evidence.')
        if (failure === 'ROLLBACK') {
          await settleNativeMovementReactionAction(ctx, {
            prepared,
            occurrenceId: input.occurrenceId,
            commandId: crypto.randomUUID(),
            ordinal: 0,
            occurredAt: new Date().toISOString(),
            execution
          })
          throw new Error('abort after reaction settlement')
        }
        await expect(
          settleNativeMovementReactionAction(ctx, {
            prepared,
            occurrenceId: input.occurrenceId,
            commandId: crypto.randomUUID(),
            ordinal: 0,
            occurredAt: new Date().toISOString(),
            execution: {
              ...execution,
              phaseReceipts:
                failure === 'INCOMPLETE'
                  ? undefined
                  : execution.phaseReceipts.map((phase) =>
                      phase.phase === failure
                        ? { ...phase, boundFactsChecksum: '0'.repeat(64) }
                        : phase
                    )
            }
          })
        ).rejects.toThrow(
          failure === 'INCOMPLETE'
            ? 'complete action phase coordinator'
            : `${failure} evidence is stale`
        )
      })
      if (failure === 'ROLLBACK')
        await expect(attempt).rejects.toThrow('abort after reaction settlement')
      else await attempt
      expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    },
    30000
  )

  it('pauses an Assisted reaction without writes', async () => {
    const base = await setupCreatureReactionRun(null, true)
    const { input, option } = await issuedReaction(base)
    const before = await reactionRecords(base.t, base.run.id)
    const execution = await base.owner.caller.run(async (ctx) => {
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
      return executeNativeMovementReactionAction(ctx, {
        runtime: await createRulesRuntime(ctx, base.owner.userId),
        occurrenceId: input.occurrenceId,
        automationMode: 'ASSISTED',
        prepared
      })
    })
    expect(execution.kind).toBe('PENDING')
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)
})
