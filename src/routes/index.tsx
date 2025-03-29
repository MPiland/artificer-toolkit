import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context }) => {
    const { isAuthenticating, user, isLoading } = context.auth
    if (!isAuthenticating && !user && !isLoading) {
      throw redirect({
        to: '/',
      })
    }
  },
  component: () => <Outlet />,
})
