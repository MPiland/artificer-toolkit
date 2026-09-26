import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

export type ActionEconomyCapabilityBinding =
  | { kind: 'NONE' }
  | { kind: 'REQUIRED'; capabilityDefinitionId: string }

/**
 * System-owned mapping from an exact authored activation to its aggregate
 * usage capability. The Encounter layer never assigns semantics to an
 * activation label itself.
 */
export interface ActionEconomyCapabilityAdapter {
  gameSystemId: string
  resolveActionEconomyCapability(input: {
    activationKind: string
    activationAmount: number
  }): ActionEconomyCapabilityBinding
  /** The capability an actor that can't act (incapacitated) has suppressed. */
  actorActionCapabilityDefinitionId(): string
  refreshCapabilityDefinitionIds(): readonly string[]
}

function canonicalSystemId(value: string): string {
  const parsed = postgresUuidSchema.safeParse(value)
  if (!parsed.success) throw new Error('Action-economy System identity must be a PostgreSQL UUID.')
  return parsed.data
}

export function createActionEconomyCapabilityRegistry(
  adapters: readonly ActionEconomyCapabilityAdapter[]
) {
  const bySystemId = new Map<string, ActionEconomyCapabilityAdapter>()
  for (const adapter of adapters) {
    const gameSystemId = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(gameSystemId)) {
      throw new Error(`Duplicate action-economy System adapter: ${gameSystemId}.`)
    }
    bySystemId.set(gameSystemId, adapter)
  }
  return {
    resolveActionEconomyCapability(input: {
      gameSystemId: string
      activationKind: string
      activationAmount: number
    }): ActionEconomyCapabilityBinding {
      const adapter = bySystemId.get(canonicalSystemId(input.gameSystemId))
      if (!adapter) {
        throw new Error('The Game System does not provide action-economy policy.')
      }
      return adapter.resolveActionEconomyCapability({
        activationKind: input.activationKind,
        activationAmount: input.activationAmount
      })
    },
    requireActorActionCapabilityDefinitionId(gameSystemId: string): string {
      const adapter = bySystemId.get(canonicalSystemId(gameSystemId))
      if (!adapter) throw new Error('The Game System does not provide action-economy policy.')
      return adapter.actorActionCapabilityDefinitionId()
    },
    requireRefreshCapabilityDefinitionIds(gameSystemId: string): readonly string[] {
      const adapter = bySystemId.get(canonicalSystemId(gameSystemId))
      if (!adapter) return []
      return [...new Set(adapter.refreshCapabilityDefinitionIds())].sort()
    }
  }
}
