import type { EncounterInitiativeRoundStateDto } from '@artificer-toolkit/schema/shared/initiativeState'

export function orderedInitiativeRows<
  T extends { turnOrderOrdinal?: number | null; sideOrderOrdinal?: number | null }
>(rows: readonly T[], key: 'turnOrderOrdinal' | 'sideOrderOrdinal', label: string) {
  const result = [...rows].sort((left, right) => (left[key] ?? -1) - (right[key] ?? -1))
  if (result.some((row, index) => row[key] !== index))
    throw new Error(`Initiative ${label} must retain one exact contiguous order.`)
  return result
}

export function validateInitiativeCursor(input: {
  state: EncounterInitiativeRoundStateDto
  currentActorId: string | null
  actorIds: readonly string[]
  allowedSideIds: readonly string[]
}): void {
  const { state, currentActorId, actorIds, allowedSideIds } = input
  if (state.round.status !== 'ACTIVE')
    throw new Error('The normalized initiative round is unavailable.')
  const participantIds = state.participants.map((participant) => participant.actorId).sort()
  const expectedActorIds = [...actorIds].sort()
  if (
    participantIds.length !== expectedActorIds.length ||
    participantIds.some((id, index) => id !== expectedActorIds[index]) ||
    state.participants.some((participant) => !allowedSideIds.includes(participant.sideId))
  )
    throw new Error('Initiative actor cohort does not match the Encounter Run.')
  const participants = orderedInitiativeRows(state.participants, 'turnOrderOrdinal', 'actor')
  const activeIndex =
    currentActorId === null ? -1 : participants.findIndex((p) => p.actorId === currentActorId)
  if (
    (currentActorId !== null && activeIndex < 0) ||
    participants.some((participant, index) =>
      currentActorId === null
        ? participant.status !== 'READY'
        : participant.status !==
          (index < activeIndex ? 'ACTED' : index === activeIndex ? 'ACTIVE' : 'READY')
    )
  )
    throw new Error('The current Encounter actor does not match normalized initiative.')
  if (state.round.procedure !== 'SIDE_ROLL') {
    if (state.sides.length !== 0)
      throw new Error('Only side-roll initiative may retain side state.')
    return
  }
  const sides = orderedInitiativeRows(state.sides, 'sideOrderOrdinal', 'side')
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
