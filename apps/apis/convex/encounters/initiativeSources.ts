import { prepareEncounterInitiativeSources } from '@artificer-toolkit/rules-runtime/encounterInitiativeSources'
import { readInitiativeSourceRoll } from '@artificer-toolkit/rules-runtime/encounterInitiativeRoll'
import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { QueryCtx } from '../_generated/server'
import { loadCharacterEncounterInitiative } from '../characters/encounterInitiative'
import { readRunActors } from '@artificer-toolkit/encounter-persistence/documents'
import { createConvexEncounterStoreReader } from '../lib/convexEncounterStore'

export async function loadEncounterInitiativeSources(
  ctx: QueryCtx,
  state: EncounterRunState,
  campaign: { id: string; ownerUserId: string },
  stagedActors?: readonly EncounterRunActorState[]
): Promise<InitiativeFactSources> {
  if (campaign.id !== state.campaignId)
    throw new Error('Encounter initiative Campaign authority does not match the Run.')
  return prepareEncounterInitiativeSources({
    state,
    campaignId: campaign.id,
    actors:
      stagedActors ?? (await readRunActors({ db: createConvexEncounterStoreReader(ctx) }, state)),
    loadCharacter: (actor) =>
      loadCharacterEncounterInitiative(ctx, campaign.ownerUserId, {
        characterId: actor.sourceId,
        campaignId: state.campaignId,
        systemId: state.gameSystemId
      })
  })
}

/**
 * One actor's initiative roll as made (SRD 5.1): 1d20 plus its initiative modifier, rolled with the
 * Character's initiative roll mode (advantage from Feral Instinct, for example).
 */
export async function readActorInitiativeRoll(
  ctx: QueryCtx,
  state: EncounterRunState,
  campaign: { id: string; ownerUserId: string },
  actorId: string
) {
  const source = (await loadEncounterInitiativeSources(ctx, state, campaign)).actors.find(
    (candidate) => candidate.actor.id === actorId
  )
  if (!source) throw new Error('Encounter initiative source was not found.')
  const { characterId, expression, rollMode } = readInitiativeSourceRoll(source)
  return { characterId, expression, rollMode }
}
