import type { AuthSessionUserDto } from '@artificer-toolkit/schema/api/auth'

export function hasPendingInvitationSetup(user: Pick<AuthSessionUserDto, 'registrationCompleted'>) {
  return !user.registrationCompleted
}
