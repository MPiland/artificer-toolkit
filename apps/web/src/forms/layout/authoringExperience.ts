import type { User } from '@supabase/supabase-js'

const AUTHORING_EXPERIENCES = ['guided', 'advanced'] as const

export type AuthoringExperience = (typeof AUTHORING_EXPERIENCES)[number]

const DEFAULT_AUTHORING_EXPERIENCE: AuthoringExperience = 'guided'
export const AUTHORING_EXPERIENCE_METADATA_KEY = 'authoring_experience'

export function readAuthoringExperience(
  user: Pick<User, 'user_metadata'> | null
): AuthoringExperience {
  const value = user?.user_metadata?.[AUTHORING_EXPERIENCE_METADATA_KEY]
  return value === 'advanced' ? 'advanced' : DEFAULT_AUTHORING_EXPERIENCE
}
