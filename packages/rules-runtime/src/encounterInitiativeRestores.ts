import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'

import type { InitiativeRestoreSource } from './character/characterInitiativeRestores.js'
import { resourceOwner } from './character/characterNativeActionResources.js'

/** One Character pool raised by an initiative restore, as the mechanics batch applies it. */
export type CharacterResourceRestore = {
  poolId: string
  chargeId: string
  owner: CharacterResourceOwnerKey
  beforeUsed: number
  afterUsed: number
  beforeRemaining: number
  afterRemaining: number
}

/**
 * The pools a Character's initiative restores raise: a charge at or below `whenAtOrBelow` uses left
 * is raised to `floor`, never past its maximum. A charge the Character has no resolved pool for (a
 * level that grants none) restores nothing; one that names two pools is an authoring error.
 */
export function planCharacterInitiativeRestores(input: {
  sources: readonly InitiativeRestoreSource[]
  resources: CharacterRulePolicyOutput['resources']
}): CharacterResourceRestore[] {
  const restores = new Map<string, CharacterResourceRestore>()
  for (const { chargeId, floor, whenAtOrBelow } of input.sources) {
    const pools = input.resources.filter(
      (resource) => resource.chargeId === chargeId && resource.state === 'RESOLVED'
    )
    if (pools.length > 1) throw new Error('An initiative restore names more than one pool.')
    const [pool] = pools
    if (!pool || pool.maximum === null || pool.remaining === null) continue
    // Every source reads the pool as the roll found it, so the sources' order never changes the result.
    const afterRemaining = Math.min(
      Math.max(floor, restores.get(pool.poolId)?.afterRemaining ?? 0, pool.remaining),
      pool.maximum
    )
    if (pool.remaining > whenAtOrBelow || afterRemaining === pool.remaining) continue
    restores.set(pool.poolId, {
      poolId: pool.poolId,
      chargeId,
      owner: resourceOwner(pool),
      beforeUsed: pool.rawUsed,
      afterUsed: pool.maximum - afterRemaining,
      beforeRemaining: pool.remaining,
      afterRemaining
    })
  }
  return [...restores.values()]
}
