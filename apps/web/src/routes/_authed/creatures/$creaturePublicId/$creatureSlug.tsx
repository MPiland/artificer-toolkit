import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/creatures/$creaturePublicId/$creatureSlug')({
  component: CreatureRoute
})

function CreatureRoute() {
  return <Outlet />
}
