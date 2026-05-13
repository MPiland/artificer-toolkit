import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import type { AuthoredContentReferenceData } from '#app/data/contentReferences'
import { getCreature } from '#app/data/creatures/queries'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { createServerApi } from '#app/lib/api'
import { queryKeys } from '#app/lib/queryKeys'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle,
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildCreatureRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'

const creatureDetailMeta = ['challengeRatings', 'conditionTypes', 'creatureTypes', 'damageTypes', 'speeds']

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }) => {
    const client = createServerApi()
    const creatureId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.creatures.list(),
      publicId: params.creaturePublicId,
      queryClient: context.queryClient,
      subjectKind: 'CREATURE'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(context.queryClient, getCreature({
      id: creatureId,
      includeDraft: true,
      meta: creatureDetailMeta,
      view
    }, client))
    const draft = response?.draft ?? null
    const references: Pick<AuthoredContentReferenceData, 'challengeRatings' | 'conditionTypes' | 'creatureTypes' | 'damageTypes' | 'speeds'> = {
      challengeRatings: response?.meta?.challengeRatings ?? [],
      conditionTypes: response?.meta?.conditionTypes ?? [],
      creatureTypes: response?.meta?.creatureTypes ?? [],
      damageTypes: response?.meta?.damageTypes ?? [],
      speeds: response?.meta?.speeds ?? []
    }
    const routeSubject = getAuthoredRouteSubject(creatureId, response, draft)

    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.creaturePublicId, params.creatureSlug, routeSubject)) {
      throw redirect({
        to: location.pathname.endsWith('/edit')
          ? '/creatures/$creaturePublicId/$creatureSlug/edit'
          : '/creatures/$creaturePublicId/$creatureSlug',
        params: buildCreatureRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { breadcrumbLabel: routeSubject?.label, creatureId, draft, references, response, view }
  },
  component: CreatureRoute
})

function CreatureRoute() {
  return <Outlet />
}
