import { allowedProfanityTerms, anchoredProfanityTerms } from '../moderation/profanityMatcher.js'
import { collapseLetterRuns } from './letterRuns.js'
import {
  USERNAME_NOT_ALLOWED_MESSAGE,
  usernameModerationCandidates,
  validateUsername
} from './usernamePolicy.js'
import { usernameWordList } from './usernameWordList.js'

const letterRuns = /(.)\1*/g

// Words are looked up by their letters with every run of a repeated letter cut to one, so a name
// that pads a word with repeated letters (`diickmuncher`, `assmuncherrr`) finds it. A name's run
// may be longer than the word's run but never shorter, so `asmuncher` does not read as `ass`.
function isPaddedForm(text: string, word: string): boolean {
  const wordRuns = word.match(letterRuns) ?? []
  return (text.match(letterRuns) ?? []).every((run, i) => run.length >= (wordRuns[i]?.length ?? 0))
}

// The word list is sorted by collapsed runs, so the words sharing one are a contiguous range found
// by binary search over the string itself. Indexing its 72 000 words in a Set and a Map kept 21 MiB
// of heap per Convex isolate, which the sign-up request left behind for the next request to find
// as an IsolateNotClean memory carry-over (QUALITY-19.2).
function dictionaryWordsWithRuns(runs: string): string[] {
  const list = usernameWordList
  const entryEnd = (start: number) => {
    const space = list.indexOf(' ', start)
    return space === -1 ? list.length : space
  }
  // Both bounds are entry starts; `hi` may be one past the end, the start of no entry.
  let lo = 0
  let hi = list.length + 1
  while (lo < hi) {
    const middle = (lo + hi) >>> 1
    const start = list.lastIndexOf(' ', middle - 1) + 1
    const end = entryEnd(start)
    if (collapseLetterRuns(list.slice(start, end)) < runs) lo = end + 1
    else hi = start
  }
  const words: string[] = []
  for (let start = lo; start <= list.length;) {
    const end = entryEnd(start)
    const word = list.slice(start, end)
    if (collapseLetterRuns(word) !== runs) break
    words.push(word)
    start = end + 1
  }
  return words
}

function wordsWithRuns(runs: string): string[] {
  return [
    ...dictionaryWordsWithRuns(runs),
    ...allowedProfanityTerms.filter((term) => collapseLetterRuns(term) === runs)
  ]
}

function isWord(text: string): boolean {
  return wordsWithRuns(collapseLetterRuns(text)).includes(text)
}

// A plural of a blocked term is blocked too (`bigdicks`).
const blockedWords = anchoredProfanityTerms.flatMap((term) => [term, `${term}s`])
const blockedWordsByRuns = blockedWords.reduce((index, word) => {
  const runs = collapseLetterRuns(word)
  return index.set(runs, [...(index.get(runs) ?? []), word])
}, new Map<string, string[]>())

function findsPaddedCleanWord(text: string): boolean {
  return wordsWithRuns(collapseLetterRuns(text)).some(
    (word) => !blockedWords.includes(word) && isPaddedForm(text, word)
  )
}

function findsPaddedBlockedWord(text: string): boolean {
  return (blockedWordsByRuns.get(collapseLetterRuns(text)) ?? []).some((word) =>
    isPaddedForm(text, word)
  )
}

// The candidate is a compound when it reads as a blocked term plus dictionary words (`assmuncher`
// = ass + muncher) and no reading as dictionary words alone (`titanslayer` = titan + slayer) uses
// fewer pieces. A tie keeps the blocked reading: `asslicker` = ass + licker = as + slicker.
// A candidate that is itself a dictionary word (compass, classic) is never a compound.
function isBlockedCompound(candidate: string): boolean {
  if (isWord(candidate)) return false

  // cleanPieces[i] / blockedPieces[i]: the fewest pieces that cover candidate[0, i) with only
  // non-blocked words / with at least one blocked term among words.
  const cleanPieces = Array.from({ length: candidate.length + 1 }, () => Infinity)
  const blockedPieces = [...cleanPieces]
  cleanPieces[0] = 0
  for (let end = 1; end <= candidate.length; end++) {
    for (let start = 0; start < end; start++) {
      const piece = candidate.slice(start, end)
      if (findsPaddedCleanWord(piece)) {
        cleanPieces[end] = Math.min(
          cleanPieces[end] ?? Infinity,
          (cleanPieces[start] ?? Infinity) + 1
        )
        blockedPieces[end] = Math.min(
          blockedPieces[end] ?? Infinity,
          (blockedPieces[start] ?? Infinity) + 1
        )
      }
      if (findsPaddedBlockedWord(piece)) {
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
  const partsAreWords = parts.length > 0 && parts.every(isWord)
  if ((partsAreWords ? parts : [joined, ...parts]).some(isBlockedCompound)) {
    return { username: result.username, message: USERNAME_NOT_ALLOWED_MESSAGE }
  }
  return result
}
