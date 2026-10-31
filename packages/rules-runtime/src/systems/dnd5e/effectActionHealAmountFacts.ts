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
  recurringHealOutcomeId: string | null
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

/** A spent heal's per-unit amount for each unit the caster spent from the pool. */
export function spentHealAmountFacts(
  published: ServerPublishedRuleDefinitionDto,
  rows: readonly ResolvedHealRow[],
  spentUnits: number | undefined
): Record<string, number> {
  const requiresAmount = published.definition.nodes.some((node) =>
    Object.values(node.inputs).some(
      (binding) => binding.kind === 'FACT' && binding.factKey === DND5E_SPENT_HEAL_AMOUNT_FACT_KEY
    )
  )
  if (!requiresAmount) return {}
  const perUnit = rows.length === 1 ? /^\d+$/.exec(rows[0]!.expression) : null
  if (!perUnit || spentUnits === undefined || !Number.isSafeInteger(spentUnits) || spentUnits < 1)
    throw new Dnd5eEffectActionCompilerError(
      'D&D spent healing requires one exact resolved amount and the units spent.'
    )
  return { [DND5E_SPENT_HEAL_AMOUNT_FACT_KEY]: Number(perUnit[0]) * spentUnits }
}
