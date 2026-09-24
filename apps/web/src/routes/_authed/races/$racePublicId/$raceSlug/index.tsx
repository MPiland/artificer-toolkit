import { createFileRoute, redirect } from '@tanstack/react-router'
import { raceResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getRace, useGetRace } from '#app/data/races/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import type { RaceDetailLoaderData } from '#app/routes/-routeLoaderData'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'

const raceDetailMeta = ['heritages', 'races', 'speeds']

export const Route = createFileRoute('/_authed/races/$racePublicId/$raceSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<RaceDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = raceResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getRace({ id: params.racePublicId, meta: raceDetailMeta, view })
      )
    )
    const draft = response?.draft ?? null
    const raceId = response?.item?.id ?? draft?.subjectId ?? params.racePublicId
    const routeSubject = getAuthoredRouteSubject(raceId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.racePublicId, params.raceSlug, routeSubject)
    ) {
      throw redirect({
        to: '/races/$racePublicId/$raceSlug',
        params: buildRaceRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      draft,
      raceId,
      response,
      view
    }
  },
  component: RaceDetailRoute
})

function RaceDetailRoute() {
  const { raceId, view } = Route.useLoaderData()
  const { racePublicId } = Route.useParams()
  const { data: response } = useGetRace({ id: racePublicId, meta: raceDetailMeta, view })

  return (
    <RaceDetailPage
      draft={response?.draft ?? null}
      raceId={raceId}
      response={response}
      view={view}
    />
  )
}
