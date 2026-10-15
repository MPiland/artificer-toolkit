import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  allowedUsernameTerms,
  usernameModerationCandidates,
  validateUsername,
  wholePartUsernameTerms
} from './usernamePolicy.js'
import { usernameWordList } from './usernameWordList.js'

const letterRuns = /(.)\1*/g

// Words grouped by their letters with every run of a repeated letter cut to one, so a name that
// pads a word with repeated letters (`diickmuncher`, `assmuncherrr`) finds it. A name's run may be
// longer than the word's run but never shorter, so `asmuncher` does not read as `ass`.
function indexByRuns(words: Iterable<string>): ReadonlyMap<string, string[]> {
  const index = new Map<string, string[]>()
  for (const word of words) {
    const key = word.replace(/(.)\1+/g, '$1')
    index.set(key, [...(index.get(key) ?? []), word])
  }
  return index
}

function isPaddedForm(text: string, word: string): boolean {
  const wordRuns = word.match(letterRuns) ?? []
  return (text.match(letterRuns) ?? []).every((run, i) => run.length >= (wordRuns[i]?.length ?? 0))
}

function findsPaddedWord(text: string, index: ReadonlyMap<string, string[]>): boolean {
  const key = text.replace(/(.)\1+/g, '$1')
  return (index.get(key) ?? []).some((word) => isPaddedForm(text, word))
}

const blockedTerms = indexByRuns(wholePartUsernameTerms)

// Built on the first compound check so isolates that only import the auth options do not pay for it.
let lexicon: { words: ReadonlySet<string>; wordsByRuns: ReadonlyMap<string, string[]> } | undefined
function getLexicon(): NonNullable<typeof lexicon> {
  if (!lexicon) {
    const words = new Set([...usernameWordList.split(' '), ...allowedUsernameTerms])
    lexicon = { words, wordsByRuns: indexByRuns(words) }
  }
  return lexicon
}

// The candidate splits into a blocked term plus dictionary words (`assmuncher` = ass + muncher).
// A candidate that is itself a dictionary word (compass, classic) is never a compound.
function isBlockedCompound(candidate: string): boolean {
  const { words, wordsByRuns } = getLexicon()
  if (words.has(candidate)) return false

  // reachable[i] / withBlocked[i]: candidate[0, i) is covered by pieces, and (withBlocked) at
  // least one piece is a blocked term.
  const reachable = Array.from({ length: candidate.length + 1 }, () => false)
  const withBlocked = [...reachable]
  reachable[0] = true
  for (let end = 1; end <= candidate.length; end++) {
    for (let start = 0; start < end; start++) {
      const piece = candidate.slice(start, end)
      const isBlocked = findsPaddedWord(piece, blockedTerms)
      const isWord = findsPaddedWord(piece, wordsByRuns)
      if (!isBlocked && !isWord) continue
      if (reachable[start]) {
        reachable[end] ||= isWord
        withBlocked[end] ||= isBlocked
      }
      if (withBlocked[start]) withBlocked[end] = true
    }
  }
  return withBlocked[candidate.length] ?? false
}

/** The server-authoritative username check: the shared policy plus the dictionary compound check. */
export function validateUsernameOnServer(username: string): {
  username: string
  message: string | null
} {
  const result = validateUsername(username)
  if (
    result.message === null &&
    usernameModerationCandidates(result.username).some(isBlockedCompound)
  ) {
    return { username: result.username, message: USERNAME_NOT_ALLOWED_MESSAGE }
  }
  return result
}
