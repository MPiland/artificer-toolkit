import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readActorConcentration } from '@artificer-toolkit/encounter-persistence/concentrationListing'
import { listCarriedActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import { carriedConcentration } from '@artificer-toolkit/rules-runtime/activeGrantListings'
import type { ConcentrationListingDto } from '@artificer-toolkit/schema/shared/activeGrantListing'
import type { RoomEncounterStore } from './roomEncounterStore.js'

/**
 * The Concentration a Character maintains as its Sheet names it (SPELLS-5.11): its live slot while an
 * ACTIVE Run holds it as an actor, otherwise the grants a finished Run carried over from its last one.
 */
export async function readRoomCharacterConcentration(
  store: RoomEncounterStore,
  campaignId: string,
  characterId: string
): Promise<ConcentrationListingDto | null> {
  const ctx = { db: store.store }
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'ACTIVE' || state.campaignId !== campaignId) continue
    const actor = (await readRunActors(ctx, state)).find(
      (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
    )
    if (actor) return readActorConcentration(ctx, { encounterId: state.id, actor })
  }
  return carriedConcentration(await listCarriedActiveRuleEffects(ctx, characterId))
}
