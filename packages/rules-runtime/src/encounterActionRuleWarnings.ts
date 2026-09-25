import type {
  EncounterRuleWarningCodeDto,
  EncounterRuleWarningDto
} from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { evaluateEncounterActionEconomy } from './encounterActionEconomy.js'
import { evaluateEncounterActionTargetPolicy } from './encounterActionTargetPolicy.js'

/**
 * The one Assisted-mode soft-check gate for RESOLVE_ACTION, shared by the Session DO planner and the
 * Convex fallback (ADR 0034 decision 2). Preparation, targeting and the action allowance each report
 * their overridable warnings here; the command proceeds only when it acknowledges every current code,
 * and the accepted warnings become the action's recorded overrides.
 */
export function evaluateEncounterActionRuleWarnings(input: {
  preparedWarnings: readonly EncounterRuleWarningDto[]
  target: Parameters<typeof evaluateEncounterActionTargetPolicy>[0]
  actionEconomy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>
  activationCode: string
  acknowledged: readonly EncounterRuleWarningCodeDto[]
}):
  | { kind: 'UNSUPPORTED_TARGET' }
  | { kind: 'UNACKNOWLEDGED'; warnings: EncounterRuleWarningDto[] }
  | { kind: 'ACCEPTED'; overrides: EncounterRuleWarningDto[] } {
  const targetWarnings = evaluateEncounterActionTargetPolicy(input.target)
  if (targetWarnings === null) return { kind: 'UNSUPPORTED_TARGET' }
  const warnings = [
    ...encounterActionEconomyWarnings(input.actionEconomy, input.activationCode),
    ...input.preparedWarnings,
    ...targetWarnings
  ]
  return warnings.every((warning) => input.acknowledged.includes(warning.code))
    ? { kind: 'ACCEPTED', overrides: warnings }
    : { kind: 'UNACKNOWLEDGED', warnings }
}

/** The overridable warning for an allowance the actor can't use now, if any. */
export function encounterActionEconomyWarnings(
  economy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>,
  activationCode: string
): EncounterRuleWarningDto[] {
  if (!economy || economy.available) return []
  const allowance = activationCode.toLowerCase().replaceAll('_', ' ')
  return [
    {
      code: 'ACTION_ECONOMY_UNAVAILABLE',
      message:
        economy.consumption.beforeUsed >= economy.consumption.maximum
          ? `No ${allowance} left this turn.`
          : `This actor can't take a ${allowance} right now.`
    }
  ]
}

/** Whether the recorded overrides let this action use an allowance past its maximum. */
export function overridesActionEconomy(overrides: readonly EncounterRuleWarningDto[]) {
  return overrides.some((warning) => warning.code === 'ACTION_ECONOMY_UNAVAILABLE')
}

/** The message for a rejected command; the warnings themselves travel alongside it. */
export const RULE_WARNINGS_MESSAGE = 'This action breaks a rule. Do it anyway?'
