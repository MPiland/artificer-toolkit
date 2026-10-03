import type { EncounterTimelineDto } from '@artificer-toolkit/schema/api/encounterData'
import { presentTimelineEntry, type StoredCommand } from './timelineEntries.js'

/**
 * One newest-first page of a Run's timeline, as Convex's `timelineReads` and the room's pushed
 * session both read it: players see only TABLE commands, the GM every command, and each Run version
 * has exactly one receipt (CREATE at version zero).
 *
 * `scan` yields the commands of the Run below `beforeVersion` newest first: the member's
 * visibility index for a player (`visibility` 'TABLE'), all commands for the GM (`visibility`
 * null). `read` produces one scanned command's receipt, or null to end the page early because a
 * read budget is spent; a page cut short keeps its UUID cursor.
 */
export async function readEncounterTimelinePage<Header extends { campaignId: string }>(input: {
  campaignId: string
  player: boolean
  runVersion: number
  /** The version of the command the page follows; null for the newest page. */
  cursorVersion: number | null
  limit: number
  scan(scope: { visibility: 'TABLE' | null; beforeVersion: number }): AsyncIterable<Header>
  read(header: Header, entriesRead: number): Promise<StoredCommand | null>
}): Promise<EncounterTimelineDto> {
  const entries: EncounterTimelineDto['entries'] = []
  let hasMore = false
  for await (const header of input.scan({
    visibility: input.player ? 'TABLE' : null,
    beforeVersion: input.cursorVersion ?? input.runVersion + 1
  })) {
    if (entries.length >= input.limit) {
      hasMore = true
      break
    }
    if (header.campaignId !== input.campaignId)
      throw new Error('Stored Encounter command ownership mismatch.')
    const command = await input.read(header, entries.length)
    if (!command) {
      hasMore = true
      break
    }
    const entry = presentTimelineEntry(command)
    if (input.player && entry.visibility !== 'TABLE')
      throw new Error('Stored Encounter timeline metadata mismatch.')
    entries.push(entry)
  }
  return { entries, nextCursor: hasMore ? (entries.at(-1)?.id ?? null) : null }
}
