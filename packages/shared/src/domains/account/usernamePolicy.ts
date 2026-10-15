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
const replacedEnglishPhrases = [
  { term: 'ass', patterns: ['|ass|'] },
  { term: 'dick', patterns: ['|dick|', '|dicks|', '|dck|'] },
  { term: 'cum', patterns: ['|cum|', '|cums|'] },
  // The transformers collapse repeated letters, so `titty` is matched as `tity`.
  { term: 'tit', patterns: ['|tit|', '|tits|', '|tity', '|titie'] }
]
// Dictionary words built on a whole-part term. The server compound check exempts dictionary words.
const profaneCompounds = [
  'asshole',
  'asshat',
  'asswipe',
  'assclown',
  'assman',
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
// Known false positives of the matcher.
export const allowedUsernameTerms = [
  'penistone',
  'fukushima',
  'fukuoka',
  'fukui',
  'cockpit',
  'dickson',
  'dickinson',
  'hitchcock',
  'middlesex',
  'shuttlecock'
]

// Terms the matcher anchors to a word boundary on at least one side only match at a part edge. The
// server compound check looks for them inside an unbroken part, so the set comes from the same dataset.
const englishAnchoredTerms: string[] = []
const dataset = [
  ...replacedEnglishPhrases,
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
    .removePhrasesIf(({ metadata, patterns }) => {
      const term = metadata?.originalWord ?? ''
      if (replacedEnglishPhrases.some((replaced) => replaced.term === term)) return true
      if (patterns.some((p) => p.requireWordBoundaryAtStart || p.requireWordBoundaryAtEnd)) {
        englishAnchoredTerms.push(term)
      }
      return false
    })
)
export const anchoredUsernameTerms = [
  ...replacedEnglishPhrases.map(({ term }) => term),
  ...englishAnchoredTerms
]
const { blacklistedTerms, whitelistedTerms } = dataset.build()
const matcher = new RegExpMatcher({
  blacklistedTerms,
  whitelistedTerms: [...(whitelistedTerms ?? []), ...allowedUsernameTerms],
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

export function validateUsername(username: string): { username: string; message: string | null } {
  const normalizedUsername = normalizeUsername(username)

  const isAllowed =
    normalizedUsername.length >= 3 &&
    normalizedUsername.length <= 30 &&
    usernamePattern.test(normalizedUsername) &&
    !reservedUsernames.has(normalizedUsername.toLowerCase()) &&
    !usernameModerationCandidates(normalizedUsername).some((text) => matcher.hasMatch(text))

  return {
    username: normalizedUsername,
    message: isAllowed ? null : USERNAME_NOT_ALLOWED_MESSAGE
  }
}
