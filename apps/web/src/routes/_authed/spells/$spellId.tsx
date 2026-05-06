import { Outlet, createFileRoute } from '@tanstack/react-router'
import { ensureOptionalActiveContent } from '#app/data/optionalActiveContent'
import { getSpell, getSpellDraft } from '#app/data/spells/queries'
import { getSpellReferenceData } from '#app/data/spells/referenceData'
import { createServerApi } from '#app/lib/api'

export const Route = createFileRoute('/_authed/spells/$spellId')({
  loader: async ({ context, params }) => {
    const client = createServerApi(context.accessToken)
    const activeSpellQuery = getSpell(params.spellId, client)
    const [response, draft] = await Promise.all([
      ensureOptionalActiveContent(context.queryClient, activeSpellQuery),
      context.queryClient.ensureQueryData(getSpellDraft(params.spellId, client))
    ])

    const references = await context.queryClient.ensureQueryData(getSpellReferenceData(client))

    return { draft, references, response }
  },
  component: SpellRoute
})

function SpellRoute() {
  return <Outlet />
}
