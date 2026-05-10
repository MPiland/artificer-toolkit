import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { SpellDetailPage } from '#domains/spells/pages/SpellDetailPage'

export const Route = createFileRoute('/_authed/spells/$spellId/')({
  component: SpellDetailRoute
})

function SpellDetailRoute() {
  const parentRoute = getRouteApi('/_authed/spells/$spellId')
  const { draft, references, response } = parentRoute.useLoaderData()
  const { spellId } = parentRoute.useParams()

  return <SpellDetailPage draft={draft} references={references} response={response} spellId={spellId} />
}
