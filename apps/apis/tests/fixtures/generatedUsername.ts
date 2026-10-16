import { validateUsername } from '@artificer-toolkit/shared/account/username'

const maxDraws = 50

function randomSuffix() {
  return crypto.randomUUID().replaceAll('-', '').slice(0, 12)
}

/** Draws suffixes until the real username policy accepts `prefix + suffix`; the policy is imported, never copied. */
export function generateValidUsername(prefix: string, nextSuffix: () => string = randomSuffix) {
  for (let draw = 0; draw < maxDraws; draw++) {
    const suffix = nextSuffix()
    const username = `${prefix}${suffix}`
    if (validateUsername(username).message === null) return { username, suffix }
  }
  throw new Error(`No allowed username found for prefix "${prefix}" after ${maxDraws} draws.`)
}
