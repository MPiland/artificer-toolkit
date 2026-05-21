import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getFeat } from '#app/data/feats/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }) => {
    const client = createServerApi()
    const featId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.feats.list(),
      publicId: params.featPublicId,
      queryClient: context.queryClient,
      subjectKind: 'FEAT'
    })
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = await ensureOptionalActiveContent(context.queryClient, getFeat({
      id: featId,
      includeDraft: true,
      view
    }, client))
    const draft = response?.draft ?? null
    const routeSubject = getAuthoredRouteSubject(featId, response, draft)

    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.featPublicId, params.featSlug, routeSubject)) {
      throw redirect({
        to: location.pathname.endsWith('/edit')
          ? '/feats/$featPublicId/$featSlug/edit'
          : '/feats/$featPublicId/$featSlug',
        params: buildFeatRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { breadcrumbLabel: routeSubject?.label, draft, featId, response, view }
  },
  component: FeatRoute
})

function FeatRoute() {
  return <Outlet />
}
