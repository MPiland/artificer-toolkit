import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSpell } from '#app/data/spells/queries'
import { createServerApi } from '#app/lib/api'
import type { SpellDetailReferenceData } from '#app/data/spells/referenceData'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { validateAuthoredDetailSearch } from '#app/routing/authoredDetailSearch'
import { queryKeys } from '#app/lib/queryKeys'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }) => {
    const client = createServerApi()
    const spellId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.spells.list(),
      publicId: params.spellPublicId,
      queryClient: context.queryClient,
      subjectKind: 'SPELL'
    })
    const view = search.view ?? 'active'
    const response = await ensureOptionalActiveContent(context.queryClient, getSpell({
      id: spellId,
      includeDraft: true,
      meta: spellDetailMeta,
      view
    }, client))
    const draft = response?.draft ?? null
    const references: SpellDetailReferenceData = {
      classes: response?.meta?.classes ?? [],
      conditionTypes: response?.meta?.conditionTypes ?? [],
      damageTypes: response?.meta?.damageTypes ?? [],
      magicSchools: response?.meta?.magicSchools ?? []
    }

    const routeSubject = getAuthoredRouteSubject(spellId, response, draft)

    if (routeSubject && !isCanonicalAuthoredRouteHandle(params.spellPublicId, params.spellSlug, routeSubject)) {
      throw redirect({
        to: location.pathname.endsWith('/edit')
          ? '/spells/$spellPublicId/$spellSlug/edit'
          : '/spells/$spellPublicId/$spellSlug',
        params: buildSpellRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { breadcrumbLabel: routeSubject?.label, draft, references, response, spellId, view }
  },
  component: SpellRoute
})

function SpellRoute() {
  return <Outlet />
}
