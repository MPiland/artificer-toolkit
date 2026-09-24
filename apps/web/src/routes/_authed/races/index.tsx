import { createFileRoute } from '@tanstack/react-router'
import { api } from '@artificer-toolkit/apis/convex/api'
import { convexQuery } from '@convex-dev/react-query'
import { RaceCataloguePage } from '#domains/races/pages/RaceCataloguePage'
import { getAuthoredCatalogueList } from '#app/data/authoredCatalogue'

export const Route = createFileRoute('/_authed/races/')({
  loader: async ({ context }): Promise<void> => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        getAuthoredCatalogueList({
          subjectKind: 'RACE',
          sort: 'family',
          paginationOpts: { cursor: null, numItems: 48 }
        })
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.content.catalogue.summary, { subjectKind: 'RACE' })
      )
    ])
  },
  component: RaceCataloguePage
})
