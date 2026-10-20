import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'
import type { CompiledEffectGroup } from '@artificer-toolkit/shared/compilers'
import type { CharacterResourceOwnerKey } from '@artificer-toolkit/shared/character'

import { resourceOwner } from './character/characterNativeActionResources.js'

/** A feature charge a passive effect raises when its holder rolls initiative. */
export type InitiativeRestoreSource = {
  chargeId: string
  floor: number
  whenAtOrBelow: number
}

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

/** The restores a passive effect authors for its holder rolling initiative; none for any other effect. */
export function initiativeRestoreSources(
  effect: Pick<CompiledEffectGroup, 'invocation' | 'entries'>
): InitiativeRestoreSource[] {
  if (effect.invocation.kind !== 'PASSIVE' || effect.invocation.triggerCode !== 'ROLL_INITIATIVE')
    return []
  return effect.entries.flatMap((entry) =>
    'outcome' in entry && entry.outcome.effectKind === 'RESTORE_RESOURCE'
      ? [
          {
            chargeId: entry.outcome.chargeId,
            floor: entry.outcome.floor,
            whenAtOrBelow: entry.outcome.whenAtOrBelow
          }
        ]
      : []
  )
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
