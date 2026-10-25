import type { QueryClient } from '@tanstack/react-query'
import { getSystem } from '#app/data/systems/queries'

/** The requested System, or the only one available; with several and no request, none is chosen. */
export function resolveCreateSystemId(
  systems: readonly { id: string }[],
  requestedSystemId: string | undefined
): string | undefined {
  if (requestedSystemId) return systems.find(({ id }) => id === requestedSystemId)?.id
  return systems.length === 1 ? systems[0]?.id : undefined
}

export async function loadAuthoredRouteSystem(
  queryClient: QueryClient,
  systemId: string | null | undefined
) {
  return systemId ? await queryClient.ensureQueryData(getSystem(systemId)) : null
}
