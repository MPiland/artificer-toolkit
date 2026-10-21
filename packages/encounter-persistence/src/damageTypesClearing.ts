import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { clearDamageTypesTaken } from '@artificer-toolkit/rules-runtime/encounterDamageTypesSinceTurnStart'
import { readRunActorWithRow, writeRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

/**
 * A start-of-turn trigger root empties its holder's damage-type record in the commit that reads it
 * (a Troll's damage on its own turn suppresses only the next trigger). Returns the receipt field
 * the root's undo restores from; null when the holder had nothing recorded.
 */
export async function clearHolderDamageTypes(
  ctx: EncounterWriteContext,
  input: { state: EncounterRunState; actorId: string }
) {
  const { actor, row } = await readRunActorWithRow(ctx, input.state, input.actorId)
  if (actor.kind === 'CHARACTER') return null
  const { holder, cleared } = clearDamageTypesTaken(actor)
  if (!cleared.length) return null
  await writeRunActor(ctx, row._id, holder)
  return { actorId: actor.id, entries: cleared }
}
