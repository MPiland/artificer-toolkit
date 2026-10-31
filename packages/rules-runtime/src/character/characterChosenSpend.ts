import type { CharacterActionCandidate } from '@artificer-toolkit/schema/api/characterActionRules'
import type { CharacterRulePolicyOutput } from '@artificer-toolkit/schema/api/characterRules'

/**
 * Whether the action's effect is sized by units the caster chooses to spend from its resource pool
 * (a `RESOURCE_SPENT` heal), so the command must name how many.
 */
export function spendsChosenUnits(candidate: Pick<CharacterActionCandidate, 'mechanicFacts'>) {
  return candidate.mechanicFacts.outcomes.some(
    (outcome) => outcome.kind === 'HEAL' && outcome.valueKind === 'RESOURCE_SPENT'
  )
}

/** What the caster may spend: the pool's cost per unit and how many units its remaining charges cover. */
export function chosenSpendChoice(
  candidate: Pick<CharacterActionCandidate, 'mechanicFacts' | 'resourceUse'>,
  resources: CharacterRulePolicyOutput['resources']
): { unitCost: number; max: number } | undefined {
  const { resourceUse } = candidate
  if (!resourceUse?.poolId || !spendsChosenUnits(candidate)) return undefined
  const remaining = resources.find(({ poolId }) => poolId === resourceUse.poolId)?.remaining ?? 0
  return { unitCost: resourceUse.cost, max: Math.floor(remaining / resourceUse.cost) }
}
