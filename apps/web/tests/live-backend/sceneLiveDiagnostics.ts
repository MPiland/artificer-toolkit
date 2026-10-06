/** Reads a departed player's still-open subscriptions or reload retry; the Campaign is gone for them (D81, D87). */
const departedPlayerReads =
  '(?:campaigns\\/(?:queries:get|sessions:get)|encounters\\/(?:activeReads:active|projectionReads:(?:list|pendingPrepared)|pendingReads:pendingRuleOccurrence|sceneBindings:get)|scenes\\/(?:presentations:get|recipientReads:header|showings:current))'
const campaignNotFound = 'Server Error\\nUncaught Error: (?:Uncaught Error: )?Campaign not found\\.'
/** The browser console's rendering of a failed query. */
const consoleDeparture = new RegExp(
  `^player verify departed player refusal: console (?:Error: )?\\[CONVEX Q\\(${departedPlayerReads}\\)\\](?: \\[Request ID: [a-f0-9]+\\])? ${campaignNotFound}(?:\\n\\s+(?:Called by client|at [^\\n]+))*\\s*$`
)
/** The sync socket's `QueryFailed` frame, labelled with the query's name. */
const socketDeparture = new RegExp(
  `^player verify departed player refusal: ${departedPlayerReads}: \\[Request ID: [a-f0-9]+\\] ${campaignNotFound}\\n+$`
)

/** Only failures deliberately caused by the offline and departure assertions are expected. */
export function isExpectedSceneLiveDiagnostic(entry: string, tabletopPath: string): boolean {
  if (
    entry.startsWith('player change while player disconnected: console WebSocket connection to ') &&
    /'wss?:\/\/[^'/]+\/api\/[^'/]+\/sync'/.test(entry) &&
    entry.includes('net::ERR_INTERNET_DISCONNECTED')
  )
    return true
  if (
    /^(owner|player) change while player disconnected: console \[CONVEX A\(scenes\/recipientActions:entities\)\]/.test(
      entry
    ) &&
    entry.includes('Uncaught Error: Live Scene snapshot changed before recipient hydration.')
  )
    return true
  if (consoleDeparture.test(entry) || socketDeparture.test(entry)) return true
  if (!entry.startsWith('player verify departed player refusal: ')) return false
  return (
    (entry.includes('console [CONVEX A(liveSessions/tickets:issue)]') &&
      entry.includes('Uncaught Error: Campaign not found.')) ||
    entry === `player verify departed player refusal: response 404 ${tabletopPath}` ||
    entry ===
      'player verify departed player refusal: console Failed to load resource: the server responded with a status of 404 ()'
  )
}
