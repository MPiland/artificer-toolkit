import { playerSeesActor } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { readActorOwnerChain } from './actorController.js'
import { rejectDomain } from './domainRejections.js'
import { readEncounterPlayerViewer } from './playerViewer.js'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

/** The creatures the member's list shows, by the same rule as `requireTargetSeenByMember`; the GM sees all. */
export async function readMemberSeenActorIds(
  ctx: EncounterReadTransaction,
  input: {
    encounterId: string
    actors: readonly EncounterRunActorState[]
    membership: Pick<EncounterDocument<'campaignMemberships'>, 'role' | 'userId'>
  }
): Promise<string[]> {
  const { encounterId, actors, membership } = input
  if (membership.role === 'OWNER') return actors.map((actor) => actor.id)
  const viewer = await readEncounterPlayerViewer(ctx, { id: encounterId, actors }, membership)
  return actors.filter((actor) => playerSeesActor(actor, viewer, actors)).map((actor) => actor.id)
}

/**
 * A player names only the creatures their list shows (ATTACK-17.3), by the one rule the player
 * projection lists by; any other target reads as unavailable, as a non-public one does. The GM
 * names any creature.
 */
export async function requireTargetSeenByMember(
  ctx: EncounterReadTransaction,
  input: {
    encounterId: string
    target: EncounterRunActorState
    membership: Pick<EncounterDocument<'campaignMemberships'>, 'role' | 'userId'>
  }
): Promise<void> {
  const { encounterId, target, membership } = input
  if (membership.role === 'OWNER') return
  const chain = await readActorOwnerChain(ctx, target)
  const viewer = await readEncounterPlayerViewer(
    ctx,
    { id: encounterId, actors: chain },
    membership
  )
  if (!playerSeesActor(target, viewer, chain)) rejectDomain('TARGET_UNAVAILABLE')
}
