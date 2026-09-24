import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  consumeEncounterActionEconomy,
  type EncounterActionEconomyConsumption
} from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { MutationCtx } from '../_generated/server'

export async function consumeNativeActionEconomy(
  ctx: MutationCtx,
  input: { actor: EncounterRunActorState; consumption: EncounterActionEconomyConsumption }
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
  await ctx.db.patch(row._id, {
    stateJson: JSON.stringify(actor),
    stateChecksum: checksumCanonicalJson(actor)
  })
  return actor
}
