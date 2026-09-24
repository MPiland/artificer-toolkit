import { createFileRoute, redirect } from '@tanstack/react-router'
import { raceResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { raceAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/race'
import { getRace } from '#app/data/races/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
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
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getRace(params.racePublicId)),
      context.queryClient.ensureQueryData(getRace({ id: params.racePublicId, view: 'draft' }))
    ])
    const response = raceResponseDtoSchema.parse(active)
    const draft = raceResponseDtoSchema.parse(working)?.draft ?? null
    const raceId = response?.item?.id ?? draft?.subjectId ?? params.racePublicId
    const routeSubject = getAuthoredRouteSubject(raceId, response, draft)
    const parsedDraft = raceAuthoringInputDtoSchema.safeParse(draft?.payload)
    const currentRace = parsedDraft.success ? parsedDraft.data : response?.item
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      currentRace?.systemId ?? draft?.systemId
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
