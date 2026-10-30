import { changedFields } from './documents.js'
import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundStateDtoSchema,
  encounterInitiativeSideDtoSchema,
  type EncounterInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import {
  encounterRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import type { EncounterWriteContext } from './store.js'

type ReinforcementInitiative = {
  actor: EncounterRunActorState
  actors: EncounterRunActorState[]
  state: EncounterInitiativeRoundStateDto | null
}

function order<
  T extends {
    turnOrderOrdinal?: number | null
    sideOrderOrdinal?: number | null
  }
>(values: readonly T[], key: 'turnOrderOrdinal' | 'sideOrderOrdinal') {
  return [...values].sort((left, right) => (left[key] ?? -1) - (right[key] ?? -1))
}

function scoreOrder(
  left: { score: number; tie: string },
  right: { score: number; tie: string },
  direction: 'ASCENDING' | 'DESCENDING'
) {
  const score = direction === 'ASCENDING' ? left.score - right.score : right.score - left.score
  return score === 0 ? left.tie.localeCompare(right.tie) : score
}

/** Inserts only into the current normalized round; historical initiative rows stay immutable. */
export async function insertReinforcementInitiative(input: {
  ctx: EncounterWriteContext
  state: EncounterRunState
  actors: readonly EncounterRunActorState[]
  actor: EncounterRunActorState
  initiative: number | null | undefined
  occurredAt: string
}): Promise<ReinforcementInitiative> {
  if (input.state.status !== 'ACTIVE')
    return {
      actor: input.actor,
      actors: [...input.actors, input.actor],
      state: null
    }
  const store = createEncounterInitiativeStore(input.ctx)
  const current = await store.lockInitiativeRound({
    encounterId: input.state.id,
    round: input.state.round
  })
  if (!current) throw new Error('The normalized initiative round is unavailable.')
  if (
    current.round.policySnapshotChecksum !==
    (input.state.automationMode === 'MANUAL' ? null : input.state.initiativePolicySnapshotChecksum)
  )
    throw new Error('Initiative policy snapshot does not match the Encounter Run.')
  validateInitiativeCursor({
    state: current,
    currentActorId: input.state.currentActorId,
    actors: input.actors,
    allowedSideIds: input.state.sides.map((side) => side.id)
  })

  const allActors = [...input.actors, input.actor]
  const actorById = new Map(allActors.map((actor) => [actor.id, actor]))
  const isSideRoll = current.round.procedure === 'SIDE_ROLL'
  const currentParticipants = order(current.participants, 'turnOrderOrdinal')
  const currentSides = order(current.sides, 'sideOrderOrdinal')
  const activeIndex =
    input.state.currentActorId === null
      ? -1
      : currentParticipants.findIndex((row) => row.actorId === input.state.currentActorId)
  const sortDirection =
    current.round.procedure === 'MANUAL'
      ? 'DESCENDING'
      : input.state.initiativePolicySnapshot?.policy.document.evaluationGraph.sortDirection
  if (!sortDirection) throw new Error('Initiative ordering policy is unavailable.')

  let actor = input.actor
  let participants: EncounterInitiativeRoundStateDto['participants']
  let sides: EncounterInitiativeRoundStateDto['sides']
  if (!isSideRoll) {
    if (
      input.initiative === null ||
      input.initiative === undefined ||
      !Number.isFinite(input.initiative) ||
      !Number.isInteger(input.initiative)
    )
      throw new Error('Active actor initiative requires a finite integer score.')
    const inserted = encounterInitiativeParticipantDtoSchema.parse({
      encounterId: input.state.id,
      round: input.state.round,
      actorId: actor.id,
      sideId: actor.sideId,
      status: 'READY',
      initiativeScore: input.initiative,
      evaluation: { occurrenceId: null, resultChecksum: null },
      tie: { occurrenceId: null, resultChecksum: null },
      declaration: null,
      declarationChecksum: null,
      turnOrderOrdinal: 0,
      version: 0,
      createdAt: input.occurredAt,
      updatedAt: input.occurredAt
    })
    const insertionIndex = currentParticipants.findIndex((participant) => {
      const participantActor = actorById.get(participant.actorId)
      if (!participantActor) throw new Error('Initiative participant actor is unavailable.')
      const score = participant.initiativeScore ?? participantActor.initiative
      if (score === null) throw new Error('Active initiative participants must have scores.')
      return (
        scoreOrder(
          { score: input.initiative!, tie: actor.stableTieKey },
          { score, tie: participantActor.stableTieKey },
          sortDirection
        ) < 0
      )
    })
    const orderedParticipants = [...currentParticipants]
    orderedParticipants.splice(
      insertionIndex < 0 ? orderedParticipants.length : insertionIndex,
      0,
      inserted
    )
    participants = orderedParticipants.map((participant, index) =>
      encounterInitiativeParticipantDtoSchema.parse({
        ...participant,
        status:
          participant.actorId === actor.id
            ? input.state.currentActorId === null
              ? 'READY'
              : index <= activeIndex
                ? 'ACTED'
                : 'READY'
            : participant.status,
        turnOrderOrdinal: index,
        ...(participant.actorId === actor.id
          ? {}
          : participant.turnOrderOrdinal === index
            ? {}
            : {
                version: participant.version + 1,
                updatedAt: input.occurredAt
              })
      })
    )
    const insertedIndex = participants.findIndex((participant) => participant.actorId === actor.id)
    actor = {
      ...actor,
      initiative: input.initiative,
      manualOrder: insertedIndex
    }
    sides = []
  } else {
    const existingSide = currentSides.find((side) => side.sideId === actor.sideId)
    let orderedSides: EncounterInitiativeRoundStateDto['sides']
    let insertedSideIndex: number
    if (existingSide) {
      actor = {
        ...actor,
        initiative: existingSide.initiativeScore,
        manualOrder: null
      }
      orderedSides = currentSides
      insertedSideIndex = orderedSides.findIndex((side) => side.sideId === actor.sideId)
    } else {
      if (
        input.initiative === null ||
        input.initiative === undefined ||
        !Number.isFinite(input.initiative) ||
        !Number.isInteger(input.initiative)
      )
        throw new Error('An empty active side requires a finite integer initiative score.')
      actor = { ...actor, initiative: input.initiative, manualOrder: null }
      const insertedSide = encounterInitiativeSideDtoSchema.parse({
        encounterId: input.state.id,
        round: input.state.round,
        sideId: actor.sideId,
        status: 'READY',
        initiativeScore: input.initiative,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        sideOrderOrdinal: 0,
        version: 0,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt
      })
      const insertionIndex = currentSides.findIndex((side) => {
        if (side.initiativeScore === null)
          throw new Error('Active initiative sides must have scores.')
        return (
          scoreOrder(
            { score: input.initiative!, tie: actor.sideId },
            { score: side.initiativeScore, tie: side.sideId },
            sortDirection
          ) < 0
        )
      })
      orderedSides = [...currentSides]
      orderedSides.splice(
        insertionIndex < 0 ? orderedSides.length : insertionIndex,
        0,
        insertedSide
      )
      insertedSideIndex = orderedSides.findIndex((side) => side.sideId === actor.sideId)
    }
    const activeSideId =
      input.state.currentActorId === null
        ? null
        : (currentParticipants.find((row) => row.actorId === input.state.currentActorId)?.sideId ??
          null)
    const activeSideIndex =
      activeSideId === null ? -1 : orderedSides.findIndex((side) => side.sideId === activeSideId)
    sides = orderedSides.map((side, index) =>
      encounterInitiativeSideDtoSchema.parse({
        ...side,
        status:
          side.sideId === actor.sideId && !existingSide
            ? input.state.currentActorId === null || index > activeSideIndex
              ? 'READY'
              : 'COMPLETED'
            : side.status,
        sideOrderOrdinal: index,
        ...(side.sideId === actor.sideId && !existingSide
          ? {}
          : side.sideOrderOrdinal === index
            ? {}
            : { version: side.version + 1, updatedAt: input.occurredAt })
      })
    )
    const insertionStatus =
      input.state.currentActorId === null ||
      (existingSide ? existingSide.status !== 'COMPLETED' : insertedSideIndex > activeSideIndex)
        ? 'READY'
        : 'ACTED'
    const sideOrder = order(sides, 'sideOrderOrdinal').map((side) => side.sideId)
    const grouped = sideOrder.flatMap((sideId) =>
      currentParticipants.filter((row) => row.sideId === sideId)
    )
    const insertionIndex =
      grouped.length === 0
        ? 0
        : existingSide
          ? grouped.reduce(
              (last, row, index) => (row.sideId === actor.sideId ? index + 1 : last),
              0
            )
          : grouped.findIndex((row) => row.sideId === sideOrder[insertedSideIndex + 1])
    const position = insertionIndex < 0 ? grouped.length : insertionIndex
    grouped.splice(
      position,
      0,
      encounterInitiativeParticipantDtoSchema.parse({
        encounterId: input.state.id,
        round: input.state.round,
        actorId: actor.id,
        sideId: actor.sideId,
        status: insertionStatus,
        initiativeScore: actor.initiative,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: position,
        version: 0,
        createdAt: input.occurredAt,
        updatedAt: input.occurredAt
      })
    )
    participants = grouped.map((participant, index) =>
      encounterInitiativeParticipantDtoSchema.parse({
        ...participant,
        turnOrderOrdinal: index,
        ...(participant.actorId === actor.id || participant.turnOrderOrdinal === index
          ? {}
          : { version: participant.version + 1, updatedAt: input.occurredAt })
      })
    )
  }
  const result = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      ...current.round,
      nextTurnOrderOrdinal: participants.length,
      version: current.round.version + 1,
      updatedAt: input.occurredAt
    },
    participants: [...participants].sort((left, right) =>
      left.actorId.localeCompare(right.actorId)
    ),
    sides: [...sides].sort((left, right) => left.sideId.localeCompare(right.sideId))
  })
  validateInitiativeCursor({
    state: result,
    currentActorId: input.state.currentActorId,
    actors: allActors,
    allowedSideIds: input.state.sides.map((side) => side.id)
  })
  const roundRow = await input.ctx.db
    .query('encounterInitiativeRounds')
    .withIndex('by_encounterId_round', (q) =>
      q.eq('encounterId', input.state.id).eq('round', input.state.round)
    )
    .unique()
  if (!roundRow || roundRow.version !== current.round.version)
    throw new Error('The normalized initiative round changed before reinforcement.')
  await input.ctx.db.patch(roundRow._id, changedFields(roundRow, result.round))
  for (const participant of result.participants) {
    const previous = current.participants.find((row) => row.actorId === participant.actorId)
    if (!previous) {
      await input.ctx.db.insert('encounterInitiativeParticipants', participant)
      continue
    }
    if (previous.turnOrderOrdinal === participant.turnOrderOrdinal) continue
    const row = await input.ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) =>
        q
          .eq('encounterId', input.state.id)
          .eq('round', input.state.round)
          .eq('actorId', participant.actorId)
      )
      .unique()
    if (!row || row.version !== previous.version)
      throw new Error('Initiative participant changed before reinforcement.')
    await input.ctx.db.patch(row._id, changedFields(row, participant))
  }
  for (const side of result.sides) {
    const previous = current.sides.find((row) => row.sideId === side.sideId)
    if (!previous) {
      await input.ctx.db.insert('encounterInitiativeSides', side)
      continue
    }
    if (previous.sideOrderOrdinal === side.sideOrderOrdinal) continue
    const row = await input.ctx.db
      .query('encounterInitiativeSides')
      .withIndex('by_encounterId_round_sideId', (q) =>
        q.eq('encounterId', input.state.id).eq('round', input.state.round).eq('sideId', side.sideId)
      )
      .unique()
    if (!row || row.version !== previous.version)
      throw new Error('Initiative side changed before reinforcement.')
    await input.ctx.db.patch(row._id, changedFields(row, side))
  }
  const orderedActors = result.participants.map((participant) => {
    const currentActor = actorById.get(participant.actorId)
    if (!currentActor) throw new Error('Initiative participant actor is unavailable.')
    const manualOrder = participant.turnOrderOrdinal
    return encounterRunActorStateSchema.parse({
      ...currentActor,
      ...(currentActor.id === actor.id ? { initiative: participant.initiativeScore } : {}),
      manualOrder,
      ...(currentActor.manualOrder === manualOrder ? {} : { updatedAt: input.occurredAt })
    })
  })
  const reinforced = orderedActors.find((candidate) => candidate.id === actor.id)
  if (!reinforced) throw new Error('Reinforced actor is unavailable.')
  // An owned actor acting on its owner's turn is in no round; the order leaves it as it is.
  const unordered = input.actors.filter(
    (candidate) => !result.participants.some(({ actorId }) => actorId === candidate.id)
  )
  return { actor: reinforced, actors: [...orderedActors, ...unordered], state: result }
}
