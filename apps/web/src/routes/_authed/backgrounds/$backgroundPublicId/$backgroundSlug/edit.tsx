import { createFileRoute, redirect } from '@tanstack/react-router'
import { getBackground, getBackgroundDraft } from '#app/data/backgrounds/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildBackgroundRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { BackgroundEditLoaderData } from '#app/routes/-routeLoaderData'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug/edit')({
  context: () => createAuthoredFormRouteContext('background', 'edit'),
  loader: async ({ context, params }): Promise<BackgroundEditLoaderData> => {
    const client = createServerApi()
    const backgroundId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.backgrounds.list(),
      publicId: params.backgroundPublicId,
      queryClient: context.queryClient,
      subjectKind: 'BACKGROUND'
    })
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, getBackground(backgroundId, client)),
      context.queryClient.ensureQueryData(getBackgroundDraft(backgroundId, client))
    ])
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
        to: '/backgrounds/$backgroundPublicId/$backgroundSlug/edit',
        params: buildBackgroundRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: backgroundId
    })
  },
  component: AuthoringLayout
})
