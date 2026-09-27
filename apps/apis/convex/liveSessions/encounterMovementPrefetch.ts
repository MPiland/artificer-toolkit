import { v } from 'convex/values'
import {
  liveSessionMovementPrefetchInputSchema,
  type LiveSessionMovementPrefetch
} from '@artificer-toolkit/schema/api/liveSessionMovementAnswer'
import { serverRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { readEncounterMovementPendingContext } from '@artificer-toolkit/rules-runtime/encounterMovementPendingContext'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { captureBundleChecksum, readEncounterCaptureBundle } from './encounterCaptureBundle'
import { readPendingDecisionOwner } from './encounterRoute'

/**
 * Reads a held movement decision's capture bundle for one member who may answer it, while the
 * table decides (D64). The decision must be the Encounter's pending movement occurrence (players
 * only one their pending reads show them), and the bundle's `MOVEMENT_INPUTS` admission under the
 * DECISION scope refuses anyone the answer's own admission refuses. Nothing is staged; the answer
 * rereads this bundle in its commit and refuses it if any read checksum changed.
 */
export async function readMovementPrefetch(
  ctx: QueryCtx,
  args: unknown
): Promise<LiveSessionMovementPrefetch> {
  const { occurrenceId, tokenOrdinals, maintenanceDefinitionIds, cachedSystem, ...member } =
    liveSessionMovementPrefetchInputSchema.parse(args)
  const { run, occurrence, owner } = await readPendingDecisionOwner(ctx, {
    ...member,
    occurrenceId
  })
  if (owner !== 'MOVEMENT' || !occurrence.pendingSnapshotJson)
    throw new Error('Only a movement decision is prefetched.')
  const { root } = readEncounterMovementPendingContext(
    serverRuleExecutionPendingSnapshotDtoSchema.parse(JSON.parse(occurrence.pendingSnapshotJson))
  )
  const movement = {
    encounterId: run.id,
    baseTokenOrdinal:
      tokenOrdinals.find((entry) => entry.tokenId === root.tokenId)?.baseOrdinal ?? null,
    subject: {
      kind: 'DECISION' as const,
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: run.version,
      appRoll: null
    }
  }
  const bundle = await readEncounterCaptureBundle(ctx, {
    ...member,
    expectedVersion: run.version,
    movement,
    request: { kind: 'MOVEMENT_INPUTS' },
    maintenanceDefinitionIds,
    cachedSystem
  })
  return { expectedVersion: run.version, movement, bundle, checksum: captureBundleChecksum(bundle) }
}

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const prefetch = internalQuery({
  args: v.any(),
  handler: readMovementPrefetch
})
