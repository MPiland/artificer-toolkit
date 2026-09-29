import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deleteActorProjectionFacts, writeActorProjectionFacts } from './actorProjectionFacts.js'
import { deriveOnce } from './transactionReads.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/**
 * The fields of `next` that differ from `current`, for a patch that writes only what a command
 * changed: the delta a checkpoint carries (ADR 0035 Amendment 12).
 */
export function changedFields<Fields extends object>(
  current: NoInfer<Fields>,
  next: Fields
): Partial<Fields> {
  const changed: Partial<Fields> = {}
  for (const key of Object.keys(next) as (keyof Fields)[])
    if (JSON.stringify(current[key]) !== JSON.stringify(next[key])) changed[key] = next[key]
  return changed
}

/** Reads a Run's state after checking that it belongs to `campaign` and its Game System. */
export function readCampaignRunState(
  row: EncounterDocument<'encounterRuns'>,
  campaign: EncounterDocument<'campaigns'>
) {
  if (row.campaignId !== campaign.id || row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Stored Encounter ownership mismatch.')
  return readRunState(row)
}

export function readRunState(row: EncounterDocument<'encounterRuns'>) {
  const state = encounterRunStateSchema.parse(JSON.parse(row.stateJson))
  if (
    state.id !== row.id ||
    state.campaignId !== row.campaignId ||
    state.gameSystemId !== row.gameSystemId ||
    state.version !== row.version ||
    state.status !== row.status ||
    checksumCanonicalJson(state) !== row.stateChecksum ||
    state.optionalCombatSnapshot.gameSystemId !== state.gameSystemId ||
    checksumCanonicalJson(state.optionalCombatSnapshot) !== state.optionalCombatSnapshotChecksum ||
    (state.initiativePolicySnapshot === null
      ? state.initiativePolicySnapshotChecksum !== null
      : state.initiativePolicySnapshot.gameSystemId !== state.gameSystemId ||
        checksumCanonicalJson(state.initiativePolicySnapshot) !==
          state.initiativePolicySnapshotChecksum)
  )
    throw new Error('Stored Encounter policy snapshot mismatch.')
  return state
}

export async function readRunActors(ctx: EncounterReadContext, state: EncounterRunState) {
  const rows = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Encounter actors exceed the supported bound.')
  const actors = rows
    .map((row) => parseRunActor(row, state))
    .sort((left, right) => left.id.localeCompare(right.id))
  const expectedActorIds = [...state.actorIds].sort((left, right) => left.localeCompare(right))
  if (
    actors.length !== expectedActorIds.length ||
    actors.some(
      (actor, index) =>
        actor.id !== expectedActorIds[index] ||
        actor.systemId !== state.gameSystemId ||
        !state.sides.some((side) => side.id === actor.sideId)
    )
  )
    throw new Error('Encounter actor state does not match the Run.')
  return actors
}

function readRunActorDocument(row: EncounterDocument<'encounterRunActors'>) {
  const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
  if (actor.id !== row.id || checksumCanonicalJson(actor) !== row.stateChecksum)
    throw new Error('Encounter actor state checksum mismatch.')
  return actor
}

function parseRunActor(row: EncounterDocument<'encounterRunActors'>, state: EncounterRunState) {
  const actor = deriveOnce(row, readRunActorDocument)
  if (actor.encounterId !== state.id) throw new Error('Encounter actor state checksum mismatch.')
  return actor
}

/** Replaces one actor's stored state, refusing when it changed since `before` was read. */
export async function replaceRunActor(
  ctx: EncounterWriteContext,
  before: EncounterRunActorState,
  after: EncounterRunActorState
) {
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', before.encounterId).eq('id', before.id)
    )
    .unique()
  if (
    !row ||
    row.stateChecksum !== checksumCanonicalJson(before) ||
    after.id !== before.id ||
    after.encounterId !== before.encounterId
  )
    throw new Error('Encounter actor changed before settlement.')
  await writeRunActor(ctx, row._id, after)
}

/**
 * Every actor write goes through `insertRunActor`, `writeRunActor` or `deleteRunActor`, which keep
 * the actor's projection facts in step in the same transaction (ADR 0035 Amendment 12).
 */
export async function insertRunActor(ctx: EncounterWriteContext, actor: EncounterRunActorState) {
  await ctx.db.insert('encounterRunActors', {
    id: actor.id,
    encounterId: actor.encounterId,
    stateJson: JSON.stringify(actor),
    stateChecksum: checksumCanonicalJson(actor)
  })
  await writeActorProjectionFacts(ctx, actor)
}

/** Rewrites a stored actor row the caller has already checked. */
export async function writeRunActor(
  ctx: EncounterWriteContext,
  rowId: EncounterDocument<'encounterRunActors'>['_id'],
  actor: EncounterRunActorState
) {
  await ctx.db.patch(rowId, {
    stateJson: JSON.stringify(actor),
    stateChecksum: checksumCanonicalJson(actor)
  })
  await writeActorProjectionFacts(ctx, actor)
}

export async function deleteRunActor(
  ctx: EncounterWriteContext,
  row: EncounterDocument<'encounterRunActors'>
) {
  await ctx.db.delete(row._id)
  await deleteActorProjectionFacts(ctx, row.encounterId, row.id)
}

/** Read one actor without hydrating unrelated actor snapshots. */
export async function readRunActor(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  actorId: string
) {
  if (!state.actorIds.includes(actorId)) throw new Error('Encounter actor was not found.')
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id).eq('id', actorId))
    .unique()
  if (!row) throw new Error('Encounter actor was not found.')
  const actor = parseRunActor(row, state)
  if (
    actor.systemId !== state.gameSystemId ||
    !state.sides.some((side) => side.id === actor.sideId)
  )
    throw new Error('Encounter actor state does not match the Run.')
  return actor
}
