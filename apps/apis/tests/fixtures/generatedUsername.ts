import { validateUsernameOnServer } from '@artificer-toolkit/shared/account/usernameServer'

const maxDraws = 50

function randomSuffix() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/**
 * Draws suffixes until the server-authoritative username policy, the one sign-up enforces, accepts
 * `prefix + suffix`; the policy is imported, never copied.
 */
export function generateValidUsername(prefix: string, nextSuffix: () => string = randomSuffix) {
  for (let draw = 0; draw < maxDraws; draw++) {
    const suffix = nextSuffix()
    const username = `${prefix}${suffix}`
    if (validateUsernameOnServer(username).message === null) return { username, suffix }
  }
  throw new Error(`No allowed username found for prefix "${prefix}" after ${maxDraws} draws.`)
}
