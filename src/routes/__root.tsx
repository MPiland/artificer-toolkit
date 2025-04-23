import { createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import { AuthOptionsType } from '@/pages/auth/AuthProvider'
import Layout from '../Layout/Layout'
import type { FormType } from '@/types/form'

export interface RootContext {
  queryClient: QueryClient
  auth: AuthOptionsType
  form?: {
    type?: FormType
    id?: string
  }
  systemPref: string
}

export const Route = createRootRouteWithContext<RootContext>()({
  component: Layout,
})
