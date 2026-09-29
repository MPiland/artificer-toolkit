import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  consumeEncounterActionEconomy,
  type EncounterActionEconomyConsumption
} from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { writeRunActor } from './documents.js'
import type { EncounterWriteContext } from './store.js'

export async function consumeNativeActionEconomy(
  ctx: EncounterWriteContext,
  input: {
    actor: EncounterRunActorState
    consumption: EncounterActionEconomyConsumption
    overridden: boolean
  }
) {
  const actor = consumeEncounterActionEconomy(input)
  const row = await ctx.db
    .query('encounterRunActors')
    .withIndex('by_encounterId_id', (q) =>
      q.eq('encounterId', actor.encounterId).eq('id', actor.id)
    )
    .unique()
  if (!row || row.stateChecksum !== checksumCanonicalJson(input.actor))
    throw new Error('The selected action allowance changed before settlement.')
  await writeRunActor(ctx, row._id, actor)
  return actor
}
