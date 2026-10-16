import { profanityMatcher } from '../moderation/profanityMatcher.js'

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

const partBoundary = /_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
const letterDigitBoundary = /(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/

function resolveDigits(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, (digit) => moderationDigitSubstitutions[digit] ?? digit)
}

/**
 * The texts a username is moderated as, lowercased with digits read as look-alike letters: the
 * name joined without `_`, its `_` parts, its `_`-and-case parts and, as a further segmentation,
 * those split at letter-digit changes. So `Ass1Muncher` yields `ass`, `a55_muncher` yields `ass`,
 * and `My_aSS` yields `ass` although the case change would split it.
 */
export function usernameModerationCandidates(username: string): string[] {
  const underscoreParts = username.split('_')
  const parts = username.split(partBoundary)
  return [
    ...new Set(
      [
        underscoreParts.join(''),
        ...underscoreParts,
        ...parts,
        ...parts.flatMap((part) => part.split(letterDigitBoundary))
      ].map(resolveDigits)
    )
  ]
}

function normalizeUsername(username: string): string {
  return username.trim()
}

/** Length and character set only. Sign-in uses it, so a later moderation rule never locks an account out. */
export function isUsernameFormatValid(username: string): boolean {
  const normalizedUsername = normalizeUsername(username)
  return (
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    usernamePattern.test(normalizedUsername)
  )
}

export function validateUsername(username: string): { username: string; message: string | null } {
  const normalizedUsername = normalizeUsername(username)

  const isAllowed =
    isUsernameFormatValid(normalizedUsername) &&
    !reservedUsernames.has(normalizedUsername.toLowerCase()) &&
    !usernameModerationCandidates(normalizedUsername).some((text) => profanityMatcher.hasMatch(text))

  return {
    username: normalizedUsername,
    message: isAllowed ? null : USERNAME_NOT_ALLOWED_MESSAGE
  }
}