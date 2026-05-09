import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { FeatCreatePage } from '#domains/feats'

export const Route = createFileRoute('/_authed/feats/new')({
  loader: async ({ context }) => {
    const client = createServerApi()
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))

    return { systems }
  },
  component: FeatCreatePage
})
