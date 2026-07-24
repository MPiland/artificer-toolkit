import { createFileRoute, redirect } from '@tanstack/react-router'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getRace } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'
import type { RaceDetailLoaderData } from '#app/routes/-routeLoaderData'
import { RaceDetailPage } from '#domains/races/pages/RaceDetailPage'

const raceDetailMeta = ['heritages', 'races', 'speeds']

export const Route = createFileRoute('/_authed/races/$racePublicId/$raceSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, params }): Promise<RaceDetailLoaderData> => {
    const client = createServerApi()
    const raceId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.races.list(),
      publicId: params.racePublicId,
      queryClient: context.queryClient,
      subjectKind: 'RACE'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(
      context.queryClient,
      getRace(
        {
          id: raceId,
          meta: raceDetailMeta,
          view
        },
        client
      )
    )
    const parentResponse =
      response?.item?.category === 'SUBRACE'
        ? await ensureOptionalActiveContent(
            context.queryClient,
            getRace(
              {
                id: response.item.parentRaceId,
                meta: raceDetailMeta,
                view: 'active'
              },
              client
            )
          )
        : null
    const draft = response?.draft ?? null
    const references: Pick<AuthoredContentReferenceData, 'heritages' | 'races' | 'speeds'> = {
      heritages: response?.meta?.heritages ?? [],
      races: response?.meta?.races ?? [],
      speeds: response?.meta?.speeds ?? []
    }
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
      parentResponse,
      raceId,
      references,
      response,
      view
    }
  },
  component: RaceDetailRoute
})

function RaceDetailRoute() {
  const { draft, parentResponse, raceId, references, response, view } = Route.useLoaderData()

  return (
    <RaceDetailPage
      draft={draft}
      parentResponse={parentResponse}
      raceId={raceId}
      references={references}
      response={response}
      view={view}
    />
  )
}
