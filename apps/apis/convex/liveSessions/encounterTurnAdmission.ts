import type {
  EncounterRunState,
  EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  LiveSessionEncounterTurnPendingInput,
  LiveSessionEncounterTurnCommitInput
} from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readLiveScene } from '../scenes/liveDocuments'
import { assertLiveSessionRulesRevisions } from './rulesRevisions'
import { readEncounterMaintenanceCapture } from './encounterMaintenanceCapture'
import type { MutationCtx } from '../_generated/server'

/** Checks the complete read fence before a pending or terminal turn writes anything. */
export async function assertLiveTurnRevisions(
  ctx: MutationCtx,
  state: EncounterRunState,
  actors: readonly EncounterRunActorState[],
  input: Pick<LiveSessionEncounterTurnPendingInput, 'revisions' | 'scenes'>,
  maintenanceOwners: LiveSessionEncounterTurnCommitInput['maintenanceOwners'] = []
) {
  const characterIds = actors.flatMap((actor) => {
    if (actor.kind !== 'CHARACTER') return []
    return [actor.sourceId]
  })
  if (new Set(characterIds).size !== characterIds.length)
    throw new Error('Encounter Character source binding mismatch.')
  const owners = new Set<string>()
  for (const request of maintenanceOwners) {
    const key = checksumCanonicalJson(request)
    if (!actors.some((actor) => actor.id === request.actorId) || owners.has(key))
      throw new Error('Live Session turn maintenance scope mismatch.')
    owners.add(key)
    await readEncounterMaintenanceCapture(ctx, state, request)
    if (request.owner.kind === 'CHARACTER' && !characterIds.includes(request.owner.characterId))
      characterIds.push(request.owner.characterId)
  }
  await assertLiveSessionRulesRevisions(ctx, input.revisions, {
    systemId: state.gameSystemId,
    campaignId: state.campaignId,
    characterIds
  })
  for (const scene of input.scenes) {
    const binding = await ctx.db
      .query('encounterSceneBindings')
      .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
      .unique()
    if (!binding || binding.campaignId !== state.campaignId || binding.sceneId !== scene.sceneId)
      throw new Error('Live Session turn Scene binding is stale.')
    const { header } = await readLiveScene(ctx, scene.sceneId, 'MEMBER')
    if (
      header.campaignId !== state.campaignId ||
      header.version !== scene.sceneVersion ||
      header.definitionSaveId !== scene.definitionSaveId
    )
      throw new Error('Live Session turn Scene changed before commit.')
  }
}
