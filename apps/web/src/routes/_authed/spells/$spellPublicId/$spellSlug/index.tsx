import { createFileRoute, redirect } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSpell } from '#app/data/spells/queries'
import type { SpellDetailReferenceData } from '#app/data/spells/referenceData'
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
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import { resolveAuthoredRouteSubjectId } from '#app/routing/authoredRouteSubjectId'
import type { SpellDetailLoaderData } from '#app/routes/-routeLoaderData'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<SpellDetailLoaderData> => {
    const client = createServerApi()
    const spellId = await resolveAuthoredRouteSubjectId({
      client,
      listQueryKey: queryKeys.content.spells.list(),
      publicId: params.spellPublicId,
      queryClient: context.queryClient,
      subjectKind: 'SPELL'
    })
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = await ensureOptionalActiveContent(
      context.queryClient,
      getSpell(
        {
          id: spellId,
          includeDraft: true,
          meta: spellDetailMeta,
          view
        },
        client
      )
    )
    const draft = response?.draft ?? null
    const references: SpellDetailReferenceData = {
      classes: response?.meta?.classes ?? [],
      conditionTypes: response?.meta?.conditionTypes ?? [],
      damageTypes: response?.meta?.damageTypes ?? [],
      magicSchools: response?.meta?.magicSchools ?? []
    }
    const routeSubject = getAuthoredRouteSubject(spellId, response, draft)

    if (
      routeSubject &&
      !isCanonicalAuthoredRouteHandle(params.spellPublicId, params.spellSlug, routeSubject)
    ) {
      throw redirect({
        to: '/spells/$spellPublicId/$spellSlug',
        params: buildSpellRouteParams(routeSubject.publicId, routeSubject.label),
        replace: true
      })
    }

    return { breadcrumbLabel: routeSubject?.label, draft, references, response, spellId, view }
  },
  component: SpellDetailRoute
})

function SpellDetailRoute() {
  const {
    draft, references, response, spellId, view
  } = Route.useLoaderData()

  return <SpellDetailPage draft={draft} references={references} response={response} spellId={spellId} view={view} />
}
