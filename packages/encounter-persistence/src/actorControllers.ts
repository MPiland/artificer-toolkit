import {
  encounterRunActorStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { readRunActors, replaceRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

/**
 * Removes the controllers `departed` names from every actor of an open Run. The Run version is
 * unchanged: the edit replaces no receipt, and the PLAY revision these writes advance fences any
 * Session-room plan prepared before it.
 */
export async function removeRunActorControllers(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  departed: (userId: string) => boolean
): Promise<void> {
  for (const actor of await readRunActors(ctx, state))
    if (actor.controllerUserIds.some(departed))
      await replaceRunActor(
        ctx,
        actor,
        encounterRunActorStateSchema.parse({
          ...actor,
          controllerUserIds: actor.controllerUserIds.filter((id) => !departed(id))
        })
      )
}
