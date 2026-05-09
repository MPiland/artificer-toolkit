import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { ClassCreatePage } from '#domains/classes'

export const Route = createFileRoute('/_authed/classes/new')({
  loader: async ({ context }) => {
    const client = createServerApi()
    const systems = await context.queryClient.ensureQueryData(getSystemList(client))

    return { systems }
  },
  component: () => <ClassCreatePage />
})
