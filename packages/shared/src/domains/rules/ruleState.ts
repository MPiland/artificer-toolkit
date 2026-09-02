export interface RuleCapabilitySuppression {
  id: string
  order: number
  kind: 'CAPABILITY_SUPPRESS'
  capabilityDefinitionIds: readonly string[]
}

export interface ConditionRuleStateDefinition {
  id: string
  gameSystemId: string
  capabilitySuppressions: readonly RuleCapabilitySuppression[]
}

export interface RuleCapabilityAvailability {
  available: boolean
  suppressingConditionDefinitionIds: readonly string[]
  suppressingActiveEffectIds: readonly string[]
  activeEffectSuppressions: readonly {
    activeEffectId: string
    contributionId: string
  }[]
  contributionIds: readonly string[]
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

function requireUuid(value: string, label: string): string {
  const normalized = value.toLowerCase()
  if (!UUID_PATTERN.test(normalized)) throw new Error(`${label} must be a UUID.`)
  return normalized
}

/** Resolves one capability without knowing condition names or action-economy labels. */
export function resolveRuleCapabilityAvailability(input: {
  gameSystemId: string
  capabilityDefinitionId: string
  conditions: readonly ConditionRuleStateDefinition[]
  activeEffectSuppressions?: readonly {
    activeEffectId: string
    contributionId: string
    capabilityDefinitionIds: readonly string[]
  }[]
}): RuleCapabilityAvailability {
  const gameSystemId = requireUuid(input.gameSystemId, 'Rule capability Game System identity')
  const capabilityDefinitionId = requireUuid(
    input.capabilityDefinitionId,
    'Rule capability definition identity'
  )
  const suppressions: {
    conditionDefinitionId: string
    contributionId: string
  }[] = []
  const conditionIds = new Set<string>()
  const contributionIds = new Set<string>()
  const activeEffectIds = new Set<string>()

  for (const condition of input.conditions) {
    const conditionDefinitionId = requireUuid(
      condition.id,
      'Condition rule-state definition identity'
    )
    if (conditionIds.has(conditionDefinitionId))
      throw new Error('Condition rule-state definition identities must be unique.')
    conditionIds.add(conditionDefinitionId)
    if (
      requireUuid(condition.gameSystemId, 'Condition rule-state Game System identity') !==
      gameSystemId
    )
      throw new Error('Condition rule-state definition belongs to another Game System.')

    let prior: RuleCapabilitySuppression | undefined
    for (const suppression of condition.capabilitySuppressions) {
      const contributionId = requireUuid(
        suppression.id,
        'Condition rule-state contribution identity'
      )
      if (contributionIds.has(contributionId))
        throw new Error('Condition rule-state contribution identities must be unique.')
      contributionIds.add(contributionId)
      if (
        prior &&
        (prior.order > suppression.order ||
          (prior.order === suppression.order && prior.id >= suppression.id))
      )
        throw new Error('Condition rule-state contributions must retain canonical order.')
      prior = suppression
      if (
        suppression.capabilityDefinitionIds.some(
          (definitionId) =>
            requireUuid(definitionId, 'Suppressed capability definition identity') ===
            capabilityDefinitionId
        )
      )
        suppressions.push({ conditionDefinitionId, contributionId })
    }
  }

  const activeSuppressions = (input.activeEffectSuppressions ?? []).map((suppression) => ({
    activeEffectId: requireUuid(suppression.activeEffectId, 'Active effect identity'),
    contributionId: requireUuid(suppression.contributionId, 'Active effect contribution identity'),
    capabilityDefinitionIds: suppression.capabilityDefinitionIds.map((id) =>
      requireUuid(id, 'Active effect suppressed capability identity')
    )
  }))
  activeSuppressions.sort(
    (left, right) =>
      left.activeEffectId.localeCompare(right.activeEffectId) ||
      left.contributionId.localeCompare(right.contributionId)
  )
  for (const suppression of activeSuppressions) {
    if (activeEffectIds.has(suppression.activeEffectId + suppression.contributionId))
      throw new Error('Active effect suppression identities must be unique.')
    activeEffectIds.add(suppression.activeEffectId + suppression.contributionId)
    if (contributionIds.has(suppression.contributionId))
      throw new Error(
        'Active effect contribution identities must not overlap condition contributions.'
      )
    contributionIds.add(suppression.contributionId)
    if (suppression.capabilityDefinitionIds.includes(capabilityDefinitionId))
      suppressions.push({
        conditionDefinitionId: '',
        contributionId: suppression.contributionId
      })
  }

  suppressions.sort(
    (left, right) =>
      left.conditionDefinitionId.localeCompare(right.conditionDefinitionId) ||
      left.contributionId.localeCompare(right.contributionId)
  )
  const selectedActiveSuppressions = activeSuppressions.filter((suppression) =>
    suppression.capabilityDefinitionIds.includes(capabilityDefinitionId)
  )
  return {
    available: suppressions.length === 0,
    suppressingConditionDefinitionIds: [
      ...new Set(
        suppressions
          .map((suppression) => suppression.conditionDefinitionId)
          .filter((conditionDefinitionId) => conditionDefinitionId.length > 0)
      )
    ],
    suppressingActiveEffectIds: [
      ...new Set(selectedActiveSuppressions.map((suppression) => suppression.activeEffectId))
    ],
    activeEffectSuppressions: selectedActiveSuppressions.map(
      ({ activeEffectId, contributionId }) => ({
        activeEffectId,
        contributionId
      })
    ),
    contributionIds: suppressions.map((suppression) => suppression.contributionId)
  }
}
