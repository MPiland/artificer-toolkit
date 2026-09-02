import { describe, expect, it, vi } from 'vitest'

import type {
  ServerCompletedRuleExecutionDto,
  ServerPublishedRuleDefinitionDto,
  ServerRuleExecutionContinuationDto,
  ServerRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import type { CharacterRuleActionSystemAdapter } from '../rules/characterRuleActionSystemAdapter.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import {
  executeEncounterMovementReactionAction,
  type PreparedEncounterMovementReactionAction
} from './encounterMovementReactionActionExecution.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000001',
  condition: '00000000-0000-4000-8000-000000000002',
  definition: '00000000-0000-4000-8000-000000000003',
  occurrence: '00000000-0000-4000-8000-000000000004'
}
const sourceChecksum = 'a'.repeat(64)
const contributorChecksum = checksumRuleDocument([])

function expectedD20Policy() {
  return {
    requestNodeId: 'roll',
    rollMode: 'NORMAL' as const,
    contributors: [],
    contributorChecksum,
    modifier: 3,
    dc: 15
  }
}

function published(): ServerPublishedRuleDefinitionDto {
  return {
    id: ids.definition,
    checksum: sourceChecksum
  } as ServerPublishedRuleDefinitionDto
}

function continuation(
  facts: Readonly<Record<string, boolean | number | string>> = { exact: 1 }
): ServerRuleExecutionContinuationDto {
  return {
    occurrenceId: ids.occurrence,
    facts,
    graph: {
      source: { definitionId: ids.definition, checksum: sourceChecksum }
    },
    request: {
      kind: 'INTEGER_RANGE',
      requestId: 'reaction-roll',
      nodeId: 'roll',
      ordinal: 0,
      min: 1,
      max: 20
    }
  } as ServerRuleExecutionContinuationDto
}

function complete(
  value: number,
  movementInterruptionOutput?: boolean
): ServerCompletedRuleExecutionDto {
  return {
    status: 'COMPLETE',
    outputs: {
      resultPath: 'ON_HIT',
      ...(movementInterruptionOutput === undefined
        ? {}
        : { movementInterruption: movementInterruptionOutput })
    },
    evidence: {
      trace: [
        {
          nodeId: 'roll',
          operation: {
            key: 'evidence.integer-range',
            contractVersion: 1
          },
          inputs: { min: 1, max: 20 },
          outputs: { value },
          evidence: {
            requestId: 'reaction-roll',
            kind: 'INTEGER_RANGE',
            value
          }
        }
      ]
    }
  } as unknown as ServerCompletedRuleExecutionDto
}

function harness(input?: {
  resumeResult?: ServerRuleExecutionResultDto
  startResult?: ServerRuleExecutionResultDto
}) {
  const paused = {
    status: 'PAUSED' as const,
    continuation: continuation()
  }
  const executeResolved = vi
    .fn<RulesRuntimeService['executeResolved']>()
    .mockResolvedValue(input?.startResult ?? paused)
  const resume = vi
    .fn<RulesRuntimeService['resume']>()
    .mockResolvedValue(input?.resumeResult ?? complete(17))
  const interpret = vi.fn<CharacterRuleActionSystemAdapter['interpret']>(() => [
    {
      kind: 'CONDITION_APPLY',
      conditionId: ids.condition,
      targetActorId: ids.actor,
      sourceNodeId: 'outcome',
      sourceOperationKey: 'test.condition',
      authoredPath: 'ON_HIT',
      resolvedPath: 'ON_HIT'
    }
  ])
  const adapter = {
    gameSystemId: '00000000-0000-4000-8000-000000000005',
    compile: vi.fn(),
    bindFacts: vi.fn(() => ({
      facts: { exact: 1 },
      d20RollMode: 'NORMAL' as const,
      d20Audit: {
        contributors: [],
        contributorChecksum,
        modifier: 3,
        defenseOrDc: 15
      }
    })),
    interpret
  } as unknown as CharacterRuleActionSystemAdapter
  const runtime = {
    executeResolved,
    resume
  } as unknown as RulesRuntimeService
  const prepared: PreparedEncounterMovementReactionAction = {
    adapter,
    published: published(),
    actionMechanic: {},
    movementInterruption: null,
    sourceDerivedFacts: {},
    target: {
      actorId: ids.actor,
      currentHitPoints: 10,
      temporaryHitPoints: 0,
      maximumHitPoints: 10,
      scalarValues: {},
      conditionIds: [],
      derivedFacts: {},
      defenses: [],
      conditionImmunityIds: []
    }
  }
  return { executeResolved, interpret, prepared, resume, runtime }
}

describe('Encounter movement reaction action execution', () => {
  it('pauses an Assisted action before interpretation or application', async () => {
    const value = harness()
    const result = await executeEncounterMovementReactionAction({
      runtime: value.runtime,
      occurrenceId: ids.occurrence,
      automationMode: 'ASSISTED',
      prepared: value.prepared
    })

    expect(result).toMatchObject({
      kind: 'PENDING',
      d20Policy: {
        requestNodeId: 'roll',
        rollMode: 'NORMAL',
        modifier: 3,
        dc: 15
      }
    })
    expect(value.resume).not.toHaveBeenCalled()
    expect(value.interpret).not.toHaveBeenCalled()
  })

  it('resumes exact raw evidence and interprets one completed action', async () => {
    const value = harness()
    const result = await executeEncounterMovementReactionAction({
      runtime: value.runtime,
      occurrenceId: ids.occurrence,
      automationMode: 'ASSISTED',
      prepared: value.prepared,
      continuation: continuation(),
      expectedD20Policy: expectedD20Policy(),
      resolution: {
        kind: 'ENTER_DICE',
        requestId: 'reaction-roll',
        rawFaces: [17]
      }
    })

    expect(result).toMatchObject({
      kind: 'COMPLETE',
      d20: {
        requestId: 'reaction-roll',
        rawFaces: [17],
        selectedNatural: 17,
        total: 20,
        resultPath: 'ON_HIT'
      },
      applications: [{ kind: 'CONDITION_APPLY' }]
    })
    expect(value.executeResolved).not.toHaveBeenCalled()
    expect(value.resume).toHaveBeenCalledWith({
      continuation: continuation(),
      response: { requestId: 'reaction-roll', value: 17 }
    })
    expect(value.interpret).toHaveBeenCalledTimes(1)
  })

  it('settles an Automatic action with server evidence in the same invocation', async () => {
    const value = harness({ resumeResult: complete(12) })
    const rollD20 = vi.fn(() => 12)
    const result = await executeEncounterMovementReactionAction({
      runtime: value.runtime,
      occurrenceId: ids.occurrence,
      automationMode: 'AUTOMATIC',
      prepared: value.prepared,
      rollD20
    })

    expect(result).toMatchObject({
      kind: 'COMPLETE',
      d20: { rawFaces: [12], selectedNatural: 12 }
    })
    expect(rollD20).toHaveBeenCalledTimes(1)
    expect(value.executeResolved).toHaveBeenCalledTimes(1)
    expect(value.resume).toHaveBeenCalledTimes(1)
  })

  it('accepts STOP only when the compiled movement binding and execution output agree', async () => {
    const value = harness({ resumeResult: complete(12, true) })
    value.prepared.movementInterruption = { kind: 'STOP', whenResultPath: 'ON_HIT' }

    const result = await executeEncounterMovementReactionAction({
      runtime: value.runtime,
      occurrenceId: ids.occurrence,
      automationMode: 'AUTOMATIC',
      prepared: value.prepared,
      rollD20: () => 12
    })

    expect(result).toMatchObject({
      kind: 'COMPLETE',
      execution: { movementInterruption: { kind: 'STOP' } }
    })
  })

  it('maps a false compiled interruption output to no movement stop', async () => {
    const value = harness({ resumeResult: complete(12, false) })
    value.prepared.movementInterruption = { kind: 'STOP', whenResultPath: 'ON_HIT' }

    const result = await executeEncounterMovementReactionAction({
      runtime: value.runtime,
      occurrenceId: ids.occurrence,
      automationMode: 'AUTOMATIC',
      prepared: value.prepared,
      rollD20: () => 12
    })

    expect(result).toMatchObject({ kind: 'COMPLETE', execution: { movementInterruption: null } })
  })

  it('rejects a tampered STOP binding when the compiled graph did not emit it', async () => {
    const value = harness({ resumeResult: complete(12) })
    value.prepared.movementInterruption = { kind: 'STOP', whenResultPath: 'ON_HIT' }

    await expect(
      executeEncounterMovementReactionAction({
        runtime: value.runtime,
        occurrenceId: ids.occurrence,
        automationMode: 'AUTOMATIC',
        prepared: value.prepared,
        rollD20: () => 12
      })
    ).rejects.toThrow('movement interruption output is invalid')
  })

  it('rejects stale facts before resuming the action graph', async () => {
    const value = harness()
    await expect(
      executeEncounterMovementReactionAction({
        runtime: value.runtime,
        occurrenceId: ids.occurrence,
        automationMode: 'ASSISTED',
        prepared: value.prepared,
        continuation: continuation({ exact: 2 }),
        expectedD20Policy: expectedD20Policy(),
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: 'reaction-roll'
        }
      })
    ).rejects.toThrow('continuation is stale')
    expect(value.resume).not.toHaveBeenCalled()
    expect(value.interpret).not.toHaveBeenCalled()
  })

  it('rejects a mismatched request before consuming system randomness', async () => {
    const value = harness()
    const rollD20 = vi.fn(() => 10)
    await expect(
      executeEncounterMovementReactionAction({
        runtime: value.runtime,
        occurrenceId: ids.occurrence,
        automationMode: 'ASSISTED',
        prepared: value.prepared,
        continuation: continuation(),
        expectedD20Policy: expectedD20Policy(),
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: 'wrong-request'
        },
        rollD20
      })
    ).rejects.toThrow('request is stale')
    expect(rollD20).not.toHaveBeenCalled()
    expect(value.resume).not.toHaveBeenCalled()
  })

  it('rejects a second action evidence stage', async () => {
    const value = harness({
      resumeResult: {
        status: 'PAUSED',
        continuation: continuation()
      }
    })
    await expect(
      executeEncounterMovementReactionAction({
        runtime: value.runtime,
        occurrenceId: ids.occurrence,
        automationMode: 'ASSISTED',
        prepared: value.prepared,
        continuation: continuation(),
        expectedD20Policy: expectedD20Policy(),
        resolution: {
          kind: 'ENTER_DICE',
          requestId: 'reaction-roll',
          rawFaces: [10]
        }
      })
    ).rejects.toThrow('more than one evidence stage')
    expect(value.interpret).not.toHaveBeenCalled()
  })

  it('rejects a stale issued d20 policy before evidence or randomness', async () => {
    const value = harness()
    const rollD20 = vi.fn(() => 10)
    await expect(
      executeEncounterMovementReactionAction({
        runtime: value.runtime,
        occurrenceId: ids.occurrence,
        automationMode: 'ASSISTED',
        prepared: value.prepared,
        continuation: continuation(),
        expectedD20Policy: { ...expectedD20Policy(), modifier: 4 },
        resolution: {
          kind: 'SYSTEM_ROLL',
          requestId: 'reaction-roll'
        },
        rollD20
      })
    ).rejects.toThrow('d20 policy is stale')
    expect(rollD20).not.toHaveBeenCalled()
    expect(value.resume).not.toHaveBeenCalled()
    expect(value.interpret).not.toHaveBeenCalled()
  })
})
