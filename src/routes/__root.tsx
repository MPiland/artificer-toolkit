import { createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { AuthOptionsType } from '../pages/auth/AuthProvider'
import Layout from '../layout/Layout'

export interface RootContext {
  queryClient: QueryClient
  auth: AuthOptionsType
}

export const Route = createRootRouteWithContext<RootContext>()({
  component: Layout,
})
