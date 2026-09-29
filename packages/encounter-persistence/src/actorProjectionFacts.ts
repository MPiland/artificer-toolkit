import {
  encounterActorProjectionFactsSchema,
  encounterSourceProjectionFactsSchema,
  type EncounterRunActorState,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { MAX_ENCOUNTER_ACTORS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { projectEncounterActorFacts } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { deriveOnce } from './transactionReads.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/**
 * One actor's projection facts with its rules evaluated as a projection built from the actor alone
 * would: each actor's rules depend only on that actor (ADR 0035 Amendment 12).
 */
function evaluateActorProjectionFacts(actor: EncounterRunActorState) {
  if (actor.kind === 'CHARACTER') return projectEncounterActorFacts(actor, { actors: [] })
  if (actor.systemId === null) throw new Error('Encounter actor System is unavailable.')
  const facts = buildEncounterActorRuleFacts({ actors: [actor] })
  return projectEncounterActorFacts(
    actor,
    reconcileEncounterActorRuleOutput(
      evaluateInstalledEncounterActors({ gameSystemId: actor.systemId, facts }),
      facts
    )
  )
}

function readFactsRow(ctx: EncounterReadContext, encounterId: string, actorId: string) {
  return ctx.db
    .query('encounterActorProjectionFacts')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId).eq('id', actorId))
    .unique()
}

function readSourceRow(ctx: EncounterReadContext, encounterId: string, checksum: string) {
  return ctx.db
    .query('encounterSourceProjectionFacts')
    .withIndex('by_encounterId_checksum', (q) =>
      q.eq('encounterId', encounterId).eq('checksum', checksum)
    )
    .unique()
}

/** Deletes a source's facts once no actor of the Run names them. */
async function releaseSourceFacts(
  ctx: EncounterWriteContext,
  encounterId: string,
  checksum: string
) {
  const named = await ctx.db
    .query('encounterActorProjectionFacts')
    .withIndex('by_encounterId_sourceFactsChecksum', (q) =>
      q.eq('encounterId', encounterId).eq('sourceFactsChecksum', checksum)
    )
    .first()
  if (named) return
  const source = await readSourceRow(ctx, encounterId, checksum)
  if (source) await ctx.db.delete(source._id)
}

/**
 * Writes `actor`'s projection facts beside it. Every actor insert and update calls this in the same
 * transaction (through `insertRunActor` and `writeRunActor`), so the facts never lag the actor.
 */
export async function writeActorProjectionFacts(
  ctx: EncounterWriteContext,
  actor: EncounterRunActorState
) {
  const { facts, source } = evaluateActorProjectionFacts(actor)
  const sourceFactsChecksum = facts.kind === 'CHARACTER' ? null : facts.sourceFactsChecksum
  if (
    source &&
    sourceFactsChecksum &&
    !(await readSourceRow(ctx, actor.encounterId, sourceFactsChecksum))
  )
    await ctx.db.insert('encounterSourceProjectionFacts', {
      encounterId: actor.encounterId,
      checksum: sourceFactsChecksum,
      factsJson: JSON.stringify(source)
    })
  const factsJson = JSON.stringify(facts)
  const row = await readFactsRow(ctx, actor.encounterId, actor.id)
  if (!row) {
    await ctx.db.insert('encounterActorProjectionFacts', {
      id: actor.id,
      encounterId: actor.encounterId,
      factsJson,
      sourceFactsChecksum
    })
    return
  }
  if (row.factsJson === factsJson && row.sourceFactsChecksum === sourceFactsChecksum) return
  await ctx.db.patch(row._id, { factsJson, sourceFactsChecksum })
  if (row.sourceFactsChecksum !== null && row.sourceFactsChecksum !== sourceFactsChecksum)
    await releaseSourceFacts(ctx, actor.encounterId, row.sourceFactsChecksum)
}

/** Deletes an actor's projection facts with the actor. */
export async function deleteActorProjectionFacts(
  ctx: EncounterWriteContext,
  encounterId: string,
  actorId: string
) {
  const row = await readFactsRow(ctx, encounterId, actorId)
  if (!row) throw new Error('Encounter actor projection facts are unavailable.')
  await ctx.db.delete(row._id)
  if (row.sourceFactsChecksum !== null)
    await releaseSourceFacts(ctx, encounterId, row.sourceFactsChecksum)
}

function parseFactsRow(row: EncounterDocument<'encounterActorProjectionFacts'>) {
  const facts = encounterActorProjectionFactsSchema.parse(JSON.parse(row.factsJson))
  if (
    facts.id !== row.id ||
    facts.encounterId !== row.encounterId ||
    (facts.kind === 'CHARACTER' ? null : facts.sourceFactsChecksum) !== row.sourceFactsChecksum
  )
    throw new Error('Encounter actor projection facts mismatch.')
  return facts
}

function parseSourceRow(row: EncounterDocument<'encounterSourceProjectionFacts'>) {
  return encounterSourceProjectionFactsSchema.parse(JSON.parse(row.factsJson))
}

/**
 * A Run's actor projection facts in actor ID order, and the source facts they name by checksum. A
 * projection reads these instead of the actor documents and their source snapshots.
 */
export async function readRunProjectionFacts(ctx: EncounterReadContext, state: EncounterRunState) {
  const rows = await ctx.db
    .query('encounterActorProjectionFacts')
    .withIndex('by_encounterId_id', (q) => q.eq('encounterId', state.id))
    .take(MAX_ENCOUNTER_ACTORS + 1)
  if (rows.length > MAX_ENCOUNTER_ACTORS)
    throw new Error('Encounter actors exceed the supported bound.')
  const actors = rows
    .map((row) => deriveOnce(row, parseFactsRow))
    .sort((left, right) => left.id.localeCompare(right.id))
  const expectedActorIds = [...state.actorIds].sort((left, right) => left.localeCompare(right))
  if (
    actors.length !== expectedActorIds.length ||
    actors.some(
      (actor, index) =>
        actor.id !== expectedActorIds[index] || actor.systemId !== state.gameSystemId
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
