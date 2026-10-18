import type {
  LiveRoomInputsResponse,
  LiveRoomInputsScope
} from '@artificer-toolkit/schema/api/liveRoomInputs'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { readStoredDefinitionRoot } from '../content/definitionStore'
import { readLiveSessionRulesRevisions } from './rulesRevisions'

/** All System definitions readable as the Campaign owner, bounded before root decoding. */
export async function readRoomDefinitionsPage(
  ctx: QueryCtx,
  campaign: Doc<'campaigns'>,
  scope: Extract<LiveRoomInputsScope, { kind: 'DEFINITIONS' }>
): Promise<Extract<LiveRoomInputsResponse, { kind: 'DEFINITIONS' }>> {
  const position = scope.cursor?.position ?? 0
  const paginationCursor = scope.cursor?.paginationCursor ?? null
  if (position !== 0 && position !== 1) throw new Error('Room input cursor is invalid.')
  const ownerUserId = position === 0 ? undefined : campaign.ownerUserId
  const page = await ctx.db
    .query('reusableDefinitions')
    .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
      q.eq('gameSystemId', campaign.gameSystemId).eq('ownerUserId', ownerUserId)
    )
    .paginate({
      cursor: paginationCursor,
      numItems: 128,
      maximumRowsRead: 129,
      maximumBytesRead: 2 * 1024 * 1024
    })
  if (!page.isDone && page.continueCursor === paginationCursor)
    throw new Error('Room input page cannot advance.')
  const sources = new Map<string, Promise<Doc<'contentSources'> | null>>()
  const definitions = await Promise.all(
    page.page.map(async (record) => {
      if (record.gameSystemId !== campaign.gameSystemId || record.ownerUserId !== ownerUserId)
        throw new Error('Reusable definition System or owner mismatch.')
      let sourceRead = sources.get(record.contentSourceId)
      if (!sourceRead) {
        sourceRead = ctx.db
          .query('contentSources')
          .withIndex('by_publicId', (q) => q.eq('id', record.contentSourceId))
          .unique()
        sources.set(record.contentSourceId, sourceRead)
      }
      const source = await sourceRead
      if (!source) throw new Error('Reusable definition unavailable.')
      const root = readStoredDefinitionRoot(record, source, campaign.ownerUserId)
      return { id: root.id, sourceKind: root.sourceKind, definition: root.current }
    })
  )
  return {
    kind: 'DEFINITIONS',
    revisions: (
      await readLiveSessionRulesRevisions(ctx, {
        systemId: campaign.gameSystemId,
        campaignId: campaign.id
      })
    ).filter((revision) => revision.scope === 'SYSTEM' || revision.scope === 'CAMPAIGN'),
    definitions,
    continueCursor: !page.isDone
      ? { position, paginationCursor: page.continueCursor }
      : position === 0
        ? { position: 1, paginationCursor: null }
        : null
  }
}
