import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

export type ActionEconomyCapabilityBinding =
  | { kind: 'NONE' }
  | {
      kind: 'REQUIRED'
      capabilityDefinitionId: string
      /** The value domain whose active `SET_VALUE` grants raise this allowance's maximum. */
      grantedCountDomain?: string
      /**
       * The allowance an `ACTION_BONUS_ACTION_EXCLUSIVITY` grant makes this one exclusive with:
       * once the other is spent this turn, this one is unavailable.
       */
      exclusiveWithCapabilityDefinitionId?: string
    }

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
  /**
   * Whether an action is an attack of the Attack action: several of them share the one Action the
   * first spends, up to the actor's attacks per Attack action.
   */
  isAttackActionAttack(input: {
    activationKind: string
    activationAmount: number
    triggerCode: string
  }): boolean
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
    isAttackActionAttack(input: {
      gameSystemId: string
      activationKind: string
      activationAmount: number
      triggerCode: string
    }): boolean {
      return (
        bySystemId.get(canonicalSystemId(input.gameSystemId))?.isAttackActionAttack(input) ?? false
      )
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
