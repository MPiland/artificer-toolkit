import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  usernameModerationParts,
  validateUsername,
  wholePartUsernameTerms
} from './usernamePolicy.js'
import { usernameWordList } from './usernameWordList.js'

const dictionary = new Set(usernameWordList.split(' '))
const blockedTerms = new Set(wholePartUsernameTerms)

// A part splits into a blocked term plus dictionary words (`assmuncher` = ass + muncher). A part
// that is itself a dictionary word (compass, classic) is never a compound.
function isBlockedCompound(part: string): boolean {
  const letters = part.replace(/[^a-z]/g, '').replace(/(.)\1{2,}/g, '$1$1')
  if (dictionary.has(letters)) return false

  // reachable[i] / withBlocked[i]: letters[0, i) is covered by pieces, and (withBlocked) at least
  // one piece is a blocked term.
  const reachable = Array.from({ length: letters.length + 1 }, () => false)
  const withBlocked = [...reachable]
  reachable[0] = true
  for (let end = 1; end <= letters.length; end++) {
    for (let start = 0; start < end; start++) {
      const piece = letters.slice(start, end)
      const isBlocked = blockedTerms.has(piece)
      const isWord = dictionary.has(piece)
      if (!isBlocked && !isWord) continue
      if (reachable[start]) {
        reachable[end] ||= isWord
        withBlocked[end] ||= isBlocked
      }
      if (withBlocked[start]) withBlocked[end] = true
    }
  }
  return withBlocked[letters.length] ?? false
}

/** The server-authoritative username check: the shared policy plus the dictionary compound check. */
export function validateUsernameOnServer(username: string): {
  username: string
  message: string | null
} {
  const result = validateUsername(username)
  if (result.message === null && usernameModerationParts(result.username).some(isBlockedCompound)) {
    return { username: result.username, message: USERNAME_NOT_ALLOWED_MESSAGE }
  }
  return result
}
