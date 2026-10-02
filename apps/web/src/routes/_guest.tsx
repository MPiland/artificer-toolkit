import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_guest')({
  ssr: true,
  component: GuestLayout
})

function GuestLayout() {
  return <Outlet />
}
