import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { readActorConcentrations } from '@artificer-toolkit/encounter-persistence/concentrationListing'
import { listCarriedActiveRuleEffects } from '@artificer-toolkit/encounter-persistence/effectReads'
import type { RoomCharacterConcentrations } from './roomCharacterSheetProjection.js'
import type { RoomEncounterStore } from './roomEncounterStore.js'

/**
 * The Concentrations a Character maintains as its Sheet reads them (SPELLS-5.11): its live states'
 * while an ACTIVE Run holds it as an actor, otherwise the grants a finished Run carried over from its
 * last one. Null when it maintains none.
 */
export async function readRoomCharacterConcentrations(
  store: RoomEncounterStore,
  campaignId: string,
  characterId: string
): Promise<RoomCharacterConcentrations | null> {
  const ctx = { db: store.store }
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'ACTIVE' || state.campaignId !== campaignId) continue
    const actor = (await readRunActors(ctx, state)).find(
      (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
    )
    if (actor) return readActorConcentrations(ctx, { state, actor })
  }
  const carried = await listCarriedActiveRuleEffects(ctx, characterId)
  return carried.length === 0 ? null : { effects: carried, stateIds: [] }
}
