import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import Loading from '@/components/Loading/Loading'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context }) => {
    const { isAuthenticating, user, isLoading } = context.auth

    if (!isAuthenticating && !user && !isLoading) {
      throw redirect({
        to: '/$auth',
        params: { auth: 'sign-in' },
      })
    }
  },
  component: () => (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  ),
})
