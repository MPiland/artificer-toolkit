import { createFileRoute, redirect } from '@tanstack/react-router'
import { backgroundResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getBackground } from '#app/data/backgrounds/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import type { BackgroundEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute(
  '/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit'
)({
  context: () => createAuthoredFormRouteContext('background', 'edit'),
  loader: async ({ context, params }): Promise<BackgroundEditLoaderData> => {
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getBackground(params.backgroundPublicId)),
      context.queryClient.ensureQueryData(
        getBackground({ id: params.backgroundPublicId, view: 'draft' })
      )
    ])
    const response = backgroundResponseDtoSchema.parse(active)
    const draft = backgroundResponseDtoSchema.parse(working)?.draft ?? null
    const backgroundId = response?.item?.id ?? draft?.subjectId ?? params.backgroundPublicId
    const routeSubject = getAuthoredRouteSubject(backgroundId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      response?.item?.systemId ?? draft?.systemId
    )

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(
        params.backgroundPublicId,
        params.backgroundSlug,
        routeSubject
      )
    ) {
      throw redirect({
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
        params: buildBackgroundRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: backgroundId,
      system
    })
  },
  component: AuthoringLayout
})
