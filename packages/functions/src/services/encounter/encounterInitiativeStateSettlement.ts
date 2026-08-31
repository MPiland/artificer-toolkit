import {
  checksumCanonicalJson,
  createEncounterRepository,
  type EncounterInitiativeParticipantRecord,
  type EncounterInitiativeRoundStateRecord,
  type EncounterInitiativeSideRecord
} from '@artificer-toolkit/db'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  type EncounterInitiativeAdvancePlanDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

type InitiativeRepository = Pick<
  ReturnType<typeof createEncounterRepository>,
  'updateInitiativeParticipant' | 'updateInitiativeRound' | 'updateInitiativeSide'
>

function requireExactOrder(input: {
  label: string
  expectedIds: readonly string[]
  orderedIds: readonly string[]
}): void {
  if (
    input.orderedIds.length !== input.expectedIds.length ||
    new Set(input.orderedIds).size !== input.orderedIds.length ||
    input.orderedIds.some((id) => !input.expectedIds.includes(id))
  ) {
    throw new Error(`${input.label} must contain each locked initiative identity exactly once.`)
  }
}

export async function settleEncounterInitiativeRound(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateRecord
  orderedActorIds: readonly string[]
  orderedSideIds?: readonly string[]
}): Promise<EncounterInitiativeRoundStateRecord> {
  if (input.state.round.status !== 'PREPARING') {
    throw new Error('Only a preparing initiative round can settle its order.')
  }
  requireExactOrder({
    label: 'Initiative actor order',
    expectedIds: input.state.participants.map((participant) => participant.actorId),
    orderedIds: input.orderedActorIds
  })
  const orderedSideIds = input.orderedSideIds ?? []
  requireExactOrder({
    label: 'Initiative side order',
    expectedIds: input.state.sides.map((side) => side.sideId),
    orderedIds: orderedSideIds
  })
  if (input.state.round.procedure === 'SIDE_ROLL') {
    const sideOrdinal = new Map(orderedSideIds.map((sideId, ordinal) => [sideId, ordinal]))
    let priorSideOrdinal = -1
    for (const actorId of input.orderedActorIds) {
      const participant = input.state.participants.find(
        (candidate) => candidate.actorId === actorId
      )!
      const currentSideOrdinal = sideOrdinal.get(participant.sideId)
      if (currentSideOrdinal === undefined || currentSideOrdinal < priorSideOrdinal) {
        throw new Error('Side initiative actor order must retain contiguous settled side order.')
      }
      priorSideOrdinal = currentSideOrdinal
    }
  } else if (orderedSideIds.length > 0) {
    throw new Error('Only side-roll initiative may settle side order.')
  }

  const participantById = new Map(
    input.state.participants.map((participant) => [participant.actorId, participant])
  )
  const readyParticipants: EncounterInitiativeParticipantRecord[] = []
  for (const [turnOrderOrdinal, actorId] of input.orderedActorIds.entries()) {
    const participant = participantById.get(actorId)!
    readyParticipants.push(
      await input.repository.updateInitiativeParticipant({
        encounterId: participant.encounterId,
        round: participant.round,
        actorId,
        expectedVersion: participant.version,
        status: 'READY',
        initiativeScore: participant.initiativeScore,
        evaluation: participant.evaluation,
        tie: participant.tie,
        declaration: participant.declaration,
        declarationChecksum: participant.declarationChecksum,
        turnOrderOrdinal
      })
    )
  }

  const sideById = new Map(input.state.sides.map((side) => [side.sideId, side]))
  const readySides: EncounterInitiativeSideRecord[] = []
  for (const [sideOrderOrdinal, sideId] of orderedSideIds.entries()) {
    const side = sideById.get(sideId)!
    readySides.push(
      await input.repository.updateInitiativeSide({
        encounterId: side.encounterId,
        round: side.round,
        sideId,
        expectedVersion: side.version,
        status: 'READY',
        initiativeScore: side.initiativeScore,
        evaluation: side.evaluation,
        tie: side.tie,
        sideOrderOrdinal
      })
    )
  }

  if (readyParticipants.length < 1) {
    throw new Error('An initiative round requires at least one participant.')
  }
  const firstParticipant = readyParticipants[0]!
  readyParticipants[0] = await input.repository.updateInitiativeParticipant({
    encounterId: firstParticipant.encounterId,
    round: firstParticipant.round,
    actorId: firstParticipant.actorId,
    expectedVersion: firstParticipant.version,
    status: 'ACTIVE',
    initiativeScore: firstParticipant.initiativeScore,
    evaluation: firstParticipant.evaluation,
    tie: firstParticipant.tie,
    declaration: firstParticipant.declaration,
    declarationChecksum: firstParticipant.declarationChecksum,
    turnOrderOrdinal: firstParticipant.turnOrderOrdinal
  })
  if (readySides.length > 0) {
    const firstSide = readySides[0]!
    readySides[0] = await input.repository.updateInitiativeSide({
      encounterId: firstSide.encounterId,
      round: firstSide.round,
      sideId: firstSide.sideId,
      expectedVersion: firstSide.version,
      status: 'ACTIVE',
      initiativeScore: firstSide.initiativeScore,
      evaluation: firstSide.evaluation,
      tie: firstSide.tie,
      sideOrderOrdinal: firstSide.sideOrderOrdinal
    })
  }
  const round = await input.repository.updateInitiativeRound({
    encounterId: input.state.round.encounterId,
    round: input.state.round.round,
    expectedVersion: input.state.round.version,
    status: 'ACTIVE',
    nextTurnOrderOrdinal: readyParticipants.length
  })
  return { round, participants: readyParticipants, sides: readySides }
}

function orderedInitiativeParticipants(state: EncounterInitiativeRoundStateRecord) {
  const ordered = [...state.participants].sort(
    (left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1)
  )
  if (
    ordered.length < 1 ||
    ordered.some((participant, ordinal) => participant.turnOrderOrdinal !== ordinal)
  )
    throw new Error('Active initiative state must retain one exact contiguous actor order.')
  const activeIndex = ordered.findIndex((participant) => participant.status === 'ACTIVE')
  if (
    activeIndex < 0 ||
    ordered.some(
      (participant, index) =>
        participant.status !==
        (index < activeIndex ? 'ACTED' : index === activeIndex ? 'ACTIVE' : 'READY')
    )
  )
    throw new Error('Active initiative participant state is not a valid turn cursor.')
  return { ordered, activeIndex }
}

function orderedInitiativeSides(state: EncounterInitiativeRoundStateRecord): string[] {
  if (state.round.procedure !== 'SIDE_ROLL') {
    if (state.sides.length > 0) throw new Error('Only side-roll initiative may retain side state.')
    return []
  }
  const ordered = [...state.sides].sort(
    (left, right) => (left.sideOrderOrdinal ?? -1) - (right.sideOrderOrdinal ?? -1)
  )
  if (ordered.some((side, ordinal) => side.sideOrderOrdinal !== ordinal))
    throw new Error('Side initiative state must retain one exact contiguous side order.')
  return ordered.map((side) => side.sideId)
}

export function planEncounterInitiativeAdvance(input: {
  state: EncounterInitiativeRoundStateRecord
  currentActorId: string
}): EncounterInitiativeAdvancePlanDto {
  if (input.state.round.status !== 'ACTIVE')
    throw new Error('Only an active initiative round can advance.')
  const { ordered, activeIndex } = orderedInitiativeParticipants(input.state)
  const current = ordered[activeIndex]!
  if (current.actorId !== input.currentActorId)
    throw new Error('Encounter and normalized initiative current actors do not match.')
  const stateChecksum = checksumCanonicalJson(input.state)
  const next = ordered[activeIndex + 1]
  if (next)
    return encounterInitiativeAdvancePlanDtoSchema.parse({
      kind: 'SAME_ROUND',
      round: input.state.round.round,
      stateChecksum,
      currentActorId: current.actorId,
      nextActorId: next.actorId
    })
  const orderedActorIds = ordered.map((participant) => participant.actorId)
  return encounterInitiativeAdvancePlanDtoSchema.parse({
    kind: 'ROUND_WRAP',
    round: input.state.round.round,
    nextRound: input.state.round.round + 1,
    cadence: input.state.round.cadence,
    stateChecksum,
    currentActorId: current.actorId,
    firstActorId: input.state.round.cadence === 'ENCOUNTER_START' ? orderedActorIds[0]! : null,
    orderedActorIds,
    orderedSideIds: orderedInitiativeSides(input.state)
  })
}

export async function applyEncounterInitiativeAdvance(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateRecord
  plan: EncounterInitiativeAdvancePlanDto
}): Promise<EncounterInitiativeRoundStateRecord> {
  const currentPlan = planEncounterInitiativeAdvance({
    state: input.state,
    currentActorId: input.plan.currentActorId
  })
  if (checksumCanonicalJson(currentPlan) !== checksumCanonicalJson(input.plan))
    throw new Error('The normalized initiative round changed before turn advancement.')

  const participants = new Map(
    input.state.participants.map((participant) => [participant.actorId, participant])
  )
  const current = participants.get(input.plan.currentActorId)!
  participants.set(
    current.actorId,
    await input.repository.updateInitiativeParticipant({
      encounterId: current.encounterId,
      round: current.round,
      actorId: current.actorId,
      expectedVersion: current.version,
      status: 'ACTED',
      initiativeScore: current.initiativeScore,
      evaluation: current.evaluation,
      tie: current.tie,
      declaration: current.declaration,
      declarationChecksum: current.declarationChecksum,
      turnOrderOrdinal: current.turnOrderOrdinal
    })
  )

  const sides = new Map(input.state.sides.map((side) => [side.sideId, side]))
  const currentSide = sides.get(current.sideId) ?? null
  let nextSideId: string | null = null
  if (input.plan.kind === 'SAME_ROUND') {
    const next = participants.get(input.plan.nextActorId)!
    nextSideId = next.sideId
    participants.set(
      next.actorId,
      await input.repository.updateInitiativeParticipant({
        encounterId: next.encounterId,
        round: next.round,
        actorId: next.actorId,
        expectedVersion: next.version,
        status: 'ACTIVE',
        initiativeScore: next.initiativeScore,
        evaluation: next.evaluation,
        tie: next.tie,
        declaration: next.declaration,
        declarationChecksum: next.declarationChecksum,
        turnOrderOrdinal: next.turnOrderOrdinal
      })
    )
  }

  if (currentSide && (input.plan.kind === 'ROUND_WRAP' || currentSide.sideId !== nextSideId)) {
    sides.set(
      currentSide.sideId,
      await input.repository.updateInitiativeSide({
        encounterId: currentSide.encounterId,
        round: currentSide.round,
        sideId: currentSide.sideId,
        expectedVersion: currentSide.version,
        status: 'COMPLETED',
        initiativeScore: currentSide.initiativeScore,
        evaluation: currentSide.evaluation,
        tie: currentSide.tie,
        sideOrderOrdinal: currentSide.sideOrderOrdinal
      })
    )
  }
  if (input.plan.kind === 'SAME_ROUND' && currentSide?.sideId !== nextSideId && nextSideId) {
    const nextSide = sides.get(nextSideId)!
    sides.set(
      nextSide.sideId,
      await input.repository.updateInitiativeSide({
        encounterId: nextSide.encounterId,
        round: nextSide.round,
        sideId: nextSide.sideId,
        expectedVersion: nextSide.version,
        status: 'ACTIVE',
        initiativeScore: nextSide.initiativeScore,
        evaluation: nextSide.evaluation,
        tie: nextSide.tie,
        sideOrderOrdinal: nextSide.sideOrderOrdinal
      })
    )
  }

  const round =
    input.plan.kind === 'ROUND_WRAP'
      ? await input.repository.updateInitiativeRound({
          encounterId: input.state.round.encounterId,
          round: input.state.round.round,
          expectedVersion: input.state.round.version,
          status: 'COMPLETED',
          nextTurnOrderOrdinal: input.state.round.nextTurnOrderOrdinal
        })
      : input.state.round
  return {
    round,
    participants: input.state.participants.map(
      (participant) => participants.get(participant.actorId)!
    ),
    sides: input.state.sides.map((side) => sides.get(side.sideId)!)
  }
}
