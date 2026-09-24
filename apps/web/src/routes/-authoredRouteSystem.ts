import type { QueryClient } from '@tanstack/react-query'
import { getSystem } from '#app/data/systems/queries'

export async function loadAuthoredRouteSystem(
  queryClient: QueryClient,
  systemId: string | null | undefined
) {
  return systemId ? await queryClient.ensureQueryData(getSystem(systemId)) : null
}
