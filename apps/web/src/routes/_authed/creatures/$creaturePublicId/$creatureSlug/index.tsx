import { createFileRoute, redirect } from '@tanstack/react-router'
import { creatureResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getCreature, useGetCreature } from '#app/data/creatures/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import type { CreatureDetailLoaderData } from '#app/routes/-routeLoaderData'
import { CreatureDetailPage } from '#domains/creatures/pages/CreatureDetailPage'

const creatureDetailMeta = [
  'abilities',
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
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = creatureResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getCreature({ id: params.creaturePublicId, meta: creatureDetailMeta, view })
      )
    )
    const draft = response?.draft ?? null
    const creatureId = response?.item?.id ?? draft?.subjectId ?? params.creaturePublicId
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

    return { breadcrumbLabel: routeSubject?.label, creatureId, draft, response, view }
  },
  component: CreatureDetailRoute
})

function CreatureDetailRoute() {
  const { creatureId, view } = Route.useLoaderData()
  const { creaturePublicId } = Route.useParams()
  const { data: response } = useGetCreature({
    id: creaturePublicId,
    meta: creatureDetailMeta,
    view
  })

  return (
    <CreatureDetailPage
      creatureId={creatureId}
      draft={response?.draft ?? null}
      response={response}
      view={view}
    />
  )
}
