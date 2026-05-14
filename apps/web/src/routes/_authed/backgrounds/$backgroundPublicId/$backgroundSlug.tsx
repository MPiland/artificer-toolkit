import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getAuthoredContentReferenceData } from '#app/data/contentReferences'
import { getBackground } from '#app/data/backgrounds/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }) => {
    const client = createServerApi()
    const backgroundId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.backgrounds.list(),
      publicId: params.backgroundPublicId,
      queryClient: context.queryClient,
      subjectKind: 'BACKGROUND'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(context.queryClient, getBackground({
      id: backgroundId,
      includeDraft: true,
      view
    }, client))
    const draft = response?.draft ?? null
    const references = await context.queryClient.ensureQueryData(getAuthoredContentReferenceData(response?.item?.systemId ?? draft?.systemId, client))
    const routeSubject = getAuthoredRouteSubject(backgroundId, response, draft)

    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.backgroundPublicId, params.backgroundSlug, routeSubject)) {
      throw redirect({
        to: location.pathname.endsWith('/edit')
          ? '/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
          : '/backgrounds/$backgroundPublicId/$backgroundSlug',
        params: buildBackgroundRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { backgroundId, breadcrumbLabel: routeSubject?.label, draft, references, response, view }
  },
  component: BackgroundRoute
})

function BackgroundRoute() {
  return <Outlet />
}
