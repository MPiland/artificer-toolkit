import { createFileRoute } from '@tanstack/react-router'
import { getSystem, getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import type { AuthoredCreateLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/spells/new')({
  context: () => createAuthoredFormRouteContext('spell', 'create'),
  loader: async ({ context }): Promise<AuthoredCreateLoaderData> => {
    const client = createServerApi()
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))
    const systemId = systems[0]?.id
    const system = systemId
      ? await context.queryClient.ensureQueryData(getSystem(systemId, client))
      : null

    return createAuthoredFormRouteLoaderData({ system, systems })
  },
  component: AuthoringLayout
})
