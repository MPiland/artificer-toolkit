import { createFileRoute } from '@tanstack/react-router'
import { loadSystemList } from '#app/data/systems/queries'
import type { CharacterCreateLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import {
  createAuthoringRouteLoaderData,
  createCharacterBuilderRouteContext
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/characters/new')({
  context: () => createCharacterBuilderRouteContext('create'),
  loader: async ({ context }): Promise<CharacterCreateLoaderData> => {
    const systems = await loadSystemList(context.queryClient)
    return createAuthoringRouteLoaderData({
      systems
    })
  },
  component: AuthoringLayout
})
