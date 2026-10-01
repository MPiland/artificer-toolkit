import {
  readLiveEncounterActionAdmission as readSharedLiveEncounterActionAdmission,
  readLiveEncounterActionScope as readSharedLiveEncounterActionScope
} from '@artificer-toolkit/encounter-persistence/liveActionAdmission'
import type { QueryCtx } from '../_generated/server'
import { encounterReadTransaction } from '../encounters/encounterPorts'

/** Binds the shared admission and replay fences to the owning Convex readers. */
export function readLiveEncounterActionAdmission(
  ctx: QueryCtx,
  input: Parameters<typeof readSharedLiveEncounterActionAdmission>[1]
) {
  return readSharedLiveEncounterActionAdmission(encounterReadTransaction(ctx), input)
}

/** Re-admits the action scope through the same native authorization readers. */
export function readLiveEncounterActionScope(
  ctx: QueryCtx,
  input: Parameters<typeof readSharedLiveEncounterActionScope>[1]
) {
  return readSharedLiveEncounterActionScope(encounterReadTransaction(ctx), input)
}
