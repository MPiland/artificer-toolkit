import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  EncounterInitiativeParticipantDto,
  EncounterInitiativeRoundStateDto,
  EncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'

import type {
  InitiativeScoreBatchEntityResult,
  InitiativeScoreBatchResult
} from './encounterInitiativeScoreBatch.js'
import type { settleEncounterInitiativeRound } from './encounterInitiativeStateSettlement.js'
import type { InitiativeTieResolutionResult } from './encounterInitiativeTieResolution.js'

type InitiativeRepository = Pick<
  Parameters<typeof settleEncounterInitiativeRound>[0]['repository'],
  'updateInitiativeParticipant' | 'updateInitiativeSide'
>
type InitiativeEvaluationPhase = 'PRIMARY' | 'TIE_RESOLUTION'
type InitiativePointer = { occurrenceId: string | null; resultChecksum: string | null }

function resultState(input: {
  result: InitiativeScoreBatchEntityResult['result']
  occurrenceId: string
}): { score: number | null; pointer: InitiativePointer } {
  if (input.result.kind !== 'GRAPH_COMPLETE') {
    return { score: null, pointer: { occurrenceId: null, resultChecksum: null } }
  }
  return {
    score: input.result.execution.automatic ? input.result.execution.score : null,
    pointer: {
      occurrenceId: input.occurrenceId,
      resultChecksum: checksumCanonicalJson(input.result.execution.execution)
    }
  }
}

function pointerEquals(left: InitiativePointer, right: InitiativePointer): boolean {
  return left.occurrenceId === right.occurrenceId && left.resultChecksum === right.resultChecksum
}

async function recordParticipant(input: {
  repository: InitiativeRepository
  participant: EncounterInitiativeParticipantDto
  phase: InitiativeEvaluationPhase
  status: 'PENDING' | 'EVALUATED'
  score: number | null
  pointer: InitiativePointer | null
}): Promise<EncounterInitiativeParticipantDto> {
  const evaluation =
    input.phase === 'PRIMARY' && input.pointer ? input.pointer : input.participant.evaluation
  const tie =
    input.phase === 'TIE_RESOLUTION' && input.pointer ? input.pointer : input.participant.tie
  const score = input.pointer ? input.score : input.participant.initiativeScore
  if (
    input.participant.status === input.status &&
    input.participant.initiativeScore === score &&
    pointerEquals(input.participant.evaluation, evaluation) &&
    pointerEquals(input.participant.tie, tie)
  ) {
    return input.participant
  }
  return input.repository.updateInitiativeParticipant({
    encounterId: input.participant.encounterId,
    round: input.participant.round,
    actorId: input.participant.actorId,
    expectedVersion: input.participant.version,
    status: input.status,
    initiativeScore: score,
    evaluation,
    tie,
    declaration: input.participant.declaration,
    declarationChecksum: input.participant.declarationChecksum,
    turnOrderOrdinal: null
  })
}

async function recordSide(input: {
  repository: InitiativeRepository
  side: EncounterInitiativeSideDto
  phase: InitiativeEvaluationPhase
  status: 'PENDING' | 'EVALUATED'
  score: number | null
  pointer: InitiativePointer | null
}): Promise<EncounterInitiativeSideDto> {
  const evaluation =
    input.phase === 'PRIMARY' && input.pointer ? input.pointer : input.side.evaluation
  const tie = input.phase === 'TIE_RESOLUTION' && input.pointer ? input.pointer : input.side.tie
  const score = input.pointer ? input.score : input.side.initiativeScore
  if (
    input.side.status === input.status &&
    input.side.initiativeScore === score &&
    pointerEquals(input.side.evaluation, evaluation) &&
    pointerEquals(input.side.tie, tie)
  ) {
    return input.side
  }
  return input.repository.updateInitiativeSide({
    encounterId: input.side.encounterId,
    round: input.side.round,
    sideId: input.side.sideId,
    expectedVersion: input.side.version,
    status: input.status,
    initiativeScore: score,
    evaluation,
    tie,
    sideOrderOrdinal: null
  })
}

export async function recordEncounterInitiativeScoreBatch(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateDto
  occurrenceId: string
  phase: InitiativeEvaluationPhase
  batch: InitiativeScoreBatchResult
}): Promise<EncounterInitiativeRoundStateDto> {
  const participantById = new Map(
    input.state.participants.map((participant) => [participant.actorId, participant])
  )
  const sideById = new Map(input.state.sides.map((side) => [side.sideId, side]))
  const completedIds = new Set<string>()
  for (const completed of input.batch.completed) {
    const resolved = resultState({ result: completed.result, occurrenceId: input.occurrenceId })
    completedIds.add(completed.entity.id)
    if (completed.entity.kind === 'ACTOR') {
      const participant = participantById.get(completed.entity.id)
      if (!participant)
        throw new Error('Initiative score result references an unlocked participant.')
      participantById.set(
        completed.entity.id,
        await recordParticipant({
          repository: input.repository,
          participant,
          phase: input.phase,
          status: 'EVALUATED',
          score: resolved.score,
          pointer: resolved.pointer
        })
      )
    } else {
      const side = sideById.get(completed.entity.id)
      if (!side) throw new Error('Initiative score result references an unlocked side.')
      sideById.set(
        completed.entity.id,
        await recordSide({
          repository: input.repository,
          side,
          phase: input.phase,
          status: 'EVALUATED',
          score: resolved.score,
          pointer: resolved.pointer
        })
      )
    }
  }

  if (input.batch.kind === 'PENDING') {
    if (completedIds.has(input.batch.current.id)) {
      throw new Error('Pending initiative score identity is already in the completed prefix.')
    }
    if (input.batch.current.kind === 'ACTOR') {
      const participant = participantById.get(input.batch.current.id)
      if (!participant)
        throw new Error('Pending initiative score references an unlocked participant.')
      participantById.set(
        input.batch.current.id,
        await recordParticipant({
          repository: input.repository,
          participant,
          phase: input.phase,
          status: 'PENDING',
          score: participant.initiativeScore,
          pointer: null
        })
      )
    } else {
      const side = sideById.get(input.batch.current.id)
      if (!side) throw new Error('Pending initiative score references an unlocked side.')
      sideById.set(
        input.batch.current.id,
        await recordSide({
          repository: input.repository,
          side,
          phase: input.phase,
          status: 'PENDING',
          score: side.initiativeScore,
          pointer: null
        })
      )
    }
  }

  return {
    round: input.state.round,
    participants: input.state.participants.map(
      (participant) => participantById.get(participant.actorId)!
    ),
    sides: input.state.sides.map((side) => sideById.get(side.sideId)!)
  }
}

export async function recordEncounterInitiativeTieResolution(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateDto
  occurrenceId: string
  resolution: InitiativeTieResolutionResult
}): Promise<EncounterInitiativeRoundStateDto> {
  const segments =
    input.resolution.kind === 'PENDING'
      ? input.resolution.completedSegments
      : input.resolution.segments
  const finalResults = segments.flatMap((segment) => segment.tieResults ?? [])
  if (
    new Set(finalResults.map((result) => `${result.entity.kind}:${result.entity.id}`)).size !==
    finalResults.length
  ) {
    throw new Error('Final initiative tie results must contain each entity at most once.')
  }
  let state = input.state
  if (finalResults.length > 0) {
    state = await recordEncounterInitiativeScoreBatch({
      repository: input.repository,
      state,
      occurrenceId: input.occurrenceId,
      phase: 'TIE_RESOLUTION',
      batch: { kind: 'COMPLETE', completed: finalResults }
    })
  }
  if (input.resolution.kind === 'PENDING') {
    const currentKey = `${input.resolution.pendingScoreBatch.current.kind}:${input.resolution.pendingScoreBatch.current.id}`
    if (finalResults.some((result) => `${result.entity.kind}:${result.entity.id}` === currentKey)) {
      throw new Error('Pending initiative tie identity is already finalized.')
    }
    state = await recordEncounterInitiativeScoreBatch({
      repository: input.repository,
      state,
      occurrenceId: input.occurrenceId,
      phase: 'TIE_RESOLUTION',
      batch: {
        kind: 'PENDING',
        completed: [],
        current: input.resolution.pendingScoreBatch.current,
        remaining: [],
        continuation: input.resolution.pendingScoreBatch.continuation
      }
    })
  }
  return state
}
