import { reconcileRunActorDepartures } from '@artificer-toolkit/encounter-persistence/actorDepartures'
import { removeMissingCharacterActors } from '@artificer-toolkit/encounter-persistence/actorRemovalCommand'
import { readRunActors, readRunState } from '@artificer-toolkit/encounter-persistence/documents'
import type { EncounterProjectionTransaction } from '@artificer-toolkit/encounter-persistence/ports'
import type { LiveSessionRoomAuthorization } from '@artificer-toolkit/schema/api/liveSessionRoomAuthorization'
import { readCharacterPlay } from '@artificer-toolkit/schema/projections/characterStoredState'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'
import { roomEncounterWriteTransaction } from './roomEncounterWritePorts.js'
import type { RoomInputs } from './roomInputs.js'

/**
 * D74: Convex writes no actors of a Run its room holds, so the room applies the departure edits
 * itself when its authorization reloads. These are Convex's own bodies (`actorRemovalCommand`,
 * `characterDeparture`, `actorControllerRemoval`): remove a deleted Character's actor, freeze one
 * whose assignment is gone, and unlist controllers who are no longer members. An archived Campaign
 * has no members and reconciles nothing.
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

/**
 * The departures the open Runs name: the unfrozen Character actors whose assignment is gone, or
 * `null` when no open Run names a departed controller or such a Character and the room holds no
 * cached inputs of an unassigned Character.
 */
export async function readRoomActorDepartures(
  store: RoomEncounterStore,
  inputs: RoomInputs,
  authorization: LiveSessionRoomAuthorization
): Promise<{ unassignedCharacterIds: string[] } | null> {
  const { archived, isDeparted, isUnassigned } = departures(authorization)
  if (archived) return null
  const unassigned = new Set<string>()
  let departed = false
  for await (const state of openRuns(store))
    for (const actor of await readRunActors({ db: store.store }, state)) {
      if (actor.kind === 'CHARACTER' && !actor.frozenState && isUnassigned(actor.sourceId))
        unassigned.add(actor.sourceId)
      departed ||= actor.controllerUserIds.some(isDeparted)
    }
  return departed || unassigned.size || inputs.cachedCharacterIds().some(isUnassigned)
    ? { unassignedCharacterIds: [...unassigned] }
    : null
}

/** The Characters whose actors an open Run holds frozen at departure (D74). */
export async function readFrozenCharacterIds(store: RoomEncounterStore): Promise<string[]> {
  const frozen = new Set<string>()
  for await (const state of openRuns(store))
    for (const actor of await readRunActors({ db: store.store }, state))
      if (actor.kind === 'CHARACTER' && actor.frozenState) frozen.add(actor.sourceId)
  return [...frozen]
}

/**
 * The frozen Character actors of open Runs whose assignment is gone. A Character deletion's
 * `CHARACTER` notice re-reads them, since a departure froze them before the deletion landed (D200).
 */
export async function readFrozenUnassignedCharacterIds(
  store: RoomEncounterStore,
  authorization: LiveSessionRoomAuthorization
): Promise<string[]> {
  const { archived, isUnassigned } = departures(authorization)
  return archived ? [] : (await readFrozenCharacterIds(store)).filter(isUnassigned)
}

/**
 * Runs inside the caller's room transaction; the caller journals it. Actors of Characters that no
 * longer exist are removed last, as account deletion removes them in Convex: the removal projects
 * every remaining actor, so the ones whose assignment is gone freeze first.
 */
export async function reconcileRoomActorDepartures(input: {
  store: RoomEncounterStore
  transaction: RoomTransaction
  inputs: RoomInputs
  authorization: LiveSessionRoomAuthorization
  campaignId: string
  epoch: string
  deletedCharacterIds: ReadonlySet<string>
}): Promise<void> {
  const { store, transaction, inputs, authorization, campaignId, epoch, deletedCharacterIds } =
    input
  const { archived, isDeparted, isUnassigned } = departures(authorization)
  if (archived) return
  const isMissing = async (characterId: string) => deletedCharacterIds.has(characterId)
  const ctx: EncounterProjectionTransaction & { db: RoomEncounterStore['store'] } = {
    db: store.store,
    ports: {
      readCharacterPlay,
      requireSystem: async () => inputs.systemSnapshot(),
      isRoomHeldRun: async () => true
    }
  }
  for await (const state of openRuns(store))
    await reconcileRunActorDepartures(ctx, state, { isDeparted, isUnassigned, isMissing })
  for (const characterId of inputs.cachedCharacterIds())
    if (isUnassigned(characterId)) inputs.evictCharacter(characterId, transaction)
  if (deletedCharacterIds.size) {
    const { ownerUserId } = authorization.campaign
    const context = await roomEncounterWriteTransaction({
      store,
      transaction,
      inputs,
      authorization,
      campaignId,
      epoch,
      userId: ownerUserId,
      observed: inputs.revisions(campaignId, authorization.revisions)
    })
    const { campaign } = await context.ports.requireCampaignAuthority(campaignId, ownerUserId)
    await removeMissingCharacterActors(context, campaign, ownerUserId, isMissing)
  }
}
