import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
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

function canonicalSystemId(value: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success)
    throw new Error('Combat-perception System identity must be a PostgreSQL UUID.')
  return parsed.data
}

export function createCombatPerceptionCapabilityRegistry(
  adapters: readonly CombatPerceptionCapabilityAdapter[]
) {
  const bySystemId = new Map<string, CombatPerceptionCapabilityAdapter>()
  for (const adapter of adapters) {
    const gameSystemId = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(gameSystemId)) {
      throw new Error(`Duplicate combat-perception System adapter: ${gameSystemId}.`)
    }
    bySystemId.set(gameSystemId, adapter)
  }
  return {
    resolveCombatPerceptionWithContributions(
      input: CombatPerceptionResolutionInput & { gameSystemId: string }
    ): CombatPerceptionContributionResult {
      const { gameSystemId, ...resolution } = input
      const adapter = bySystemId.get(canonicalSystemId(gameSystemId))
      if (!adapter) throw new Error('The Game System does not provide combat-perception policy.')
      return adapter.resolveCombatPerceptionWithContributions(resolution)
    }
  }
}
