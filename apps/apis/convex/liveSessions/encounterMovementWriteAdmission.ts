import type { LiveSessionMovementPrepareInput } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import { readLiveMovementAdmission } from './encounterMovementAdmission'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'

/** Checks every captured owner before any staged or gameplay write in this transaction. */
export async function readLiveMovementWriteAdmission(
  ctx: MutationCtx,
  input: LiveSessionMovementPrepareInput
) {
  const admission = await readLiveMovementAdmission(ctx, input)
  const { state } = admission
  if (
    input.preparation.encounterId !== state.id ||
    input.preparation.expectedEncounterVersion !== state.version
  )
    throw new Error('Live movement preparation Run mismatch.')
  const actors = await readRunActors(ctx, state)
  const characterIds = new Set(
    state.automationMode === 'MANUAL'
      ? []
      : actors.flatMap((actor) => {
          if (actor.kind !== 'CHARACTER') return []
          return [actor.sourceId]
        })
  )
  const requests = new Set<string>()
  for (const request of input.maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if (requests.has(key) || !state.actorIds.includes(request.actorId))
      throw new Error('Live movement maintenance owner scope mismatch.')
    requests.add(key)
    await readEncounterMaintenanceCapture(ctx, state, request)
    if (request.owner.kind === 'CHARACTER') characterIds.add(request.owner.characterId)
  }
  await assertLiveSessionRulesRevisions(ctx, input.revisions, {
    systemId: state.gameSystemId,
    campaignId: state.campaignId,
    characterIds: [...characterIds]
  })
  return { ...admission, actors, characterIds }
}
