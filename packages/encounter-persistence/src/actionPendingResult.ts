import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { projectNativeActionPending, readNativeActionPending } from './actionPending.js'
import {
  areaActionPendingContext,
  projectNativeAreaActionPending,
  readNativeAreaActionPending
} from './actionAreaPending.js'
import {
  attackSquarePendingContext,
  projectNativeAttackSquarePending,
  readNativeAttackSquarePending
} from './attackSquarePending.js'
import { readRunActors, readRunState } from './documents.js'
import { readEncounterGmProjection } from './nativeProjection.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { noEncounterRollModeReasons } from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * The root every pending Encounter action carries, single-target or area: the command that started
 * it and who started it. Both kinds seal the same fingerprint so a replay or follow-up can be checked.
 */
export async function readNativePendingRoot(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  if (snapshot && attackSquarePendingContext(snapshot))
    return readNativeAttackSquarePending(ctx, occurrence)
  return snapshot && areaActionPendingContext(snapshot)
    ? readNativeAreaActionPending(ctx, occurrence)
    : readNativeActionPending(ctx, occurrence)
}

/** The command result of a pending action, as the GM sees it. */
export async function nativeActionPendingResult(
  ctx: EncounterReadTransaction,
  run: EncounterDocument<'encounterRuns'>,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  if (
    run.id !== occurrence.encounterId ||
    run.campaignId !== occurrence.campaignId ||
    run.version !== occurrence.expectedEncounterVersion
  )
    throw new Error('Pending Encounter action scope is stale.')
  return encounterCommandResultDtoSchema.parse({
    projection: await readEncounterGmProjection(ctx, readRunState(run)),
    roll: null,
    occurrence: {
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      status: 'PENDING',
      pending: await projectGmPending(ctx, occurrence, readRunState(run))
    }
  })
}

async function projectGmPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  state: EncounterRunState
) {
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  if (snapshot && attackSquarePendingContext(snapshot)) {
    const pending = projectNativeAttackSquarePending(
      occurrence,
      await readNativeAttackSquarePending(ctx, occurrence),
      true
    )
    if (!pending) throw new Error('Stored Encounter square attack has no pending decision.')
    return pending
  }
  if (!snapshot || !areaActionPendingContext(snapshot))
    return projectNativeActionPending(
      occurrence,
      await readNativeActionPending(ctx, occurrence),
      true
    )
  const pending = projectNativeAreaActionPending(
    occurrence,
    await readNativeAreaActionPending(ctx, occurrence),
    { isOwner: true, controlledActorIds: new Set(), actors: await readRunActors(ctx, state) },
    noEncounterRollModeReasons
  )
  if (!pending) throw new Error('Stored Encounter area action has no pending save.')
  return pending
}
