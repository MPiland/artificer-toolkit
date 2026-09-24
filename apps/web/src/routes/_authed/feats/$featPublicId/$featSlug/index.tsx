import { createFileRoute, redirect } from '@tanstack/react-router'
import { featResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getFeat, useGetFeat } from '#app/data/feats/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import type { FeatDetailLoaderData } from '#app/routes/-routeLoaderData'
import { FeatDetailPage } from '#domains/feats/pages/FeatDetailPage'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<FeatDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = featResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(getFeat({ id: params.featPublicId, view }))
    )
    const draft = response?.draft ?? null
    const featId = response?.item?.id ?? draft?.subjectId ?? params.featPublicId
    const routeSubject = getAuthoredRouteSubject(featId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.featPublicId, params.featSlug, routeSubject)
    ) {
      throw redirect({
        to: '/feats/$featPublicId/$featSlug',
        params: buildFeatRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return {
      breadcrumbLabel: routeSubject?.label,
      draft,
      featId,
      response,
      view
    }
  },
  component: FeatDetailRoute
})

function FeatDetailRoute() {
  const { featId, view } = Route.useLoaderData()
  const { featPublicId } = Route.useParams()
  const { data: response } = useGetFeat({ id: featPublicId, view })

  return (
    <FeatDetailPage
      draft={response?.draft ?? null}
      featId={featId}
      response={response}
      view={view}
    />
  )
}
