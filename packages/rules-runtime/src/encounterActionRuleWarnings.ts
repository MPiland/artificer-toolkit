import type {
  EncounterRuleWarningCodeDto,
  EncounterRuleWarningDto
} from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import type { evaluateEncounterActionEconomy } from './encounterActionEconomy.js'
import {
  evaluateEncounterActionTargetPolicy,
  withoutCreatureTypeExclusions
} from './encounterActionTargetPolicy.js'

/** The overridable warning for a stabilize (the Healer's Kit, First Aid) aimed at a creature that is not dying. */
export const TARGET_NOT_DYING_WARNING: EncounterRuleWarningDto = {
  code: 'TARGET_NOT_DYING',
  message: 'The target is not dying.'
}

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
   * The target's creature type when readable (a Creature's snapshot carries one; a Character's
   * facts do not). An action that excludes the type still proceeds, but only as an override.
   */
  targetCreatureTypeId?: string | null
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
  const { targeting } = input.target.targetPolicy
  const excludedTypeIds =
    (targeting?.selectionKind !== 'SELF' && targeting?.excludedCreatureTypeIds) || []
  const targetWarnings = evaluateEncounterActionTargetPolicy({
    ...input.target,
    targetPolicy: withoutCreatureTypeExclusions(input.target.targetPolicy)
  })
  if (targetWarnings === null) return { kind: 'UNSUPPORTED_TARGET' }
  const warnings: EncounterRuleWarningDto[] = [
    ...encounterActionEconomyWarnings(input.actionEconomy, input.activationCode),
    ...input.preparedWarnings,
    ...(input.stabilize
      ? input.stabilize.targetDying
        ? []
        : [TARGET_NOT_DYING_WARNING]
      : input.targetDefeated
        ? [{ code: 'TARGET_DEFEATED' as const, message: 'The target is defeated.' }]
        : []),
    ...(input.targetCreatureTypeId && excludedTypeIds.includes(input.targetCreatureTypeId)
      ? [
          {
            code: 'TARGET_CREATURE_TYPE_EXCLUDED' as const,
            message: 'This action has no effect on this creature type.'
          }
        ]
      : []),
    ...targetWarnings
  ]
  return acknowledgeEncounterActionWarnings(warnings, input.acknowledged)
}

function acknowledgeEncounterActionWarnings(
  warnings: EncounterRuleWarningDto[],
  acknowledged: readonly EncounterRuleWarningCodeDto[]
):
  | { kind: 'UNACKNOWLEDGED'; warnings: EncounterRuleWarningDto[] }
  | { kind: 'ACCEPTED'; overrides: EncounterRuleWarningDto[] } {
  return warnings.every((warning) => acknowledged.includes(warning.code))
    ? { kind: 'ACCEPTED', overrides: warnings }
    : { kind: 'UNACKNOWLEDGED', warnings }
}

/**
 * The same soft-check gate for a point-origin area action. Every creature in the area is caught, so
 * no per-target rule applies: the area's own range warning, the preparation warnings and the action
 * allowance are all it reports.
 */
export function evaluateEncounterAreaRuleWarnings(input: {
  preparedWarnings: readonly EncounterRuleWarningDto[]
  areaWarnings: readonly EncounterRuleWarningDto[]
  actionEconomy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>
  activationCode: string
  acknowledged: readonly EncounterRuleWarningCodeDto[]
}) {
  return acknowledgeEncounterActionWarnings(
    [
      ...encounterActionEconomyWarnings(input.actionEconomy, input.activationCode),
      ...input.preparedWarnings,
      ...input.areaWarnings
    ],
    input.acknowledged
  )
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
