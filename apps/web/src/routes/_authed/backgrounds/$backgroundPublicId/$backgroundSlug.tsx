import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/backgrounds/$backgroundPublicId/$backgroundSlug')({
  component: BackgroundRoute
})

function BackgroundRoute() {
  return <Outlet />
}
