import type { RollMode } from './rollExpression.js'

export type D20ContributorInfluence = Exclude<RollMode, 'NORMAL'>

export interface D20RollContributor {
  influence: D20ContributorInfluence
}

interface ResolvedD20Contributors<TContributor extends D20RollContributor> {
  contributors: readonly TContributor[]
  rollMode: RollMode
}

/**
 * Resolves an ordered set of already-qualified d20 contributors. Qualification and
 * contributor identity remain System policy; this mechanic owns only cancellation.
 */
export function resolveD20Contributors<TContributor extends D20RollContributor>(
  contributors: readonly TContributor[]
): ResolvedD20Contributors<TContributor> {
  let hasAdvantage = false
  let hasDisadvantage = false

  for (const contributor of contributors) {
    if (contributor.influence === 'ADVANTAGE') hasAdvantage = true
    else hasDisadvantage = true
  }

  return {
    contributors,
    rollMode: hasAdvantage
      ? hasDisadvantage
        ? 'NORMAL'
        : 'ADVANTAGE'
      : hasDisadvantage
        ? 'DISADVANTAGE'
        : 'NORMAL'
  }
}
