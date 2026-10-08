import { Profanity } from '@2toad/profanity'

export const USERNAME_NOT_ALLOWED_MESSAGE = "That username isn't allowed."

const usernamePattern = /^[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*$/
const reservedUsernames = new Set([
  'admin',
  'moderator',
  'support',
  'system',
  'root',
  'artificer',
  'artificer_toolkit'
])
const moderationDigitSubstitutions: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '2': 'z',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '6': 'g',
  '7': 't',
  '8': 'b',
  '9': 'g'
}
const profanity = new Profanity({ languages: ['en'], wholeWord: false })

function normalizeUsername(username: string): string {
  return username.trim()
}

export function validateUsername(username: string): { username: string; message: string | null } {
  const normalizedUsername = normalizeUsername(username)
  const comparisonUsername = normalizedUsername.toLowerCase()
  const moderationUsername = comparisonUsername
    .replaceAll('_', '')
    .replace(/[0-9]/g, (digit) => moderationDigitSubstitutions[digit] ?? digit)

  const isAllowed =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    usernamePattern.test(normalizedUsername) &&
    !reservedUsernames.has(comparisonUsername) &&
    !profanity.exists(comparisonUsername) &&
    !profanity.exists(moderationUsername)

  return {
    username: normalizedUsername,
    message: isAllowed ? null : USERNAME_NOT_ALLOWED_MESSAGE
  }
}
