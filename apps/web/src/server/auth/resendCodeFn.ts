import { getSupabaseServerClient } from '#supabase'
import { createServerFn } from '@tanstack/react-start'

export const resendCodeFn = createServerFn({ method: 'POST' })
  .inputValidator((d: { email: string }) => d)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()
    const { error } = await supabase.auth.resend({
      email: data.email,
      type: 'signup'
    })
    return error ? { error: true } : { error: false }
  })
