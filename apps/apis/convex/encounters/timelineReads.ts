import type { z } from 'zod'
import type { Validator } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  encounterTimelineDtoSchema,
  getEncounterTimelineInputDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounterData'
import { query } from '../_generated/server'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readValidatedRunProjection } from './documents'
import { presentTimelineEntry } from './timelineEntries'

export const timeline = query({
  args: zodToConvexFields(getEncounterTimelineInputDtoSchema.shape),
  get returns(): Validator<EncounterTimelineDto, 'required', string> {
    return zodToConvex<z.core.$ZodType<EncounterTimelineDto>>(encounterTimelineDtoSchema)
  },
  handler: async (ctx, args): Promise<EncounterTimelineDto> => {
    const input = getEncounterTimelineInputDtoSchema.parse({
      ...args,
      encounterId: args.encounterId.toLowerCase(),
      ...(args.cursor === undefined ? {} : { cursor: args.cursor.toLowerCase() })
    })
    const { userId } = await requireIdentity(ctx)
    const row = await ctx.db
      .query('encounterRuns')
      .withIndex('by_publicId', (q) => q.eq('id', input.encounterId))
      .unique()
    if (!row) throw new Error('Encounter is unavailable.')
    const { campaign, membership } = await requireCampaignAuthority(ctx, row.campaignId, userId)
    readValidatedRunProjection(row, campaign)
    const missingMetadata = await ctx.db
      .query('encounterRunCommands')
      .withIndex('by_encounterId_visibility_version', (q) =>
        q.eq('encounterId', row.id).eq('visibility', undefined)
      )
      .first()
    if (missingMetadata) throw new Error('Encounter timeline backfill is incomplete.')
    const player = membership.role !== 'OWNER'
    const cursor = input.cursor
      ? await ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId_id', (q) => q.eq('encounterId', row.id).eq('id', input.cursor))
          .unique()
      : null
    if (input.cursor && (!cursor || (player && cursor.visibility !== 'TABLE')))
      return { entries: [], nextCursor: null }
    if (cursor) {
      if (cursor.campaignId !== campaign.id)
        throw new Error('Stored Encounter command ownership mismatch.')
      presentTimelineEntry(cursor)
    }
    // Each committed Run version has exactly one receipt, including CREATE at version zero.
    const beforeVersion = cursor?.version ?? row.version + 1
    const commands = player
      ? ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId_visibility_version', (q) =>
            q.eq('encounterId', row.id).eq('visibility', 'TABLE').lt('version', beforeVersion)
          )
      : ctx.db
          .query('encounterRunCommands')
          .withIndex('by_encounterId_version', (q) =>
            q.eq('encounterId', row.id).lt('version', beforeVersion)
          )
    const entries: EncounterTimelineDto['entries'] = []
    let bytesRead = 0
    let hasMore = false
    // Leave room for authority, Run and cursor reads plus one receipt of lookahead.
    // Short pages preserve the UUID cursor and never cap the Run's history or creative content.
    for await (const command of commands.order('desc')) {
      if (entries.length >= input.limit || (entries.length > 0 && bytesRead >= 4 * 1024 * 1024)) {
        hasMore = true
        break
      }
      bytesRead += new TextEncoder().encode(JSON.stringify(command)).byteLength
      if (command.campaignId !== campaign.id)
        throw new Error('Stored Encounter command ownership mismatch.')
      const entry = presentTimelineEntry(command)
      if (player && entry.visibility !== 'TABLE')
        throw new Error('Stored Encounter timeline metadata mismatch.')
      entries.push(entry)
    }
    return encounterTimelineDtoSchema.parse({
      entries,
      nextCursor: hasMore ? (entries.at(-1)?.id ?? null) : null
    })
  }
})
