import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import type { CharacterCreateLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms/layout/AuthoringLayout'
import {
  createAuthoringRouteLoaderData,
  createCharacterBuilderRouteContext
} from '#forms/layout/authoredFormRouteContext'
import {
  createFallbackCharacterFormValues,
  normalizeCharacterForDraft
} from '#domains/characters/builder/shared/formNormalization'

export const Route = createFileRoute('/_authed/characters/new')({
  context: () => createCharacterBuilderRouteContext('create'),
  loader: async ({ context }): Promise<CharacterCreateLoaderData> => {
    const client = createServerApi()
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))
    const systemId = systems[0]?.id
    const payload = systemId
      ? await client.characters.resolve({
          character: normalizeCharacterForDraft({
            ...createFallbackCharacterFormValues(systemId),
            id: crypto.randomUUID()
          }),
          mode: 'create'
        })
      : null

    return createAuthoringRouteLoaderData({
      payload,
      systems
    })
  },
  component: AuthoringLayout
})
