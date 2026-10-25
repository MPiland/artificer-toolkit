import type {
  EncounterRuleWarningCodeDto,
  EncounterRuleWarningDto
} from '@artificer-toolkit/schema/shared/encounterRuleWarnings'
import { isTargetDead } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { evaluateEncounterActionEconomy } from './encounterActionEconomy.js'
import { isEncounterTargetDying } from './encounterActorDefeat.js'
import type { EffectOutcomeTargetPrecondition } from './effectOutcomeRegistry.js'
import {
  evaluateEncounterActionTargetPolicy,
  targetingExcludesCreatureType,
  withoutCreatureTypeRestrictions
} from './encounterActionTargetPolicy.js'
import { sizeRank } from './systemSizes.js'

type OutcomeTarget = Parameters<typeof isEncounterTargetDying>[0]

/** How a target meets each outcome precondition, and the overridable warning it raises when it fails. */
const TARGET_PRECONDITIONS: Readonly<
  Record<
    EffectOutcomeTargetPrecondition,
    { met: (target: OutcomeTarget) => boolean; warning: EncounterRuleWarningDto }
  >
> = {
  DYING: {
    met: isEncounterTargetDying,
    warning: { code: 'TARGET_NOT_DYING', message: 'The target is not dying.' }
  },
  DEAD: {
    met: (target) =>
      target !== undefined &&
      isTargetDead({ currentHitPoints: target.state.current, deathSaves: target.state.deathSaves }),
    warning: { code: 'TARGET_NOT_DEAD', message: 'The target is not dead.' }
  }
}

/** The overridable warning for an end-effects action (Lesser Restoration) aimed at a creature with nothing it ends. */
export const TARGET_NOTHING_TO_END_WARNING: EncounterRuleWarningDto = {
  code: 'TARGET_NOTHING_TO_END',
  message: 'The target holds no effect this ends.'
}

/**
 * The warnings an unmet outcome precondition raises. An action that proceeds over one rolls and
 * applies nothing (D173 Q1).
 */
export const TARGET_PRECONDITION_WARNING_CODES: ReadonlySet<EncounterRuleWarningCodeDto> = new Set(
  Object.values(TARGET_PRECONDITIONS).map(({ warning }) => warning.code)
)

type EncounterActionWarningInput = {
  preparedWarnings: readonly EncounterRuleWarningDto[]
  target: Parameters<typeof evaluateEncounterActionTargetPolicy>[0]
  /** A defeated target (D63) is left out of target lists; naming one anyway only warns. */
  targetDefeated: boolean
  /**
   * The target's creature type when readable (a Creature's snapshot carries one; a Character's
   * facts do not). An action that excludes the type, or names other types it affects, still
   * proceeds, but only as an override.
   */
  targetCreatureTypeId?: string | null
  /**
   * The target's Intelligence when readable (a Creature's snapshot carries it; a Character's facts
   * do not), judged against the Intelligence floor of an action that bonds its targets.
   */
  targetIntelligence?: number | null
  /**
   * The actor's and the target's sizes when readable, judged against the action's `sizeLimit` on
   * their System's size list; either one unknown raises nothing.
   */
  sizes?: { gameSystemId: string; actor: string | null; target: string | null }
  /** Set when the action bonds its targets (Telepathic Bond): Intelligence at or below it is excluded. */
  linkIntelligenceFloor?: number | null
  /**
   * The target preconditions the action's outcomes declare (D173 Q1) and the loaded target judged
   * against them. Each one it fails warns in place of TARGET_DEFEATED, which a dying target is.
   */
  targetPreconditions: {
    declared: readonly EffectOutcomeTargetPrecondition[]
    target: OutcomeTarget
  }
  actionEconomy: Awaited<ReturnType<typeof evaluateEncounterActionEconomy>>
  activationCode: string
  acknowledged: readonly EncounterRuleWarningCodeDto[]
}

/** Whether the target is more size steps above the actor than a single-target `sizeLimit` allows. */
function targetExceedsSizeLimit(
  input: Pick<EncounterActionWarningInput, 'target' | 'sizes'>
): boolean {
  const { targeting } = input.target.targetPolicy
  const limit = targeting?.selectionKind === 'SINGLE_TARGET' ? targeting.sizeLimit : undefined
  if (limit === undefined || !input.sizes) return false
  const actorRank = sizeRank(input.sizes.gameSystemId, input.sizes.actor)
  const targetRank = sizeRank(input.sizes.gameSystemId, input.sizes.target)
  return actorRank !== null && targetRank !== null && targetRank - actorRank > limit.stepsAboveActor
}

/** Every warning one target raises, or null when the target policy refuses the target outright. */
function encounterActionWarnings(input: EncounterActionWarningInput) {
  const targetWarnings = evaluateEncounterActionTargetPolicy({
    ...input.target,
    targetPolicy: withoutCreatureTypeRestrictions(input.target.targetPolicy)
  })
  if (targetWarnings === null) return null
  return [
    ...encounterActionEconomyWarnings(input.actionEconomy, input.activationCode),
    ...input.preparedWarnings,
    ...(input.targetPreconditions.declared.length > 0
      ? [...new Set(input.targetPreconditions.declared)].flatMap((precondition) => {
          const { met, warning } = TARGET_PRECONDITIONS[precondition]
          return met(input.targetPreconditions.target) ? [] : [warning]
        })
      : input.targetDefeated
        ? [{ code: 'TARGET_DEFEATED' as const, message: 'The target is defeated.' }]
        : []),
    ...(input.targetCreatureTypeId &&
    targetingExcludesCreatureType(input.target.targetPolicy.targeting, input.targetCreatureTypeId)
      ? [
          {
            code: 'TARGET_CREATURE_TYPE_EXCLUDED' as const,
            message: 'This action has no effect on this creature type.'
          }
        ]
      : []),
    ...(targetExceedsSizeLimit(input)
      ? [
          {
            code: 'TARGET_TOO_LARGE' as const,
            message: 'The target is too large for this action.'
          }
        ]
      : []),
    ...(input.linkIntelligenceFloor != null &&
    input.targetIntelligence != null &&
    input.targetIntelligence <= input.linkIntelligenceFloor
      ? [
          {
            code: 'TARGET_INTELLIGENCE_EXCLUDED' as const,
            message: 'This creature has too little Intelligence to join the bond.'
          }
        ]
      : []),
    ...targetWarnings
  ]
}

/**
 * The one Assisted-mode soft-check gate for RESOLVE_ACTION, shared by the Session DO planner and the
 * Convex fallback (ADR 0034 decision 2). Preparation, targeting and the action allowance each report
 * their overridable warnings here; the command proceeds only when it acknowledges every current code,
 * and the accepted warnings become the action's recorded overrides.
 */
export function evaluateEncounterActionRuleWarnings(
  input: EncounterActionWarningInput
):
  | { kind: 'UNSUPPORTED_TARGET' }
  | { kind: 'UNACKNOWLEDGED'; warnings: EncounterRuleWarningDto[] }
  | { kind: 'ACCEPTED'; overrides: EncounterRuleWarningDto[] } {
  const warnings = encounterActionWarnings(input)
  return warnings === null
    ? { kind: 'UNSUPPORTED_TARGET' }
    : acknowledgeEncounterActionWarnings(warnings, input.acknowledged)
}

/**
 * The same gate for a list of chosen creatures: each target is held to the single-target rules, and
 * a warning that applies to more than one of them (a spent allowance, an unprepared spell) is
 * reported once. A list inside an area adds the area's own range and sight warnings for its point.
 */
export function evaluateEncounterActorsRuleWarnings(
  input: Omit<
    EncounterActionWarningInput,
    // A size limit is single-target only.
    | 'target'
    | 'targetDefeated'
    | 'targetCreatureTypeId'
    | 'targetIntelligence'
    | 'targetPreconditions'
    | 'sizes'
  > & {
    targets: readonly Pick<
      EncounterActionWarningInput,
      'target' | 'targetDefeated' | 'targetCreatureTypeId' | 'targetIntelligence'
    >[]
    areaWarnings: readonly EncounterRuleWarningDto[]
  }
):
  | { kind: 'UNSUPPORTED_TARGET' }
  | { kind: 'UNACKNOWLEDGED'; warnings: EncounterRuleWarningDto[] }
  | { kind: 'ACCEPTED'; overrides: EncounterRuleWarningDto[] } {
  const { targets, areaWarnings, ...shared } = input
  const warnings = new Map<string, EncounterRuleWarningDto>(
    areaWarnings.map((warning) => [JSON.stringify([warning.code, warning.message]), warning])
  )
  for (const target of targets) {
    const targetWarnings = encounterActionWarnings({
      ...shared,
      ...target,
      targetPreconditions: { declared: [], target: undefined }
    })
    if (targetWarnings === null) return { kind: 'UNSUPPORTED_TARGET' }
    for (const warning of targetWarnings)
      warnings.set(JSON.stringify([warning.code, warning.message]), warning)
  }
  return acknowledgeEncounterActionWarnings([...warnings.values()], input.acknowledged)
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
