import { createClient } from '@supabase/supabase-js'

export interface TrpcContext {
  userId?: string
}

export function createTrpcContext(params: TrpcContext): TrpcContext {
  return params
}

export async function createTrpcContextFromJwt(jwt: string): Promise<TrpcContext> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { data, error } = await supabase.auth.getUser(jwt)
  if (error || !data.user) {
    return {}
  }
  return { userId: data.user.id }
}

