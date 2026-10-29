import {
  encounterRunStateSchema,
  type EncounterRunActorState,
  type EncounterRunState,
  type EncounterStoredRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import {
  checksumRunActorPlayState,
  composeRunActorState
} from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { recordZoneApplications } from '@artificer-toolkit/shared/vtt/spatial'
import {
  ensureSourceFacts,
  readStoredRunActor,
  releaseSourceFacts,
  serializeStoredRunActor,
  splitActorForStorage
} from './actorProjectionFacts.js'
import { ensureActorSnapshot, readActorSnapshot, releaseActorSnapshot } from './actorSnapshots.js'
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

/**
 * The Run's zone applications once a settled movement's spatial executions are counted against the
 * current turn. A movement that caught no one (no batch) leaves them unchanged.
 */
export function runZoneApplicationsAfter(
  state: Pick<EncounterRunState, 'turnSequence' | 'zoneApplications'>,
  result:
    | {
        status: 'BATCH_COMPLETE'
        executions: readonly {
          candidate: { candidate: { effectId: string; targetActorId: string } }
        }[]
      }
    | { status: 'MOVEMENT_COMPLETE' }
) {
  return recordZoneApplications(
    state.zoneApplications,
    state.turnSequence,
    result.status === 'BATCH_COMPLETE'
      ? result.executions.map((execution) => execution.candidate.candidate)
      : []
  )
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

/** The Run's verified state; shared and frozen where reads are memoized, so callers never mutate it. */
export function readRunState(row: EncounterDocument<'encounterRuns'>) {
  return deriveOnce(row, parseRunState)
}

function parseRunState(row: EncounterDocument<'encounterRuns'>) {
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

const composedActors = new WeakMap<object, WeakMap<object, EncounterRunActorState>>()

/** One composed actor per stored record and snapshot, so reads memoized by actor identity keep hitting. */
function composeActor(
  stored: EncounterStoredRunActorState,
  snapshot: EncounterRunActorState['snapshot'],
  originSnapshot?: EncounterRunActorState['snapshot']
) {
  if (typeof snapshot !== 'object' || snapshot === null)
    return Object.freeze(composeRunActorState(stored, snapshot, originSnapshot))
  let bySnapshot = composedActors.get(stored)
  if (!bySnapshot) {
    bySnapshot = new WeakMap()
    composedActors.set(stored, bySnapshot)
  }
  let actor = bySnapshot.get(snapshot)
  if (!actor) {
    actor = Object.freeze(composeRunActorState(stored, snapshot, originSnapshot))
    bySnapshot.set(snapshot, actor)
  }
  return actor
}

export async function readRunActors(ctx: EncounterReadContext, state: EncounterRunState) {
  const rows = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Encounter actors exceed the supported bound.')
  const snapshots = new Map(
    await Promise.all(
      [
        ...new Set(
          rows.flatMap((row) =>
            row.formOriginSnapshotChecksum === null
              ? [row.snapshotChecksum]
              : [row.snapshotChecksum, row.formOriginSnapshotChecksum]
          )
        )
      ].map(
        async (checksum) => [checksum, await readActorSnapshot(ctx, state.id, checksum)] as const
      )
    )
  )
  const actors = rows
    .map((row) =>
      parseRunActor(
        row,
        state,
        snapshots.get(row.snapshotChecksum)!,
        row.formOriginSnapshotChecksum === null
          ? undefined
          : snapshots.get(row.formOriginSnapshotChecksum)
      )
    )
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

function parseRunActor(
  row: EncounterDocument<'encounterRunActors'>,
  state: EncounterRunState,
  snapshot: EncounterRunActorState['snapshot'],
  originSnapshot?: EncounterRunActorState['snapshot']
) {
  const actor = composeActor(readStoredRunActor(row), snapshot, originSnapshot)
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
    row.stateChecksum !== checksumRunActorPlayState(before) ||
    after.id !== before.id ||
    after.encounterId !== before.encounterId
  )
    throw new Error('Encounter actor changed before settlement.')
  await writeRunActor(ctx, row._id, after)
}

/**
 * Every actor write goes through `insertRunActor`, `writeRunActor` or `deleteRunActor`, which keep
 * the actor's snapshot and source facts rows in step in the same transaction (ADR 0035
 * Amendments 12 and 29). The actor's row holds its play state and projection facts and names its
 * snapshot by checksum; `stateChecksum` covers the actor without its snapshot.
 */
export async function insertRunActor(ctx: EncounterWriteContext, actor: EncounterRunActorState) {
  const split = splitActorForStorage(actor)
  await ensureActorSnapshot(ctx, actor.encounterId, split.snapshotChecksum, split.snapshot)
  if (split.originSnapshot && split.originSnapshotChecksum)
    await ensureActorSnapshot(
      ctx,
      actor.encounterId,
      split.originSnapshotChecksum,
      split.originSnapshot
    )
  if (split.source && split.sourceFactsChecksum)
    await ensureSourceFacts(ctx, actor.encounterId, split.sourceFactsChecksum, split.source)
  await ctx.db.insert('encounterRunActors', {
    id: actor.id,
    encounterId: actor.encounterId,
    stateJson: serializeStoredRunActor(split.stored),
    stateChecksum: checksumRunActorPlayState(actor),
    snapshotChecksum: split.snapshotChecksum,
    formOriginSnapshotChecksum: split.originSnapshotChecksum,
    sourceFactsChecksum: split.sourceFactsChecksum
  })
}

/**
 * Rewrites a stored actor row the caller has already checked. A snapshot or source the actor newly
 * names is written first; one it stops naming is released after the row points elsewhere. An actor
 * that leaves its form (D130) also ends the effect that held it, so no effect outlives its form.
 */
export async function writeRunActor(
  ctx: EncounterWriteContext,
  rowId: EncounterDocument<'encounterRunActors'>['_id'],
  actor: EncounterRunActorState
) {
  const row = await ctx.db.get(rowId)
  if (!row) throw new Error('Encounter actor was not found.')
  const split = splitActorForStorage(actor)
  if (row.snapshotChecksum !== split.snapshotChecksum)
    await ensureActorSnapshot(ctx, actor.encounterId, split.snapshotChecksum, split.snapshot)
  if (
    split.originSnapshot &&
    split.originSnapshotChecksum &&
    row.formOriginSnapshotChecksum !== split.originSnapshotChecksum
  )
    await ensureActorSnapshot(
      ctx,
      actor.encounterId,
      split.originSnapshotChecksum,
      split.originSnapshot
    )
  if (
    split.source &&
    split.sourceFactsChecksum &&
    row.sourceFactsChecksum !== split.sourceFactsChecksum
  )
    await ensureSourceFacts(ctx, actor.encounterId, split.sourceFactsChecksum, split.source)
  await ctx.db.patch(rowId, {
    stateJson: serializeStoredRunActor(split.stored),
    stateChecksum: checksumRunActorPlayState(actor),
    snapshotChecksum: split.snapshotChecksum,
    formOriginSnapshotChecksum: split.originSnapshotChecksum,
    sourceFactsChecksum: split.sourceFactsChecksum
  })
  if (row.snapshotChecksum !== split.snapshotChecksum)
    await releaseActorSnapshot(ctx, row.encounterId, row.snapshotChecksum)
  if (
    row.formOriginSnapshotChecksum !== null &&
    row.formOriginSnapshotChecksum !== split.originSnapshotChecksum
  )
    await releaseActorSnapshot(ctx, row.encounterId, row.formOriginSnapshotChecksum)
  if (row.sourceFactsChecksum !== null && row.sourceFactsChecksum !== split.sourceFactsChecksum)
    await releaseSourceFacts(ctx, row.encounterId, row.sourceFactsChecksum)
  if (actor.form === null) {
    const before = readStoredRunActor(row)
    if (before.form !== null) {
      const effectId = before.form.effectId
      const effect = await ctx.db
        .query('encounterActiveRuleEffects')
        .withIndex('by_encounterId_targetActorId_id', (q) =>
          q.eq('encounterId', row.encounterId).eq('targetActorId', row.id).eq('id', effectId)
        )
        .unique()
      if (effect) await ctx.db.delete(effect._id)
      // A Character's form is held by an effect on the Character.
      if (before.kind === 'CHARACTER') {
        const characterEffect = await ctx.db
          .query('characterActiveRuleEffects')
          .withIndex('by_characterId_id', (q) =>
            q.eq('characterId', before.sourceId).eq('id', effectId)
          )
          .unique()
        if (characterEffect) await ctx.db.delete(characterEffect._id)
      }
    }
  }
}

export async function deleteRunActor(
  ctx: EncounterWriteContext,
  row: EncounterDocument<'encounterRunActors'>
) {
  await ctx.db.delete(row._id)
  await releaseActorSnapshot(ctx, row.encounterId, row.snapshotChecksum)
  if (row.formOriginSnapshotChecksum !== null)
    await releaseActorSnapshot(ctx, row.encounterId, row.formOriginSnapshotChecksum)
  if (row.sourceFactsChecksum !== null)
    await releaseSourceFacts(ctx, row.encounterId, row.sourceFactsChecksum)
}

/** Read one actor with its row, without hydrating unrelated actor snapshots. */
export async function readRunActorWithRow(
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
  const actor = parseRunActor(
    row,
    state,
    await readActorSnapshot(ctx, state.id, row.snapshotChecksum),
    row.formOriginSnapshotChecksum === null
      ? undefined
      : await readActorSnapshot(ctx, state.id, row.formOriginSnapshotChecksum)
  )
  if (
    actor.systemId !== state.gameSystemId ||
    !state.sides.some((side) => side.id === actor.sideId)
  )
    throw new Error('Encounter actor state does not match the Run.')
  return { row, actor }
}

export async function readRunActor(
  ctx: EncounterReadContext,
  state: EncounterRunState,
  actorId: string
) {
  return (await readRunActorWithRow(ctx, state, actorId)).actor
}
