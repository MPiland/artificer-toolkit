import type { EncounterActorOwnerDto } from '@artificer-toolkit/schema/api/encounterData'
import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

export function orderedInitiativeRows<
  T extends { turnOrderOrdinal?: number | null; sideOrderOrdinal?: number | null }
>(rows: readonly T[], key: 'turnOrderOrdinal' | 'sideOrderOrdinal', label: string) {
  const result = [...rows].sort((left, right) => (left[key] ?? -1) - (right[key] ?? -1))
  if (result.some((row, index) => row[key] !== index))
    throw new Error(`Initiative ${label} must retain one exact contiguous order.`)
  return result
}

/**
 * The one reader of the participant turn cursor. `currentActorId` pins the cursor (`null` means no
 * actor is active yet); omitting it requires and derives exactly one ACTIVE participant.
 */
export function readTurnCursor(
  state: EncounterInitiativeRoundStateDto,
  errors: { order: string; cursor: string },
  currentActorId?: string | null
) {
  const participants = [...state.participants].sort(
    (left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1)
  )
  if (
    (currentActorId === undefined && participants.length < 1) ||
    participants.some((participant, ordinal) => participant.turnOrderOrdinal !== ordinal)
  )
    throw new Error(errors.order)
  const activeIndex =
    currentActorId === undefined
      ? participants.findIndex((participant) => participant.status === 'ACTIVE')
      : currentActorId === null
        ? -1
        : participants.findIndex((participant) => participant.actorId === currentActorId)
  if (
    (currentActorId !== null && activeIndex < 0) ||
    participants.some((participant, index) =>
      activeIndex < 0
        ? participant.status !== 'READY'
        : participant.status !==
          (index < activeIndex ? 'ACTED' : index === activeIndex ? 'ACTIVE' : 'READY')
    )
  )
    throw new Error(errors.cursor)
  return { participants, activeIndex }
}

/** Side rows in settled order; non-side-roll rounds must retain none. */
export function readSideOrder(state: EncounterInitiativeRoundStateDto, orderError: string) {
  if (state.round.procedure !== 'SIDE_ROLL') {
    if (state.sides.length > 0) throw new Error('Only side-roll initiative may retain side state.')
    return []
  }
  const sides = [...state.sides].sort(
    (left, right) => (left.sideOrderOrdinal ?? -1) - (right.sideOrderOrdinal ?? -1)
  )
  if (sides.some((side, ordinal) => side.sideOrderOrdinal !== ordinal)) throw new Error(orderError)
  return sides
}

/** The owner link of a Run actor, as the initiative order reads it. */
export type ActorOwnerLink = Pick<EncounterActorOwnerDto, 'ownerActorId' | 'turnTiming'>

/**
 * Whether a Run actor is rolled into the initiative order: an owned actor acts on its owner's turn
 * (D190a) unless its summon was authored to roll its own initiative (D200). One authored to act right
 * after its owner is not rolled; its turn follows the owner's.
 */
export function takesInitiativeTurns(actor: { owner?: ActorOwnerLink | null }) {
  return !actor.owner || actor.owner.turnTiming === 'OWN_INITIATIVE'
}

export function validateInitiativeCursor(input: {
  state: EncounterInitiativeRoundStateDto
  currentActorId: string | null
  /** Every Run actor; the owned ones are left out of the cohort. */
  actors: readonly { id: string; owner?: ActorOwnerLink | null }[]
  allowedSideIds: readonly string[]
}): void {
  const { state, currentActorId, actors, allowedSideIds } = input
  if (state.round.status !== 'ACTIVE')
    throw new Error('The normalized initiative round is unavailable.')
  const participantIds = state.participants.map((participant) => participant.actorId).sort()
  const expectedActorIds = actors
    .filter(takesInitiativeTurns)
    .map((actor) => actor.id)
    .sort()
  if (
    participantIds.length !== expectedActorIds.length ||
    participantIds.some((id, index) => id !== expectedActorIds[index]) ||
    state.participants.some((participant) => !allowedSideIds.includes(participant.sideId))
  )
    throw new Error('Initiative actor cohort does not match the Encounter Run.')
  const { participants } = readTurnCursor(
    state,
    {
      order: 'Initiative actor must retain one exact contiguous order.',
      cursor: 'The current Encounter actor does not match normalized initiative.'
    },
    currentActorId
  )
  const sides = readSideOrder(state, 'Initiative side must retain one exact contiguous order.')
  if (state.round.procedure !== 'SIDE_ROLL') return
  const sideIds = [...new Set(state.participants.map((participant) => participant.sideId))].sort()
  if (
    sides.length !== sideIds.length ||
    [...sides.map((side) => side.sideId)].sort().some((id, i) => id !== sideIds[i])
  )
    throw new Error('Initiative side cohort does not match the Encounter Run.')
  const participantSideOrder = participants.map((participant) => participant.sideId)
  const compactSideOrder = participantSideOrder.filter(
    (sideId, index) => index === 0 || participantSideOrder[index - 1] !== sideId
  )
  if (
    new Set(compactSideOrder).size !== compactSideOrder.length ||
    compactSideOrder.length !== sides.length ||
    compactSideOrder.some((sideId, index) => sideId !== sides[index]!.sideId)
  )
    throw new Error('Side initiative actor order must retain contiguous settled side order.')
  const activeSideId =
    currentActorId === null
      ? null
      : (participants.find((participant) => participant.actorId === currentActorId)?.sideId ?? null)
  const activeSideIndex =
    activeSideId === null ? -1 : sides.findIndex((side) => side.sideId === activeSideId)
  if (
    (activeSideId !== null && activeSideIndex < 0) ||
    sides.some((side, index) =>
      activeSideId === null
        ? side.status !== 'READY'
        : side.status !==
          (index < activeSideIndex ? 'COMPLETED' : index === activeSideIndex ? 'ACTIVE' : 'READY')
    )
  )
    throw new Error('The current Encounter side does not match normalized initiative.')
}
