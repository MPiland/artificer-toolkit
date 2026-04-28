import { createFileRoute } from '@tanstack/react-router'
import { SpellDetailPage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/$spellId/')({
  component: SpellViewRoute
})

function SpellViewRoute() {
  const { user } = Route.useRouteContext()
  const { spellId } = Route.useParams()

  return <SpellDetailPage spellId={spellId} mode='view' userId={user?.id ?? 'unknown-user'} />
}
