import {
  MAX_ENCOUNTER_ACTORS,
  type EncounterSessionStateDto
} from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredTurnMovementSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { snapshotStatBlock } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { resolveWalkingSpeedFeet } from '@artificer-toolkit/rules-runtime/walkingSpeed'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { requireSystem } from '../content/systemDocuments'
import { readEncounterControlledActorIds } from './actorController'
import { readRunActors, readRunState } from './documents'

type RunTurnState = Pick<EncounterRunState, 'id' | 'status' | 'round' | 'currentActorId'>

/** The turn now running: the Run's round and current actor, or null between turns. */
function currentTurn(state: RunTurnState) {
  return state.status === 'ACTIVE' && state.currentActorId !== null
    ? { encounterId: state.id, round: state.round, turnActorId: state.currentActorId }
    : null
}

/**
 * Adds an actor's voluntary movement to its record for the current turn (D38). It never writes the
 * Run, so it bumps no version and adds no contention to Encounter commands.
 */
export async function recordTurnMovement(
  ctx: MutationCtx,
  input: { state: RunTurnState; actorId: string; feet: number }
) {
  const turn = currentTurn(input.state)
  if (!turn || input.feet <= 0) return
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
  if (row) await ctx.db.patch(row._id, { usedFeet: row.usedFeet + input.feet })
  else
    await ctx.db.insert(
      'encounterTurnMovements',
      encounterStoredTurnMovementSchema.parse({
        ...turn,
        actorId: input.actorId,
        usedFeet: input.feet
      })
    )
}

/** Feet each actor has moved in the current turn; an actor without a record has moved none. */
export async function readTurnMovementByActorId(
  ctx: QueryCtx,
  state: RunTurnState
): Promise<ReadonlyMap<string, number>> {
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
  return new Map(rows.map((row) => [row.actorId, row.usedFeet]))
}

/**
 * The tabletop's movement readout (V07.5): feet spent this turn and the walking-speed budget for
 * each actor the member controls, which for the GM is every actor. Characters read the speed their
 * row stores; creatures read their stat block's walking speed; custom actors have no budget.
 */
export async function readTurnMovementView(
  ctx: QueryCtx,
  input: {
    row: Doc<'encounterRuns'>
    campaign: Doc<'campaigns'>
    membership: Doc<'campaignMemberships'>
  }
): Promise<EncounterSessionStateDto['turnMovement']> {
  const state = readRunState(input.row)
  if (!currentTurn(state)) return []
  const runActors = await readRunActors(ctx, state)
  const controlled = await readEncounterControlledActorIds(ctx, { ...input, actors: runActors })
  const actors = runActors.filter((actor) => controlled.has(actor.id))
  const used = await readTurnMovementByActorId(ctx, state)
  const speeds = actors.some((actor) => actor.kind === 'CREATURE')
    ? (await requireSystem(ctx, input.campaign.gameSystemId)).speeds
    : []
  return Promise.all(
    actors.map(async (actor) => ({
      actorId: actor.id,
      used: used.get(actor.id) ?? 0,
      budget:
        actor.kind === 'CHARACTER'
          ? ((
              await ctx.db
                .query('characters')
                .withIndex('by_publicId', (q) => q.eq('id', actor.sourceId))
                .unique()
            )?.walkingSpeed ?? null)
          : actor.kind === 'CREATURE'
            ? resolveWalkingSpeedFeet(snapshotStatBlock(actor)?.speeds ?? [], speeds)
            : null
    }))
  )
}

/** A completed Run keeps no turn movement (D38) or GM-skip records (D39). */
export async function removeCompletedRunTurnRecords(ctx: MutationCtx, encounterId: string) {
  const [movements, skips] = await Promise.all([
    ctx.db
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId)
      )
      .collect(),
    ctx.db
      .query('encounterDecisionSkips')
      .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
        q.eq('encounterId', encounterId)
      )
      .collect()
  ])
  for (const row of [...movements, ...skips]) await ctx.db.delete(row._id)
}
