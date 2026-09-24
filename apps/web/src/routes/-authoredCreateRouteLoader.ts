import type { QueryClient } from '@tanstack/react-query'
import { loadSystemList } from '#app/data/systems/queries'
import type { AuthoredCreateLoaderData } from './-routeLoaderData'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { loadAuthoredRouteSystem } from './-authoredRouteSystem'

export async function loadAuthoredCreateRouteData(
  queryClient: QueryClient
): Promise<AuthoredCreateLoaderData> {
  const systems = await loadSystemList(queryClient)
  const systemId = systems[0]?.id
  const system = await loadAuthoredRouteSystem(queryClient, systemId)

  return createAuthoredFormRouteLoaderData({ system, systems })
}
