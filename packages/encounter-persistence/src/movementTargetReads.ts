import {
  buildMovementTarget,
  type MovementTarget
} from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import type { CharacterTurnFacts } from '@artificer-toolkit/rules-runtime/character/turnFacts'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { serverUuidIdentityDtoSchema } from '@artificer-toolkit/schema/shared/serverUuidIdentity'
import { readRunActor, readRunActors } from './documents.js'
import { listActiveRuleEffects } from './effectStore.js'
import type { EncounterTurnReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/**
 * Loads current movement targets for a Run and Campaign the caller already read and authorized in
 * this transaction, without advancing any Encounter state.
 */
export async function loadMovementTargets<TFacts extends CharacterTurnFacts>(
  tx: EncounterTurnReadTransaction<TFacts>,
  input: {
    state: EncounterRunState
    campaign: EncounterDocument<'campaigns'>
    targetActorIds: readonly string[]
    includeReactionSources?: boolean
  }
): Promise<ReadonlyMap<string, MovementTarget<TFacts>>> {
  const { state, campaign } = input
  const targetActorIds = input.targetActorIds.map((id) => serverUuidIdentityDtoSchema.parse(id))
  if (new Set(targetActorIds).size !== targetActorIds.length)
    throw new Error('Movement target input is invalid.')
  if (campaign.id !== state.campaignId)
    throw new Error('Movement target read context scope differs.')
  if (campaign.status !== 'ACTIVE' || campaign.gameSystemId !== state.gameSystemId)
    throw new Error('Encounter Campaign is stale.')
  if (targetActorIds.some((id) => !state.actorIds.includes(id)))
    throw new Error('Encounter actor was not found.')
  const currentActors =
    targetActorIds.length === state.actorIds.length
      ? await readRunActors(tx, state)
      : await Promise.all(targetActorIds.map((id) => readRunActor(tx, state, id)))
  const actorsById = new Map(currentActors.map((actor) => [actor.id, actor]))
  const actors = targetActorIds.map((id) => actorsById.get(id)!)
  const result = new Map<string, MovementTarget<TFacts>>()
  const characterIds = new Set<string>()
  for (const actor of actors) {
    if (actor.kind === 'CHARACTER') {
      if (characterIds.has(actor.sourceId)) throw new Error('Encounter Character target is stale.')
      characterIds.add(actor.sourceId)
      const loaded = await tx.ports.readCharacterTurnFacts(campaign, actor.sourceId)
      if (!loaded) throw new Error('Encounter Character source is unavailable.')
      result.set(
        actor.id,
        buildMovementTarget({
          actor,
          activeEffects: loaded.activeEffects,
          gameSystemId: state.gameSystemId,
          campaignId: campaign.id,
          characterFacts: loaded,
          includeReactionSources: input.includeReactionSources
        })
      )
      continue
    }
    result.set(
      actor.id,
      buildMovementTarget<TFacts>({
        actor,
        activeEffects: await listActiveRuleEffects(tx, {
          kind: 'ENCOUNTER_ACTOR',
          encounterId: state.id,
          targetActorId: actor.id
        }),
        gameSystemId: state.gameSystemId,
        campaignId: campaign.id,
        characterFacts: null
      })
    )
  }
  return result
}
