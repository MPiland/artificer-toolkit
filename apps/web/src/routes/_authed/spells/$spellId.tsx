import { Outlet, createFileRoute } from '@tanstack/react-router'
import { getSpell, getSpellDraft } from '#app/data/spells/queries'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/spells/$spellId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    await Promise.all([
      context.queryClient.ensureQueryData(getSpell(params.spellId, client)),
      context.queryClient.ensureQueryData(getSpellDraft(params.spellId, client)),
      context.queryClient.ensureQueryData(getSpellReferenceData(client))
    ])
  },
  component: SpellRoute
})

function SpellRoute() {
  return <Outlet />
}
