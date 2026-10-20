import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  consumeEncounterActionEconomy,
  type EncounterActionEconomyConsumption
} from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { applyEncounterAttackActionTransition } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import type { EncounterAttackActionTransitionDto } from '@artificer-toolkit/schema/projections/encounterAttackAction'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { writeRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

export async function consumeNativeActionEconomy(
  ctx: EncounterWriteContext,
  input: {
    actor: EncounterRunActorState
    consumption: EncounterActionEconomyConsumption
    overridden: boolean
    /** The Attack action the spent action fills, settled in the same write. */
    attackAction?: EncounterAttackActionTransitionDto | null
  }
) {
  const spent = consumeEncounterActionEconomy(input)
  const actor = input.attackAction
    ? applyEncounterAttackActionTransition(spent, input.attackAction)
    : spent
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', actor.encounterId).eq('id', actor.id)
    )
    .unique()
  if (!row || row.stateChecksum !== checksumRunActorPlayState(input.actor))
    throw new Error('The selected action allowance changed before settlement.')
  await writeRunActor(ctx, row._id, actor)
  return actor
}
