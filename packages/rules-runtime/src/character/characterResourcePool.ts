import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'

/**
 * The pool that pays `charge` of a resource pool cost, when exactly one resolved pool carries that
 * charge and still holds `cost` of it; any other state offers no way of paying.
 */
export function affordablePoolFor(
  resources: CharacterRulePolicyOutput['resources'],
  { chargeId, cost }: { chargeId: string; cost: number }
): CharacterRulePolicyOutput['resources'][number] | null {
  const pools = resources.filter(
    (resource) => resource.chargeId === chargeId && resource.state === 'RESOLVED'
  )
  const [pool] = pools
  return pools.length === 1 && pool && pool.remaining !== null && pool.remaining >= cost
    ? pool
    : null
}
