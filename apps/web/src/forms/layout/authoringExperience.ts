import type { AuthSessionUserDto, AuthoringExperience } from '@artificer-toolkit/schema/api/auth'

export type { AuthoringExperience } from '@artificer-toolkit/schema/api/auth'

const DEFAULT_AUTHORING_EXPERIENCE: AuthoringExperience = 'guided'

export function readAuthoringExperience(
  user: Pick<AuthSessionUserDto, 'authoringExperience'> | null
): AuthoringExperience {
  return user?.authoringExperience ?? DEFAULT_AUTHORING_EXPERIENCE
}
