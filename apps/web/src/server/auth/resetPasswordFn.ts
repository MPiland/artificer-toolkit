import { getSupabaseServerClient } from '~utils'
import { createServerFn } from '@tanstack/react-start'

export const resetPasswordFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { password: string }) => d)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.updateUser({ password: data.password })
    if (error) return { error: true }
    return { error: false }
  })
