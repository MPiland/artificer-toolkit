import {
  resolvedDividedHealSchema,
  type CharacterActionCandidate
} from '@artificer-toolkit/schema/api/characterActionRules'
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

/** Whether the caster divides the action's pool among the creatures it reaches, so the command must name each share. */
export function dividesHealing(candidate: Pick<CharacterActionCandidate, 'mechanicFacts'>) {
  return candidate.mechanicFacts.outcomes.some(
    (outcome) => outcome.kind === 'HEAL' && outcome.split
  )
}

/** The pool the caster divides among the creatures the action reaches: its resolved total and each creature's ceiling. */
export type DividedHeal = {
  total: number
  ceiling?: { numerator: number; denominator: number }
}

/** The divided pool a resolved action carries, when its total resolved to a whole number. */
export function dividedHealOf(
  mechanic: Readonly<Record<string, unknown>>
): DividedHeal | undefined {
  const outcomes = Array.isArray(mechanic.outcomes) ? mechanic.outcomes : []
  for (const outcome of outcomes) {
    const divided = resolvedDividedHealSchema.safeParse(outcome)
    if (!divided.success) continue
    const { expression, split } = divided.data
    return { total: Number(expression), ...(split.ceiling ? { ceiling: split.ceiling } : {}) }
  }
  return undefined
}

/**
 * Why the caster's shares of a divided pool cannot be given, or null when they can: every chosen
 * creature gets a share, the shares fit the pool, and none takes a creature past its ceiling.
 */
export function refuseHealShares(input: {
  divided: DividedHeal
  shares: readonly { actorId: string; amount: number }[]
  targets: readonly { id: string; label: string; currentHitPoints: number; maxHitPoints: number }[]
}): string | null {
  const { divided, shares, targets } = input
  if (
    shares.length !== targets.length ||
    targets.some(({ id }) => shares.filter(({ actorId }) => actorId === id).length !== 1)
  )
    return 'Give each chosen creature a share.'
  const given = shares.reduce((sum, { amount }) => sum + amount, 0)
  if (given > divided.total) return `Only ${divided.total} hit points to divide; ${given} given.`
  const { ceiling } = divided
  if (!ceiling) return null
  for (const { actorId, amount } of shares) {
    const target = targets.find(({ id }) => id === actorId)!
    const room = Math.max(
      0,
      Math.floor((target.maxHitPoints * ceiling.numerator) / ceiling.denominator) -
        target.currentHitPoints
    )
    if (amount > room) return `${target.label} can take at most ${room}.`
  }
  return null
}
