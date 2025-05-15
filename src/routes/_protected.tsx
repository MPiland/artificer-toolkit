import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Suspense } from 'react'
import Loading from '@/components/Loading'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context, location }) => {
    const { isAuthenticating, user, isLoading } = context.auth

    console.log({ isAuthenticating, user, isLoading })

    if (!isAuthenticating && !user && !isLoading) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
        },
      })
    }
  },
  component: () => (
    <Suspense fallback={<Loading />}>
      <Outlet />
    </Suspense>
  ),
})
