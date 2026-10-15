import {
  DataSet,
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
  parseRawPattern
} from 'obscenity'

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

// Q22 tiers. Short ambiguous terms are refused only as a whole part, so Cassandra, Dickens and
// Cummings pass; the server also refuses them inside an unbroken compound (usernameServerPolicy).
const wholePartPatterns: Record<string, string[]> = {
  ass: ['|ass|'],
  dick: ['|dick|', '|dicks|', '|dck|'],
  cum: ['|cum|'],
  tit: ['|tit|', '|tits|', '|titt', '|tiddies', '|tities']
}
export const wholePartUsernameTerms = Object.keys(wholePartPatterns)
// Dictionary words built on a whole-part term. The server compound check exempts dictionary words.
const profaneCompounds = [
  'asshole',
  'asshat',
  'asswipe',
  'assclown',
  'dumbass',
  'jackass',
  'smartass',
  'fatass',
  'dickhead',
  'dickwad',
  'dickface',
  'dickweed',
  'cumshot',
  'cumslut',
  'cumdump'
]
// Known false positives of the unambiguous terms.
const allowedTerms = ['penistone', 'fukushima', 'fukuoka', 'fukui']

const dataset = [
  ...wholePartUsernameTerms.map((term) => ({ term, patterns: wholePartPatterns[term] ?? [] })),
  ...profaneCompounds.map((term) => ({ term, patterns: [term] }))
].reduce(
  (set, { term, patterns }) =>
    set.addPhrase((phrase) =>
      patterns
        .reduce((builder, raw) => builder.addPattern(parseRawPattern(raw)), phrase)
        .setMetadata({ originalWord: term })
    ),
  new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    .removePhrasesIf(({ metadata }) => wholePartUsernameTerms.includes(metadata?.originalWord ?? ''))
)
const { blacklistedTerms, whitelistedTerms } = dataset.build()
const matcher = new RegExpMatcher({
  blacklistedTerms,
  whitelistedTerms: [...(whitelistedTerms ?? []), ...allowedTerms],
  ...englishRecommendedTransformers
})

const partBoundary = /_|(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/
const letterDigitBoundary = /(?<=[A-Za-z])(?=[0-9])|(?<=[0-9])(?=[A-Za-z])/

function resolveDigits(text: string): string {
  return text
    .toLowerCase()
    .replace(/[0-9]/g, (digit) => moderationDigitSubstitutions[digit] ?? digit)
}

/**
 * Parts of a username, lowercased with digits read as look-alike letters. Splits at `_`, at case
 * changes, and (as a second segmentation) at letter-digit changes, so `Ass1Muncher` yields `ass`
 * and `a55_muncher` yields `ass`.
 */
export function usernameModerationParts(username: string): string[] {
  const parts = username.split(partBoundary)
  return [...parts, ...parts.flatMap((part) => part.split(letterDigitBoundary))].map(resolveDigits)
}

function hasBlockedTerm(username: string): boolean {
  const joined = resolveDigits(username.replaceAll('_', ''))
  return [joined, ...usernameModerationParts(username)].some((text) => matcher.hasMatch(text))
}

function normalizeUsername(username: string): string {
  return username.trim()
}

export function validateUsername(username: string): { username: string; message: string | null } {
  const normalizedUsername = normalizeUsername(username)

  const isAllowed =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    usernamePattern.test(normalizedUsername) &&
    !reservedUsernames.has(normalizedUsername.toLowerCase()) &&
    !hasBlockedTerm(normalizedUsername)

  return {
    username: normalizedUsername,
    message: isAllowed ? null : USERNAME_NOT_ALLOWED_MESSAGE
  }
}
