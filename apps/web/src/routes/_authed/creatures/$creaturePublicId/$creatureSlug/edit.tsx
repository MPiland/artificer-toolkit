import { createFileRoute, redirect } from '@tanstack/react-router'
import { creatureResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { creatureAuthoringInputDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { getCreature } from '#app/data/creatures/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
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
    const [active, working] = await Promise.all([
      context.queryClient.ensureQueryData(getCreature(params.creaturePublicId)),
      context.queryClient.ensureQueryData(
        getCreature({ id: params.creaturePublicId, view: 'draft' })
      )
    ])
    const response = creatureResponseDtoSchema.parse(active)
    const draft = creatureResponseDtoSchema.parse(working)?.draft ?? null
    const creatureId = response?.item?.id ?? draft?.subjectId ?? params.creaturePublicId
    const routeSubject = getAuthoredRouteSubject(creatureId, response, draft)
    const parsedDraft = creatureAuthoringInputDtoSchema.safeParse(draft?.payload)
    const currentCreature = parsedDraft.success ? parsedDraft.data : response?.item
    const system = await loadAuthoredRouteSystem(
      context.queryClient,
      currentCreature?.systemId ?? draft?.systemId
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
