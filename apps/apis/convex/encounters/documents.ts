import * as z from 'zod/mini'
import {
  encounterGmActorDtoSchema,
  encounterGmProjectionDtoSchema
} from '@artificer-toolkit/schema/api/encounterData'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type Context = MutationCtx | QueryCtx

const actorCoreFields = z.omit(encounterGmActorDtoSchema, {
  statBlock: true,
  features: true,
  healthBand: true,
  sourceRevision: true,
  currentHitPoints: true,
  maxHitPoints: true,
  tempHitPoints: true,
  conditions: true
})
const actorCoreSchema = actorCoreFields.clone({ ...actorCoreFields._zod.def, catchall: undefined })
const runOwnedFields = z.pick(encounterGmActorDtoSchema, {
  sourceRevision: true,
  currentHitPoints: true,
  maxHitPoints: true,
  tempHitPoints: true,
  conditions: true
})
const runOwnedSchema = runOwnedFields.clone({ ...runOwnedFields._zod.def, catchall: undefined })

/**
 * The actor fields a stored projection repeats from its Run actor. Character hit points,
 * maximum, conditions and stream versions belong to the Character, so only other actors include them.
 */
export function readEncounterActorCore(actor: unknown) {
  const core = actorCoreSchema.parse(actor)
  return core.kind === 'CHARACTER' ? core : { ...core, ...runOwnedSchema.parse(actor) }
}

export function readRunProjection(row: Doc<'encounterRuns'>) {
  const projection = encounterGmProjectionDtoSchema.parse(JSON.parse(row.projectionJson))
  if (
    projection.id !== row.id ||
    projection.campaignId !== row.campaignId ||
    projection.gameSystemId !== row.gameSystemId ||
    projection.version !== row.version ||
    projection.status !== row.status ||
    checksumCanonicalJson(projection) !== row.projectionChecksum
  )
    throw new Error('Stored Encounter projection mismatch.')
  return projection
}

export function readValidatedRunProjection(row: Doc<'encounterRuns'>, campaign: Doc<'campaigns'>) {
  if (row.campaignId !== campaign.id || row.gameSystemId !== campaign.gameSystemId)
    throw new Error('Stored Encounter ownership mismatch.')
  return readRunProjection(row)
}

export function readRunState(row: Doc<'encounterRuns'>) {
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

export async function readRunActors(ctx: Context, state: EncounterRunState) {
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

function parseRunActor(row: Doc<'encounterRunActors'>, state: EncounterRunState) {
  const actor = encounterRunActorStateSchema.parse(JSON.parse(row.stateJson))
  if (
    actor.id !== row.id ||
    actor.encounterId !== state.id ||
    checksumCanonicalJson(actor) !== row.stateChecksum
  )
    throw new Error('Encounter actor state checksum mismatch.')
  return actor
}

/** Read one actor without hydrating unrelated actor snapshots. */
export async function readRunActor(ctx: Context, state: EncounterRunState, actorId: string) {
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
