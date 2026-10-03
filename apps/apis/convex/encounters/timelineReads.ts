import {
  readReceiptHeader,
  readReceiptLedger,
  readReceiptLedgerMetadata,
  type DecodedReceiptLedger,
  type ReceiptLedgerLoader
} from '../lib/receiptLedgers'
import { RECEIPT_LEDGER_MAX_BYTES } from '@artificer-toolkit/schema/projections/receiptLedgerPersistence'
import type { z } from 'zod'
import type { Validator } from 'convex/values'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  encounterTimelineDtoSchema,
  getEncounterTimelineInputDtoSchema,
  type EncounterTimelineDto
} from '@artificer-toolkit/schema/api/encounterData'
import { query } from '../lib/queries'
import { requireIdentity } from '../lib/identity'
import { requireCampaignAuthority } from '../campaigns/authority'
import { readCampaignRunState } from '@artificer-toolkit/encounter-persistence/documents'
import { presentTimelineEntry } from '@artificer-toolkit/encounter-persistence/timelineEntries'
import { readEncounterTimelinePage } from '@artificer-toolkit/encounter-persistence/timelinePages'

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
    readCampaignRunState(row, campaign)
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
    const ledgers = new Map<string, Promise<DecodedReceiptLedger>>()
    const loadLedger: ReceiptLedgerLoader = (ledgerCtx, ledgerId) => {
      let ledger = ledgers.get(ledgerId)
      if (!ledger) {
        ledger = readReceiptLedger(ledgerCtx, ledgerId)
        ledgers.set(ledgerId, ledger)
      }
      return ledger
    }
    if (cursor) {
      if (cursor.campaignId !== campaign.id)
        throw new Error('Stored Encounter command ownership mismatch.')
      presentTimelineEntry(await readReceiptHeader(ctx, 'encounterRunCommands', cursor, loadLedger))
    }
    const outputLedgers = new Set<string>()
    let ledgerBytesRead = 0
    let bytesRead = 0
    // The cursor ledger has its own allowance; output ledgers share one 4 MiB budget.
    // Reusing the loader keeps cursor and output reads of the same ledger together.
    // Short pages preserve the UUID cursor and never cap the Run's history or creative content.
    return encounterTimelineDtoSchema.parse(
      await readEncounterTimelinePage({
        campaignId: campaign.id,
        player,
        runVersion: row.version,
        cursorVersion: cursor?.version ?? null,
        limit: input.limit,
        scan: ({ visibility, beforeVersion }) =>
          visibility
            ? ctx.db
                .query('encounterRunCommands')
                .withIndex('by_encounterId_visibility_version', (q) =>
                  q
                    .eq('encounterId', row.id)
                    .eq('visibility', visibility)
                    .lt('version', beforeVersion)
                )
                .order('desc')
            : ctx.db
                .query('encounterRunCommands')
                .withIndex('by_encounterId_version', (q) =>
                  q.eq('encounterId', row.id).lt('version', beforeVersion)
                )
                .order('desc'),
        read: async (header, entriesRead) => {
          if (entriesRead > 0 && bytesRead >= 4 * 1024 * 1024) return null
          if (!outputLedgers.has(header.ledgerId)) {
            const metadata = await readReceiptLedgerMetadata(ctx, header.ledgerId)
            if (entriesRead > 0 && ledgerBytesRead + metadata.byteLength > RECEIPT_LEDGER_MAX_BYTES)
              return null
            ledgerBytesRead += metadata.byteLength
            outputLedgers.add(header.ledgerId)
          }
          const command = await readReceiptHeader(ctx, 'encounterRunCommands', header, loadLedger)
          bytesRead += new TextEncoder().encode(JSON.stringify(command)).byteLength
          return command
        }
      })
    )
  }
})
