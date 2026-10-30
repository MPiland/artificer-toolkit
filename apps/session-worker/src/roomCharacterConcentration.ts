import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readActorConcentrationEffects } from '@artificer-toolkit/encounter-persistence/concentrationListing'
import { listCarriedActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectStore'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { RoomEncounterStore } from './roomEncounterStore.js'

/**
 * The effects a Character's Concentration keeps alive as its Sheet reads them (SPELLS-5.11): its live
 * slot's while an ACTIVE Run holds it as an actor, otherwise the grants a finished Run carried over
 * from its last one. Null when it maintains none.
 */
export async function readRoomCharacterConcentrationEffects(
  store: RoomEncounterStore,
  campaignId: string,
  characterId: string
): Promise<ActiveRuleEffectRecord[] | null> {
  const ctx = { db: store.store }
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'ACTIVE' || state.campaignId !== campaignId) continue
    const actor = (await readRunActors(ctx, state)).find(
      (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
    )
    if (actor) return readActorConcentrationEffects(ctx, { state, actor })
  }
  const carried = await listCarriedActiveRuleEffects(ctx, characterId)
  return carried.length === 0 ? null : carried
}
