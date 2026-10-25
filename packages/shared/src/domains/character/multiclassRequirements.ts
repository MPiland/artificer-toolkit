export type MulticlassRequirementGroup = {
  requirements: readonly {
    ability: string
    min: number
  }[]
}

export type MulticlassRequirementEvaluation = {
  passes: boolean
  unmetRequirementGroups: readonly MulticlassRequirementGroup[]
}

export function evaluateMulticlassRequirements(
  requirementGroups: { groups: readonly MulticlassRequirementGroup[] },
  abilityScores: Partial<Record<string, number>>
): MulticlassRequirementEvaluation {
  const unmetRequirementGroups = requirementGroups.groups.filter((group) =>
    group.requirements.some(
      (requirement) => (abilityScores[requirement.ability] ?? 0) < requirement.min
    )
  )

  return {
    passes:
      requirementGroups.groups.length === 0 ||
      unmetRequirementGroups.length < requirementGroups.groups.length,
    unmetRequirementGroups
  }
}
