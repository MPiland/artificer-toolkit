import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type {
  EncounterInitiativeParticipantDto,
  EncounterInitiativeRoundDto,
  EncounterInitiativeRoundStateDto,
  EncounterInitiativeSideDto,
  UpdateEncounterInitiativeParticipantDto,
  UpdateEncounterInitiativeRoundDto,
  UpdateEncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import {
  encounterInitiativeAdvancePlanDtoSchema,
  type EncounterInitiativeAdvancePlanDto
} from '@artificer-toolkit/schema/shared/ruleExecutionInitiative'

type InitiativeRepository = {
  updateInitiativeParticipant(
    input: UpdateEncounterInitiativeParticipantDto
  ): Promise<EncounterInitiativeParticipantDto>
  updateInitiativeRound(
    input: UpdateEncounterInitiativeRoundDto
  ): Promise<EncounterInitiativeRoundDto>
  updateInitiativeSide(input: UpdateEncounterInitiativeSideDto): Promise<EncounterInitiativeSideDto>
}

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
  state: EncounterInitiativeRoundStateDto
  orderedActorIds: readonly string[]
  orderedSideIds?: readonly string[]
}): Promise<EncounterInitiativeRoundStateDto> {
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
  const readyParticipants: EncounterInitiativeParticipantDto[] = []
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
  const readySides: EncounterInitiativeSideDto[] = []
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
  return {
    round,
    participants: readyParticipants.sort((left, right) =>
      left.actorId.localeCompare(right.actorId)
    ),
    sides: readySides.sort((left, right) => left.sideId.localeCompare(right.sideId))
  }
}

function orderedInitiativeParticipants(state: EncounterInitiativeRoundStateDto) {
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

function orderedInitiativeSides(state: EncounterInitiativeRoundStateDto): string[] {
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

/**
 * Plans the next turn. Defeated actors (D63) keep their initiative place, but their turns are
 * skipped: the next turn goes to the next actor that isn't defeated, wrapping the round when none
 * remains after the current one.
 */
export function planEncounterInitiativeAdvance(input: {
  state: EncounterInitiativeRoundStateDto
  currentActorId: string
  defeatedActorIds: ReadonlySet<string>
}): EncounterInitiativeAdvancePlanDto {
  if (input.state.round.status !== 'ACTIVE')
    throw new Error('Only an active initiative round can advance.')
  const { ordered, activeIndex } = orderedInitiativeParticipants(input.state)
  const current = ordered[activeIndex]!
  if (current.actorId !== input.currentActorId)
    throw new Error('Encounter and normalized initiative current actors do not match.')
  const stateChecksum = checksumCanonicalJson(input.state)
  const next = ordered
    .slice(activeIndex + 1)
    .find((participant) => !input.defeatedActorIds.has(participant.actorId))
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
    firstActorId:
      input.state.round.cadence === 'ENCOUNTER_START'
        ? firstUndefeatedActorId(orderedActorIds, input.defeatedActorIds)
        : null,
    orderedActorIds,
    orderedSideIds: orderedInitiativeSides(input.state)
  })
}

/** The round's opening actor: the first one that isn't defeated (D63). */
export function firstUndefeatedActorId(
  orderedActorIds: readonly string[],
  defeatedActorIds: ReadonlySet<string>
): string {
  // With everyone defeated the round still needs a current actor; the order's first keeps it.
  return orderedActorIds.find((actorId) => !defeatedActorIds.has(actorId)) ?? orderedActorIds[0]!
}

/**
 * Moves a just-settled round's opening turn past defeated actors (D63), marking them as having
 * acted; they keep their initiative place. Unchanged when the opener can act or everyone is defeated.
 */
export async function skipDefeatedOpeningTurns(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateDto
  defeatedActorIds: ReadonlySet<string>
}): Promise<EncounterInitiativeRoundStateDto> {
  const { ordered, activeIndex } = orderedInitiativeParticipants(input.state)
  const opener = ordered[activeIndex]!
  if (
    activeIndex !== 0 ||
    firstUndefeatedActorId(
      ordered.map((participant) => participant.actorId),
      input.defeatedActorIds
    ) === opener.actorId
  )
    return input.state
  const plan = planEncounterInitiativeAdvance({
    state: input.state,
    currentActorId: opener.actorId,
    defeatedActorIds: input.defeatedActorIds
  })
  return applyEncounterInitiativeAdvance({ ...input, plan })
}

/**
 * Commits a planned advance. The outgoing actor and every defeated actor whose turn is skipped are
 * marked as having acted, and so is each side left behind, so the cursor stays contiguous.
 */
export async function applyEncounterInitiativeAdvance(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateDto
  plan: EncounterInitiativeAdvancePlanDto
  defeatedActorIds: ReadonlySet<string>
}): Promise<EncounterInitiativeRoundStateDto> {
  const currentPlan = planEncounterInitiativeAdvance({
    state: input.state,
    currentActorId: input.plan.currentActorId,
    defeatedActorIds: input.defeatedActorIds
  })
  if (checksumCanonicalJson(currentPlan) !== checksumCanonicalJson(input.plan))
    throw new Error('The normalized initiative round changed before turn advancement.')

  const { ordered, activeIndex } = orderedInitiativeParticipants(input.state)
  const nextActorId = input.plan.kind === 'SAME_ROUND' ? input.plan.nextActorId : null
  const nextIndex =
    nextActorId === null
      ? ordered.length
      : ordered.findIndex((participant) => participant.actorId === nextActorId)
  const participants = new Map(
    input.state.participants.map((participant) => [participant.actorId, participant])
  )
  const setParticipantStatus = async (
    participant: EncounterInitiativeParticipantDto,
    status: 'ACTED' | 'ACTIVE'
  ) =>
    participants.set(
      participant.actorId,
      await input.repository.updateInitiativeParticipant({
        encounterId: participant.encounterId,
        round: participant.round,
        actorId: participant.actorId,
        expectedVersion: participant.version,
        status,
        initiativeScore: participant.initiativeScore,
        evaluation: participant.evaluation,
        tie: participant.tie,
        declaration: participant.declaration,
        declarationChecksum: participant.declarationChecksum,
        turnOrderOrdinal: participant.turnOrderOrdinal
      })
    )
  for (const participant of ordered.slice(activeIndex, nextIndex))
    await setParticipantStatus(participant, 'ACTED')
  const next = ordered[nextIndex]
  if (next) await setParticipantStatus(next, 'ACTIVE')

  const sides = new Map(input.state.sides.map((side) => [side.sideId, side]))
  const setSideStatus = async (sideId: string, status: 'COMPLETED' | 'ACTIVE') => {
    const side = sides.get(sideId)
    if (!side) throw new Error('The normalized initiative side changed before turn advancement.')
    sides.set(
      sideId,
      await input.repository.updateInitiativeSide({
        encounterId: side.encounterId,
        round: side.round,
        sideId,
        expectedVersion: side.version,
        status,
        initiativeScore: side.initiativeScore,
        evaluation: side.evaluation,
        tie: side.tie,
        sideOrderOrdinal: side.sideOrderOrdinal
      })
    )
  }
  if (input.state.round.procedure === 'SIDE_ROLL') {
    const nextSideId = next?.sideId ?? null
    const leftSideIds = new Set(
      ordered.slice(activeIndex, nextIndex).map((participant) => participant.sideId)
    )
    if (nextSideId !== null) leftSideIds.delete(nextSideId)
    for (const sideId of leftSideIds) await setSideStatus(sideId, 'COMPLETED')
    if (nextSideId !== null && nextSideId !== ordered[activeIndex]!.sideId)
      await setSideStatus(nextSideId, 'ACTIVE')
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
