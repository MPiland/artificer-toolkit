import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/races/$racePublicId/$raceSlug')({
  component: RaceRoute
})

function RaceRoute() {
  return <Outlet />
}
