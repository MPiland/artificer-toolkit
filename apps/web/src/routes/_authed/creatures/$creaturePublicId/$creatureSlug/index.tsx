import { createFileRoute, redirect } from '@tanstack/react-router'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { getCreature } from '#app/data/creatures/queries'
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
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { CreatureDetailLoaderData } from '#app/routes/-routeLoaderData'
import { CreatureDetailPage } from '#domains/creatures/pages/CreatureDetailPage'

const creatureDetailMeta = [
  'challengeRatings',
  'conditionTypes',
  'creatureTypes',
  'damageTypes',
  'equipment',
  'speeds'
]

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({
    context,
    deps: search,
    location,
    params
  }): Promise<CreatureDetailLoaderData> => {
    const client = createServerApi()
    const creatureId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.creatures.list(),
      publicId: params.creaturePublicId,
      queryClient: context.queryClient,
      subjectKind: 'CREATURE'
    })
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = await ensureOptionalActiveContent(
      context.queryClient,
      getCreature(
        {
          id: creatureId,
          meta: creatureDetailMeta,
          view
        },
        client
      )
    )
    const draft = response?.draft ?? null
    const references: Pick<
      AuthoredContentReferenceData,
      | 'challengeRatings'
      | 'conditionTypes'
      | 'creatureTypes'
      | 'damageTypes'
      | 'equipment'
      | 'speeds'
    > = {
      challengeRatings: response?.meta?.challengeRatings ?? [],
      conditionTypes: response?.meta?.conditionTypes ?? [],
      creatureTypes: response?.meta?.creatureTypes ?? [],
      damageTypes: response?.meta?.damageTypes ?? [],
      equipment: response?.meta?.equipment ?? [],
      speeds: response?.meta?.speeds ?? []
    }
    const routeSubject = getAuthoredRouteSubject(creatureId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.creaturePublicId, params.creatureSlug, routeSubject)
    ) {
      throw redirect({
        to: '/creatures/$creaturePublicId/$creatureSlug',
        params: buildCreatureRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { breadcrumbLabel: routeSubject?.label, creatureId, draft, references, response, view }
  },
  component: CreatureDetailRoute
})

function CreatureDetailRoute() {
  const { creatureId, draft, references, response, view } = Route.useLoaderData()

  return (
    <CreatureDetailPage
      creatureId={creatureId}
      draft={draft}
      references={references}
      response={response}
      view={view}
    />
  )
}
