import { describe, expect, it } from 'vitest'

import {
  createEncounterInitiativeRoundDtoSchema,
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeRoundStateDtoSchema,
  encounterInitiativeSideDtoSchema,
  updateEncounterInitiativeParticipantDtoSchema
} from '../shared/initiativeState.js'

const encounterId = '11111111-1111-4111-8111-111111111111'
const actorId = '22222222-2222-4222-8222-222222222222'
const sideId = '33333333-3333-4333-8333-333333333333'
const occurrenceId = '44444444-4444-4444-8444-444444444444'
const timestamp = '2026-08-28T00:00:00.000Z'
const checksum = 'a'.repeat(64)
const declaration = {
  actorSize: 'MEDIUM',
  primary: {
    kind: 'GM_ADJUDICATED' as const,
    optionId: 'GM_ADJUDICATED' as const,
    actorId,
    factorIds: [],
    spellLevel: null
  },
  bonus: null
}

describe('normalized encounter initiative state contracts', () => {
  it('accepts one sealed effective round policy and rejects invalid checksum pairs', () => {
    expect(
      createEncounterInitiativeRoundDtoSchema.parse({
        encounterId: encounterId.toUpperCase(),
        round: 1,
        procedure: 'ACTOR_ROLL',
        cadence: 'ENCOUNTER_START',
        policySnapshotChecksum: checksum
      })
    ).toMatchObject({ encounterId })
    expect(() =>
      createEncounterInitiativeRoundDtoSchema.parse({
        encounterId,
        round: 1,
        procedure: 'MANUAL',
        cadence: 'ENCOUNTER_START',
        policySnapshotChecksum: checksum
      })
    ).toThrow()
  })

  it('rejects malformed persisted round procedure and checksum pairs', () => {
    expect(() =>
      encounterInitiativeRoundDtoSchema.parse({
        encounterId,
        round: 1,
        procedure: 'INVALID',
        cadence: 'ENCOUNTER_START',
        status: 'PREPARING',
        policySnapshotChecksum: null,
        nextTurnOrderOrdinal: 0,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toThrow()
    expect(() =>
      encounterInitiativeRoundDtoSchema.parse({
        encounterId,
        round: 1,
        procedure: 'MANUAL',
        cadence: 'ENCOUNTER_START',
        status: 'PREPARING',
        policySnapshotChecksum: checksum,
        nextTurnOrderOrdinal: 0,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    ).toThrow(/MANUAL/)
  })

  it('requires paired occurrence evidence and normalized order only in terminal order states', () => {
    const participant = {
      encounterId,
      round: 1,
      actorId,
      sideId,
      status: 'READY' as const,
      initiativeScore: 12.5,
      evaluation: { occurrenceId, resultChecksum: checksum },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: 0,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    expect(encounterInitiativeParticipantDtoSchema.parse(participant)).toEqual(participant)
    expect(() =>
      encounterInitiativeParticipantDtoSchema.parse({
        ...participant,
        evaluation: { occurrenceId, resultChecksum: null }
      })
    ).toThrow(/evaluation occurrence identity/)
    expect(() =>
      encounterInitiativeParticipantDtoSchema.parse({
        ...participant,
        status: 'UNRESOLVED',
        turnOrderOrdinal: 0
      })
    ).toThrow(/Turn order/)
  })

  it('requires declaration facts and checksum to be null or populated together', () => {
    const participant = {
      encounterId,
      round: 1,
      actorId,
      sideId,
      status: 'PENDING' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration,
      declarationChecksum: checksum,
      turnOrderOrdinal: null,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    const update = {
      encounterId,
      round: 1,
      actorId,
      expectedVersion: 0,
      status: 'PENDING' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration,
      declarationChecksum: checksum,
      turnOrderOrdinal: null
    }

    expect(encounterInitiativeParticipantDtoSchema.parse(participant)).toEqual(participant)
    expect(updateEncounterInitiativeParticipantDtoSchema.parse(update)).toEqual(update)
    for (const invalid of [
      { declaration: null, declarationChecksum: checksum },
      { declaration, declarationChecksum: null }
    ]) {
      expect(() =>
        encounterInitiativeParticipantDtoSchema.parse({ ...participant, ...invalid })
      ).toThrow(/declaration facts and checksum/)
      expect(() =>
        updateEncounterInitiativeParticipantDtoSchema.parse({ ...update, ...invalid })
      ).toThrow(/declaration facts and checksum/)
    }
  })

  it('keeps side state independent and finite', () => {
    const side = {
      encounterId,
      round: 1,
      sideId,
      status: 'ACTIVE' as const,
      initiativeScore: 8,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      sideOrderOrdinal: 0,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp
    }
    expect(encounterInitiativeSideDtoSchema.parse(side)).toEqual(side)
    expect(() =>
      encounterInitiativeSideDtoSchema.parse({ ...side, initiativeScore: Number.POSITIVE_INFINITY })
    ).toThrow()
  })

  it('binds assembled child state to the exact round in deterministic identity order', () => {
    const round = encounterInitiativeRoundDtoSchema.parse({
      encounterId,
      round: 1,
      procedure: 'ACTOR_ROLL',
      cadence: 'ENCOUNTER_START',
      status: 'PREPARING',
      policySnapshotChecksum: checksum,
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    })
    const participant = {
      encounterId,
      round: 1,
      actorId,
      sideId,
      status: 'UNRESOLVED' as const,
      initiativeScore: null,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: null,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    }

    expect(
      encounterInitiativeRoundStateDtoSchema.parse({
        round,
        sides: [],
        participants: [participant]
      })
    ).toMatchObject({ round: { encounterId }, participants: [{ actorId }] })
    expect(() =>
      encounterInitiativeRoundStateDtoSchema.parse({
        round,
        sides: [],
        participants: [{ ...participant, round: 2 }]
      })
    ).toThrow(/enclosing Encounter round/)
    expect(() =>
      encounterInitiativeRoundStateDtoSchema.parse({
        round,
        sides: [],
        participants: [
          { ...participant, actorId: '55555555-5555-4555-8555-555555555555' },
          participant
        ]
      })
    ).toThrow(/ascending actor identity order/)
  })

  it('rejects side rows for non-side initiative procedures', () => {
    expect(() =>
      encounterInitiativeRoundStateDtoSchema.parse({
        round: {
          encounterId,
          round: 1,
          procedure: 'ACTOR_ROLL',
          cadence: 'ENCOUNTER_START',
          status: 'PREPARING',
          policySnapshotChecksum: checksum,
          nextTurnOrderOrdinal: 0,
          version: 0,
          createdAt: timestamp,
          updatedAt: timestamp
        },
        sides: [
          {
            encounterId,
            round: 1,
            sideId,
            status: 'UNRESOLVED',
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            sideOrderOrdinal: null,
            version: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          }
        ],
        participants: []
      })
    ).toThrow(/Only SIDE_ROLL/)
  })
})
