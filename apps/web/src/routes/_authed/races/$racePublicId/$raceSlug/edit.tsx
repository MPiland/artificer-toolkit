import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getRace, getRaceDraft } from '#app/data/races/queries'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildRaceRouteParams } from '#app/routing/authoredRouteParams'
import type { RaceEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/races/$racePublicId/$raceSlug/edit')({
  context: () => createAuthoredFormRouteContext('race', 'edit'),
  loader: async ({ context, params }): Promise<RaceEditLoaderData> => {
    const client = createServerApi()
    const raceId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.races.list(),
      publicId: params.racePublicId,
      queryClient: context.queryClient,
      subjectKind: 'RACE'
    })
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, getRace(raceId, client)),
      context.queryClient.ensureQueryData(getRaceDraft(raceId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(raceId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      client,
      response?.item?.systemId ?? draft?.systemId
    )

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.racePublicId, params.raceSlug, routeSubject)
    ) {
      throw redirect({
        to: '/races/$racePublicId/$raceSlug/edit',
        params: buildRaceRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: raceId,
      system
    })
  },
  component: AuthoringLayout
})
