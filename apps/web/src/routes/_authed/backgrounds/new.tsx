import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import type { AuthoredCreateLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/backgrounds/new')({
  context: () => createAuthoredFormRouteContext('background', 'create'),
  loader: async ({ context }): Promise<AuthoredCreateLoaderData> => {
    const systems = await context.queryClient.ensureQueryData(getSystemList(createServerApi()))

    return createAuthoredFormRouteLoaderData({ systems })
  },
  component: AuthoringLayout
})
