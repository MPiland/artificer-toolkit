import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { CreatureCreatePage } from '#domains/creatures'

export const Route = createFileRoute('/_authed/creatures/new')({
  loader: async ({ context }) => {
    const client = createServerApi(context.accessToken)
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))

    return { systems }
  },
  component: CreatureCreatePage
})
