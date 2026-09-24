import { createFileRoute } from '@tanstack/react-router'
import { getSystemListPage } from '#app/data/systems/queries'
import { SystemListPage } from '#domains/systems'

export const Route = createFileRoute('/_authed/systems/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getSystemListPage())
  },
  component: SystemListPage
})
