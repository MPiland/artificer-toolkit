import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { SystemListPage } from '#domains/systems'

export const Route = createFileRoute('/_authed/systems/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getSystemList(createServerApi()))
  },
  component: SystemListPage
})
