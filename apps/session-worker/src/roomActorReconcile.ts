import { reconcileRunActorDepartures } from '@artificer-toolkit/encounter-persistence/actorDepartures'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterProjectionTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { RoomEncounterStore } from './roomEncounterStore.js'
import type { RoomInputs } from './roomInputs.js'

/**
 * D74: Convex writes no actors of a Run its room holds, so the room applies the departure edits
 * itself when its authorization reloads. These are Convex's own bodies (`characterDeparture`,
 * `actorControllerRemoval`): freeze a Character actor whose assignment is gone, and unlist
 * controllers who are no longer members. An archived Campaign has no members and reconciles nothing.
 */
async function* openRuns(store: RoomEncounterStore) {
  for (const run of store.documents('encounterRuns')) {
    const state = readRunState(run)
    if (state.status !== 'COMPLETED') yield state
  }
}

function departures(authorization: LiveSessionRoomAuthorization) {
  const { members, assignments } = authorization.campaign
  const memberIds = new Set(members.map((member) => member.userId))
  const assigned = new Set(assignments.map((assignment) => assignment.characterId))
  return {
    archived: members.length === 0,
    isDeparted: (userId: string) => !memberIds.has(userId),
    isUnassigned: (characterId: string) => !assigned.has(characterId)
  }
}

/** Whether any open Run names a departed controller or an unfrozen, unassigned Character. */
export async function hasRoomActorDepartures(
  store: RoomEncounterStore,
  authorization: LiveSessionRoomAuthorization
): Promise<boolean> {
  const { archived, isDeparted, isUnassigned } = departures(authorization)
  if (archived) return false
  for await (const state of openRuns(store))
    for (const actor of await readRunActors({ db: store.store }, state))
      if (
        actor.controllerUserIds.some(isDeparted) ||
        (actor.kind === 'CHARACTER' && !actor.frozenState && isUnassigned(actor.sourceId))
      )
        return true
  return false
}

/** Runs inside the caller's room transaction; the caller journals it. */
export async function reconcileRoomActorDepartures(input: {
  store: RoomEncounterStore
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
}): Promise<void> {
  const { store, inputs, authorization } = input
  const { archived, isDeparted, isUnassigned } = departures(authorization)
  if (archived) return
  const ctx: EncounterProjectionTransaction & { db: RoomEncounterStore['store'] } = {
    db: store.store,
    ports: { readCharacterPlay, requireSystem: async () => inputs.systemSnapshot() }
  }
  for await (const state of openRuns(store))
    await reconcileRunActorDepartures(ctx, state, { isDeparted, isUnassigned })
}
