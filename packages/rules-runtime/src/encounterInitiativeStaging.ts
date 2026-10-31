import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'
import type { StagedInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/rulesExecution'

import { EncounterConflictError } from './encounterErrors.js'
import {
  followedActorId,
  rollsInitiative,
  type ActorOwnerLink
} from './encounterInitiativeCursor.js'
import type { settleEncounterInitiativeRound } from './encounterInitiativeStateSettlement.js'

type MutableInitiativeRepository = Parameters<
  typeof settleEncounterInitiativeRound
>[0]['repository']

function stagedStateFromRecord(
  state: EncounterInitiativeRoundStateDto
): StagedInitiativeRoundStateDto {
  return {
    round: {
      encounterId: state.round.encounterId,
      round: state.round.round,
      procedure: state.round.procedure,
      cadence: state.round.cadence,
      status: state.round.status,
      policySnapshotChecksum: state.round.policySnapshotChecksum,
      nextTurnOrderOrdinal: state.round.nextTurnOrderOrdinal,
      version: state.round.version
    },
    participants: state.participants.map((participant) => ({
      encounterId: participant.encounterId,
      round: participant.round,
      actorId: participant.actorId,
      sideId: participant.sideId,
      status: participant.status,
      initiativeScore: participant.initiativeScore,
      evaluation: participant.evaluation,
      tie: participant.tie,
      declaration: participant.declaration,
      declarationChecksum: participant.declarationChecksum,
      turnOrderOrdinal: participant.turnOrderOrdinal,
      version: participant.version
    })),
    sides: state.sides.map((side) => ({
      encounterId: side.encounterId,
      round: side.round,
      sideId: side.sideId,
      status: side.status,
      initiativeScore: side.initiativeScore,
      evaluation: side.evaluation,
      tie: side.tie,
      sideOrderOrdinal: side.sideOrderOrdinal,
      version: side.version
    }))
  }
}

export function hydrateStagedState(
  input: StagedInitiativeRoundStateDto
): EncounterInitiativeRoundStateDto {
  const timestamp = '1970-01-01T00:00:00.000Z'
  return {
    round: { ...input.round, createdAt: timestamp, updatedAt: timestamp },
    participants: input.participants.map((participant) => ({
      ...participant,
      createdAt: timestamp,
      updatedAt: timestamp
    })),
    sides: input.sides.map((side) => ({ ...side, createdAt: timestamp, updatedAt: timestamp }))
  }
}

export function inMemoryInitiativeRepository(initial: EncounterInitiativeRoundStateDto): {
  repository: MutableInitiativeRepository
  read: () => EncounterInitiativeRoundStateDto
} {
  let state = initial
  const requireVersion = (actual: number, expected: number) => {
    if (actual !== expected) throw new EncounterConflictError('Staged initiative state is stale.')
  }
  return {
    repository: {
      async updateInitiativeRound(input) {
        requireVersion(state.round.version, input.expectedVersion)
        state = {
          ...state,
          round: {
            ...state.round,
            status: input.status,
            nextTurnOrderOrdinal: input.nextTurnOrderOrdinal,
            version: state.round.version + 1
          }
        }
        return state.round
      },
      async updateInitiativeParticipant({ expectedVersion, ...input }) {
        const index = state.participants.findIndex(
          (candidate) => candidate.actorId === input.actorId
        )
        const current = state.participants[index]
        if (!current)
          throw new EncounterConflictError('Staged initiative participant is unavailable.')
        requireVersion(current.version, expectedVersion)
        const updated = { ...current, ...input, version: current.version + 1 }
        state = {
          ...state,
          participants: state.participants.map((candidate, candidateIndex) =>
            candidateIndex === index ? updated : candidate
          )
        }
        return updated
      },
      async updateInitiativeSide({ expectedVersion, ...input }) {
        const index = state.sides.findIndex((candidate) => candidate.sideId === input.sideId)
        const current = state.sides[index]
        if (!current) throw new EncounterConflictError('Staged initiative side is unavailable.')
        requireVersion(current.version, expectedVersion)
        const updated = { ...current, ...input, version: current.version + 1 }
        state = {
          ...state,
          sides: state.sides.map((candidate, candidateIndex) =>
            candidateIndex === index ? updated : candidate
          )
        }
        return updated
      }
    },
    read: () => state
  }
}

export function serializeStagedInitiativeRoundState(
  state: EncounterInitiativeRoundStateDto
): StagedInitiativeRoundStateDto {
  return stagedStateFromRecord(state)
}

/**
 * Seats each actor authored to act right after its owner directly behind the owner in a settled round,
 * so it keeps that place in every round (D200). It rolls nothing: it shares its owner's score, and a
 * summon whose owner is itself seated follows it. The staged rolls carry only the actors that roll.
 */
export function anchorOwnedActors(
  state: EncounterInitiativeRoundStateDto,
  actors: readonly { id: string; sideId: string; owner?: ActorOwnerLink | null }[]
): EncounterInitiativeRoundStateDto {
  const followers = actors
    .filter((actor) => actor.owner?.turnTiming === 'AFTER_OWNER')
    .sort((left, right) => left.id.localeCompare(right.id))
  if (followers.length === 0) return state
  const ordered = [...state.participants].sort(
    (left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1)
  )
  for (let pending = followers; pending.length > 0;) {
    const seated = pending.filter((actor) => {
      const anchorId = followedActorId(actor, actors, (id) =>
        ordered.some((participant) => participant.actorId === id)
      )
      const anchorIndex = ordered.findIndex((participant) => participant.actorId === anchorId)
      if (anchorIndex < 0) return false
      const anchor = ordered[anchorIndex]!
      ordered.splice(anchorIndex + 1, 0, {
        ...anchor,
        actorId: actor.id,
        sideId: actor.sideId,
        status: 'READY',
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        version: 0
      })
      return true
    })
    if (seated.length === 0)
      throw new EncounterConflictError('An owned actor has no owner in the initiative order.')
    pending = pending.filter((actor) => !seated.includes(actor))
  }
  return {
    round: { ...state.round, nextTurnOrderOrdinal: ordered.length },
    participants: ordered
      .map((participant, turnOrderOrdinal) => ({ ...participant, turnOrderOrdinal }))
      .sort((left, right) => left.actorId.localeCompare(right.actorId)),
    sides: state.sides
  }
}

export function createStagedInitiativeRoundState(input: {
  encounter: Pick<EncounterRunState, 'id' | 'automationMode'> &
    Partial<
      Pick<EncounterRunState, 'initiativePolicySnapshot' | 'initiativePolicySnapshotChecksum'>
    > & {
      actors: readonly {
        id: string
        sideId?: string
        owner?: ActorOwnerLink | null
      }[]
    }
  round: number
}): StagedInitiativeRoundStateDto {
  const timestamp = '1970-01-01T00:00:00.000Z'
  const manualExecution = input.encounter.automationMode === 'MANUAL'
  const policy = manualExecution ? null : input.encounter.initiativePolicySnapshot
  const procedure = policy?.policy.document.procedure ?? 'MANUAL'
  const cadence = policy?.policy.document.cadence ?? 'ENCOUNTER_START'
  const actorSides = input.encounter.actors.filter(rollsInitiative).map((actor) => {
    if (!actor.sideId) {
      throw new EncounterConflictError('Encounter actor side state is unavailable for initiative.')
    }
    return { actor, sideId: actor.sideId }
  })
  return stagedStateFromRecord({
    round: {
      encounterId: input.encounter.id,
      round: input.round,
      procedure,
      cadence,
      status: 'PREPARING',
      policySnapshotChecksum: manualExecution
        ? null
        : (input.encounter.initiativePolicySnapshotChecksum ?? null),
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    participants: [...actorSides]
      .sort((left, right) => left.actor.id.localeCompare(right.actor.id))
      .map(({ actor, sideId }) => ({
        encounterId: input.encounter.id,
        round: input.round,
        actorId: actor.id,
        sideId,
        status: 'UNRESOLVED',
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: null,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      })),
    sides:
      procedure === 'SIDE_ROLL'
        ? [...new Set(actorSides.map(({ sideId }) => sideId))].sort().map((sideId) => ({
            encounterId: input.encounter.id,
            round: input.round,
            sideId,
            status: 'UNRESOLVED',
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            sideOrderOrdinal: null,
            version: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          }))
        : []
  })
}
