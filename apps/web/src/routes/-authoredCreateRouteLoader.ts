import type { QueryClient } from '@tanstack/react-query'
import { loadSystemList } from '#app/data/systems/queries'
import type { AuthoredCreateLoaderData } from './-routeLoaderData'
import { createAuthoredFormRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { loadAuthoredRouteSystem, resolveCreateSystemId } from './-authoredRouteSystem'

export async function loadAuthoredCreateRouteData(
  queryClient: QueryClient,
  requestedSystemId: string | undefined
): Promise<AuthoredCreateLoaderData> {
  const systems = await loadSystemList(queryClient)
  const system = await loadAuthoredRouteSystem(
    queryClient,
    resolveCreateSystemId(systems, requestedSystemId)
  )

  return createAuthoredFormRouteLoaderData({ system, systems })
}
