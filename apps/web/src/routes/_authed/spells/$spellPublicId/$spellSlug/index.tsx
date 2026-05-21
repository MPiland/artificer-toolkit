import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug/')({
  component: SpellDetailRoute
})

function SpellDetailRoute() {
  const parentRoute = getRouteApi('/_authed/spells/$spellPublicId/$spellSlug')
  const {
    draft, references, response, spellId, view
  } = parentRoute.useLoaderData()

  return <SpellDetailPage draft={draft} references={references} response={response} spellId={spellId} view={view} />
}
