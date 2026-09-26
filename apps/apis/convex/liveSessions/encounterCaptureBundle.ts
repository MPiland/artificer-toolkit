import { v } from 'convex/values'
import {
  liveSessionCharacterRulesScope,
  liveSessionEncounterCaptureBundleInputSchema,
  type LiveSessionEncounterCaptureBundle
} from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import type { LiveSessionEncounterRulesRequest } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { memoizeTransactionReads } from '../lib/transactionReads'
import { readCharacterRulesCapture } from './characterRulesCapture'
import { readEncounterRulesCapture } from './encounterRulesCapture'

/**
 * Every volatile read a room Encounter command's planner makes after its admission, in one
 * transaction: Run inputs, each actor with its first effect page, the requested maintenance slots,
 * the initiative round for a turn, and each Character's inputs. Each part runs the part's own capture
 * builder, so it carries the same authorization, read checksum and revisions as a separate read. The
 * bundle stops at the first part that fails; the planner reads that part separately and fails there.
 */
export async function readEncounterCaptureBundle(
  transaction: QueryCtx,
  args: unknown
): Promise<LiveSessionEncounterCaptureBundle> {
  // Every part reruns its builder's authorization; identical reads are served once (frozen).
  const ctx: QueryCtx = { ...transaction, db: memoizeTransactionReads(transaction.db) }
  const { maintenanceDefinitionIds, ...scope } =
    liveSessionEncounterCaptureBundleInputSchema.parse(args)
  const bundle: LiveSessionEncounterCaptureBundle = {
    encounter: [{ request: scope.request, response: await readEncounterRulesCapture(ctx, scope) }],
    characters: []
  }
  async function part(request: LiveSessionEncounterRulesRequest) {
    const response = await readEncounterRulesCapture(ctx, { ...scope, request })
    bundle.encounter.push({ request, response })
    return response
  }
  try {
    const inputs = await part({ kind: 'INPUTS' })
    if (inputs.kind !== 'INPUTS') return bundle
    if (scope.request.kind === 'TURN_COMMAND') await part({ kind: 'INITIATIVE_ROUND' })
    const actors = []
    for (const actorId of inputs.state.actorIds) {
      const actor = await part({ kind: 'ACTOR', actorId })
      if (actor.kind === 'ACTOR') actors.push(actor.actor)
    }
    for (const definitionId of maintenanceDefinitionIds)
      for (const actorId of inputs.state.actorIds)
        await part({ kind: 'MAINTENANCE_SLOT', actorId, definitionId })
    for (const actor of actors) {
      if (actor.kind !== 'CHARACTER') continue
      bundle.characters.push({
        actorId: actor.id,
        response: await readCharacterRulesCapture(ctx, {
          ...liveSessionCharacterRulesScope(scope, actor),
          request: { kind: 'INPUTS' }
        })
      })
    }
  } catch {
    // The planner reads the failing part separately and meets the same refusal there.
  }
  return bundle
}

// Worker-boundary input: the handler's Zod contract is the validator (live-sessions.md).
export const capture = internalQuery({
  args: v.any(),
  handler: readEncounterCaptureBundle
})
