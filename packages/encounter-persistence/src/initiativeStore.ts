import {
  createEncounterInitiativeRoundDtoSchema,
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeRoundStateDtoSchema,
  encounterInitiativeSideDtoSchema,
  stagedInitiativeRoundStateDtoSchema,
  updateEncounterInitiativeParticipantDtoSchema,
  updateEncounterInitiativeRoundDtoSchema,
  updateEncounterInitiativeSideDtoSchema
} from '@artificer-toolkit/schema/shared/initiativeState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { EncounterConflictError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { takesInitiativeTurns } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'

import { readRunActors, readRunState, changedFields } from './documents.js'
import type { EncounterReadContext, EncounterWriteContext } from './store.js'

const storedRoundSchema = encounterInitiativeRoundDtoSchema.clone({
  ...encounterInitiativeRoundDtoSchema._zod.def,
  catchall: undefined
})
const storedSideSchema = encounterInitiativeSideDtoSchema.clone({
  ...encounterInitiativeSideDtoSchema._zod.def,
  catchall: undefined
})
const storedParticipantSchema = encounterInitiativeParticipantDtoSchema.clone({
  ...encounterInitiativeParticipantDtoSchema._zod.def,
  catchall: undefined
})

function roundTransition(current: string, next: string) {
  return (
    current === next ||
    (current === 'PREPARING' && next === 'ACTIVE') ||
    (current === 'ACTIVE' && next === 'COMPLETED')
  )
}

function participantTransition(current: string, next: string) {
  return (
    current === next ||
    (current === 'UNRESOLVED' && ['PENDING', 'EVALUATED', 'READY'].includes(next)) ||
    (current === 'PENDING' && ['EVALUATED', 'READY'].includes(next)) ||
    (current === 'EVALUATED' && ['PENDING', 'READY'].includes(next)) ||
    (current === 'READY' && next === 'ACTIVE') ||
    // A defeated actor's skipped turn (D63).
    (current === 'READY' && next === 'ACTED') ||
    (current === 'ACTIVE' && next === 'ACTED')
  )
}

function sideTransition(current: string, next: string) {
  return (
    current === next ||
    (current === 'UNRESOLVED' && ['PENDING', 'EVALUATED', 'READY'].includes(next)) ||
    (current === 'PENDING' && ['EVALUATED', 'READY'].includes(next)) ||
    (current === 'EVALUATED' && ['PENDING', 'READY'].includes(next)) ||
    (current === 'READY' && next === 'ACTIVE') ||
    // A side whose every turn was skipped (D63).
    (current === 'READY' && next === 'COMPLETED') ||
    (current === 'ACTIVE' && next === 'COMPLETED')
  )
}

export async function readEncounterInitiativeRound(
  ctx: EncounterReadContext,
  input: { encounterId: string; round: number }
) {
  const header = await ctx.db
    .query('encounterInitiativeRounds')
    .withIndex('by_encounterId_round', (q) =>
      q.eq('encounterId', input.encounterId).eq('round', input.round)
    )
    .unique()
  if (!header) return null
  const [sides, participants] = await Promise.all([
    ctx.db
      .query('encounterInitiativeSides')
      .withIndex('by_encounterId_round_sideId', (q) =>
        q.eq('encounterId', input.encounterId).eq('round', input.round)
      )
      .take(MAX_ENCOUNTER_ACTORS + 1),
    ctx.db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) =>
        q.eq('encounterId', input.encounterId).eq('round', input.round)
      )
      .take(MAX_ENCOUNTER_ACTORS + 1)
  ])
  if (sides.length > MAX_ENCOUNTER_ACTORS || participants.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Initiative state exceeds the Encounter actor bound.')
  return encounterInitiativeRoundStateDtoSchema.parse({
    round: storedRoundSchema.parse(header),
    sides: sides.map((side) => storedSideSchema.parse(side)),
    participants: participants.map((participant) => storedParticipantSchema.parse(participant))
  })
}

export function createEncounterInitiativeStore(ctx: EncounterWriteContext) {
  async function lockInitiativeRound(input: { encounterId: string; round: number }) {
    return readEncounterInitiativeRound(ctx, input)
  }

  return {
    async persistStagedInitiativeRound(input: unknown, options?: { replaceExistingRound: true }) {
      const staged = stagedInitiativeRoundStateDtoSchema.parse(input)
      if (staged.round.status !== 'ACTIVE')
        throw new EncounterConflictError('Only settled initiative state can be persisted.')
      const existing = await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) =>
          q.eq('encounterId', staged.round.encounterId).eq('round', staged.round.round)
        )
        .unique()
      if (existing && !options?.replaceExistingRound)
        throw new EncounterConflictError('Initiative round already exists.')
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', staged.round.encounterId))
        .unique()
      if (!run) throw new Error('Encounter Run is unavailable.')
      const runState = readRunState(run)
      if (
        staged.round.policySnapshotChecksum !==
        (runState.automationMode === 'MANUAL' ? null : runState.initiativePolicySnapshotChecksum)
      )
        throw new EncounterConflictError('Staged initiative policy does not match the Run.')
      if (
        options?.replaceExistingRound &&
        (runState.status !== 'ACTIVE' ||
          staged.round.round !== runState.round + 1 ||
          staged.round.cadence !== 'EACH_ROUND' ||
          runState.automationMode === 'MANUAL')
      )
        throw new EncounterConflictError('Only each-round advancement may replace a settled round.')
      const actors = (await readRunActors(ctx, runState)).filter(takesInitiativeTurns)
      const participants = [...staged.participants].sort((left, right) =>
        left.actorId.localeCompare(right.actorId)
      )
      const actorIds = actors.map((actor) => actor.id).sort()
      if (
        participants.length !== actorIds.length ||
        participants.some(
          (participant, index) =>
            participant.actorId !== actorIds[index] ||
            participant.sideId !== actors.find((actor) => actor.id === participant.actorId)?.sideId
        )
      )
        throw new EncounterConflictError('Initiative actor cohort changed while paused.')
      const sideIds = [...new Set(actors.map((actor) => actor.sideId))].sort()
      if (
        staged.round.procedure === 'SIDE_ROLL'
          ? staged.sides.length !== sideIds.length ||
            staged.sides.some((side, index) => side.sideId !== sideIds[index])
          : staged.sides.length !== 0
      )
        throw new EncounterConflictError('Initiative side cohort changed while paused.')
      const [existingParticipants, existingSides] = await Promise.all([
        ctx.db
          .query('encounterInitiativeParticipants')
          .withIndex('by_encounterId_round_actorId', (q) =>
            q.eq('encounterId', staged.round.encounterId).eq('round', staged.round.round)
          )
          .take(MAX_ENCOUNTER_ACTORS + 1),
        ctx.db
          .query('encounterInitiativeSides')
          .withIndex('by_encounterId_round_sideId', (q) =>
            q.eq('encounterId', staged.round.encounterId).eq('round', staged.round.round)
          )
          .take(MAX_ENCOUNTER_ACTORS + 1)
      ])
      if (
        existingParticipants.length > MAX_ENCOUNTER_ACTORS ||
        existingSides.length > MAX_ENCOUNTER_ACTORS ||
        (!existing && (existingParticipants.length > 0 || existingSides.length > 0))
      )
        throw new EncounterConflictError('Stored target initiative state is inconsistent.')
      if (existing) {
        const previous = encounterInitiativeRoundStateDtoSchema.parse({
          round: storedRoundSchema.parse(existing),
          participants: existingParticipants.map((participant) =>
            storedParticipantSchema.parse(participant)
          ),
          sides: existingSides.map((side) => storedSideSchema.parse(side))
        })
        if (
          previous.round.status === 'PREPARING' ||
          previous.round.procedure !== staged.round.procedure ||
          previous.round.cadence !== staged.round.cadence ||
          previous.round.policySnapshotChecksum !== staged.round.policySnapshotChecksum
        )
          throw new EncounterConflictError('Stored target initiative policy is inconsistent.')
      }
      const now = new Date().toISOString()
      const round = encounterInitiativeRoundDtoSchema.parse({
        ...staged.round,
        version: existing ? existing.version + 1 : staged.round.version,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now
      })
      if (existing) await ctx.db.patch(existing._id, changedFields(existing, round))
      else await ctx.db.insert('encounterInitiativeRounds', round)
      for (const participant of staged.participants) {
        const previous = existingParticipants.find((row) => row.actorId === participant.actorId)
        const value = encounterInitiativeParticipantDtoSchema.parse({
          ...participant,
          version: previous ? previous.version + 1 : participant.version,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now
        })
        if (previous) await ctx.db.patch(previous._id, changedFields(previous, value))
        else await ctx.db.insert('encounterInitiativeParticipants', value)
      }
      for (const participant of existingParticipants)
        if (!staged.participants.some((row) => row.actorId === participant.actorId))
          await ctx.db.delete(participant._id)
      for (const side of staged.sides) {
        const previous = existingSides.find((row) => row.sideId === side.sideId)
        const value = encounterInitiativeSideDtoSchema.parse({
          ...side,
          version: previous ? previous.version + 1 : side.version,
          createdAt: previous?.createdAt ?? now,
          updatedAt: now
        })
        if (previous) await ctx.db.patch(previous._id, changedFields(previous, value))
        else await ctx.db.insert('encounterInitiativeSides', value)
      }
      for (const side of existingSides)
        if (!staged.sides.some((row) => row.sideId === side.sideId)) await ctx.db.delete(side._id)
    },
    async createInitiativeRound(input: unknown) {
      const parsed = createEncounterInitiativeRoundDtoSchema.parse(input)
      const existing = await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) =>
          q.eq('encounterId', parsed.encounterId).eq('round', parsed.round)
        )
        .unique()
      if (existing) throw new EncounterConflictError('Initiative round already exists.')
      const run = await ctx.db
        .query('encounterRuns')
        .withIndex('by_publicId', (q) => q.eq('id', parsed.encounterId))
        .unique()
      if (!run) throw new Error('Encounter Run is unavailable.')
      const runState = readRunState(run)
      const actorStates = await readRunActors(ctx, runState)
      const now = new Date().toISOString()
      const round = encounterInitiativeRoundDtoSchema.parse({
        ...parsed,
        status: 'PREPARING',
        nextTurnOrderOrdinal: 0,
        version: 0,
        createdAt: now,
        updatedAt: now
      })
      await ctx.db.insert('encounterInitiativeRounds', round)
      for (const actor of actorStates) {
        await ctx.db.insert(
          'encounterInitiativeParticipants',
          encounterInitiativeParticipantDtoSchema.parse({
            encounterId: parsed.encounterId,
            round: parsed.round,
            actorId: actor.id,
            sideId: actor.sideId,
            status: 'UNRESOLVED',
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            declaration: null,
            declarationChecksum: null,
            turnOrderOrdinal: null,
            version: 0,
            createdAt: now,
            updatedAt: now
          })
        )
      }
      if (parsed.procedure === 'SIDE_ROLL') {
        for (const sideId of [...new Set(actorStates.map((actor) => actor.sideId))].sort()) {
          await ctx.db.insert(
            'encounterInitiativeSides',
            encounterInitiativeSideDtoSchema.parse({
              encounterId: parsed.encounterId,
              round: parsed.round,
              sideId,
              status: 'UNRESOLVED',
              initiativeScore: null,
              evaluation: { occurrenceId: null, resultChecksum: null },
              tie: { occurrenceId: null, resultChecksum: null },
              sideOrderOrdinal: null,
              version: 0,
              createdAt: now,
              updatedAt: now
            })
          )
        }
      }
      return round
    },
    lockInitiativeRound,
    async updateInitiativeRound(input: unknown) {
      const parsed = updateEncounterInitiativeRoundDtoSchema.parse(input)
      const row = await ctx.db
        .query('encounterInitiativeRounds')
        .withIndex('by_encounterId_round', (q) =>
          q.eq('encounterId', parsed.encounterId).eq('round', parsed.round)
        )
        .unique()
      if (
        !row ||
        row.version !== parsed.expectedVersion ||
        row.nextTurnOrderOrdinal > parsed.nextTurnOrderOrdinal ||
        !roundTransition(row.status, parsed.status)
      )
        throw new EncounterConflictError('Initiative round changed before it could be updated.')
      const updated = encounterInitiativeRoundDtoSchema.parse({
        encounterId: row.encounterId,
        round: row.round,
        procedure: row.procedure,
        cadence: row.cadence,
        policySnapshotChecksum: row.policySnapshotChecksum,
        createdAt: row.createdAt,
        status: parsed.status,
        nextTurnOrderOrdinal: parsed.nextTurnOrderOrdinal,
        version: row.version + 1,
        updatedAt: new Date().toISOString()
      })
      await ctx.db.patch(row._id, changedFields(row, updated))
      return updated
    },
    async updateInitiativeParticipant(input: unknown) {
      const parsed = updateEncounterInitiativeParticipantDtoSchema.parse(input)
      const row = await ctx.db
        .query('encounterInitiativeParticipants')
        .withIndex('by_encounterId_round_actorId', (q) =>
          q
            .eq('encounterId', parsed.encounterId)
            .eq('round', parsed.round)
            .eq('actorId', parsed.actorId)
        )
        .unique()
      if (
        !row ||
        row.version !== parsed.expectedVersion ||
        (row.turnOrderOrdinal !== null && row.turnOrderOrdinal !== parsed.turnOrderOrdinal) ||
        (row.evaluation.occurrenceId !== null &&
          (row.evaluation.occurrenceId !== parsed.evaluation.occurrenceId ||
            row.evaluation.resultChecksum !== parsed.evaluation.resultChecksum)) ||
        (row.tie.occurrenceId !== null &&
          (row.tie.occurrenceId !== parsed.tie.occurrenceId ||
            row.tie.resultChecksum !== parsed.tie.resultChecksum)) ||
        (row.turnOrderOrdinal !== null && row.initiativeScore !== parsed.initiativeScore) ||
        !participantTransition(row.status, parsed.status)
      )
        throw new EncounterConflictError(
          'Initiative participant changed before it could be updated.'
        )
      const updated = encounterInitiativeParticipantDtoSchema.parse({
        encounterId: row.encounterId,
        round: row.round,
        actorId: row.actorId,
        sideId: row.sideId,
        createdAt: row.createdAt,
        status: parsed.status,
        initiativeScore: parsed.initiativeScore,
        evaluation: parsed.evaluation,
        tie: parsed.tie,
        declaration: parsed.declaration,
        declarationChecksum: parsed.declarationChecksum,
        turnOrderOrdinal: parsed.turnOrderOrdinal,
        version: row.version + 1,
        updatedAt: new Date().toISOString()
      })
      await ctx.db.patch(row._id, changedFields(row, updated))
      return updated
    },
    async updateInitiativeSide(input: unknown) {
      const parsed = updateEncounterInitiativeSideDtoSchema.parse(input)
      const row = await ctx.db
        .query('encounterInitiativeSides')
        .withIndex('by_encounterId_round_sideId', (q) =>
          q
            .eq('encounterId', parsed.encounterId)
            .eq('round', parsed.round)
            .eq('sideId', parsed.sideId)
        )
        .unique()
      if (
        !row ||
        row.version !== parsed.expectedVersion ||
        (row.sideOrderOrdinal !== null && row.sideOrderOrdinal !== parsed.sideOrderOrdinal) ||
        (row.evaluation.occurrenceId !== null &&
          (row.evaluation.occurrenceId !== parsed.evaluation.occurrenceId ||
            row.evaluation.resultChecksum !== parsed.evaluation.resultChecksum)) ||
        (row.tie.occurrenceId !== null &&
          (row.tie.occurrenceId !== parsed.tie.occurrenceId ||
            row.tie.resultChecksum !== parsed.tie.resultChecksum)) ||
        (row.sideOrderOrdinal !== null && row.initiativeScore !== parsed.initiativeScore) ||
        !sideTransition(row.status, parsed.status)
      )
        throw new EncounterConflictError('Initiative side changed before it could be updated.')
      const updated = encounterInitiativeSideDtoSchema.parse({
        encounterId: row.encounterId,
        round: row.round,
        sideId: row.sideId,
        createdAt: row.createdAt,
        status: parsed.status,
        initiativeScore: parsed.initiativeScore,
        evaluation: parsed.evaluation,
        tie: parsed.tie,
        sideOrderOrdinal: parsed.sideOrderOrdinal,
        version: row.version + 1,
        updatedAt: new Date().toISOString()
      })
      await ctx.db.patch(row._id, changedFields(row, updated))
      return updated
    }
  }
}
