import { createFileRoute, redirect } from '@tanstack/react-router'
import { getCreature, getCreatureDraft } from '#app/data/creatures/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { CreatureEditLoaderData } from '#app/routes/-routeLoaderData'
import { loadAuthoredRouteSystem } from '#app/routes/-authoredRouteSystem'
import { AuthoringLayout } from '#forms'
import {
  createAuthoredFormRouteContext,
  createAuthoredFormRouteLoaderData
} from '#forms/layout/authoredFormRouteContext'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug/edit')({
  context: () => createAuthoredFormRouteContext('creature', 'edit'),
  loader: async ({ context, params }): Promise<CreatureEditLoaderData> => {
    const client = createServerApi()
    const creatureId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.creatures.list(),
      publicId: params.creaturePublicId,
      queryClient: context.queryClient,
      subjectKind: 'CREATURE'
    })
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, getCreature(creatureId, client)),
      context.queryClient.ensureQueryData(getCreatureDraft(creatureId, client))
    ])
    const routeSubject = getAuthoredRouteSubject(creatureId, response, draft)
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      client,
      response?.item?.systemId ?? draft?.systemId
    )

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.creaturePublicId, params.creatureSlug, routeSubject)
    ) {
      throw redirect({
        to: '/creatures/$creaturePublicId/$creatureSlug/edit',
        params: buildCreatureRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return createAuthoredFormRouteLoaderData({
      breadcrumbLabel: routeSubject?.label,
      draft,
      response,
      subjectId: creatureId,
      system
    })
  },
  component: AuthoringLayout
})
