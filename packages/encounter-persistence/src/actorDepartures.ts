import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { removeRunActorControllers } from './actorControllers.js'
import { freezeEncounterCharacterActor, readCharacterPlayProjection } from './characterStates.js'
import { readRunActors } from './documents.js'
import type { EncounterProjectionTransaction } from './ports.js'
import type { EncounterWriteContext } from './store.js'

/**
 * One open Run's departures against current Campaign truth: an unfrozen Character actor whose
 * assignment is gone freezes at its current play values, and controllers who are no longer members
 * are unlisted. Convex applies it at room release and the room on authorization reload, so both
 * owners of a Run end in the same state. It runs before `removeMissingCharacterActors`: removal
 * projects every remaining actor, which an unfrozen unassigned one would fail, while a Character
 * that no longer exists has no play record to freeze from and is left to that removal.
 */
export async function reconcileRunActorDepartures(
  ctx: EncounterProjectionTransaction & EncounterWriteContext,
  state: EncounterRunState,
  departures: {
    isDeparted: (userId: string) => boolean
    isUnassigned: (characterId: string) => boolean
    isMissing: (characterId: string) => Promise<boolean>
  }
): Promise<void> {
  for (const actor of await readRunActors(ctx, state)) {
    if (
      actor.kind !== 'CHARACTER' ||
      actor.frozenState ||
      !departures.isUnassigned(actor.sourceId) ||
      (await departures.isMissing(actor.sourceId))
    )
      continue
    const play = await ctx.db
      .query('characterPlayStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', actor.sourceId))
      .unique()
    if (!play) throw new Error('Character play record is missing.')
    await freezeEncounterCharacterActor(ctx, actor, await readCharacterPlayProjection(ctx, play))
  }
  await removeRunActorControllers(ctx, state, departures.isDeparted)
}
