import {
  encounterSourceProjectionFactsSchema,
  encounterStoredRunActorStateSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  runActorPlayState,
  splitRunActorState
} from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveOnce } from './transactionReads.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/**
 * One actor split into its stored record and shared rows, with its rules evaluated as a projection
 * built from the actor alone would: each actor's rules depend only on that actor (ADR 0035
 * Amendments 12 and 29).
 */
export function splitActorForStorage(actor: EncounterRunActorState) {
  if (actor.kind === 'CHARACTER') return splitRunActorState(actor, { actors: [] })
  if (actor.systemId === null) throw new Error('Encounter actor System is unavailable.')
  const facts = buildEncounterActorRuleFacts({ actors: [actor] })
  return splitRunActorState(
    actor,
    reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: actor.systemId, facts }),
      facts
    )
  )
}

function readSourceRow(ctx: EncounterReadContext, encounterId: string, checksum: string) {
  return ctx.db
    .query('encounterSourceProjectionFacts')
    .withIndex('by_encounterId_checksum', (q) =>
      q.eq('encounterId', encounterId).eq('checksum', checksum)
    )
    .unique()
}

/** Stores a Creature source's facts once; identical Creatures in the Run share the row. */
export async function ensureSourceFacts(
  ctx: EncounterWriteContext,
  encounterId: string,
  checksum: string,
  source: NonNullable<ReturnType<typeof splitActorForStorage>['source']>
) {
  if (await readSourceRow(ctx, encounterId, checksum)) return
  await ctx.db.insert('encounterSourceProjectionFacts', {
    encounterId,
    checksum,
    factsJson: JSON.stringify(source)
  })
}

/** Deletes a source's facts once no actor of the Run names them. */
export async function releaseSourceFacts(
  ctx: EncounterWriteContext,
  encounterId: string,
  checksum: string
) {
  const named = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_sourceFactsChecksum', (q) =>
      q.eq('encounterId', encounterId).eq('sourceFactsChecksum', checksum)
    )
    .first()
  if (named) return
  const source = await readSourceRow(ctx, encounterId, checksum)
  if (source) await ctx.db.delete(source._id)
}

function parseStoredActor(row: EncounterDocument<'encounterRunActors'>) {
  const stored = encounterStoredRunActorStateSchema.parse(JSON.parse(row.stateJson))
  if (
    stored.id !== row.id ||
    stored.encounterId !== row.encounterId ||
    stored.snapshotChecksum !== row.snapshotChecksum ||
    (stored.kind === 'CHARACTER' ? null : stored.sourceFactsChecksum) !== row.sourceFactsChecksum ||
    checksumCanonicalJson(runActorPlayState(stored)) !== row.stateChecksum
  )
    throw new Error('Encounter actor state checksum mismatch.')
  return stored
}

/**
 * An actor's verified stored record: its play state, the reference to its snapshot, and the
 * projection facts evaluated when it was written. Shared and frozen where reads are memoized.
 */
export function readStoredRunActor(row: EncounterDocument<'encounterRunActors'>) {
  return deriveOnce(row, parseStoredActor)
}

function parseSourceRow(row: EncounterDocument<'encounterSourceProjectionFacts'>) {
  return encounterSourceProjectionFactsSchema.parse(JSON.parse(row.factsJson))
}

/**
 * A Run's stored actor records in actor ID order, and the source facts they name by checksum. A
 * projection, including the finished Encounter's, reads these instead of the actors' snapshots.
 */
export async function readRunProjectionFacts(ctx: EncounterReadContext, state: EncounterRunState) {
  const rows = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Encounter actors exceed the supported bound.')
  const actors = rows.map(readStoredRunActor).sort((left, right) => left.id.localeCompare(right.id))
  const expectedActorIds = [...state.actorIds].sort((left, right) => left.localeCompare(right))
  if (
    actors.length !== expectedActorIds.length ||
    actors.some(
      (actor, index) =>
        actor.id !== expectedActorIds[index] ||
        actor.encounterId !== state.id ||
        actor.systemId !== state.gameSystemId
    )
  )
    throw new Error('Encounter actor projection facts do not match the Run.')
  const checksums = [
    ...new Set(
      actors.flatMap((actor) =>
        actor.kind !== 'CHARACTER' && actor.sourceFactsChecksum ? [actor.sourceFactsChecksum] : []
      )
    )
  ]
  const sources = new Map(
    await Promise.all(
      checksums.map(async (checksum) => {
        const row = await readSourceRow(ctx, state.id, checksum)
        if (!row) throw new Error('Encounter actor source facts are unavailable.')
        return [checksum, deriveOnce(row, parseSourceRow)] as const
      })
    )
  )
  return { actors, sources }
}
