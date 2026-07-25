import {
  CHARACTER_CALCULATION_CONTRIBUTION_STATE,
  type CharacterCalculation,
  type CharacterCalculationContribution
} from '../../character/sheetCalculation.js'

export function resolveNumericCalculation(
  base: number,
  contributions: readonly CharacterCalculationContribution<number>[] = [],
  override?: CharacterCalculation<number>['override']
): CharacterCalculation<number> {
  const resolvedContributions = contributions.map((contribution) => ({
    ...contribution,
    state: override ? CHARACTER_CALCULATION_CONTRIBUTION_STATE.SUPPRESSED : contribution.state
  }))
  const effective =
    override?.value ??
    resolvedContributions.reduce(
      (total, contribution) =>
        contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
          ? total + contribution.value
          : total,
      base
    )

  return {
    base,
    contributions: resolvedContributions,
    ...(override ? { override } : {}),
    effective
  }
}

export function resolveSelectionCalculation<T>(
  base: T,
  contributions: readonly CharacterCalculationContribution<T>[] = [],
  override?: CharacterCalculation<T>['override']
): CharacterCalculation<T> {
  const resolvedContributions = contributions.map((contribution) => ({
    ...contribution,
    state: override ? CHARACTER_CALCULATION_CONTRIBUTION_STATE.SUPPRESSED : contribution.state
  }))
  const effective =
    override?.value ??
    [...resolvedContributions]
      .reverse()
      .find(
        (contribution) => contribution.state === CHARACTER_CALCULATION_CONTRIBUTION_STATE.APPLIED
      )?.value ??
    base

  return {
    base,
    contributions: resolvedContributions,
    ...(override ? { override } : {}),
    effective
  }
}
