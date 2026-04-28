import { createFileRoute } from '@tanstack/react-router'
import { SpellDetailPage } from '#domains/spells'

export const Route = createFileRoute('/_authed/spells/$spellId/edit')({
  component: EditSpellRoute
})

function EditSpellRoute() {
  const { user } = Route.useRouteContext()
  const { spellId } = Route.useParams()

  return <SpellDetailPage spellId={spellId} mode='edit' userId={user?.id ?? 'unknown-user'} />
}
