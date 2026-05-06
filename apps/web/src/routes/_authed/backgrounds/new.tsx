import { createFileRoute } from '@tanstack/react-router'
import { getSystemList } from '#app/data/systems/queries'
import { createServerApi } from '#app/lib/api'
import { BackgroundCreatePage } from '#domains/backgrounds'

export const Route = createFileRoute('/_authed/backgrounds/new')({
  loader: async ({ context }) => {
    const systems = await context.queryClient.ensureQueryData(
      getSystemList(createServerApi(context.accessToken))
    )

    return { systems }
  },
  component: () => <BackgroundCreatePage />
})
