import { createFileRoute, Outlet } from '@tanstack/react-router'

export const Route = createFileRoute('/_authed/campaigns/$campaignPublicId/$campaignSlug')({
  component: () => <Outlet />
})
