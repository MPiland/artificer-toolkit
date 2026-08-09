import type { QueryClient } from '@tanstack/react-query'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import type { AuthoredCreateLoaderData } from './-routeLoaderData'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { loadAuthoredRouteSystem } from './-authoredRouteSystem'

export async function loadAuthoredCreateRouteData(
  queryClient: QueryClient
): Promise<AuthoredCreateLoaderData> {
  const client = createServerApi()
  const systems = await queryClient.ensureQueryData(getSystemList(client))
  const systemId = systems[0]?.id
  const system = await loadAuthoredRouteSystem(queryClient, client, systemId)

  return createAuthoredFormRouteLoaderData({ system, systems })
}
