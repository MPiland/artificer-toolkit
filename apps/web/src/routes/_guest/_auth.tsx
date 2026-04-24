import { Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_guest/_auth')({
  component: GuestAuthLayout
})

function GuestAuthLayout() {
  return <Outlet />
}
