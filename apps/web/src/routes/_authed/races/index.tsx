import { createFileRoute } from '@tanstack/react-router'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'
import { getRaceList } from '#app/data/races/queries'
import { createServerApi, type RaceListRequestDto } from '#app/lib/api'

const raceCatalogueRequest = {
  direction: 'FORWARD',
  limit: 48,
  sort: 'name'
} satisfies RaceListRequestDto

export const Route = createFileRoute('/_authed/races/')({
  loader: async ({ context }): Promise<void> => {
    await context.queryClient.ensureInfiniteQueryData(
      getRaceList(raceCatalogueRequest, createServerApi())
    )
  },
  component: RaceCataloguePage
})
