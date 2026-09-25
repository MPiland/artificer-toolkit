import { describe, expect, it } from 'vitest'
import {
  reactionInput,
  reactionRecords,
  setupCreatureReactionRun
} from '../../tests/fixtures/movementReaction'
import { createRulesRuntime } from '../rules/runtime'
import { retainEncounterMovementReactionActionEvidence } from '@artificer-toolkit/rules-runtime/encounterMovementReactionContinuation'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  executeNativeMovementReactionAction,
  planNativeMovementReactionAction,
  prepareNativeMovementReactionAction
} from './actionMovementReactions'
import { replayNativeMovementReactionAction } from './movementReactionReplay'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'

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
  return { input, option, group: entry.group }
}

describe('native movement reaction replay', () => {
  it.each([0, 2])(
    'reproduces a retained pending action after %s responses without writes',
    async (responses) => {
      const base = await setupCreatureReactionRun(null, true)
      const { input, option, group } = await issuedReaction(base)
      const before = await reactionRecords(base.t, base.run.id)
      await base.owner.caller.run(async (ctx) => {
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
        const runtime = await createRulesRuntime(ctx, base.owner.userId)
        const issued = await executeNativeMovementReactionAction(ctx, {
          runtime,
          occurrenceId: input.occurrenceId,
          autoRoll: {},
          prepared
        })
        if (issued.kind !== 'PENDING') throw new Error('Expected issued pending action.')
        let execution: Awaited<ReturnType<typeof advanceNativeActionGraphs>> = issued
        for (let index = 0; index < responses; index++) {
          if (execution.kind !== 'PENDING') throw new Error('Expected another evidence request.')
          execution = await advanceNativeActionGraphs({
            runtime,
            adapter: prepared.prepared.adapter,
            plan: prepared.executionPlan,
            occurrenceId: input.occurrenceId,
            autoRoll: { SOURCE: false, TARGET: false },
            binding: prepared.prepared.binding,
            afterTest: async () => undefined,
            resume: {
              pending: execution,
              resolution: execution.d20Policy
                ? {
                    kind: 'ENTER_DICE',
                    requestId: execution.continuation.request.requestId,
                    rawFaces: execution.d20Policy.rollMode === 'NORMAL' ? [20] : [20, 20],
                    rollMode: execution.d20Policy.rollMode
                  }
                : {
                    kind: 'ENTER_INTEGER',
                    requestId: execution.continuation.request.requestId,
                    value: execution.continuation.request.min
                  }
            }
          })
        }
        if (execution.kind !== 'PENDING') throw new Error('Expected pending action.')
        const timeline = [{ kind: 'CONTROLLER_CHOICE' as const, group }]
        const context = {
          kind: 'ENCOUNTER_MOVEMENT_REACTION' as const,
          schemaVersion: 1 as const,
          root: {
            commandId: crypto.randomUUID(),
            commandFingerprint: 'a'.repeat(64),
            initiatorUserId: base.owner.userId,
            correlationId: null,
            encounterId: base.run.id,
            sceneId: crypto.randomUUID(),
            tokenId: input.movingTokenId,
            expectedEncounterVersion: base.run.version,
            expectedSceneVersion: 0,
            currentSceneVersion: 0,
            movementKind: input.movementKind,
            originalPath: input.path,
            pathChecksum: checksumRuleDocument(input.path),
            pathStartDistance: option.candidate.pathDistance,
            currentPosition: option.candidate.contact,
            terminalPassageStop: null,
            resolutionCommands: []
          },
          spatialSelectionChecksum: 'b'.repeat(64),
          spatialCurrentnessChecksum: 'c'.repeat(64),
          reactionSelectionChecksum: checksumRuleDocument(timeline),
          completedSpatialExecutions: [],
          appliedSpatialPrefix: null,
          completedReactionExecutions: [],
          phase: { kind: 'CHOICE' as const },
          remainingSpatialCandidates: [],
          reactionTimeline: timeline
        }
        const snapshot = retainEncounterMovementReactionActionEvidence({
          continuation: execution.continuation,
          context,
          selectedOptionId: option.optionId,
          rollerActorId:
            execution.roller === 'SOURCE'
              ? option.candidate.reactorActorId
              : option.candidate.movingActorId,
          d20Policy: execution.d20Policy,
          ...(execution.twoPhase ? { twoPhase: execution.twoPhase } : {}),
          ...(execution.phaseReceipts ? { phaseReceipts: execution.phaseReceipts } : {})
        })
        const issuedSnapshot = retainEncounterMovementReactionActionEvidence({
          continuation: issued.continuation,
          context,
          selectedOptionId: option.optionId,
          rollerActorId:
            issued.roller === 'SOURCE'
              ? option.candidate.reactorActorId
              : option.candidate.movingActorId,
          d20Policy: issued.d20Policy,
          ...(issued.twoPhase ? { twoPhase: issued.twoPhase } : {}),
          ...(issued.phaseReceipts ? { phaseReceipts: issued.phaseReceipts } : {})
        })
        await expect(
          replayNativeMovementReactionAction({
            runtime: await createRulesRuntime(ctx, base.owner.userId),
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot,
            retained: { kind: 'PENDING', snapshot }
          })
        ).resolves.toMatchObject({ kind: 'PENDING', continuation: execution.continuation })
        await expect(
          replayNativeMovementReactionAction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot: {
              ...issuedSnapshot,
              request: { ...issuedSnapshot.request, max: issuedSnapshot.request.max - 1 }
            },
            retained: { kind: 'PENDING', snapshot }
          })
        ).rejects.toThrow('The retained movement reaction pending evidence is stale.')
        await expect(
          replayNativeMovementReactionAction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot: {
              ...issuedSnapshot,
              request: { ...issuedSnapshot.request, requestId: crypto.randomUUID() }
            },
            retained: { kind: 'PENDING', snapshot }
          })
        ).rejects.toThrow('The retained movement reaction pending evidence is stale.')
        await expect(
          replayNativeMovementReactionAction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot,
            retained: {
              kind: 'PENDING',
              snapshot: {
                ...snapshot,
                request: { ...snapshot.request, max: snapshot.request.max - 1 }
              }
            }
          })
        ).rejects.toThrow('The retained movement reaction pending evidence is stale.')
        const completed = await executeNativeMovementReactionAction(ctx, {
          runtime,
          occurrenceId: input.occurrenceId,
          autoRoll: {
            [prepared.option.candidate.reactorActorId]: true,
            [prepared.prepared.binding.targetActorId]: true
          },
          prepared,
          random: (maximum) => (maximum === 20 ? maximum - 1 : 0)
        })
        if (completed.kind !== 'COMPLETE') throw new Error('Expected completed critical action.')
        const receipt = planNativeMovementReactionAction(
          {
            prepared,
            occurrenceId: input.occurrenceId,
            commandId: crypto.randomUUID(),
            ordinal: 0,
            occurredAt: new Date().toISOString(),
            execution: completed
          },
          base.owner.userId
        ).reactionExecution
        await expect(
          replayNativeMovementReactionAction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot: snapshot,
            retained: { kind: 'COMPLETE', receipt }
          })
        ).resolves.toMatchObject({ kind: 'COMPLETE', execution: receipt.execution })
        const phases = receipt.phaseReceipts
        if (!phases?.length) throw new Error('Expected retained TEST phase evidence.')
        await expect(
          replayNativeMovementReactionAction({
            runtime,
            occurrenceId: input.occurrenceId,
            prepared,
            issuedSnapshot,
            retained: {
              kind: 'COMPLETE',
              receipt: {
                ...receipt,
                phaseReceipts: phases.map((phase, index) =>
                  index === 0
                    ? {
                        ...phase,
                        execution: {
                          ...phase.execution,
                          outputs: { ...phase.execution.outputs, naturalD20: 1 }
                        }
                      }
                    : phase
                )
              }
            }
          })
        ).rejects.toThrow('The retained movement reaction completion evidence is stale.')
      })
      expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
    },
    30000
  )

  it('reproduces a retained completion without writes and rejects changed facts', async () => {
    const base = await setupCreatureReactionRun(null, true)
    const { input, option } = await issuedReaction(base)
    const before = await reactionRecords(base.t, base.run.id)
    await base.owner.caller.run(async (ctx) => {
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
        autoRoll: {
          [prepared.option.candidate.reactorActorId]: true,
          [prepared.prepared.binding.targetActorId]: true
        },
        prepared,
        random: (maximum) => maximum - 1
      })
      if (execution.kind !== 'COMPLETE') throw new Error('Expected completed action.')
      const receipt = planNativeMovementReactionAction(
        {
          prepared,
          occurrenceId: input.occurrenceId,
          commandId: crypto.randomUUID(),
          ordinal: 0,
          occurredAt: new Date().toISOString(),
          execution
        },
        base.owner.userId
      ).reactionExecution
      const replayed = await replayNativeMovementReactionAction({
        runtime: await createRulesRuntime(ctx, base.owner.userId),
        occurrenceId: input.occurrenceId,
        prepared,
        retained: { kind: 'COMPLETE', receipt }
      })
      expect(replayed).toMatchObject({
        kind: 'COMPLETE',
        execution: receipt.execution,
        phaseReceipts: receipt.phaseReceipts
      })
      const phases = receipt.phaseReceipts
      if (!phases?.length) throw new Error('Expected retained TEST phase evidence.')
      await expect(
        replayNativeMovementReactionAction({
          runtime: await createRulesRuntime(ctx, base.owner.userId),
          occurrenceId: input.occurrenceId,
          prepared,
          retained: {
            kind: 'COMPLETE',
            receipt: {
              ...receipt,
              phaseReceipts: phases.map((phase, index) =>
                index === 0
                  ? {
                      ...phase,
                      execution: {
                        ...phase.execution,
                        outputs: { ...phase.execution.outputs, naturalD20: 1 }
                      }
                    }
                  : phase
              )
            }
          }
        })
      ).rejects.toThrow('The retained movement reaction completion evidence is stale.')
      const changedFacts = {
        ...prepared,
        prepared: {
          ...prepared.prepared,
          binding: {
            ...prepared.prepared.binding,
            currentHitPoints: prepared.prepared.binding.currentHitPoints + 1
          }
        }
      }
      await expect(
        replayNativeMovementReactionAction({
          runtime: await createRulesRuntime(ctx, base.owner.userId),
          occurrenceId: input.occurrenceId,
          prepared: changedFacts,
          retained: { kind: 'COMPLETE', receipt }
        })
      ).rejects.toThrow()
    })
    expect(await reactionRecords(base.t, base.run.id)).toEqual(before)
  }, 30000)
})
