import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  allowedUsernameTerms,
  anchoredUsernameTerms,
  usernameModerationCandidates,
  validateUsername
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

// A plural of a blocked term is blocked too (`bigdicks`).
const blockedWords = anchoredUsernameTerms.flatMap((term) => [term, `${term}s`])
const blockedTerms = indexByRuns(blockedWords)

// Built on the first compound check so isolates that only import the auth options do not pay for it.
let lexicon: { words: ReadonlySet<string>; cleanWordsByRuns: ReadonlyMap<string, string[]> } | undefined
function getLexicon(): NonNullable<typeof lexicon> {
  if (!lexicon) {
    const words = new Set([...usernameWordList.split(' '), ...allowedUsernameTerms])
    const blocked = new Set(blockedWords)
    lexicon = {
      words,
      cleanWordsByRuns: indexByRuns([...words].filter((word) => !blocked.has(word)))
    }
  }
  return lexicon
}

// The candidate is a compound when it reads as a blocked term plus dictionary words (`assmuncher`
// = ass + muncher) and no reading as dictionary words alone (`titanslayer` = titan + slayer) uses
// fewer pieces. A tie keeps the blocked reading: `asslicker` = ass + licker = as + slicker.
// A candidate that is itself a dictionary word (compass, classic) is never a compound.
function isBlockedCompound(candidate: string): boolean {
  const { words, cleanWordsByRuns } = getLexicon()
  if (words.has(candidate)) return false

  // cleanPieces[i] / blockedPieces[i]: the fewest pieces that cover candidate[0, i) with only
  // non-blocked words / with at least one blocked term among words.
  const cleanPieces = Array.from({ length: candidate.length + 1 }, () => Infinity)
  const blockedPieces = [...cleanPieces]
  cleanPieces[0] = 0
  for (let end = 1; end <= candidate.length; end++) {
    for (let start = 0; start < end; start++) {
      const piece = candidate.slice(start, end)
      if (findsPaddedWord(piece, cleanWordsByRuns)) {
        cleanPieces[end] = Math.min(cleanPieces[end] ?? Infinity, (cleanPieces[start] ?? Infinity) + 1)
        blockedPieces[end] = Math.min(
          blockedPieces[end] ?? Infinity,
          (blockedPieces[start] ?? Infinity) + 1
        )
      }
      if (findsPaddedWord(piece, blockedTerms)) {
        blockedPieces[end] = Math.min(
          blockedPieces[end] ?? Infinity,
          Math.min(cleanPieces[start] ?? Infinity, blockedPieces[start] ?? Infinity) + 1
        )
      }
    }
  }
  const blocked = blockedPieces[candidate.length] ?? Infinity
  return blocked !== Infinity && blocked <= (cleanPieces[candidate.length] ?? Infinity)
}

/** The server-authoritative username check: the shared policy plus the dictionary compound check. */
export function validateUsernameOnServer(username: string): {
  username: string
  message: string | null
} {
  const result = validateUsername(username)
  if (result.message !== null) return result

  // The joined form catches a term split across parts (`a_ss_muncher`); it is skipped when every
  // part is a word, since then the parts already read as words (`Assassin_Creed`, `Titan_Fall`).
  const [joined = '', ...parts] = usernameModerationCandidates(result.username)
  const { words } = getLexicon()
  const partsAreWords = parts.length > 0 && parts.every((part) => words.has(part))
  if ((partsAreWords ? parts : [joined, ...parts]).some(isBlockedCompound)) {
    return { username: result.username, message: USERNAME_NOT_ALLOWED_MESSAGE }
  }
  return result
}
