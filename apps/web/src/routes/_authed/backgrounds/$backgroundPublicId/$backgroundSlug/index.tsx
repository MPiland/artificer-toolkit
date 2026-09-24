import { createFileRoute, redirect } from '@tanstack/react-router'
import { backgroundResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getBackground, useGetBackground } from '#app/data/backgrounds/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
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
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = backgroundResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getBackground({
          id: params.backgroundPublicId,
          meta: backgroundDetailMeta,
          view
        })
      )
    )
    const draft = response?.draft ?? null
    const backgroundId = response?.item?.id ?? draft?.subjectId ?? params.backgroundPublicId
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
  const { backgroundId, view } = Route.useLoaderData()
  const { backgroundPublicId } = Route.useParams()
  const { data: response } = useGetBackground({
    id: backgroundPublicId,
    meta: backgroundDetailMeta,
    view
  })

  return (
    <BackgroundDetailPage
      backgroundId={backgroundId}
      draft={response?.draft ?? null}
      references={{
        currencies: response?.meta?.currencies ?? [],
        equipment: response?.meta?.equipment ?? [],
        languages: response?.meta?.languages ?? [],
        skills: response?.meta?.skills ?? []
      }}
      response={response}
      view={view}
    />
  )
}
