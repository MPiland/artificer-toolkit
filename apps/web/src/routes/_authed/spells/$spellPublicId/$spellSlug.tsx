import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/spells/$spellPublicId/$spellSlug')({
  component: SpellRoute
})

function SpellRoute() {
  return <Outlet />
}
