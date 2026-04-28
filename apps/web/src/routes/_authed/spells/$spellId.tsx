import { createFileRoute } from '@tanstack/react-router'
import { getSpell } from '#app/data/spells/queries'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { createServerApi } from '#app/lib/api'
import { SpellDetailPage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/$spellId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    await Promise.all([
      context.queryClient.ensureQueryData(getSpell(params.spellId, client)),
      context.queryClient.ensureQueryData(getSpellReferenceData(client))
    ])
  },
  component: SpellRoute
})

function SpellRoute() {
  const { user } = Route.useRouteContext()
  const { spellId } = Route.useParams()

  return <SpellDetailPage spellId={spellId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
