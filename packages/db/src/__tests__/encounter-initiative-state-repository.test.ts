import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DBLike } from '../types/index.js'

const state = vi.hoisted(() => ({ results: [] as Array<{ rows: Record<string, unknown>[] }> }))
vi.mock('kysely', () => ({
  sql: () => ({
    execute: async () => state.results.shift() ?? { rows: [] }
  })
}))

import { createEncounterRepository } from '../repositories/encounter.js'

const encounterId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const sideId = '33333333-3333-4333-8333-333333333333'
const occurrenceId = '44444444-4444-4444-8444-444444444444'
const timestamp = new Date('2026-08-28T00:00:00.000Z')

function roundRow(): Record<string, unknown> {
  return {
    encounter_id: encounterId,
    round: 1,
    procedure: 'MANUAL',
    cadence: 'ENCOUNTER_START',
    status: 'PREPARING',
    policy_snapshot_checksum: null,
    next_turn_order_ordinal: 0,
    version: 0,
    created_at: timestamp,
    updated_at: timestamp
  }
}

function participantRow(): Record<string, unknown> {
  return {
    encounter_id: encounterId,
    round: 1,
    actor_id: actorId,
    side_id: sideId,
    status: 'UNRESOLVED',
    initiative_score: null,
    evaluation_occurrence_id: null,
    evaluation_result_checksum: null,
    tie_occurrence_id: null,
    tie_result_checksum: null,
    turn_order_ordinal: null,
    version: 0,
    created_at: timestamp,
    updated_at: timestamp
  }
}

function declarationFacts(): Record<string, unknown> {
  return {
    actorSize: 'MEDIUM',
    primary: {
      kind: 'GM_ADJUDICATED',
      optionId: 'GM_ADJUDICATED',
      actorId,
      actionFactors: [],
      spellLevel: null
    },
    bonus: null
  }
}

function sideRow(): Record<string, unknown> {
  return {
    encounter_id: encounterId,
    round: 1,
    procedure: 'SIDE_ROLL',
    side_id: sideId,
    status: 'UNRESOLVED',
    initiative_score: null,
    evaluation_occurrence_id: null,
    evaluation_result_checksum: null,
    tie_occurrence_id: null,
    tie_result_checksum: null,
    side_order_ordinal: null,
    version: 0,
    created_at: timestamp,
    updated_at: timestamp
  }
}

function encounterRow(): Record<string, unknown> {
  return {
    id: encounterId,
    campaign_id: '55555555-5555-4555-8555-555555555555',
    session_id: '66666666-6666-4666-8666-666666666666',
    game_system_id: '77777777-7777-4777-8777-777777777777',
    blueprint_id: '88888888-8888-4888-8888-888888888888',
    blueprint_version: 1,
    blueprint_checksum: 'a'.repeat(64),
    rule_pack_revision_id: null,
    initiative_policy_snapshot: null,
    initiative_policy_snapshot_checksum: null,
    optional_combat_snapshot: null,
    optional_combat_snapshot_checksum: null,
    automation_mode: 'ASSISTED',
    manual_reminder_mode: 'OFF',
    name: 'Projection state',
    status: 'ACTIVE',
    version: 1,
    round: 1,
    current_actor_id: '99999999-9999-4999-8999-999999999999',
    created_at: timestamp,
    updated_at: timestamp
  }
}

function actorRow(): Record<string, unknown> {
  return {
    id: actorId,
    encounter_id: encounterId,
    side_id: sideId,
    kind: 'CHARACTER',
    source_id: null,
    source_revision: null,
    label: 'Current participant',
    system_id: null,
    stable_tie_key: actorId,
    public: true,
    current_hit_points: 10,
    max_hit_points: 10,
    temp_hit_points: 0,
    conditions: [],
    resources: {},
    gm_notes: null,
    initiative: null,
    manual_order: 0,
    snapshot: {},
    created_at: timestamp,
    updated_at: timestamp
  }
}

describe('encounter initiative state repository boundary', () => {
  beforeEach(() => {
    state.results = []
  })

  it('maps a locked normalized round through strict contracts', async () => {
    state.results = [{ rows: [roundRow()] }, { rows: [] }, { rows: [participantRow()] }]
    const repository = createEncounterRepository({} as DBLike)
    await expect(repository.lockInitiativeRound({ encounterId, round: 1 })).resolves.toMatchObject({
      round: { encounterId, procedure: 'MANUAL' },
      participants: [{ actorId, sideId }]
    })
  })

  it('hydrates the current normalized initiative state with an Encounter read', async () => {
    state.results = [
      { rows: [encounterRow()] },
      { rows: [actorRow()] },
      { rows: [] },
      { rows: [{ ...roundRow(), status: 'ACTIVE', next_turn_order_ordinal: 1 }] },
      { rows: [] },
      {
        rows: [
          {
            ...participantRow(),
            status: 'ACTIVE',
            turn_order_ordinal: 0
          }
        ]
      }
    ]
    const repository = createEncounterRepository({} as DBLike)

    await expect(repository.find(encounterId)).resolves.toMatchObject({
      currentActorId: '99999999-9999-4999-8999-999999999999',
      initiativeRoundState: {
        round: { status: 'ACTIVE' },
        participants: [{ actorId, status: 'ACTIVE' }]
      }
    })
  })

  it('round-trips non-null JSONB declaration facts without stringification', async () => {
    const declaration = declarationFacts()
    state.results = [
      { rows: [roundRow()] },
      { rows: [] },
      {
        rows: [
          {
            ...participantRow(),
            declaration,
            declaration_checksum: 'a'.repeat(64)
          }
        ]
      }
    ]
    const repository = createEncounterRepository({} as DBLike)

    await expect(repository.lockInitiativeRound({ encounterId, round: 1 })).resolves.toMatchObject({
      participants: [{ declaration, declarationChecksum: 'a'.repeat(64) }]
    })
  })

  it('rejects malformed database occurrence evidence before returning it', async () => {
    state.results = [
      { rows: [roundRow()] },
      { rows: [] },
      {
        rows: [
          {
            ...participantRow(),
            evaluation_occurrence_id: occurrenceId,
            evaluation_result_checksum: null
          }
        ]
      }
    ]
    const repository = createEncounterRepository({} as DBLike)
    await expect(repository.lockInitiativeRound({ encounterId, round: 1 })).rejects.toThrow(
      /evaluation occurrence identity/
    )
  })

  it('rejects child rows that do not belong to the locked Encounter round', async () => {
    state.results = [
      { rows: [roundRow()] },
      { rows: [] },
      { rows: [{ ...participantRow(), round: 2 }] }
    ]
    const repository = createEncounterRepository({} as DBLike)
    await expect(repository.lockInitiativeRound({ encounterId, round: 1 })).rejects.toThrow(
      /enclosing Encounter round/
    )
  })

  it('rejects side rows without the persisted SIDE_ROLL discriminator', async () => {
    state.results = [
      {
        rows: [{ ...roundRow(), procedure: 'SIDE_ROLL', policy_snapshot_checksum: 'a'.repeat(64) }]
      },
      { rows: [{ ...sideRow(), procedure: 'ACTOR_ROLL' }] },
      { rows: [participantRow()] }
    ]
    const repository = createEncounterRepository({} as DBLike)
    await expect(repository.lockInitiativeRound({ encounterId, round: 1 })).rejects.toThrow(
      /SIDE_ROLL round/
    )
  })

  it('rejects malformed input before issuing a state update query', async () => {
    const repository = createEncounterRepository({} as DBLike)
    await expect(
      repository.updateInitiativeParticipant({
        encounterId,
        round: 1,
        actorId,
        expectedVersion: 0,
        status: 'READY',
        initiativeScore: 10,
        evaluation: { occurrenceId, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: 0
      })
    ).rejects.toThrow(/evaluation occurrence identity/)
    expect(state.results).toHaveLength(0)
  })
})
