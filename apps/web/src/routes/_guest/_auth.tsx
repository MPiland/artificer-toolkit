import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'

export function canAuthenticatedUserVisitGuestAuthPath(pathname: string) {
  return pathname === '/update-password'
}

export const Route = createFileRoute('/_guest/_auth')({
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
