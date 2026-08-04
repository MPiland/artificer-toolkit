import { createFileRoute } from '@tanstack/react-router'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'
import { getRaceList } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/races/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureQueryData(getRaceList(createServerApi()))
  },
  component: RaceCataloguePage
})
