import {
  MAX_ENCOUNTER_ACTORS,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredTurnMovementSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { resolveWalkingSpeedFeet } from '@artificer-toolkit/rules-runtime/walkingSpeed'
import { readEncounterCharacterPlay } from './characterPlay.js'
import { readEncounterControlledActorIds } from './actorController.js'
import { readRunActors, readRunState } from './documents.js'
import type { EncounterDocument, EncounterWriteContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

type RunTurnState = Pick<EncounterRunState, 'id' | 'status' | 'round' | 'currentActorId'>

/** The turn now running: the Run's round and current actor, or null between turns. */
function currentTurn(state: RunTurnState) {
  return state.status === 'ACTIVE' && state.currentActorId !== null
    ? { encounterId: state.id, round: state.round, turnActorId: state.currentActorId }
    : null
}

/** Adds to an actor's record for the current turn, creating it at zero (D38). */
async function addTurnMovement(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string; usedFeet: number; speedBonuses: number }
) {
  const turn = currentTurn(input.state)
  if (!turn) throw new Error('Turn movement needs a current turn.')
  const row = await ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', turn.encounterId)
        .eq('round', turn.round)
        .eq('turnActorId', turn.turnActorId)
        .eq('actorId', input.actorId)
    )
    .unique()
  if (row)
    await ctx.db.patch(row._id, {
      usedFeet: row.usedFeet + input.usedFeet,
      speedBonuses: row.speedBonuses + input.speedBonuses
    })
  else
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: input.actorId,
        usedFeet: input.usedFeet,
        speedBonuses: input.speedBonuses
      })
    )
}

/**
 * Adds an actor's voluntary movement to its record for the current turn (D38). It never writes the
 * Run, so it bumps no version and adds no contention to Encounter commands.
 */
export async function recordTurnMovement(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string; feet: number }
) {
  if (!currentTurn(input.state) || input.feet <= 0) return
  await addTurnMovement(ctx, {
    state: input.state,
    actorId: input.actorId,
    usedFeet: input.feet,
    speedBonuses: 0
  })
}

/** Records a basic action that added the actor's speed to its budget this turn (Dash, D38). */
export async function recordTurnSpeedBonus(
  ctx: EncounterWriteContext,
  input: { state: RunTurnState; actorId: string }
) {
  await addTurnMovement(ctx, { ...input, usedFeet: 0, speedBonuses: 1 })
}

/** Takes back one recorded speed bonus from an actor's turn record (the GM's undo of a Dash). */
export async function removeTurnSpeedBonus(
  ctx: EncounterWriteContext,
  input: { encounterId: string; round: number; turnActorId: string; actorId: string }
) {
  const row = await ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', input.encounterId)
        .eq('round', input.round)
        .eq('turnActorId', input.turnActorId)
        .eq('actorId', input.actorId)
    )
    .unique()
  if (!row || row.speedBonuses < 1) throw new Error('The turn speed bonus record is unavailable.')
  await ctx.db.patch(row._id, { speedBonuses: row.speedBonuses - 1 })
}
/** Each actor's record for the current turn; an actor without one has moved none and has no bonus. */
async function readTurnMovementByActorId(
  ctx: EncounterReadTransaction,
  state: RunTurnState
): Promise<ReadonlyMap<string, { usedFeet: number; speedBonuses: number }>> {
  const turn = currentTurn(state)
  if (!turn) return new Map()
  const rows = await ctx.db
    .query('encounterTurnMovements')
    .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
      q
        .eq('encounterId', turn.encounterId)
        .eq('round', turn.round)
        .eq('turnActorId', turn.turnActorId)
    )
    .take(MAX_ENCOUNTER_ACTORS)
  return new Map(rows.map((row) => [row.actorId, row]))
}

/**
 * The tabletop's movement readout (V07.5): feet spent this turn and the walking-speed budget for
 * each actor the member controls, which for the GM is every actor. Characters read the speed their
 * row stores; creatures read their stat block's walking speed; custom actors have no budget. Each
 * speed bonus this turn (Dash) adds the speed once more.
 */
export async function readTurnMovementView(
  ctx: EncounterReadTransaction,
  input: {
    row: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
  }
): Promise<EncounterSessionStateDto['turnMovement']> {
  const state = readRunState(input.row)
  if (!currentTurn(state)) return []
  const runActors = await readRunActors(ctx, state)
  const controlled = await readEncounterControlledActorIds(ctx, { ...input, actors: runActors })
  const actors = runActors.filter((actor) => controlled.has(actor.id))
  const records = await readTurnMovementByActorId(ctx, state)
  const speeds = actors.some((actor) => actor.kind === 'CREATURE')
    ? (await ctx.ports.requireSystem(input.campaign.gameSystemId)).speeds
    : []
  return Promise.all(
    actors.map(async (actor) => {
      const record = records.get(actor.id)
      const speed =
        actor.kind === 'CHARACTER'
          ? ((await readEncounterCharacterPlay(ctx, actor.sourceId))?.walkingSpeed ?? null)
          : actor.kind === 'CREATURE'
            ? resolveWalkingSpeedFeet(snapshotStatBlock(actor)?.speeds ?? [], speeds)
            : null
      return {
        actorId: actor.id,
        used: record?.usedFeet ?? 0,
        budget: speed === null ? null : speed * (1 + (record?.speedBonuses ?? 0))
      }
    })
  )
}
