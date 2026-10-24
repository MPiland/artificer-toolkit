import {
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeRoundStateDtoSchema,
  encounterInitiativeSideDtoSchema,
  type EncounterInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/initiativeState'
import { readRunActors, readRunState, changedFields } from './documents.js'
import { createEncounterInitiativeStore } from './initiativeStore.js'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  orderedInitiativeRows,
  validateInitiativeCursor
} from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import type { EncounterWriteContext } from './store.js'

export async function correctInitiativeCursor(input: {
  ctx: EncounterWriteContext
  encounterId: string
  sourceRound: number
  targetRound: number
  sourceCurrentActorId: string | null
  currentActorId: string | null
}): Promise<EncounterInitiativeRoundStateDto> {
  const { currentActorId } = input
  const initiative = createEncounterInitiativeStore(input.ctx)
  const source = await initiative.lockInitiativeRound({
    encounterId: input.encounterId,
    round: input.sourceRound
  })
  if (!source) throw new Error('The normalized initiative round is unavailable.')
  const run = await input.ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
    .unique()
  if (!run) throw new Error('Encounter Run is unavailable.')
  const runState = readRunState(run)
  if (
    source.round.policySnapshotChecksum !==
    (runState.automationMode === 'MANUAL' ? null : runState.initiativePolicySnapshotChecksum)
  )
    throw new Error('Initiative policy snapshot does not match the Encounter Run.')
  if (
    runState.round !== input.sourceRound ||
    runState.currentActorId !== input.sourceCurrentActorId
  )
    throw new Error('Encounter cursor changed before initiative correction.')
  const actors = await readRunActors(input.ctx, runState)
  const actorSides = new Map(actors.map((actor) => [actor.id, actor.sideId]))
  validateInitiativeCursor({
    state: source,
    currentActorId: input.sourceCurrentActorId,
    actors,
    allowedSideIds: runState.sides.map((side) => side.id)
  })
  if (currentActorId !== null && !actorSides.has(currentActorId))
    throw new Error('Encounter actor was not found.')
  const target = await initiative.lockInitiativeRound({
    encounterId: input.encounterId,
    round: input.targetRound
  })
  if (target && target.round.policySnapshotChecksum !== source.round.policySnapshotChecksum)
    throw new Error('Initiative policy snapshot does not match the Encounter Run.')
  const [targetRoundRow, targetParticipantRows, targetSideRows] = target
    ? await Promise.all([
        input.ctx.db
          .query('encounterInitiativeRounds')
          .withIndex('by_encounterId_round', (q) =>
            q.eq('encounterId', input.encounterId).eq('round', input.targetRound)
          )
          .unique(),
        input.ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', input.encounterId).eq('round', input.targetRound)
          )
          .take(MAX_ENCOUNTER_ACTORS + 1),
        input.ctx.db
          .query('encounterInitiativeSides')
          .withIndex('by_encounterId_round_sideId', (q) =>
            q.eq('encounterId', input.encounterId).eq('round', input.targetRound)
          )
          .take(MAX_ENCOUNTER_ACTORS + 1)
      ])
    : [null, [], []]
  if (
    target &&
    (!targetRoundRow ||
      targetParticipantRows.length !== target.participants.length ||
      targetSideRows.length !== target.sides.length)
  )
    throw new Error('The normalized initiative round is unavailable.')
  const now = new Date().toISOString()
  const orderedParticipants = orderedInitiativeRows(
    source.participants,
    'turnOrderOrdinal',
    'actor'
  )
  const activeIndex =
    currentActorId === null
      ? -1
      : orderedParticipants.findIndex((participant) => participant.actorId === currentActorId)
  const participants = orderedParticipants.map((participant, index) => {
    const existing = target?.participants.find(
      (candidate) => candidate.actorId === participant.actorId
    )
    return encounterInitiativeParticipantDtoSchema.parse({
      ...participant,
      round: input.targetRound,
      status:
        currentActorId === null
          ? 'READY'
          : index < activeIndex
            ? 'ACTED'
            : index === activeIndex
              ? 'ACTIVE'
              : 'READY',
      version: existing ? existing.version + 1 : 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
  })
  const orderedSides =
    source.round.procedure === 'SIDE_ROLL'
      ? orderedInitiativeRows(source.sides, 'sideOrderOrdinal', 'side')
      : []
  const activeSideId =
    currentActorId === null
      ? null
      : (orderedParticipants.find((participant) => participant.actorId === currentActorId)
          ?.sideId ?? null)
  const activeSideIndex =
    activeSideId === null ? -1 : orderedSides.findIndex((side) => side.sideId === activeSideId)
  const sides = orderedSides.map((side, index) => {
    const existing = target?.sides.find((candidate) => candidate.sideId === side.sideId)
    return encounterInitiativeSideDtoSchema.parse({
      ...side,
      round: input.targetRound,
      status:
        activeSideId === null
          ? 'READY'
          : index < activeSideIndex
            ? 'COMPLETED'
            : index === activeSideIndex
              ? 'ACTIVE'
              : 'READY',
      version: existing ? existing.version + 1 : 0,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    })
  })
  const round = encounterInitiativeRoundDtoSchema.parse({
    ...source.round,
    round: input.targetRound,
    status: 'ACTIVE',
    nextTurnOrderOrdinal: participants.length,
    version: target ? target.round.version + 1 : 0,
    createdAt: target?.round.createdAt ?? now,
    updatedAt: now
  })
  const corrected = encounterInitiativeRoundStateDtoSchema.parse({
    round,
    participants: [...participants].sort((a, b) => a.actorId.localeCompare(b.actorId)),
    sides: [...sides].sort((a, b) => a.sideId.localeCompare(b.sideId))
  })
  validateInitiativeCursor({
    state: corrected,
    currentActorId,
    actors,
    allowedSideIds: runState.sides.map((side) => side.id)
  })
  if (target) {
    await input.ctx.db.patch(targetRoundRow!._id, changedFields(targetRoundRow!, round))
    for (const participant of participants) {
      const row = targetParticipantRows.find(
        (candidate) => candidate.actorId === participant.actorId
      )
      if (row) await input.ctx.db.patch(row._id, changedFields(row, participant))
      else await input.ctx.db.insert('encounterInitiativeParticipants', participant)
    }
    for (const row of targetParticipantRows)
      if (!participants.some((participant) => participant.actorId === row.actorId))
        await input.ctx.db.delete(row._id)
    for (const side of sides) {
      const row = targetSideRows.find((candidate) => candidate.sideId === side.sideId)
      if (row) await input.ctx.db.patch(row._id, changedFields(row, side))
      else await input.ctx.db.insert('encounterInitiativeSides', side)
    }
    for (const row of targetSideRows)
      if (!sides.some((side) => side.sideId === row.sideId)) await input.ctx.db.delete(row._id)
  } else {
    await input.ctx.db.insert('encounterInitiativeRounds', round)
    for (const participant of participants)
      await input.ctx.db.insert('encounterInitiativeParticipants', participant)
    for (const side of sides) await input.ctx.db.insert('encounterInitiativeSides', side)
  }
  return corrected
}
