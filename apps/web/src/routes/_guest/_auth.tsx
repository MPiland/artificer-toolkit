import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { canAuthenticatedUserVisitGuestAuthPath } from './-guestRouteGuards'

export const Route = createFileRoute('/_guest/_auth')({
  ssr: true,
  beforeLoad: ({ context, location }) => {
    if (context.user && !canAuthenticatedUserVisitGuestAuthPath(location.pathname)) {
      throw redirect({ to: '/home' })
    }
  },
  component: GuestAuthLayout
})

function GuestAuthLayout() {
  return <Outlet />
}
