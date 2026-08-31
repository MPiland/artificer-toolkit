import { describe, expect, it, vi } from 'vitest'

import type { EncounterActorRecord } from '@artificer-toolkit/db'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

import type { InitiativeFactAdapter } from '../rules/initiativeFactAdapter.js'
import type { LockedEncounterInitiativeFactSources } from './encounterInitiativeFactSources.js'
import { createEncounterInitiativeScoreEntities } from './encounterInitiativeEntities.js'

const encounterId = '00000000-0000-4000-8000-000000000001'
const actorA = '00000000-0000-4000-8000-000000000002'
const actorB = '00000000-0000-4000-8000-000000000003'
const sideA = '00000000-0000-4000-8000-000000000004'
const sideB = '00000000-0000-4000-8000-000000000005'
const systemId = '00000000-0000-4000-8000-000000000006'
const now = '2026-08-28T00:00:00.000Z'

function customActor(id: string): EncounterActorRecord {
  return {
    id,
    encounterId,
    kind: 'CUSTOM',
    sourceId: null,
    sourceRevision: null,
    label: id,
    systemId,
    stableTieKey: id,
    public: true,
    currentHitPoints: 1,
    maxHitPoints: 1,
    tempHitPoints: 0,
    conditions: [],
    resources: {},
    gmNotes: null,
    initiative: null,
    manualOrder: null,
    snapshot: {},
    createdAt: now,
    updatedAt: now
  }
}

function state(
  procedure: 'ACTOR_ROLL' | 'SIDE_ROLL' | 'DECLARED_ACTION_ROLL'
): EncounterInitiativeRoundStateDto {
  const participants = [
    {
      encounterId,
      round: 1,
      actorId: actorA,
      sideId: sideA,
      status: 'UNRESOLVED' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: null,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    {
      encounterId,
      round: 1,
      actorId: actorB,
      sideId: sideB,
      status: 'UNRESOLVED' as const,
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
  ]
  return {
    round: {
      encounterId,
      round: 1,
      procedure,
      cadence: 'ENCOUNTER_START',
      status: 'PREPARING',
      policySnapshotChecksum: 'a'.repeat(64),
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: now,
      updatedAt: now
    },
    participants,
    sides:
      procedure === 'SIDE_ROLL'
        ? [sideA, sideB].map((sideId) => ({
            encounterId,
            round: 1,
            sideId,
            status: 'UNRESOLVED' as const,
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            sideOrderOrdinal: null,
            version: 0,
            createdAt: now,
            updatedAt: now
          }))
        : []
  }
}

const sources: LockedEncounterInitiativeFactSources = {
  characterIds: [],
  actors: [actorA, actorB].map((id) => ({
    kind: 'CUSTOM' as const,
    actor: customActor(id),
    systemId
  }))
}

function adapter(): InitiativeFactAdapter {
  return {
    gameSystemId: systemId,
    bindActor: vi.fn((source) => ({ automatic: true, facts: { actor: source.actor.id } })),
    bindDeclaredActor: vi.fn(() => ({ automatic: false as const })),
    bindSide: vi.fn((source) => ({ automatic: true, facts: { count: source.participants.length } }))
  }
}

describe('createEncounterInitiativeScoreEntities', () => {
  it('binds actor procedures in normalized participant order', () => {
    expect(
      createEncounterInitiativeScoreEntities({
        state: state('ACTOR_ROLL'),
        sources,
        adapter: adapter()
      })
    ).toMatchObject([
      { kind: 'ACTOR', id: actorA, binding: { facts: { actor: actorA } } },
      { kind: 'ACTOR', id: actorB, binding: { facts: { actor: actorB } } }
    ])
  })

  it('binds each side from its exact normalized participants', () => {
    expect(
      createEncounterInitiativeScoreEntities({
        state: state('SIDE_ROLL'),
        sources,
        adapter: adapter()
      })
    ).toMatchObject([
      { kind: 'SIDE', id: sideA, binding: { facts: { count: 1 } } },
      { kind: 'SIDE', id: sideB, binding: { facts: { count: 1 } } }
    ])
  })

  it('marks unavailable declared-action facts and rejects mismatched round sources', () => {
    expect(
      createEncounterInitiativeScoreEntities({
        state: state('DECLARED_ACTION_ROLL'),
        sources,
        adapter: adapter()
      })
    ).toMatchObject([{ binding: { automatic: false } }, { binding: { automatic: false } }])
    expect(() =>
      createEncounterInitiativeScoreEntities({
        state: state('ACTOR_ROLL'),
        sources: { ...sources, actors: sources.actors.slice(0, 1) },
        adapter: adapter()
      })
    ).toThrow('do not match')
  })
})
