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
  /** A defeated target (D63) is left out of target lists; naming one anyway only warns. */
  targetDefeated: boolean
  /**
   * Set when the action stabilizes (the Healer's Kit): it needs a dying target, so a target that
   * is not dying warns with TARGET_NOT_DYING in place of TARGET_DEFEATED.
   */
  stabilize: { targetDying: boolean } | null
  actionEconomy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>
  activationCode: string
  acknowledged: readonly EncounterRuleWarningCodeDto[]
}):
  | { kind: 'UNSUPPORTED_TARGET' }
  | { kind: 'UNACKNOWLEDGED'; warnings: EncounterRuleWarningDto[] }
  | { kind: 'ACCEPTED'; overrides: EncounterRuleWarningDto[] } {
  const targetWarnings = evaluateEncounterActionTargetPolicy(input.target)
  if (targetWarnings === null) return { kind: 'UNSUPPORTED_TARGET' }
  const warnings: EncounterRuleWarningDto[] = [
    ...encounterActionEconomyWarnings(input.actionEconomy, input.activationCode),
    ...input.preparedWarnings,
    ...(input.stabilize
      ? input.stabilize.targetDying
        ? []
        : [{ code: 'TARGET_NOT_DYING' as const, message: 'The target is not dying.' }]
      : input.targetDefeated
        ? [{ code: 'TARGET_DEFEATED' as const, message: 'The target is defeated.' }]
        : []),
    ...targetWarnings
  ]
  return warnings.every((warning) => input.acknowledged.includes(warning.code))
    ? { kind: 'ACCEPTED', overrides: warnings }
    : { kind: 'UNACKNOWLEDGED', warnings }
}

const allowanceName = (activationCode: string) => activationCode.toLowerCase().replaceAll('_', ' ')

/** The overridable warning for an actor that can't take this activation right now. */
export function encounterActionSuppressedWarning(activationCode: string): EncounterRuleWarningDto {
  const allowance = allowanceName(activationCode)
  const article = /^[aeiou]/.test(allowance) ? 'an' : 'a'
  return {
    code: 'ACTION_ECONOMY_UNAVAILABLE',
    message: `This actor can't take ${article} ${allowance} right now.`
  }
}

/** The overridable warning for an allowance the actor can't use now, if any. */
export function encounterActionEconomyWarnings(
  economy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>,
  activationCode: string
): EncounterRuleWarningDto[] {
  if (!economy || economy.available) return []
  return [
    economy.consumption.beforeUsed >= economy.consumption.maximum
      ? {
          code: 'ACTION_ECONOMY_UNAVAILABLE',
          message: `No ${allowanceName(activationCode)} left this turn.`
        }
      : encounterActionSuppressedWarning(activationCode)
  ]
}

/** Whether the recorded overrides let this action use an allowance past its maximum. */
export function overridesActionEconomy(overrides: readonly EncounterRuleWarningDto[]) {
  return overrides.some((warning) => warning.code === 'ACTION_ECONOMY_UNAVAILABLE')
}

/** The message for a rejected command; the warnings themselves travel alongside it. */
export const RULE_WARNINGS_MESSAGE = 'This action breaks a rule. Do it anyway?'
