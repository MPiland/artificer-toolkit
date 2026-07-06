import { createFileRoute, redirect } from '@tanstack/react-router'
import { getFeat, getFeatDraft } from '#app/data/feats/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildFeatRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { FeatEditLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug/edit')({
  context: () => createAuthoredFormRouteContext('feat', 'edit'),
  loader: async ({ context, params }): Promise<FeatEditLoaderData> => {
    const client = createServerApi()
    const featId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.feats.list(),
      publicId: params.featPublicId,
      queryClient: context.queryClient,
      subjectKind: 'FEAT'
    })
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, getFeat(featId, client)),
      context.queryClient.ensureQueryData(getFeatDraft(featId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(featId, response, draft)

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
      subjectId: featId
    })
  },
  component: AuthoringLayout
})
