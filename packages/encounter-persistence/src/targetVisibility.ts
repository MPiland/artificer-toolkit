import { playerSeesActor } from '@artificer-toolkit/rules-runtime/encounterPlayerProjection'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { rejectDomain } from './domainRejections.js'
import { readEncounterPlayerViewer } from './playerViewer.js'
import type { EncounterReadTransaction } from './ports.js'
import type { EncounterDocument } from './store.js'

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
  const viewer = await readEncounterPlayerViewer(
    ctx,
    { id: encounterId, actors: [target] },
    membership
  )
  if (!playerSeesActor(target, viewer)) rejectDomain('TARGET_UNAVAILABLE')
}
