import { describe, expect, it, vi } from 'vitest'

import type {
  EncounterInitiativeParticipantRecord,
  EncounterInitiativeRoundStateRecord,
  EncounterInitiativeSideRecord
} from '@artificer-toolkit/db'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  UpdateEncounterInitiativeParticipantDto,
  UpdateEncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeScoreBatchEntityResult } from './encounterInitiativeScoreBatch.js'
import {
  recordEncounterInitiativeScoreBatch,
  recordEncounterInitiativeTieResolution
} from './encounterInitiativeStateEvaluation.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const occurrenceId = '00000000-0000-4000-8000-000000000002'
const actorA = '00000000-0000-4000-8000-000000000003'
const actorB = '00000000-0000-4000-8000-000000000004'
const sideA = '00000000-0000-4000-8000-000000000005'
const actorC = '00000000-0000-4000-8000-000000000006'
const now = '2026-08-28T00:00:00.000Z'

function participant(actorId: string): EncounterInitiativeParticipantRecord {
  return {
    encounterId,
    round: 1,
    actorId,
    sideId: sideA,
    status: 'UNRESOLVED',
    initiativeScore: null,
    evaluation: { occurrenceId: null, resultChecksum: null },
    tie: { occurrenceId: null, resultChecksum: null },
    declaration: null,
    declarationChecksum: null,
    turnOrderOrdinal: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  }
}

function side(): EncounterInitiativeSideRecord {
  return {
    encounterId,
    round: 1,
    sideId: sideA,
    status: 'UNRESOLVED',
    initiativeScore: null,
    evaluation: { occurrenceId: null, resultChecksum: null },
    tie: { occurrenceId: null, resultChecksum: null },
    sideOrderOrdinal: null,
    version: 0,
    createdAt: now,
    updatedAt: now
  }
}

function state(
  withSide = false,
  actorIds: readonly string[] = [actorA, actorB]
): EncounterInitiativeRoundStateRecord {
  return {
    round: {
      encounterId,
      round: 1,
      procedure: withSide ? 'SIDE_ROLL' : 'ACTOR_ROLL',
      cadence: 'ENCOUNTER_START',
      status: 'PREPARING',
      policySnapshotChecksum: 'a'.repeat(64),
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    participants: actorIds.map(participant),
    sides: withSide ? [side()] : []
  }
}

function graphResult(score: number): InitiativeScoreBatchEntityResult['result'] {
  const execution: ServerCompletedRuleExecutionDto = {
    status: 'COMPLETE',
    outputs: { score, automatic: true },
    evidence: {
      source: {
        definitionId: occurrenceId,
        gameSystemId: encounterId,
        definitionFamilyKey: 'test',
        checksum: 'b'.repeat(64)
      },
      capabilityContractVersion: 1,
      facts: {},
      trace: [],
      outputs: { score, automatic: true }
    }
  }
  return {
    kind: 'GRAPH_COMPLETE',
    execution: { automatic: true, score, sortDirection: 'DESCENDING', execution }
  }
}

function repository() {
  return {
    updateInitiativeParticipant: vi.fn(async (input: UpdateEncounterInitiativeParticipantDto) => ({
      encounterId: input.encounterId,
      round: input.round,
      actorId: input.actorId,
      sideId: sideA,
      status: input.status,
      initiativeScore: input.initiativeScore,
      evaluation: input.evaluation,
      tie: input.tie,
      declaration: input.declaration,
      declarationChecksum: input.declarationChecksum,
      turnOrderOrdinal: input.turnOrderOrdinal,
      version: input.expectedVersion + 1,
      createdAt: now,
      updatedAt: now
    })),
    updateInitiativeSide: vi.fn(async (input: UpdateEncounterInitiativeSideDto) => ({
      encounterId: input.encounterId,
      round: input.round,
      sideId: input.sideId,
      status: input.status,
      initiativeScore: input.initiativeScore,
      evaluation: input.evaluation,
      tie: input.tie,
      sideOrderOrdinal: input.sideOrderOrdinal,
      version: input.expectedVersion + 1,
      createdAt: now,
      updatedAt: now
    }))
  }
}

describe('recordEncounterInitiativeScoreBatch', () => {
  it('records completed actor evidence and the exact pending participant', async () => {
    const repo = repository()
    const result = await recordEncounterInitiativeScoreBatch({
      repository: repo,
      state: state(),
      occurrenceId,
      phase: 'PRIMARY',
      batch: {
        kind: 'PENDING',
        completed: [{ entity: { kind: 'ACTOR', id: actorA }, result: graphResult(17) }],
        current: { kind: 'ACTOR', id: actorB, binding: { automatic: true, facts: {} } },
        remaining: [],
        continuation: {} as never
      }
    })
    expect(result.participants).toMatchObject([
      {
        actorId: actorA,
        status: 'EVALUATED',
        initiativeScore: 17,
        evaluation: { occurrenceId }
      },
      { actorId: actorB, status: 'PENDING', initiativeScore: null }
    ])
  })

  it('records side evaluation and a later tie result in their distinct pointers', async () => {
    const repo = repository()
    const evaluated = await recordEncounterInitiativeScoreBatch({
      repository: repo,
      state: state(true),
      occurrenceId,
      phase: 'PRIMARY',
      batch: {
        kind: 'COMPLETE',
        completed: [{ entity: { kind: 'SIDE', id: sideA }, result: graphResult(12) }]
      }
    })
    const tied = await recordEncounterInitiativeScoreBatch({
      repository: repo,
      state: evaluated,
      occurrenceId,
      phase: 'TIE_RESOLUTION',
      batch: {
        kind: 'COMPLETE',
        completed: [{ entity: { kind: 'SIDE', id: sideA }, result: graphResult(8) }]
      }
    })
    expect(tied.sides[0]).toMatchObject({
      initiativeScore: 8,
      evaluation: { occurrenceId },
      tie: { occurrenceId }
    })
  })

  it('rejects an entity outside the locked round before mutation', async () => {
    const repo = repository()
    await expect(
      recordEncounterInitiativeScoreBatch({
        repository: repo,
        state: state(),
        occurrenceId,
        phase: 'PRIMARY',
        batch: {
          kind: 'COMPLETE',
          completed: [
            {
              entity: { kind: 'ACTOR', id: '00000000-0000-4000-8000-000000000099' },
              result: graphResult(4)
            }
          ]
        }
      })
    ).rejects.toThrow('unlocked participant')
    expect(repo.updateInitiativeParticipant).not.toHaveBeenCalled()
  })

  it('records only finalized tie segments while a later attempt is pending', async () => {
    const repo = repository()
    const resultA: InitiativeScoreBatchEntityResult = {
      entity: { kind: 'ACTOR', id: actorA },
      result: graphResult(18)
    }
    const resultB: InitiativeScoreBatchEntityResult = {
      entity: { kind: 'ACTOR', id: actorB },
      result: graphResult(10)
    }
    const result = await recordEncounterInitiativeTieResolution({
      repository: repo,
      state: state(false, [actorA, actorB, actorC]),
      occurrenceId,
      resolution: {
        kind: 'PENDING',
        completedAttempts: [],
        completedSegments: [
          {
            kind: 'SETTLED',
            score: 18,
            members: [{ kind: 'ACTOR', id: actorA }],
            tieResults: [resultA]
          }
        ],
        currentOriginalGroup: {
          score: 12,
          classification: 'TIED',
          members: [
            { kind: 'ACTOR', id: actorB },
            { kind: 'ACTOR', id: actorC }
          ]
        },
        attemptOrdinal: 1,
        pendingScoreBatch: {
          kind: 'PENDING',
          completed: [resultB],
          current: { kind: 'ACTOR', id: actorC, binding: { automatic: true, facts: {} } },
          remaining: [],
          continuation: {} as never
        },
        laterOriginalGroups: []
      }
    })
    expect(result.participants).toMatchObject([
      { actorId: actorA, status: 'EVALUATED', tie: { occurrenceId } },
      { actorId: actorB, status: 'UNRESOLVED', tie: { occurrenceId: null } },
      { actorId: actorC, status: 'PENDING', tie: { occurrenceId: null } }
    ])
    expect(repo.updateInitiativeParticipant).toHaveBeenCalledTimes(2)
  })
})
