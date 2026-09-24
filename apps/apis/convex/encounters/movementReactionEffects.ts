import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { createActiveRuleEffectStore } from '../rules/effectStore'

export { planEncounterMovementReactionEffects as planNativeMovementReactionEffects } from '@artificer-toolkit/rules-runtime/encounterMovementReactionEffects'

/** Keeps all store authority and capacity checks; a forecast mismatch rolls back the mutation. */
export async function persistNativeMovementReactionEffects(
  ctx: MutationCtx,
  records: readonly ActiveRuleEffectRecord[]
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const record of records) {
    const created = await store.create({
      id: record.id,
      owner: record.owner,
      definition: record.definition,
      lifecycle: record.lifecycle,
      maintainedEffectStateId: record.maintainedEffectStateId,
      occurredAt: record.createdAt
    })
    if (checksumCanonicalJson(created) !== checksumCanonicalJson(record))
      throw new Error('Movement reaction effect forecast changed before settlement.')
  }
}
