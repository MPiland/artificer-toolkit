import type { ServerPublishedRuleDefinitionDto } from '@artificer-toolkit/schema/shared/ruleExecutionCore'

import {
  DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY,
  DND5E_SPENT_HEAL_AMOUNT_FACT_KEY,
  Dnd5eEffectActionCompilerError
} from './effectActionContracts.js'

type ResolvedHealRow = { outcomeId?: unknown; expression: string }

/** A composed recurring heal's amount, settled at cast from its resolved row (D156). */
export function recurringHealAmountFacts(
  published: ServerPublishedRuleDefinitionDto,
  rows: readonly ResolvedHealRow[],
  recurringHealOutcomeId: string | number | boolean | null
): Record<string, number> {
  if (recurringHealOutcomeId === null || !published.definition.outputs.recurringHealAmount)
    return {}
  const matching = rows.filter(({ outcomeId }) => outcomeId === recurringHealOutcomeId)
  const match =
    matching.length === 1 ? /^(\d+)(?: ([+-]) (\d+))?$/.exec(matching[0]!.expression) : null
  if (!match)
    throw new Dnd5eEffectActionCompilerError(
      'D&D recurring healing requires one exact resolved fixed amount.'
    )
  const bonus = Number(match[3] ?? 0)
  return {
    [DND5E_RECURRING_HEAL_AMOUNT_FACT_KEY]: Math.max(
      0,
      Number(match[1]) + (match[2] === '-' ? -bonus : bonus)
    )
  }
}

/**
 * The amount of a heal the caster sized at use: the per-unit amount for each unit spent from the
 * pool, or this creature's share of a pool heal the caster divides among the creatures it reaches.
 */
export function spentHealAmountFacts(
  published: ServerPublishedRuleDefinitionDto,
  rows: readonly ResolvedHealRow[],
  chosen: { spentUnits?: number; dividedAmount?: number }
): Record<string, number> {
  const requiresAmount = published.definition.nodes.some((node) =>
    Object.values(node.inputs).some(
      (binding) => binding.kind === 'FACT' && binding.factKey === DND5E_SPENT_HEAL_AMOUNT_FACT_KEY
    )
  )
  if (!requiresAmount) return {}
  const { spentUnits, dividedAmount } = chosen
  if (dividedAmount !== undefined) {
    if (!Number.isSafeInteger(dividedAmount) || dividedAmount < 1)
      throw new Dnd5eEffectActionCompilerError('D&D divided healing requires a positive share.')
    return { [DND5E_SPENT_HEAL_AMOUNT_FACT_KEY]: dividedAmount }
  }
  const perUnit = rows.length === 1 ? /^\d+$/.exec(rows[0]!.expression) : null
  if (!perUnit || spentUnits === undefined || !Number.isSafeInteger(spentUnits) || spentUnits < 1)
    throw new Dnd5eEffectActionCompilerError(
      'D&D spent healing requires one exact resolved amount and the units spent.'
    )
  return { [DND5E_SPENT_HEAL_AMOUNT_FACT_KEY]: Number(perUnit[0]) * spentUnits }
}
