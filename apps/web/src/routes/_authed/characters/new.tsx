import { createFileRoute } from '@tanstack/react-router'
import { loadSystemList } from '#app/data/systems/queries'
import { resolveCreateSystemId } from '#app/routes/-authoredRouteSystem'
import type { CharacterCreateLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import {
  createAuthoringRouteLoaderData,
  createCharacterBuilderRouteContext
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/characters/new')({
  context: () => createCharacterBuilderRouteContext('create'),
  loaderDeps: ({ search }) => ({ systemId: search.system }),
  loader: async ({ context, deps }): Promise<CharacterCreateLoaderData> => {
    const systems = await loadSystemList(context.queryClient)
    return createAuthoringRouteLoaderData({
      systemId: resolveCreateSystemId(systems, deps.systemId),
      systems
    })
  },
  component: AuthoringLayout
})
