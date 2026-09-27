import { v } from 'convex/values'
import {
  liveSessionEncounterCaptureBundleInputSchema,
  type LiveSessionEncounterCaptureBundle
} from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import { internalQuery, type QueryCtx } from '../_generated/server'
import { memoizeTransactionReads } from '../lib/transactionReads'
import { admitCharacterInputsCaptures } from './characterRulesCapture'
import { admitEncounterCaptureParts, readEncounterRulesCapture } from './encounterRulesCapture'

/**
 * Every volatile read a room Encounter command's planner makes after its admission, in one
 * transaction: Run inputs, each actor with its first effect page, the requested maintenance slots,
 * the initiative round for a turn, the first Scene spatial effect page for a move, and each
 * Character's inputs. The scope is admitted once for the
 * Encounter parts and once for the Character parts; each part is still exactly the response its
 * own read returns, with the same read checksum and revisions. The Run's System travels once. The
 * bundle stops at the first part that fails; the planner reads that part separately and fails there.
 */
export async function readEncounterCaptureBundle(
  transaction: QueryCtx,
  args: unknown
): Promise<LiveSessionEncounterCaptureBundle> {
  // Admissions and parts repeat reads (actors, Characters); identical reads are served once (frozen).
  const ctx: QueryCtx = { ...transaction, db: memoizeTransactionReads(transaction.db) }
  const { maintenanceDefinitionIds, ...scope } =
    liveSessionEncounterCaptureBundleInputSchema.parse(args)
  const bundle: LiveSessionEncounterCaptureBundle = {
    encounter: [{ request: scope.request, response: await readEncounterRulesCapture(ctx, scope) }],
    system: null,
    inputs: null,
    characters: []
  }
  try {
    const readPart = await admitEncounterCaptureParts(ctx, scope)
    async function part(request: Parameters<typeof readPart>[0]) {
      const response = await readPart(request)
      bundle.encounter.push({ request, response })
      return response
    }
    const inputs = await readPart({ kind: 'INPUTS' })
    if (inputs.kind !== 'INPUTS') return bundle
    const { system, ...runInputs } = inputs
    bundle.system = system
    bundle.inputs = runInputs
    if (scope.request.kind === 'TURN_COMMAND') await part({ kind: 'INITIATIVE_ROUND' })
    // A Cleaving answer rebuilds its choice from the Scene's bound tokens.
    if (scope.request.kind === 'CLEAVING_RESPONSE') await part({ kind: 'CLEAVING_BINDINGS' })
    // A move reads the first page of its Scene's spatial effects, at the admitted Scene version.
    const [admitted] = bundle.encounter
    if (admitted?.response.kind === 'MOVEMENT_INPUTS')
      await part({
        kind: 'SCENE_SPATIAL_EFFECTS',
        sceneId: admitted.response.header.id,
        expectedSceneVersion: admitted.response.header.version,
        afterEffectId: null
      })
    const actors = []
    for (const actorId of inputs.state.actorIds) {
      const actor = await part({ kind: 'ACTOR', actorId })
      if (actor.kind === 'ACTOR') actors.push(actor.actor)
    }
    for (const definitionId of maintenanceDefinitionIds)
      for (const actorId of inputs.state.actorIds)
        await part({ kind: 'MAINTENANCE_SLOT', actorId, definitionId })
    const readCharacterInputs = admitCharacterInputsCaptures(ctx, scope)
    for (const actor of actors) {
      if (actor.kind !== 'CHARACTER') continue
      const response = await readCharacterInputs(actor)
      // A Character's System is its Campaign's, which the Run's matches.
      if (response.kind !== 'INPUTS' || response.system.id !== system.id) return bundle
      const { system: _characterSystem, ...characterInputs } = response
      bundle.characters.push({ actorId: actor.id, response: characterInputs })
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
