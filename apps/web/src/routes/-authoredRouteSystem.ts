import type { QueryClient } from '@tanstack/react-query'
import { getSystem } from '#app/data/systems/queries'
import type { Api } from '#app/lib/api'

export async function loadAuthoredRouteSystem(
  queryClient: QueryClient,
  client: Api,
  systemId: string | null | undefined
) {
  return systemId ? await queryClient.ensureQueryData(getSystem(systemId, client)) : null
}
