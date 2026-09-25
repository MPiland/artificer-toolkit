import { expect, it } from 'vitest'
import { reactionInput, setupCreatureReactionRun } from '../../tests/fixtures/movementReaction'

import { createRulesRuntime } from '../rules/runtime'
import { prepareNativeMovementReactionAction } from './actionMovementReactions'
import { discoverNativeMovementReactions } from './movementReactionDiscovery'
import {
  continueNativeActionAfterTest,
  prepareNativeActionTest
} from '@artificer-toolkit/rules-runtime/encounterActionExecution'

type PreparedSaveAction = {
  prepared: Awaited<ReturnType<typeof prepareNativeMovementReactionAction>>
  runtime: Awaited<ReturnType<typeof createRulesRuntime>>
  occurrenceId: string
}

async function withPreparedSaveAction(test: (input: PreparedSaveAction) => Promise<void>) {
  const base = await setupCreatureReactionRun(null, false, false, 'CHOICE', 'CHOICE', {
    outcomeDice: true
  })
  const occurrenceId = crypto.randomUUID()
  const input = reactionInput({
    encounterId: base.run.id,
    expectedEncounterVersion: base.run.version,
    reactorActorId: base.reactor.id,
    movingActorId: base.mover.id,
    occurrenceId
  })
  await base.owner.caller.run(async (ctx) => {
    const discovered = await discoverNativeMovementReactions(ctx, input)
    const entry = discovered.reactionTimeline[0]
    if (!entry || entry.kind !== 'CONTROLLER_CHOICE') throw new Error('Missing reaction choice.')
    const option = entry.group.options[0]
    if (!option) throw new Error('Missing reaction option.')
    const prepared = await prepareNativeMovementReactionAction(ctx, {
      encounterId: base.run.id,
      expectedEncounterVersion: base.run.version,
      movementKind: input.movementKind,
      occurrenceId,
      option,
      actorIdByTokenId: input.actorIdByTokenId,
      tokens: input.tokens,
      resolvePerception: input.resolvePerception
    })
    await test({
      prepared,
      runtime: await createRulesRuntime(ctx, base.owner.userId),
      occurrenceId
    })
  })
}

function testInput(input: PreparedSaveAction, autoRoll: boolean) {
  return {
    runtime: input.runtime,
    adapter: input.prepared.prepared.adapter,
    plan: input.prepared.executionPlan,
    occurrenceId: input.occurrenceId,
    binding: input.prepared.prepared.binding,
    autoRoll: { SOURCE: autoRoll, TARGET: autoRoll },
    afterTest: async () => undefined
  }
}

it('seals a genuine failed SAVE TEST before OUTCOME and rejects tampering', async () => {
  await withPreparedSaveAction(async (source) => {
    let randomCalls = 0
    const boundary = await prepareNativeActionTest({
      ...testInput(source, true),
      random: () => {
        randomCalls += 1
        return 0
      }
    })
    expect(boundary.kind).toBe('TEST_BOUNDARY')
    if (boundary.kind !== 'TEST_BOUNDARY') throw new Error('Expected TEST boundary.')
    expect(boundary.execution.outputs.resultPath).toBe('ON_SAVE_FAIL')
    expect(boundary.phaseReceipts).toHaveLength(1)
    expect(randomCalls).toBe(1)

    const tamperedEvidence = structuredClone(boundary)
    tamperedEvidence.d20.rawFaces[0] = 20
    await expect(
      continueNativeActionAfterTest({
        ...testInput(source, true),
        boundary: tamperedEvidence
      })
    ).rejects.toThrow()

    const tamperedFacts = structuredClone(source.prepared.prepared.binding)
    tamperedFacts.currentHitPoints += 1
    await expect(
      continueNativeActionAfterTest({
        ...testInput(source, true),
        binding: tamperedFacts,
        boundary
      })
    ).rejects.toThrow('boundary is stale')

    const tamperedPolicy = structuredClone(boundary)
    tamperedPolicy.d20Policy.modifier += 1
    await expect(
      continueNativeActionAfterTest({
        ...testInput(source, true),
        boundary: tamperedPolicy
      })
    ).rejects.toThrow('TEST policy is stale')

    const tamperedExecution = structuredClone(boundary)
    tamperedExecution.execution.evidence.source.checksum = 'f'.repeat(64)
    tamperedExecution.phaseReceipts[0]!.execution = tamperedExecution.execution
    await expect(
      continueNativeActionAfterTest({
        ...testInput(source, true),
        boundary: tamperedExecution
      })
    ).rejects.toThrow('TEST execution is stale')
  })
}, 30000)

it('pauses and resumes only OUTCOME evidence after an assisted TEST boundary', async () => {
  await withPreparedSaveAction(async (source) => {
    const input = testInput(source, false)
    const pending = await prepareNativeActionTest(input)
    expect(pending.kind).toBe('PENDING')
    if (pending.kind !== 'PENDING') throw new Error('Expected TEST evidence request.')
    const boundary = await prepareNativeActionTest({
      ...input,
      resume: {
        pending,
        resolution: { kind: 'AUTO_ROLL', requestId: pending.continuation.request.requestId }
      },
      random: () => 0
    })
    expect(boundary.kind).toBe('TEST_BOUNDARY')
    if (boundary.kind !== 'TEST_BOUNDARY') throw new Error('Expected TEST boundary.')
    const outcome = await continueNativeActionAfterTest({ ...input, boundary })
    expect(outcome.kind).toBe('PENDING')
    if (outcome.kind !== 'PENDING') throw new Error('Expected OUTCOME evidence request.')
    let outcomeRandomCalls = 0
    let completed: Awaited<ReturnType<typeof continueNativeActionAfterTest>> = outcome
    for (let requestCount = 0; completed.kind === 'PENDING'; requestCount += 1) {
      if (requestCount >= 10) throw new Error('Unexpected OUTCOME evidence count.')
      completed = await continueNativeActionAfterTest({
        ...input,
        boundary,
        resume: {
          pending: completed,
          resolution: {
            kind: 'ENTER_INTEGER',
            requestId: completed.continuation.request.requestId,
            value: completed.continuation.request.min
          }
        },
        random: () => {
          outcomeRandomCalls += 1
          throw new Error('Unexpected fresh roll.')
        }
      })
    }
    expect(completed.kind).toBe('COMPLETE')
    expect(outcomeRandomCalls).toBe(0)
  })
}, 30000)
