/** Only failures deliberately caused by the offline and departure assertions are expected. */
export function isExpectedSceneLiveDiagnostic(entry: string, tabletopPath: string): boolean {
  if (
    entry.startsWith('player change while player disconnected: console WebSocket connection to ') &&
    entry.includes('.convex.cloud/api/') &&
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
  if (
    /^player verify departed player refusal: (?:campaigns\/(?:queries:get|sessions:get)|encounters\/(?:projectionReads:(?:list|pendingPrepared)|pendingReads:pendingRuleOccurrence|sceneBindings:get)|scenes\/(?:presentations:get|recipientReads:header)): \[Request ID: [a-f0-9]+\] Server Error\nUncaught Error: (?:Uncaught Error: )?Campaign not found\.\n+$/.test(
      entry
    )
  )
    return true
  if (!entry.startsWith('player verify departed player refusal: ')) return false
  return (
    (entry.includes('console [CONVEX A(liveSessions/tickets:issue)]') &&
      entry.includes('Uncaught Error: Campaign not found.')) ||
    entry === `player verify departed player refusal: response 404 ${tabletopPath}` ||
    entry ===
      'player verify departed player refusal: console Failed to load resource: the server responded with a status of 404 ()'
  )
}
