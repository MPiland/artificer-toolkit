import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { CharacterCreatePage } from '#domains/characters'

export const Route = createFileRoute('/_authed/characters/new')({
  loader: async ({ context }) => {
    const client = createServerApi(context.accessToken)
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))
    const systemId = systems[0]?.id
    const payload = systemId
      ? await client.characters.draft({
          id: crypto.randomUUID(),
          systemId
        })
      : null

    return {
      payload,
      systems
    }
  },
  component: CharacterCreatePage
})
