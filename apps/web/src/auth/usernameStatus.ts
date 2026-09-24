import type { AccountUsernameStatusDto } from '@artificer-toolkit/schema/api/account'
import { validateUsername } from '@artificer-toolkit/shared/account/username'
import { betterAuthClient } from './betterAuthClient'

export async function getUsernameStatus(username: string): Promise<AccountUsernameStatusDto> {
  if (validateUsername(username).message) return { status: 'not_allowed' }
  const result = await betterAuthClient.isUsernameAvailable({ username })
  if (result.error || !result.data) {
    throw new Error('Username availability is temporarily unavailable.')
  }
  return { status: result.data.available ? 'available' : 'taken' }
}
