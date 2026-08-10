import type { User } from '@supabase/supabase-js'

export function hasPendingInvitationSetup(user: Pick<User, 'app_metadata' | 'invited_at'>) {
  return Boolean(user.invited_at && user.app_metadata.registration_completed !== true)
}
