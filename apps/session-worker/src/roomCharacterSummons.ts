import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import {
  ownedEncounterSpellSummons,
  type EncounterSpellSummon
} from '@artificer-toolkit/rules-runtime/character/sheetSpellSummon'
import type { RoomEncounterStore } from './roomEncounterStore.js'

/**
 * The summons a Character's Sheet lists from the Encounter (SPELLS-34.2): the live actors its spell
 * casts created that its actor owns in an ACTIVE Run. The Run actor is their only record.
 */
export async function readRoomCharacterSummons(
  store: RoomEncounterStore,
  campaignId: string,
  characterId: string
): Promise<EncounterSpellSummon[]> {
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'ACTIVE' || state.campaignId !== campaignId) continue
    const actors = await readRunActors({ db: store.store }, state)
    const actor = actors.find(
      (candidate) => candidate.kind === 'CHARACTER' && candidate.sourceId === characterId
    )
    if (actor) return ownedEncounterSpellSummons(actors, actor.id)
  }
  return []
}
