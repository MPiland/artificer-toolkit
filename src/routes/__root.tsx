import { createRootRouteWithContext } from '@tanstack/react-router'
import { QueryClient } from '@tanstack/react-query'
import Layout from '../Layout/Layout'
import type { FormType } from '~/types'
import { supabase } from '~/supabase'
import type { Session } from '@supabase/supabase-js'

export interface RootContext {
  queryClient: QueryClient
  form?: {
    type?: FormType
    id?: string
  }
  systemPref: string
  session: Session | null
}

export const Route = createRootRouteWithContext<RootContext>()({
  loader: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    return { session }
  },
  component: Layout,
})
