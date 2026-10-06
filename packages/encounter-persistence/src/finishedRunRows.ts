import type { EncounterWriteContext } from './store.js'

/**
 * Deletes one bounded page of the rows a Run stops needing when it completes (ADR 0035 Amendment
 * 30) and reports whether none was found. A finished Run keeps `encounterRuns`, its actors and the
 * source facts they name: the GM's read-only finished Encounter reads only those. Everything else
 * has no reader once the Run is COMPLETED. The command, rule receipt and evidence history tables
 * are not here: each host deletes them its own way (Convex also frees their receipt ledgers).
 */
export async function removeFinishedRunRowsPage(
  ctx: EncounterWriteContext,
  encounterId: string,
  limit: number
) {
  const { db } = ctx
  const pages = await Promise.all([
    db
      .query('encounterActorSnapshots')
      .withIndex('by_encounterId_checksum', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterInitiativeRounds')
      .withIndex('by_encounterId_round', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterInitiativeParticipants')
      .withIndex('by_encounterId_round_actorId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterInitiativeSides')
      .withIndex('by_encounterId_round_sideId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterRuleOccurrences')
      .withIndex('by_encounterId_state', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterPendingSnapshotParts')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterReplayIndex')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterTurnMovements')
      .withIndex('by_encounterId_round_turnActorId_actorId', (q) =>
        q.eq('encounterId', encounterId)
      )
      .take(limit),
    db
      .query('encounterDecisionSkips')
      .withIndex('by_encounterId_occurrenceId_occurrenceVersion', (q) =>
        q.eq('encounterId', encounterId)
      )
      .take(limit),
    db
      .query('encounterActiveRuleEffects')
      .withIndex('by_encounterId_targetActorId_id', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterMaintainedEffectStates')
      .withIndex('by_encounterId_id', (q) => q.eq('encounterId', encounterId))
      .take(limit),
    db
      .query('encounterSpatialRuleEffects')
      .withIndex('by_encounterId_sceneId_id', (q) => q.eq('encounterId', encounterId))
      .take(limit)
  ])
  const rows = pages.flat()
  for (const row of rows) await db.delete(row._id)
  return rows.length === 0
}
