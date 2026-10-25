import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import { getSystemRuleCapability } from '#app/data/systems/queries'
import { useSystemList } from '#app/data/systems/useSystemList'
import { buildPlatformNavigation, contentKindOrder } from './navigation'

/** The navigation for the Systems the user can see: Content lists the kinds those Systems publish. */
export function useShellNavigation() {
  const systems = useSystemList()
  const capabilities = useQueries({
    queries: (systems.data ?? []).map((system) => getSystemRuleCapability(system.id))
  })
  const isReady = Boolean(systems.data) && capabilities.every((capability) => capability.isSuccess)
  // A string key keeps the navigation referentially stable across unrelated query updates.
  const publishedKey = contentKindOrder
    .filter((kind) =>
      capabilities.some((capability) => capability.data?.contentKinds.includes(kind))
    )
    .join()

  return useMemo(
    () =>
      buildPlatformNavigation(
        isReady
          ? contentKindOrder.filter((kind) => publishedKey.split(',').includes(kind))
          : undefined
      ),
    [isReady, publishedKey]
  )
}
