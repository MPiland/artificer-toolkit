import { createFileRoute, redirect } from '@tanstack/react-router'
import { featResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getFeat } from '#app/data/feats/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import type { FeatEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug/edit')({
  context: () => createAuthoredFormRouteContext('feat', 'edit'),
  loader: async ({ context, params }): Promise<FeatEditLoaderData> => {
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getFeat(params.featPublicId)),
      context.queryClient.ensureQueryData(getFeat({ id: params.featPublicId, view: 'draft' }))
    ])
    const response = featResponseDtoSchema.parse(active)
    const draft = featResponseDtoSchema.parse(working)?.draft ?? null
    const featId = response?.item?.id ?? draft?.subjectId ?? params.featPublicId
    const routeSubject = getAuthoredRouteSubject(featId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      response?.item?.systemId ?? draft?.systemId
    )

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.featPublicId, params.featSlug, routeSubject)
    ) {
      throw redirect({
        to: '/feats/$featPublicId/$featSlug/edit',
        params: buildFeatRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: featId,
      system
    })
  },
  component: AuthoringLayout
})
