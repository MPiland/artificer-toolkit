import { createFileRoute, redirect } from '@tanstack/react-router'
import { getBackground } from '#app/data/backgrounds/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { BackgroundDetailLoaderData } from '#app/routes/-routeLoaderData'
import { BackgroundDetailPage } from '#domains/backgrounds/pages/BackgroundDetailPage'

const backgroundDetailMeta = ['currencies', 'equipment', 'languages', 'skills']

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({
    context,
    deps: search,
    location,
    params
  }): Promise<BackgroundDetailLoaderData> => {
    const client = createServerApi()
    const backgroundId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.backgrounds.list(),
      publicId: params.backgroundPublicId,
      queryClient: context.queryClient,
      subjectKind: 'BACKGROUND'
    })
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = await ensureOptionalActiveContent(
      context.queryClient,
      getBackground(
        {
          id: backgroundId,
          meta: backgroundDetailMeta,
          view
        },
        client
      )
    )
    const draft = response?.draft ?? null
    const references = {
      currencies: response?.meta?.currencies ?? [],
      equipment: response?.meta?.equipment ?? [],
      languages: response?.meta?.languages ?? [],
      skills: response?.meta?.skills ?? []
    }
    const routeSubject = getAuthoredRouteSubject(backgroundId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(
        params.backgroundPublicId,
        params.backgroundSlug,
        routeSubject
      )
    ) {
      throw redirect({
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug',
        params: buildBackgroundRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { backgroundId, breadcrumbLabel: routeSubject?.label, draft, references, response, view }
  },
  component: BackgroundDetailRoute
})

function BackgroundDetailRoute() {
  const { backgroundId, draft, references, response, view } = Route.useLoaderData()

  return (
    <BackgroundDetailPage
      backgroundId={backgroundId}
      draft={draft}
      references={references}
      response={response}
      view={view}
    />
  )
}
