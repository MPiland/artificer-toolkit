import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { liveSessionCharacterRulesScope } from '@artificer-toolkit/schema/api/liveSessionEncounterCaptureBundle'
import type { LiveSessionEncounterRulesInput } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { QueryCtx } from '../../convex/_generated/server'
import { readCharacterRulesCapture } from '../../convex/liveSessions/characterRulesCapture'
import { readEncounterCaptureBundle } from '../../convex/liveSessions/encounterCaptureBundle'
import { readEncounterRulesCapture } from '../../convex/liveSessions/encounterRulesCapture'

/**
 * One admission's capture bundle with its System restored into every INPUTS response, beside the
 * responses each part's separate capture returns in the same transaction. They must be equal.
 */
export async function readBundleAndSeparateCaptures(
  ctx: QueryCtx,
  admission: LiveSessionEncounterRulesInput,
  actors: ReadonlyArray<{ id: string; sourceId?: string | null }>
) {
  const { request: _admission, ...scope } = admission
  const bundle = await readEncounterCaptureBundle(ctx, {
    ...admission,
    maintenanceDefinitionIds: [DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID]
  })
  const { system, inputs } = bundle
  if (!system || !inputs) throw new Error('Expected bundled Run inputs.')
  const parts = [
    ...bundle.encounter,
    { request: { kind: 'INPUTS' as const }, response: { ...inputs, system } }
  ]
  return {
    bundle: {
      encounter: parts.map(({ response }) => response),
      characters: bundle.characters.map(({ response }) => ({ ...response, system }))
    },
    separate: {
      encounter: await Promise.all(
        parts.map(({ request }) => readEncounterRulesCapture(ctx, { ...scope, request }))
      ),
      characters: await Promise.all(
        bundle.characters.map(({ actorId }) => {
          const actor = actors.find(({ id }) => id === actorId)
          if (!actor?.sourceId) throw new Error('Missing the bundled Character actor.')
          return readCharacterRulesCapture(ctx, {
            ...liveSessionCharacterRulesScope(scope, { id: actor.id, sourceId: actor.sourceId }),
            request: { kind: 'INPUTS' }
          })
        })
      )
    }
  }
}
