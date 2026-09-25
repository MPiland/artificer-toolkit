import { prepareEncounterInitiativeSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeSources'
import { assertCharacterFactsBoundToActor } from '@artificer-toolkit/rules-runtime/encounterMovementTargets'
import { toCharacterInitiativeActorFacts } from '@artificer-toolkit/rules-runtime/character/characterInitiativeFacts'
import { characterEncounterInitiativeResultSchema } from '@artificer-toolkit/schema/api/characterEncounterInitiative'
import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterEncounterInitiative } from '../characters/encounterInitiative'
import { readRunActors } from './documents'
import type { MovementTarget } from './movementTargets'

export async function loadEncounterInitiativeSources(
  ctx: QueryCtx,
  state: EncounterRunState,
  campaign: { id: string; ownerUserId: string },
  stagedActors?: readonly EncounterRunActorState[],
  stagedMovementTargets?: ReadonlyMap<string, MovementTarget>
): Promise<InitiativeFactSources> {
  if (campaign.id !== state.campaignId)
    throw new Error('Encounter initiative Campaign authority does not match the Run.')
  return prepareEncounterInitiativeSources({
    state,
    campaignId: campaign.id,
    actors: stagedActors ?? (await readRunActors(ctx, state)),
    loadCharacter: async (actor) => {
      const staged = stagedMovementTargets?.get(actor.id)
      if (staged) {
        const facts = staged.characterFacts
        if (staged.actor.id !== actor.id) throw new Error('Character initiative source is stale.')
        assertCharacterFactsBoundToActor(
          facts,
          actor,
          state.gameSystemId,
          'Character initiative source is stale.'
        )
        const { snapshot, registry, output } = facts.ruleEvaluation
        if (snapshot.characterId !== actor.sourceId || snapshot.systemId !== state.gameSystemId)
          throw new Error('Character initiative source identity does not match the actor.')
        return characterEncounterInitiativeResultSchema.parse({
          streamVersion: facts.active.streamVersion,
          initiativeActorFacts: toCharacterInitiativeActorFacts({
            snapshot,
            registry,
            rulePolicyOutput: output
          }),
          rulePolicyOutput: output
        })
      }
      return loadCharacterEncounterInitiative(ctx, campaign.ownerUserId, {
        characterId: actor.sourceId,
        campaignId: state.campaignId,
        systemId: state.gameSystemId
      })
    }
  })
}
