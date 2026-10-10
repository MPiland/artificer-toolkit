import type { EncounterTimelineDto } from '@artificer-toolkit/schema/api/encounterData'
import { presentTimelineEntry, type StoredCommand } from './timelineEntries.js'

type TimelineScope = { visibility: 'TABLE' | 'ISSUER' | null; beforeVersion: number }

/** The commands of a stream that `userId` issued. */
async function* issuedBy<Header extends { actorUserId: string }>(
  stream: AsyncIterable<Header>,
  userId: string
): AsyncGenerator<Header> {
  for await (const header of stream) if (header.actorUserId === userId) yield header
}

/** Merges newest-first streams of commands into one newest-first stream. */
async function* mergeNewestFirst<Header extends { version?: number }>(
  streams: readonly AsyncIterable<Header>[]
): AsyncGenerator<Header> {
  const iterators = streams.map((stream) => stream[Symbol.asyncIterator]())
  const heads = await Promise.all(iterators.map((iterator) => iterator.next()))
  for (;;) {
    let next = -1
    for (const [index, head] of heads.entries())
      if (
        !head.done &&
        (next < 0 || (head.value.version ?? 0) > (heads[next]!.value!.version ?? 0))
      )
        next = index
    const head = heads[next]
    if (!head || head.done) return
    yield head.value
    heads[next] = await iterators[next]!.next()
  }
}

/**
 * One newest-first page of a Run's timeline, as the room's pushed session reads it: the GM sees
 * every command; a player sees the TABLE commands and the ISSUER commands they issued, without the
 * GM-only lines; and each Run version has exactly one receipt (CREATE at version zero).
 *
 * `scan` yields the commands of the Run below `beforeVersion` newest first: one visibility index for
 * a player (`visibility` 'TABLE', then 'ISSUER'), all commands for the GM (`visibility` null). `read`
 * produces one scanned command's receipt, or null to end the page early because a read budget is
 * spent; a page cut short keeps its UUID cursor.
 */
export async function readEncounterTimelinePage<
  Header extends { campaignId: string; actorUserId: string; version?: number }
>(input: {
  campaignId: string
  player: boolean
  /** The member reading the page. */
  userId: string
  runVersion: number
  /** The version of the command the page follows; null for the newest page. */
  cursorVersion: number | null
  limit: number
  scan(scope: TimelineScope): AsyncIterable<Header>
  read(header: Header, entriesRead: number): Promise<StoredCommand | null>
}): Promise<EncounterTimelineDto> {
  const entries: EncounterTimelineDto['entries'] = []
  let hasMore = false
  const beforeVersion = input.cursorVersion ?? input.runVersion + 1
  const stream = input.player
    ? mergeNewestFirst([
        input.scan({ visibility: 'TABLE', beforeVersion }),
        issuedBy(input.scan({ visibility: 'ISSUER', beforeVersion }), input.userId)
      ])
    : input.scan({ visibility: null, beforeVersion })
  for await (const header of stream) {
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
    if (
      input.player &&
      (entry.visibility === 'PRIVATE' ||
        (entry.visibility === 'ISSUER' && command.actorUserId !== input.userId))
    )
      throw new Error('Stored Encounter timeline metadata mismatch.')
    entries.push(input.player ? { ...entry, gmLines: [] } : entry)
  }
  return { entries, nextCursor: hasMore ? (entries.at(-1)?.id ?? null) : null }
}
