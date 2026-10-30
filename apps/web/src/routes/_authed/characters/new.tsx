import { createFileRoute } from '@tanstack/react-router'
import { loadSystemList } from '#app/data/systems/queries'
import { resolveCreateSystemId } from '#app/routes/-authoredRouteSystem'
import type { CharacterCreateLoaderData } from '#app/routes/-routeLoaderData'
import { createAuthoringRouteLoaderData } from '#forms/layout/authoredFormRouteContext'
import { CharacterBuilderAuthoringRuntime } from '#domains/characters/builder/core/CharacterBuilderAuthoringRuntime'

export const Route = createFileRoute('/_authed/characters/new')({
  loaderDeps: ({ search }) => ({ systemId: search.system }),
  loader: async ({ context, deps }): Promise<CharacterCreateLoaderData> => {
    const systems = await loadSystemList(context.queryClient)
    return createAuthoringRouteLoaderData({
      systemId: resolveCreateSystemId(systems, deps.systemId),
      systems
    })
  },
  component: function CharacterCreateRoute() {
    return (
      <CharacterBuilderAuthoringRuntime data={Route.useLoaderData().authoringData} mode='create' />
    )
  }
})
