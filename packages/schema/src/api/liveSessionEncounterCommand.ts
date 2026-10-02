import type { EncounterCommandInputDto } from './encounters.js'
import type { EncounterActorTokenBindingCommandInputDto } from './vttScenes.js'

/**
 * Every Encounter command the room commits natively in its own SQLite (D78). A decision commits
 * when retained evidence names its planner; otherwise the room refuses it as stale or unavailable.
 * The GM binds actors to the presented Scene's tokens in the same transaction.
 */
export type RoomNativeEncounterCommand =
  | EncounterCommandInputDto
  | EncounterActorTokenBindingCommandInputDto
