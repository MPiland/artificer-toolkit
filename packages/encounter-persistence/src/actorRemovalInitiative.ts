import { changedFields } from './documents.js'
import {
  encounterInitiativeRoundStateDtoSchema,
  type EncounterInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import type { EncounterWriteContext } from './store.js'

/**
 * Takes the actor out of initiative. `keepsActor` (D82) leaves its participant rows and place: only
 * ending its turn resets the round's cursor, as removal of the current actor does.
 */
export async function removeActorInitiative(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  actorId: string,
  occurredAt: string,
  keepsActor: boolean
): Promise<EncounterInitiativeRoundStateDto | null> {
  const current = await createEncounterInitiativeStore(ctx).lockInitiativeRound({
    encounterId: state.id,
    round: state.round
  })
  if (state.status === 'ACTIVE' && current === null)
    throw new Error('The normalized initiative round is unavailable.')
  if (current) {
    if (
      current.round.policySnapshotChecksum !==
      (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Initiative policy snapshot does not match the Encounter Run.')
    validateInitiativeCursor({
      state: current,
      currentActorId: state.currentActorId,
      actors,
      allowedSideIds: state.sides.map((side) => side.id)
    })
  }

  if (!keepsActor)
    // Match actor ownership across historical rounds without loading their other participants.
    for await (const row of ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_actorId_round', (q) =>
        q.eq('encounterId', state.id).eq('actorId', actorId)
      ))
      await ctx.db.delete(row._id)
  if (current === null || (keepsActor && state.currentActorId !== actorId)) return null

  const currentActorId = state.currentActorId === actorId ? null : state.currentActorId
  const ordered = current.participants
    .filter((participant) => keepsActor || participant.actorId !== actorId)
    .sort((a, b) => a.turnOrderOrdinal! - b.turnOrderOrdinal!)
  const activeIndex = ordered.findIndex((participant) => participant.actorId === currentActorId)
  const participants = ordered.map((participant, index) => ({
    ...participant,
    turnOrderOrdinal: index,
    status:
      currentActorId === null
        ? ('READY' as const)
        : index < activeIndex
          ? ('ACTED' as const)
          : index === activeIndex
            ? ('ACTIVE' as const)
            : ('READY' as const),
    version: participant.version + 1,
    updatedAt: occurredAt
  }))
  const orderedSides = current.sides
    .filter((side) => participants.some((p) => p.sideId === side.sideId))
    .sort((a, b) => a.sideOrderOrdinal! - b.sideOrderOrdinal!)
  const activeSideId =
    participants.find((participant) => participant.actorId === currentActorId)?.sideId ?? null
  const activeSideIndex = orderedSides.findIndex((side) => side.sideId === activeSideId)
  const sides = orderedSides.map((side, index) => ({
    ...side,
    sideOrderOrdinal: index,
    status:
      activeSideId === null
        ? ('READY' as const)
        : index < activeSideIndex
          ? ('COMPLETED' as const)
          : index === activeSideIndex
            ? ('ACTIVE' as const)
            : ('READY' as const),
    version: side.version + 1,
    updatedAt: occurredAt
  }))
  const result = encounterInitiativeRoundStateDtoSchema.parse({
    round: {
      ...current.round,
      nextTurnOrderOrdinal: participants.length,
      version: current.round.version + 1,
      updatedAt: occurredAt
    },
    participants: participants.sort((a, b) => a.actorId.localeCompare(b.actorId)),
    sides: sides.sort((a, b) => a.sideId.localeCompare(b.sideId))
  })
  validateInitiativeCursor({
    state: result,
    currentActorId,
    actors: keepsActor ? actors : actors.filter((actor) => actor.id !== actorId),
    allowedSideIds: state.sides.map((side) => side.id)
  })
  const round = await ctx.db
    .query('encounterInitiativeRounds')
    .withIndex('by_encounterId_round', (q) =>
      q.eq('encounterId', state.id).eq('round', state.round)
    )
    .unique()
  if (!round || round.version !== current.round.version)
    throw new Error('The normalized initiative round changed before actor removal.')
  await ctx.db.patch(round._id, changedFields(round, result.round))
  for (const participant of result.participants) {
    const row = await ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) =>
        q.eq('encounterId', state.id).eq('round', state.round).eq('actorId', participant.actorId)
      )
      .unique()
    if (!row || row.version !== participant.version - 1)
      throw new Error('Initiative participant changed before actor removal.')
    await ctx.db.patch(row._id, changedFields(row, participant))
  }
  for (const previous of current.sides) {
    const row = await ctx.db
      .query('encounterInitiativeSides')
      .withIndex('by_encounterId_round_sideId', (q) =>
        q.eq('encounterId', state.id).eq('round', state.round).eq('sideId', previous.sideId)
      )
      .unique()
    if (!row || row.version !== previous.version)
      throw new Error('Initiative side changed before actor removal.')
    const next = result.sides.find((side) => side.sideId === previous.sideId)
    if (next) await ctx.db.patch(row._id, changedFields(row, next))
    else await ctx.db.delete(row._id)
  }
  return result
}
