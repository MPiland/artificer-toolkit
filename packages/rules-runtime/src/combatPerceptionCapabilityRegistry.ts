import type {
  CombatPerceptionCapabilityInstance,
  CombatPerceptionContributionResult,
  CombatPerceptionContributionSource,
  CombatPerceptionEnvironment,
  CombatPerceptionRequirement
} from '@artificer-toolkit/shared/vtt'

export interface CombatPerceptionResolutionInput {
  requirement: CombatPerceptionRequirement
  environment: CombatPerceptionEnvironment
  capabilities: readonly CombatPerceptionCapabilityInstance[]
  observerContributions: readonly CombatPerceptionContributionSource[]
  subjectContributions: readonly CombatPerceptionContributionSource[]
  localAreaContributions: readonly CombatPerceptionContributionSource[]
}

/**
 * System-owned perception policy: how senses, light, obscurement and contributions resolve to the
 * access one actor has to another. The Encounter layer never assigns meaning to a requirement.
 */
export interface CombatPerceptionCapabilityAdapter {
  gameSystemId: string
  /** Pure: validates its input and throws on a malformed one. */
  resolveCombatPerceptionWithContributions(
    input: CombatPerceptionResolutionInput
  ): CombatPerceptionContributionResult
}
