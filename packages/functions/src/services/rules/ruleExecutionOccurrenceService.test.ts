import { describe, expect, it, vi } from 'vitest'
import type { DBLike } from '@artificer-toolkit/db'
import {
  storedRuleExecutionResultDtoSchema,
  type ServerRuleExecutionContinuationDto,
  type ServerPublishedRuleDefinitionDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

const mocks = vi.hoisted(() => {
  const receipts = new Map<string, Record<string, unknown>>()
  const occurrences = new Map<string, Record<string, unknown>>()
  return {
    receipts,
    occurrences,
    appendReceipt: vi.fn(async (input: Record<string, unknown>) => {
      mocks.receipts.set(`${input.aggregateId}:${input.commandId}`, input)
    }),
    repository: {
      findReceipt: vi.fn(
        async (_kind: string, aggregateId: string, commandId: string) =>
          mocks.receipts.get(`${aggregateId}:${commandId}`) ?? null
      ),
      lockOccurrence: vi.fn(async (_kind: string, aggregateId: string, occurrenceId: string) => {
        const occurrence = mocks.occurrences.get(occurrenceId)
        return occurrence?.aggregateId === aggregateId ? occurrence : null
      }),
      lockPendingEncounter: vi.fn(async (encounterId: string) => {
        for (const occurrence of mocks.occurrences.values()) {
          if (
            occurrence.aggregateKind === 'ENCOUNTER' &&
            occurrence.aggregateId === encounterId &&
            occurrence.state === 'PENDING'
          )
            return occurrence
        }
        return null
      }),
      createPending: vi.fn(async (input: Record<string, unknown>) => {
        const record = {
          id: input.occurrenceId,
          aggregateKind: input.aggregateKind,
          aggregateId: input.aggregateId,
          rootCommandId: input.rootCommandId,
          state: 'PENDING',
          version: 0,
          expectedAggregateVersion: input.expectedAggregateVersion,
          pendingSnapshot: input.pendingSnapshot,
          completedAt: null,
          createdAt: '2026-08-25T00:00:00.000Z',
          updatedAt: '2026-08-25T00:00:00.000Z'
        }
        mocks.occurrences.set(String(input.occurrenceId), record)
        return record
      }),
      createCompleted: vi.fn(async (input: Record<string, unknown>) => ({
        id: input.occurrenceId,
        aggregateKind: input.aggregateKind,
        aggregateId: input.aggregateId,
        rootCommandId: input.rootCommandId,
        state: 'COMPLETED',
        version: 0,
        expectedAggregateVersion: input.aggregateVersion,
        pendingSnapshot: null,
        completedAt: '2026-08-25T00:00:00.000Z',
        createdAt: '2026-08-25T00:00:00.000Z',
        updatedAt: '2026-08-25T00:00:00.000Z'
      })),
      advancePending: vi.fn(async (input: Record<string, unknown>) => {
        const prior = mocks.occurrences.get(String(input.occurrenceId))!
        const record = {
          ...prior,
          version: Number(prior.version) + 1,
          expectedAggregateVersion: input.nextAggregateVersion,
          pendingSnapshot: input.pendingSnapshot
        }
        mocks.occurrences.set(String(input.occurrenceId), record)
        return record
      }),
      complete: vi.fn(async (input: Record<string, unknown>) => {
        const prior = mocks.occurrences.get(String(input.occurrenceId))!
        const record = {
          ...prior,
          state: 'COMPLETED',
          version: Number(prior.version) + 1,
          expectedAggregateVersion: input.nextAggregateVersion,
          pendingSnapshot: null,
          completedAt: '2026-08-25T00:00:00.000Z'
        }
        mocks.occurrences.set(String(input.occurrenceId), record)
        return record
      }),
      appendReceipt: vi.fn()
    }
  }
})

vi.mock('@artificer-toolkit/db', () => ({
  withTransaction: async (db: { isTransaction?: boolean }, fn: (db: object) => Promise<unknown>) =>
    fn(db.isTransaction ? db : {}),
  createRuleOccurrenceRepository: () => ({
    ...mocks.repository,
    appendReceipt: mocks.appendReceipt
  })
}))

import {
  createRuleExecutionOccurrenceService,
  type RuleExecutionAggregatePort
} from './ruleExecutionOccurrenceService.js'

const continuation = (
  requestId: string,
  sourceChecksum = 'a'.repeat(64)
): ServerRuleExecutionContinuationDto =>
  ({
    schemaVersion: 1 as const,
    occurrenceId: '00000000-0000-4000-8000-000000000001',
    graph: {
      schemaVersion: 1,
      source: {
        definitionId: '00000000-0000-4000-8000-000000000020',
        gameSystemId: '00000000-0000-4000-8000-000000000021',
        definitionFamilyKey: 'test-resolution',
        checksum: sourceChecksum
      },
      capabilityContractVersion: 1,
      factContracts: [],
      nodes: [
        {
          id: 'result',
          operation: { key: 'test.proposal', contractVersion: 1 },
          inputs: { value: { kind: 'LITERAL', value: 14 } }
        }
      ],
      outputs: {
        result: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' }
      }
    },
    facts: {},
    nextNodeIndex: 0,
    nodeOutputs: {},
    trace: [],
    request: {
      requestId,
      kind: 'INTEGER_RANGE' as const,
      nodeId: 'roll',
      ordinal: 0,
      min: 1,
      max: 20
    },
    authority: 'APPLICATION_SERVICE' as const,
    redaction: 'SERVER_ONLY' as const,
    seal: 'a'.repeat(64)
  }) as unknown as ServerRuleExecutionContinuationDto

const publishedDefinition: ServerPublishedRuleDefinitionDto = {
  id: '00000000-0000-4000-8000-000000000020',
  gameSystemId: '00000000-0000-4000-8000-000000000021',
  definitionFamilyKey: 'test-resolution',
  checksum: 'a'.repeat(64),
  definition: {
    schemaVersion: 1,
    id: '00000000-0000-4000-8000-000000000020',
    gameSystemId: '00000000-0000-4000-8000-000000000021',
    definitionFamilyKey: 'test-resolution',
    nodes: [
      {
        id: 'result',
        operation: { key: 'test.proposal', contractVersion: 1 },
        inputs: { value: { kind: 'LITERAL', value: 14 } }
      }
    ],
    outputs: {
      result: { kind: 'NODE_OUTPUT', nodeId: 'result', port: 'value' }
    }
  }
}

function command(commandId: string, expectedAggregateVersion: number) {
  return {
    commandId,
    correlationId: null,
    expectedAggregateVersion
  }
}

function aggregate(expectedAggregateVersion: number): RuleExecutionAggregatePort {
  let version = expectedAggregateVersion
  return {
    withLockedAuthorized: async <T>(_db: DBLike, run: (context: never) => Promise<T>) =>
      run({
        aggregateKind: 'CHARACTER',
        aggregateId: '00000000-0000-4000-8000-000000000002',
        actorUserId: '00000000-0000-4000-8000-000000000003',
        currentVersion: version,
        advanceVersion: async (_trx: DBLike, expected: number) => {
          expect(version).toBe(expected)
          version += 1
          return version
        }
      } as never)
  }
}

function trackedAggregate(aggregateKind: 'CHARACTER' | 'ENCOUNTER', initialVersion: number) {
  let version = initialVersion
  const advanceVersion = vi.fn(async (_db: DBLike, expected: number) => {
    expect(version).toBe(expected)
    version += 1
    return version
  })
  const port: RuleExecutionAggregatePort = {
    withLockedAuthorized: async <T>(_db: DBLike, run: (context: never) => Promise<T>) =>
      run({
        aggregateKind,
        aggregateId:
          aggregateKind === 'CHARACTER'
            ? '00000000-0000-4000-8000-000000000002'
            : '00000000-0000-4000-8000-000000000004',
        actorUserId: '00000000-0000-4000-8000-000000000003',
        currentVersion: version,
        advanceVersion
      } as never)
  }
  return { port, advanceVersion, currentVersion: () => version }
}

function completePhaseExecution(input: {
  checksum: string
  resultPath: string
}): Extract<
  import('@artificer-toolkit/schema/shared/rulesExecution').ServerRuleExecutionResultDto,
  { status: 'COMPLETE' }
> {
  return {
    status: 'COMPLETE',
    outputs: { resultPath: input.resultPath },
    evidence: {
      source: {
        definitionId: publishedDefinition.id,
        gameSystemId: publishedDefinition.gameSystemId,
        definitionFamilyKey: publishedDefinition.definitionFamilyKey,
        checksum: input.checksum
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: { resultPath: input.resultPath }
    }
  }
}

const phasePlan = (input: {
  initialPhase: 'TEST' | 'OUTCOME'
  phase: 'TEST' | 'OUTCOME'
  templateChecksum: string
  specializedChecksum: string
}) => ({
  ...input,
  template: {
    definitionId: publishedDefinition.id,
    gameSystemId: publishedDefinition.gameSystemId,
    definitionFamilyKey: publishedDefinition.definitionFamilyKey,
    checksum: input.templateChecksum
  },
  boundFactsChecksum: checksumRuleDocument({})
})

describe('createRuleExecutionOccurrenceService', () => {
  it('retains only TEST evidence when a resumed phased action selects no OUTCOME', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const test = phasePlan({
      initialPhase: 'TEST',
      phase: 'TEST',
      templateChecksum: 'b'.repeat(64),
      specializedChecksum: 'a'.repeat(64)
    })
    const resumeWithGraph = vi.fn(
      async (input: { continuation: ServerRuleExecutionContinuationDto }) => ({
        result: completePhaseExecution({
          checksum: test.specializedChecksum,
          resultPath: 'ON_MISS'
        }),
        graph: input.continuation.graph
      })
    )
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: continuation('test', test.specializedChecksum)
        })),
        resumeWithGraph
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const started = await service.executeResolved(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: true,
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        phasePlan: test,
        validatePausedExecution: () => undefined,
        postCompletedExecution: async () => null
      })
    })
    const pending = mocks.occurrences.get(started.occurrenceId)
    if (!pending?.pendingSnapshot) throw new Error('Expected a pending rule occurrence.')
    pending.pendingSnapshot = {
      ...pending.pendingSnapshot,
      optionalCombatSnapshotChecksum: 'c'.repeat(64)
    }
    const completed = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'test', value: 4 },
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        phasePlan: test,
        postCompletedExecution: async () => null
      })
    })
    const resumeInput = resumeWithGraph.mock.calls[0]?.[0]
    if (!resumeInput)
      throw new Error('Expected the pending occurrence to resume through the graph.')
    const resumedContinuation = (resumeInput as { continuation: Record<string, unknown> })
      .continuation
    expect(resumedContinuation).not.toHaveProperty('optionalCombatSnapshotChecksum')
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      phaseReceipts: [{ phase: 'TEST', template: { checksum: 'b'.repeat(64) } }]
    })
    expect((completed as { phaseReceipts?: unknown[] }).phaseReceipts).toHaveLength(1)
  })

  it('retains distinct OUTCOME template and specialized checksums exactly once after resume', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const test = phasePlan({
      initialPhase: 'TEST',
      phase: 'TEST',
      templateChecksum: 'b'.repeat(64),
      specializedChecksum: 'a'.repeat(64)
    })
    const outcome = phasePlan({
      initialPhase: 'OUTCOME',
      phase: 'OUTCOME',
      templateChecksum: 'c'.repeat(64),
      specializedChecksum: 'd'.repeat(64)
    })
    const completedExecutions = [
      completePhaseExecution({ checksum: test.specializedChecksum, resultPath: 'ON_HIT' }),
      completePhaseExecution({ checksum: outcome.specializedChecksum, resultPath: 'ON_HIT' })
    ]
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: continuation('test', test.specializedChecksum)
        })),
        resumeWithGraph: vi.fn(
          async (input: { continuation: ServerRuleExecutionContinuationDto }) => ({
            result: completedExecutions.shift()!,
            graph: input.continuation.graph
          })
        )
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const start = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: true as const,
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        phasePlan: test,
        validatePausedExecution: () => undefined,
        postCompletedExecution: async () => {
          const outcomeContinuation = continuation('outcome', outcome.specializedChecksum)
          return {
            phase: 'OUTCOME' as const,
            phaseReceiptPlan: outcome,
            continuation: outcomeContinuation,
            graph: outcomeContinuation.graph,
            applicationContext: { kind: 'NONE' as const },
            validatePausedExecution: () => undefined
          }
        }
      })
    }
    const started = await service.executeResolved(aggregate(0), start)
    const outcomePending = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'test', value: 12 },
      resolve: start.resolve
    })
    const completed = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000012', 0),
      occurrenceId: outcomePending.occurrenceId,
      expectedOccurrenceVersion: outcomePending.occurrenceVersion,
      response: { requestId: 'outcome', value: 7 },
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        phasePlan: outcome,
        postCompletedExecution: async () => null
      })
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      phaseReceipts: [
        {
          phase: 'TEST',
          template: { checksum: test.template.checksum },
          specializedChecksum: test.specializedChecksum
        },
        {
          phase: 'OUTCOME',
          template: { checksum: outcome.template.checksum },
          specializedChecksum: outcome.specializedChecksum
        }
      ]
    })
    expect((completed as { phaseReceipts?: unknown[] }).phaseReceipts).toHaveLength(2)
  })

  it('persists a hook-created pause with its transition validator, not the prior kernel validator', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const originalValidator = vi.fn(() => {
      throw new Error('prior validator must not receive transition continuation')
    })
    const transitionValidator = vi.fn()
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'COMPLETE' as const,
          outputs: { resultPath: 'ON_SAVE_FAIL' },
          evidence: { trace: [], outputs: {} }
        }))
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    const result = await service.executeResolved(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: true,
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        validatePausedExecution: originalValidator,
        postCompletedExecution: async () => ({
          continuation: continuation('choice'),
          applicationContext: { kind: 'NONE' },
          pendingResult: {
            kind: 'LEGENDARY_RESISTANCE_CHOICE',
            targetActorId: '00000000-0000-4000-8000-000000000002',
            useOptionId: 'a'.repeat(64)
          },
          validatePausedExecution: transitionValidator
        })
      })
    })

    expect(result).toMatchObject({
      status: 'PAUSED',
      pending: { kind: 'LEGENDARY_RESISTANCE_CHOICE' }
    })
    expect(originalValidator).not.toHaveBeenCalled()
    expect(transitionValidator).toHaveBeenCalledTimes(1)
  })

  it('transitions an assisted evidence resume into a separately validated pending choice', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const originalValidator = vi.fn(() => {
      throw new Error('d20 validator must not receive choice continuation')
    })
    const transitionValidator = vi.fn()
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: continuation('d20')
        })),
        resume: vi.fn(async () => ({
          status: 'COMPLETE' as const,
          outputs: { resultPath: 'ON_SAVE_FAIL' },
          evidence: { trace: [], outputs: {} }
        }))
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const started = await service.executeResolved(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: true,
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        validatePausedExecution: transitionValidator
      })
    })
    const resumed = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      resolutionIntent: { selection: 'USE' },
      resolve: async () => ({
        published: publishedDefinition,
        facts: {},
        validatePausedExecution: originalValidator,
        postCompletedExecution: async () => ({
          continuation: continuation('choice'),
          applicationContext: { kind: 'NONE' },
          pendingResult: {
            kind: 'LEGENDARY_RESISTANCE_CHOICE',
            targetActorId: '00000000-0000-4000-8000-000000000002',
            useOptionId: 'a'.repeat(64)
          },
          validatePausedExecution: transitionValidator
        })
      }),
      deriveResponse: async ({ request }) => ({ requestId: request.requestId, value: 17 })
    })

    expect(resumed).toMatchObject({
      status: 'PAUSED',
      pending: { kind: 'LEGENDARY_RESISTANCE_CHOICE' }
    })
    expect(originalValidator).not.toHaveBeenCalled()
    expect(transitionValidator).toHaveBeenCalledTimes(2)
  })

  it('rejects a lane-invalid pause before persisting its occurrence snapshot', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.repository.createPending.mockClear()
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: continuation('d20')
        }))
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    await expect(
      service.executeResolved(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        intent: { actionId: 'action' },
        allowPaused: true,
        resolve: async () => ({
          published: publishedDefinition,
          facts: {},
          validatePausedExecution: () => {
            throw new Error('unsupported direct-action evidence')
          }
        })
      })
    ).rejects.toThrow('unsupported direct-action evidence')

    expect(mocks.repository.createPending).not.toHaveBeenCalled()
    expect(mocks.occurrences.size).toBe(0)
  })

  it('replays a stored public pending summary without resolving the source again', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const resolve = vi.fn(async () => ({
      published: publishedDefinition,
      facts: {},
      pendingResult: { kind: 'D20_EVIDENCE' as const, rollMode: 'ADVANTAGE' as const }
    }))
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: continuation('d20')
        }))
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const input = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: true,
      resolve
    }

    const first = await service.executeResolved(aggregate(0), input)
    const replay = await service.executeResolved(aggregate(0), input)

    expect(first).toMatchObject({
      status: 'PAUSED',
      pending: { kind: 'D20_EVIDENCE', rollMode: 'ADVANTAGE' }
    })
    expect(replay).toEqual(first)
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it.each(['CHARACTER', 'ENCOUNTER'] as const)(
    'anchors %s paused starts and re-pauses to the unchanged aggregate version',
    async (aggregateKind) => {
      mocks.receipts.clear()
      mocks.occurrences.clear()
      mocks.appendReceipt.mockClear()
      const tracked = trackedAggregate(aggregateKind, 0)
      const occurrenceId =
        aggregateKind === 'CHARACTER'
          ? '00000000-0000-4000-8000-000000000001'
          : '00000000-0000-4000-8000-000000000005'
      const service = createRuleExecutionOccurrenceService({
        db: {} as never,
        runtime: {
          execute: vi.fn(async () => ({
            status: 'PAUSED' as const,
            continuation: continuation('A')
          })),
          resume: vi.fn(async () => ({
            status: 'PAUSED' as const,
            continuation: continuation('B')
          }))
        } as unknown as RulesRuntimeService,
        createOccurrenceId: () => occurrenceId
      })

      const started = await service.execute(tracked.port, {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        definitionId: '00000000-0000-4000-8000-000000000020',
        facts: {}
      })
      const pausedAgain = await service.resume(tracked.port, {
        ...command('00000000-0000-4000-8000-000000000011', 0),
        occurrenceId: started.occurrenceId,
        expectedOccurrenceVersion: started.occurrenceVersion,
        response: { requestId: 'A', value: 10 }
      })

      expect(pausedAgain).toMatchObject({
        status: 'PAUSED',
        occurrenceVersion: 1
      })
      expect(tracked.advanceVersion).not.toHaveBeenCalled()
      expect(tracked.currentVersion()).toBe(0)
      expect(mocks.occurrences.get(occurrenceId)).toMatchObject({
        expectedAggregateVersion: 0,
        state: 'PENDING'
      })
      expect(mocks.appendReceipt.mock.calls.map(([receipt]) => receipt)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ aggregateVersion: 0 }),
          expect.objectContaining({ aggregateVersion: 0 })
        ])
      )
    }
  )

  it('rejects a resume after an intervening aggregate version change', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const runtime = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const started = await service.execute(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })

    await expect(
      service.resume(aggregate(1), {
        ...command('00000000-0000-4000-8000-000000000011', 1),
        occurrenceId: started.occurrenceId,
        expectedOccurrenceVersion: started.occurrenceVersion,
        response: { requestId: 'A', value: 10 }
      })
    ).rejects.toThrow('not current')
    expect(runtime.resume).not.toHaveBeenCalled()
  })

  it('keeps a pure complete on the current aggregate version', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('CHARACTER', 0)
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        execute: vi.fn(async () => ({
          status: 'COMPLETE' as const,
          outputs: { result: 14 },
          evidence: {
            source: {
              definitionId: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: { result: 14 }
          }
        })),
        resume: vi.fn()
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    await service.execute(tracked.port, {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })

    expect(tracked.advanceVersion).not.toHaveBeenCalled()
    expect(tracked.currentVersion()).toBe(0)
    expect(mocks.appendReceipt.mock.calls[0]?.[0]).toMatchObject({
      aggregateVersion: 0
    })
  })

  it('replays a matching Encounter start before the one-pending fresh-start gate', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    mocks.repository.lockPendingEncounter.mockClear()
    const tracked = trackedAggregate('ENCOUNTER', 0)
    const runtime = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('pending-roll')
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const start = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    }

    const first = await service.execute(tracked.port, start)
    const replay = await service.execute(tracked.port, start)

    expect(replay).toEqual(first)
    expect(runtime.execute).toHaveBeenCalledTimes(1)
    await expect(
      service.execute(tracked.port, {
        ...start,
        commandId: '00000000-0000-4000-8000-000000000011'
      })
    ).rejects.toThrow('already has a pending rule occurrence')
    expect(runtime.execute).toHaveBeenCalledTimes(1)
    expect(mocks.repository.lockPendingEncounter).toHaveBeenCalled()
  })

  it('rejects a fresh resolved Encounter start before source resolution while another occurrence is pending', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const tracked = trackedAggregate('ENCOUNTER', 0)
    mocks.occurrences.set('00000000-0000-4000-8000-000000000001', {
      id: '00000000-0000-4000-8000-000000000001',
      aggregateKind: 'ENCOUNTER',
      aggregateId: '00000000-0000-4000-8000-000000000004',
      rootCommandId: '00000000-0000-4000-8000-000000000010',
      state: 'PENDING',
      version: 0,
      expectedAggregateVersion: 0,
      pendingSnapshot: { ...continuation('pending-roll'), applicationContext: { kind: 'NONE' } },
      completedAt: null,
      createdAt: '2026-08-25T00:00:00.000Z',
      updatedAt: '2026-08-25T00:00:00.000Z'
    })
    const resolve = vi.fn(async () => ({ published: publishedDefinition, facts: {} }))
    const runtime = { executeResolved: vi.fn() }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService
    })

    await expect(
      service.executeResolved(tracked.port, {
        ...command('00000000-0000-4000-8000-000000000011', 0),
        intent: { actionId: 'action' },
        resolve
      })
    ).rejects.toThrow('already has a pending rule occurrence')
    expect(resolve).not.toHaveBeenCalled()
    expect(runtime.executeResolved).not.toHaveBeenCalled()
  })

  it('replays a matching resolved Encounter start before the pending gate without repeating work', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    mocks.repository.lockPendingEncounter.mockClear()
    const tracked = trackedAggregate('ENCOUNTER', 0)
    const resolve = vi.fn(async () => ({ published: publishedDefinition, facts: {} }))
    const executeResolved = vi.fn(async () => ({
      status: 'PAUSED' as const,
      continuation: continuation('pending-roll')
    }))
    const apply = vi.fn(async () => ({ kind: 'NONE' as const }))
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: { executeResolved } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { apply }
    })
    const execution = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      resolve
    }

    const first = await service.executeResolved(tracked.port, execution)
    const replay = await service.executeResolved(tracked.port, execution)

    expect(replay).toEqual(first)
    expect(resolve).toHaveBeenCalledTimes(1)
    expect(executeResolved).toHaveBeenCalledTimes(1)
    expect(apply).not.toHaveBeenCalled()
    expect(mocks.repository.lockPendingEncounter).toHaveBeenCalledTimes(1)
  })

  it('permits a terminal applicator to complete and receipt without advancing the aggregate', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('ENCOUNTER', 0)
    const requiresAggregateAdvance = vi.fn(() => false)
    const apply = vi.fn(async () => ({ kind: 'NONE' as const }))
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        execute: vi.fn(async () => ({
          status: 'COMPLETE' as const,
          outputs: { result: 14 },
          evidence: {
            source: {
              definitionId: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: { result: 14 }
          }
        }))
      } as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { requiresAggregateAdvance, apply }
    })

    await service.execute(tracked.port, {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })

    expect(requiresAggregateAdvance).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ proposedAggregateVersion: 0 }))
    expect(tracked.advanceVersion).not.toHaveBeenCalled()
    expect(mocks.appendReceipt).toHaveBeenCalledWith(
      expect.objectContaining({ aggregateVersion: 0 })
    )
  })

  it('settles a resumed receipt-only completion without advancing its Encounter', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('ENCOUNTER', 0)
    const requiresAggregateAdvance = vi.fn(() => false)
    const apply = vi.fn(async () => ({ kind: 'NONE' as const }))
    const runtime = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('pending-roll')
      })),
      resume: vi.fn(async () => ({
        status: 'COMPLETE' as const,
        outputs: { result: 14 },
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000020',
            gameSystemId: '00000000-0000-4000-8000-000000000021',
            definitionFamilyKey: 'test-resolution',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: { result: 14 }
        }
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { requiresAggregateAdvance, apply }
    })
    const started = await service.execute(tracked.port, {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })

    const settled = await service.resume(tracked.port, {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'pending-roll', value: 14 }
    })

    expect(settled).toMatchObject({ status: 'COMPLETE', occurrenceVersion: 1 })
    expect(requiresAggregateAdvance).toHaveBeenCalledTimes(1)
    expect(apply).toHaveBeenCalledWith(expect.objectContaining({ proposedAggregateVersion: 0 }))
    expect(tracked.advanceVersion).not.toHaveBeenCalled()
    expect(tracked.currentVersion()).toBe(0)
    expect(mocks.occurrences.get(started.occurrenceId)).toMatchObject({
      state: 'COMPLETED',
      expectedAggregateVersion: 0
    })
    expect(mocks.appendReceipt.mock.calls.at(-1)?.[0]).toMatchObject({ aggregateVersion: 0 })
  })

  it('resumes exactly one automatic evidence request inside the terminal command', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.repository.createPending.mockClear()
    const runtime = {
      executeResolved: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('automatic-request')
      })),
      resume: vi.fn(async () => ({
        status: 'COMPLETE' as const,
        outputs: { result: 14 },
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000020',
            gameSystemId: '00000000-0000-4000-8000-000000000021',
            definitionFamilyKey: 'test-resolution',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: { result: 14 }
        }
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    await service.executeResolved(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: false,
      resolve: async () => ({ published: publishedDefinition, facts: {} }),
      resolveAutomaticEvidence: async ({ request }) => ({
        requestId: request.requestId,
        value: 14
      })
    })

    expect(runtime.resume).toHaveBeenCalledWith(
      expect.objectContaining({
        response: { requestId: 'automatic-request', value: 14 }
      })
    )
    expect(mocks.repository.createPending).not.toHaveBeenCalled()
  })

  it('rejects malformed pauseable automatic evidence before resolving the source or runtime', async () => {
    mocks.repository.createPending.mockClear()
    mocks.repository.createCompleted.mockClear()
    mocks.appendReceipt.mockClear()
    const resolve = vi.fn(async () => ({
      published: publishedDefinition,
      facts: {}
    }))
    const runtime = {
      executeResolved: vi.fn(),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    await expect(
      service.executeResolved(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        intent: { actionId: 'action' },
        allowPaused: true,
        resolve,
        resolveAutomaticEvidence: async () => ({
          requestId: 'request',
          value: 14
        })
      } as unknown as Parameters<typeof service.executeResolved>[1])
    ).rejects.toThrow('automatic evidence requires allowPaused: false')

    expect(resolve).not.toHaveBeenCalled()
    expect(runtime.executeResolved).not.toHaveBeenCalled()
    expect(runtime.resume).not.toHaveBeenCalled()
    expect(mocks.repository.createPending).not.toHaveBeenCalled()
    expect(mocks.repository.createCompleted).not.toHaveBeenCalled()
    expect(mocks.appendReceipt).not.toHaveBeenCalled()
  })

  it('rejects a second automatic evidence stage before aggregate or occurrence mutation', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.repository.createPending.mockClear()
    mocks.repository.createCompleted.mockClear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('CHARACTER', 0)
    const completionApplicator = { apply: vi.fn() }
    const runtime = {
      executeResolved: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('automatic-request')
      })),
      resume: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('second-request')
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })

    await expect(
      service.executeResolved(tracked.port, {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        intent: { actionId: 'action' },
        allowPaused: false,
        completionApplicator,
        resolve: async () => ({ published: publishedDefinition, facts: {} }),
        resolveAutomaticEvidence: async ({ request }) => ({
          requestId: request.requestId,
          value: 14
        })
      })
    ).rejects.toThrow('may satisfy only one evidence stage')

    expect(tracked.advanceVersion).not.toHaveBeenCalled()
    expect(completionApplicator.apply).not.toHaveBeenCalled()
    expect(mocks.repository.createPending).not.toHaveBeenCalled()
    expect(mocks.repository.createCompleted).not.toHaveBeenCalled()
    expect(mocks.appendReceipt).not.toHaveBeenCalled()
  })

  it('persists independent A/B/C receipts and never returns a sealed continuation on replay', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const runtimeMocks = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi
        .fn()
        .mockResolvedValueOnce({
          status: 'PAUSED' as const,
          continuation: continuation('B')
        })
        .mockResolvedValueOnce({
          status: 'COMPLETE' as const,
          outputs: { result: 14 },
          evidence: {
            source: {
              definitionId: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: { result: 14 }
          }
        })
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'.toUpperCase()
    })

    const started = await service.execute(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010'.toUpperCase(), 0),
      definitionId: '00000000-0000-4000-8000-000000000020'.toUpperCase(),
      facts: {}
    })
    expect(started).toMatchObject({
      status: 'PAUSED',
      occurrenceVersion: 0,
      request: { requestId: 'A' }
    })
    expect(started.occurrenceId).toBe('00000000-0000-4000-8000-000000000001')
    expect(started).not.toHaveProperty('continuation')

    const second = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000011'.toUpperCase(), 0),
      occurrenceId: started.occurrenceId.toUpperCase(),
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'A', value: 3 }
    })
    expect(second).toMatchObject({
      status: 'PAUSED',
      occurrenceVersion: 1,
      request: { requestId: 'B' }
    })

    expect(
      await service.resume(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000011', 0),
        occurrenceId: second.occurrenceId,
        expectedOccurrenceVersion: started.occurrenceVersion,
        response: { requestId: 'A', value: 3 }
      })
    ).toEqual(second)
    expect(runtimeMocks.resume).toHaveBeenCalledTimes(1)

    const completed = await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000012', 0),
      occurrenceId: second.occurrenceId,
      expectedOccurrenceVersion: second.occurrenceVersion,
      response: { requestId: 'B', value: 14 }
    })
    expect(completed).toMatchObject({
      status: 'COMPLETE',
      occurrenceVersion: 2,
      outputs: { result: 14 }
    })
    expect(mocks.occurrences.get(started.occurrenceId)).toMatchObject({
      state: 'COMPLETED',
      pendingSnapshot: null
    })

    const replay = await service.execute(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })
    expect(replay).toEqual(started)
    expect(runtimeMocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.appendReceipt).toHaveBeenCalledTimes(3)
    expect(mocks.appendReceipt.mock.calls[0]?.[0]).toMatchObject({
      commandMetadata: {
        schemaVersion: 1,
        transition: 'START',
        definitionId: '00000000-0000-4000-8000-000000000020',
        expectedAggregateVersion: 0
      },
      resultPayload: { status: 'PAUSED', request: { requestId: 'A' } }
    })
    expect(JSON.stringify(mocks.appendReceipt.mock.calls[0]?.[0])).not.toContain('continuation')
  })

  it('rejects a fingerprint mismatch before it invokes the kernel', async () => {
    mocks.receipts.set(
      '00000000-0000-4000-8000-000000000002:00000000-0000-4000-8000-000000000010',
      { commandFingerprint: 'original' }
    )
    const runtimeMocks = { execute: vi.fn(), resume: vi.fn() }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    await expect(
      service.execute(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        definitionId: '00000000-0000-4000-8000-000000000020',
        facts: {}
      })
    ).rejects.toThrow('reused with a different')
    expect(runtimeMocks.execute).not.toHaveBeenCalled()
  })

  it('replays only when the normalized correlation identity also matches', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const runtimeMocks = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('correlated')
      })),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const correlated = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      correlationId: '00000000-0000-4000-8000-0000000000AA',
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    }

    await service.execute(aggregate(0), correlated)
    await expect(
      service.execute(aggregate(0), {
        ...correlated,
        correlationId: correlated.correlationId
      })
    ).resolves.toMatchObject({
      status: 'PAUSED'
    })
    await expect(
      service.execute(aggregate(0), {
        ...correlated,
        correlationId: '00000000-0000-4000-8000-000000000098'
      })
    ).rejects.toThrow('reused with a different')
    expect(runtimeMocks.execute).toHaveBeenCalledTimes(1)
    expect(mocks.appendReceipt.mock.calls[0]?.[0]).toMatchObject({
      correlationId: '00000000-0000-4000-8000-0000000000aa'
    })
  })

  it('rejects a foreign occurrence before reading its snapshot or invoking the kernel', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    const runtimeMocks = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const started = await service.execute(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })

    await expect(
      service.resume(trackedAggregate('ENCOUNTER', 0).port, {
        ...command('00000000-0000-4000-8000-000000000011', 0),
        occurrenceId: started.occurrenceId,
        expectedOccurrenceVersion: started.occurrenceVersion,
        response: { requestId: 'A', value: 1 }
      })
    ).rejects.toThrow('not current')
    expect(runtimeMocks.resume).not.toHaveBeenCalled()
  })

  it('applies complete fresh execution exactly once before aggregate advancement, never on replay', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('CHARACTER', 0)
    const applicator = vi.fn(async () => undefined)
    const runtimeMocks = {
      execute: vi.fn(async () => ({
        status: 'COMPLETE' as const,
        outputs: { result: 14 },
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000020',
            gameSystemId: '00000000-0000-4000-8000-000000000021',
            definitionFamilyKey: 'test-resolution',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: { result: 14 }
        }
      })),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { apply: applicator }
    })
    const executionCommand = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    }
    await service.execute(tracked.port, executionCommand)
    await service.execute(tracked.port, executionCommand)
    expect(applicator).toHaveBeenCalledTimes(1)
    expect(tracked.advanceVersion).toHaveBeenCalledTimes(1)
    expect(tracked.currentVersion()).toBe(1)
    expect(applicator).toHaveBeenCalledWith(
      expect.objectContaining({
        occurrenceId: '00000000-0000-4000-8000-000000000001',
        proposedAggregateVersion: 1,
        execution: expect.objectContaining({ status: 'COMPLETE' })
      })
    )
  })

  it('applies only when a pending resume completes, not while it remains paused', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const applicator = vi.fn(async () => undefined)
    const runtimeMocks = {
      execute: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi.fn(async () => ({
        status: 'COMPLETE' as const,
        outputs: { result: 14 },
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000020',
            gameSystemId: '00000000-0000-4000-8000-000000000021',
            definitionFamilyKey: 'test-resolution',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: { result: 14 }
        }
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { apply: applicator }
    })
    const started = await service.execute(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      definitionId: '00000000-0000-4000-8000-000000000020',
      facts: {}
    })
    expect(applicator).not.toHaveBeenCalled()
    await service.resume(aggregate(0), {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'A', value: 10 }
    })
    expect(applicator).toHaveBeenCalledTimes(1)
  })

  it('does not persist a receipt when completion application fails', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const advanceVersion = vi.fn(async () => 1)
    const aggregatePort: RuleExecutionAggregatePort = {
      withLockedAuthorized: async <T>(_db: DBLike, run: (context: never) => Promise<T>) =>
        run({
          aggregateKind: 'CHARACTER',
          aggregateId: '00000000-0000-4000-8000-000000000002',
          actorUserId: '00000000-0000-4000-8000-000000000003',
          currentVersion: 0,
          advanceVersion
        } as never)
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        execute: vi.fn(async () => ({
          status: 'COMPLETE' as const,
          outputs: { result: 14 },
          evidence: {
            source: {
              definitionId: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64)
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: { result: 14 }
          }
        })),
        resume: vi.fn()
      } as unknown as RulesRuntimeService,
      completionApplicator: {
        apply: async () => {
          throw new Error('application failed')
        }
      }
    })
    await expect(
      service.execute(aggregatePort, {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        definitionId: '00000000-0000-4000-8000-000000000020',
        facts: {}
      })
    ).rejects.toThrow('application failed')
    // The root CAS precedes terminal occurrence completion and the applicator;
    // the enclosing production transaction rolls this write back on failure.
    expect(advanceVersion).toHaveBeenCalledTimes(1)
    expect(mocks.appendReceipt).not.toHaveBeenCalled()
  })

  it('replays before the resolved source callback and stores typed application outputs', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const resolver = vi.fn(async () => ({
      published: publishedDefinition,
      facts: {}
    }))
    const runtimeMocks = {
      executeResolved: vi.fn(async () => ({
        status: 'COMPLETE' as const,
        outputs: { result: 14 },
        evidence: {
          source: {
            definitionId: '00000000-0000-4000-8000-000000000020',
            gameSystemId: '00000000-0000-4000-8000-000000000021',
            definitionFamilyKey: 'test-resolution',
            checksum: 'a'.repeat(64)
          },
          capabilityContractVersion: 1,
          facts: {},
          trace: [],
          outputs: { result: 14 }
        }
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtimeMocks as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const execution = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actorId: '00000000-0000-4000-8000-000000000002' },
      allowPaused: false as const,
      resolve: resolver,
      completionApplicator: { apply: async () => ({ kind: 'NONE' as const }) }
    }
    await expect(service.executeResolved(aggregate(0), execution)).resolves.toMatchObject({
      status: 'COMPLETE',
      applicationOutputs: { kind: 'NONE' }
    })
    await expect(service.executeResolved(aggregate(0), execution)).resolves.toMatchObject({
      status: 'COMPLETE',
      applicationOutputs: { kind: 'NONE' }
    })
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(runtimeMocks.executeResolved).toHaveBeenCalledTimes(1)
  })

  it('stores a recognized Manual result without invoking the kernel or changing the aggregate', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('CHARACTER', 0)
    const resolver = vi.fn(async () => ({
      published: publishedDefinition,
      facts: { recognized: true },
      manualReceipt: { reminder: { kind: 'MANUAL_RULE_REVIEW' as const } }
    }))
    const runtime = { executeResolved: vi.fn(), resume: vi.fn() }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001'
    })
    const execution = {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actionId: 'action' },
      allowPaused: false as const,
      resolve: resolver
    }

    const first = await service.executeResolved(tracked.port, execution)
    const replay = await service.executeResolved(tracked.port, execution)

    expect(first).toEqual({
      status: 'MANUAL',
      occurrenceId: '00000000-0000-4000-8000-000000000001',
      occurrenceVersion: 0,
      initiative: null,
      initiativeAdvance: null,
      reminder: { kind: 'MANUAL_RULE_REVIEW' }
    })
    expect(replay).toEqual(first)
    expect(resolver).toHaveBeenCalledTimes(1)
    expect(runtime.executeResolved).not.toHaveBeenCalled()
    expect(runtime.resume).not.toHaveBeenCalled()
    expect(tracked.advanceVersion).not.toHaveBeenCalled()
    expect(tracked.currentVersion()).toBe(0)
    expect(mocks.appendReceipt).toHaveBeenCalledTimes(1)
  })

  it('rejects malformed Manual receipt results', () => {
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        status: 'MANUAL',
        occurrenceId: '00000000-0000-4000-8000-000000000001',
        occurrenceVersion: 0
      })
    ).toThrow()
    expect(() =>
      storedRuleExecutionResultDtoSchema.parse({
        status: 'MANUAL',
        occurrenceId: '00000000-0000-4000-8000-000000000001',
        occurrenceVersion: 0,
        reminder: { kind: 'MANUAL_RULE_REVIEW', label: 'private' }
      })
    ).toThrow()
  })

  it('rejects a pauseable resolved command with a command-local applicator before resolution', async () => {
    const resolver = vi.fn()
    const runtime = { executeResolved: vi.fn(), resume: vi.fn() }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService
    })

    await expect(
      service.executeResolved(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        intent: { actorId: '00000000-0000-4000-8000-000000000002' },
        resolve: resolver,
        completionApplicator: { apply: async () => undefined }
      } as never)
    ).rejects.toThrow('requires allowPaused: false')
    expect(resolver).not.toHaveBeenCalled()
    expect(runtime.executeResolved).not.toHaveBeenCalled()
  })

  it('rejects a resolver override that makes a command-local applicator pauseable before persistence', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const runtime = {
      executeResolved: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi.fn()
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService
    })
    await expect(
      service.executeResolved(aggregate(0), {
        ...command('00000000-0000-4000-8000-000000000010', 0),
        intent: { actorId: '00000000-0000-4000-8000-000000000002' },
        allowPaused: false,
        completionApplicator: {
          apply: async () => ({ kind: 'NONE' as const })
        },
        resolve: async () => ({
          published: publishedDefinition,
          facts: {},
          allowPaused: true
        })
      })
    ).rejects.toThrow('cannot carry a command-local completion applicator')
    expect(mocks.occurrences.size).toBe(0)
    expect(mocks.appendReceipt).not.toHaveBeenCalled()
  })

  it('resumes a paused resolved execution through the service-level applicator exactly once', async () => {
    mocks.receipts.clear()
    mocks.occurrences.clear()
    mocks.appendReceipt.mockClear()
    const tracked = trackedAggregate('CHARACTER', 0)
    const applicator = vi.fn(async () => ({ kind: 'NONE' as const }))
    const resolver = vi.fn(async () => ({
      published: publishedDefinition,
      facts: {}
    }))
    const runtime = {
      executeResolved: vi.fn(async () => ({
        status: 'PAUSED' as const,
        continuation: continuation('A')
      })),
      resume: vi.fn(),
      resumeWithGraph: vi.fn(async () => ({
        result: {
          status: 'COMPLETE' as const,
          outputs: { result: 14 },
          evidence: {
            source: {
              definitionId: publishedDefinition.id,
              gameSystemId: publishedDefinition.gameSystemId,
              definitionFamilyKey: publishedDefinition.definitionFamilyKey,
              checksum: publishedDefinition.checksum
            },
            capabilityContractVersion: 1,
            facts: {},
            trace: [],
            outputs: { result: 14 }
          }
        },
        graph: continuation('A').graph
      }))
    }
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: runtime as unknown as RulesRuntimeService,
      createOccurrenceId: () => '00000000-0000-4000-8000-000000000001',
      completionApplicator: { apply: applicator }
    })
    const started = await service.executeResolved(tracked.port, {
      ...command('00000000-0000-4000-8000-000000000010', 0),
      intent: { actorId: '00000000-0000-4000-8000-000000000002' },
      resolve: resolver
    })
    const resumeCommand = {
      ...command('00000000-0000-4000-8000-000000000011', 0),
      occurrenceId: started.occurrenceId,
      expectedOccurrenceVersion: started.occurrenceVersion,
      response: { requestId: 'A', value: 10 }
    }

    expect(mocks.occurrences.get(started.occurrenceId)).toMatchObject({
      pendingSnapshot: { applicationContext: { kind: 'NONE' } }
    })
    const preflight = vi.fn()

    await service.resume(tracked.port, {
      ...resumeCommand,
      resumePreflight: preflight
    })
    await service.resume(tracked.port, resumeCommand)

    expect(tracked.advanceVersion).toHaveBeenCalledTimes(1)
    expect(applicator).toHaveBeenCalledTimes(1)
    expect(runtime.resumeWithGraph).toHaveBeenCalledTimes(1)
    expect(applicator).toHaveBeenCalledWith(
      expect.objectContaining({ compiledGraph: continuation('A').graph })
    )
    expect(preflight).toHaveBeenCalledWith(
      expect.objectContaining({ applicationContext: { kind: 'NONE' } })
    )
    expect(tracked.currentVersion()).toBe(1)
  })

  it('rejects an unexpected pause from a terminal resolved command before any aggregate write', async () => {
    const advanceVersion = vi.fn(async (expected: number) => expected + 1)
    const service = createRuleExecutionOccurrenceService({
      db: {} as never,
      runtime: {
        executeResolved: vi.fn(async () => ({
          status: 'PAUSED' as const,
          continuation: {
            schemaVersion: 1,
            seal: 'a'.repeat(64),
            graph: {
              definitionId: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64)
            },
            request: { requestId: 'roll', minimum: 1, maximum: 20 },
            facts: {},
            nextNodeId: 'result',
            values: {},
            evidence: []
          }
        }))
      } as unknown as RulesRuntimeService
    })
    await expect(
      service.executeResolved(
        {
          withLockedAuthorized: async (_db, run) =>
            run({
              aggregateKind: 'ENCOUNTER',
              aggregateId: '00000000-0000-4000-8000-000000000001',
              actorUserId: '00000000-0000-4000-8000-000000000002',
              currentVersion: 0,
              advanceVersion: (_trx, expected) => advanceVersion(expected)
            })
        },
        {
          ...command('00000000-0000-4000-8000-000000000010', 0),
          intent: { actionId: 'action' },
          allowPaused: false,
          resolve: async () => ({
            published: {
              id: '00000000-0000-4000-8000-000000000020',
              gameSystemId: '00000000-0000-4000-8000-000000000021',
              definitionFamilyKey: 'test-resolution',
              checksum: 'a'.repeat(64),
              definition: {
                schemaVersion: 1,
                id: '00000000-0000-4000-8000-000000000020',
                gameSystemId: '00000000-0000-4000-8000-000000000021',
                definitionFamilyKey: 'test-resolution',
                nodes: [
                  {
                    id: 'result',
                    operation: { key: 'test.proposal', contractVersion: 1 },
                    inputs: { value: { kind: 'LITERAL', value: 1 } }
                  }
                ],
                outputs: {
                  result: {
                    kind: 'NODE_OUTPUT',
                    nodeId: 'result',
                    port: 'value'
                  }
                }
              }
            },
            facts: {}
          })
        }
      )
    ).rejects.toThrow('unexpectedly requested a paused')
    expect(advanceVersion).not.toHaveBeenCalled()
  })
})
