import { describe, expect, it } from 'vitest'

import type { RuleOccurrenceRecord } from '@artificer-toolkit/db'

import { projectEncounterSpatialOccurrenceSummary } from './encounterSpatialOccurrenceSummary.js'

const ids = {
  actor: '00000000-0000-4000-8000-000000000101',
  character: '00000000-0000-4000-8000-000000000102',
  encounter: '00000000-0000-4000-8000-000000000103',
  mover: '00000000-0000-4000-8000-000000000104',
  occurrence: '00000000-0000-4000-8000-000000000105',
  token: '00000000-0000-4000-8000-000000000106'
}

function pendingActionEvidence(): RuleOccurrenceRecord {
  const optionId = 'a'.repeat(64)
  return {
    id: ids.occurrence,
    aggregateKind: 'ENCOUNTER',
    aggregateId: ids.encounter,
    rootCommandId: '00000000-0000-4000-8000-000000000107',
    rootCommandFingerprint: 'b'.repeat(64),
    commandType: 'MOVE_SCENE_TOKEN',
    actorUserId: '00000000-0000-4000-8000-000000000108',
    correlationId: null,
    expectedAggregateVersion: 4,
    version: 1,
    state: 'PENDING',
    pendingSnapshotChecksum: 'd'.repeat(64),
    pendingSnapshot: {
      snapshotKind: 'KERNEL_EVIDENCE',
      request: {
        kind: 'INTEGER_RANGE',
        requestId: 'reaction-roll',
        nodeId: 'roll',
        ordinal: 0,
        min: 1,
        max: 20
      },
      applicationContext: {
        kind: 'ENCOUNTER_MOVEMENT_REACTION',
        phase: {
          kind: 'ACTION_EVIDENCE',
          selectedOptionId: optionId,
          d20Policy: {
            requestNodeId: 'roll',
            rollMode: 'ADVANTAGE',
            contributors: [],
            contributorChecksum: 'c'.repeat(64),
            modifier: 4,
            dc: 15
          }
        },
        reactionTimeline: [
          {
            kind: 'CONTROLLER_CHOICE',
            group: {
              options: [
                {
                  optionId,
                  authority: {
                    kind: 'CHARACTER_CONTROLLER',
                    characterId: ids.character
                  }
                }
              ]
            }
          }
        ]
      }
    },
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
    completedAt: null
  } as unknown as RuleOccurrenceRecord
}

describe('Encounter spatial occurrence summary', () => {
  it('shows Legendary Resistance only to the GM', () => {
    const occurrence = pendingActionEvidence()
    const snapshot = occurrence.pendingSnapshot as {
      applicationContext: Record<string, unknown>
    }
    snapshot.applicationContext.phase = {
      kind: 'LEGENDARY_RESISTANCE_CHOICE',
      selectedOptionId: 'a'.repeat(64),
      resistance: {
        targetActorId: ids.mover,
        useOptionId: 'e'.repeat(64)
      }
    }
    expect(
      projectEncounterSpatialOccurrenceSummary(occurrence, 4, {
        membershipRole: 'OWNER',
        assignedCharacterId: null
      }).pending
    ).toMatchObject({
      kind: 'LEGENDARY_RESISTANCE_CHOICE',
      targetActorId: ids.mover,
      options: [{ optionId: 'e'.repeat(64) }]
    })
    expect(
      projectEncounterSpatialOccurrenceSummary(occurrence, 4, {
        membershipRole: 'PLAYER',
        assignedCharacterId: ids.character
      }).pending
    ).toBeNull()
  })

  it('shows exact selected-action d20 controls only to the controller or GM', () => {
    const occurrence = pendingActionEvidence()
    expect(
      projectEncounterSpatialOccurrenceSummary(occurrence, 4, {
        membershipRole: 'PLAYER',
        assignedCharacterId: ids.character
      })
    ).toMatchObject({
      status: 'PENDING',
      pending: {
        kind: 'D20_EVIDENCE',
        request: {
          requestId: 'reaction-roll',
          rollMode: 'ADVANTAGE'
        }
      }
    })
    expect(
      projectEncounterSpatialOccurrenceSummary(occurrence, 4, {
        membershipRole: 'OWNER',
        assignedCharacterId: null
      }).pending
    ).toMatchObject({ kind: 'D20_EVIDENCE' })
    expect(
      projectEncounterSpatialOccurrenceSummary(occurrence, 4, {
        membershipRole: 'PLAYER',
        assignedCharacterId: '00000000-0000-4000-8000-000000000109'
      }).pending
    ).toBeNull()
  })
})
