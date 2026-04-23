import { createServerFn } from '@tanstack/react-start'
import { redirect } from '@tanstack/react-router'
import { getSupabaseServerClient } from '#supabase'

export const logoutFn = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseServerClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return {
      error: true,
      message: error.message
    }
  }

  throw redirect({
    href: '/'
  })
})
