import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'

/**
 * The installed Systems' adapters for one capability, keyed by UUID-canonical `gameSystemId`
 * (ADR 0039 decision 5). A neutral runtime module reaches System behaviour only through `require`,
 * which fails closed on a System that does not provide the capability.
 *
 * @param capability Lower-case hyphenated name used in errors, such as `roll-mode`.
 * @param validate Refuses an adapter whose System data the capability cannot use, at registration.
 */
export function createSystemCapabilityRegistry<TAdapter extends { readonly gameSystemId: string }>(
  capability: string,
  adapters: readonly TAdapter[],
  validate?: (adapter: TAdapter) => void
) {
  const canonicalSystemId = (value: string) => {
    const parsed = postgresUuidSchema.safeParse(value)
    if (!parsed.success) {
      throw new Error(
        `${capability.charAt(0).toUpperCase()}${capability.slice(1)} System identity must be a PostgreSQL UUID.`
      )
    }
    return parsed.data
  }
  const bySystemId = new Map<string, TAdapter>()
  for (const adapter of adapters) {
    const gameSystemId = canonicalSystemId(adapter.gameSystemId)
    if (bySystemId.has(gameSystemId)) {
      throw new Error(`Duplicate ${capability} System adapter: ${gameSystemId}.`)
    }
    validate?.(adapter)
    bySystemId.set(gameSystemId, adapter)
  }
  return {
    require(gameSystemId: string): TAdapter {
      const adapter = bySystemId.get(canonicalSystemId(gameSystemId))
      if (!adapter) throw new Error(`The Game System does not provide ${capability} policy.`)
      return adapter
    },
    /**
     * For optional capabilities only: a caller whose rule is valid for a System that does not provide
     * the capability (such as a Sheet Character of a System with no 0 hit point condition). A caller
     * that needs the capability uses `require`.
     */
    find(gameSystemId: string): TAdapter | undefined {
      return bySystemId.get(canonicalSystemId(gameSystemId))
    }
  }
}
