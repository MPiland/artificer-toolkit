import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/feats/$featPublicId/$featSlug')({
  component: FeatRoute
})

function FeatRoute() {
  return <Outlet />
}
