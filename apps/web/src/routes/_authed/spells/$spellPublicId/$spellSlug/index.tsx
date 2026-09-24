import { createFileRoute, redirect } from '@tanstack/react-router'
import { spellResponseDtoSchema } from '@artificer-toolkit/schema/api/content'
import { getSpell, useGetSpell } from '#app/data/spells/queries'
import {
  getAuthoredRouteSubject,
  isCanonicalAuthoredRouteHandle
} from '#app/routing/authoredRouteHandles'
import {
  resolveAuthoredDetailView,
  validateAuthoredDetailSearch
} from '#app/routing/authoredDetailSearch'
import { buildSpellRouteParams } from '#app/routing/authoredRouteParams'
import type { SpellDetailLoaderData } from '#app/routes/-routeLoaderData'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

const spellDetailMeta = ['classes', 'conditionTypes', 'damageTypes', 'magicSchools']

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/')({
  validateSearch: validateAuthoredDetailSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps: search, location, params }): Promise<SpellDetailLoaderData> => {
    const view = resolveAuthoredDetailView(search, location.pathname)
    const response = spellResponseDtoSchema.parse(
      await context.queryClient.ensureQueryData(
        getSpell({ id: params.spellPublicId, meta: spellDetailMeta, view })
      )
    )
    const draft = response?.draft ?? null
    const spellId = response?.item?.id ?? draft?.subjectId ?? params.spellPublicId
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

    return { breadcrumbLabel: routeSubject?.label, draft, response, spellId, view }
  },
  component: SpellDetailRoute
})

function SpellDetailRoute() {
  const { spellId, view } = Route.useLoaderData()
  const { spellPublicId } = Route.useParams()
  const { data: response } = useGetSpell({ id: spellPublicId, meta: spellDetailMeta, view })

  return (
    <SpellDetailPage
      draft={response?.draft ?? null}
      response={response}
      spellId={spellId}
      view={view}
    />
  )
}
