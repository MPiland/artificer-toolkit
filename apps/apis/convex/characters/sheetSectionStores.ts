import { makeFunctionReference } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

// Queued Sheet section stores (ADR 0041). Kept apart from the fingerprint and derivation code
// because every tracked mutation queues through here (`lib/mutations.ts` triggers) and loads it.

/** Content-head marking queues through the unwrapped writer, so only these two are required. */
type SheetStoreScheduling = Pick<MutationCtx, 'db' | 'scheduler'>

const storeReference = makeFunctionReference<
  'mutation',
  { characterId: string; token: string },
  null
>('characters/sheetSectionDerivation:store')

/** How long a queued derivation waits, so a burst of writes (a Builder session) derives once. */
export const CHARACTER_SHEET_STORE_DELAY_MS = 300

export function readCharacterSheetPendingStore(ctx: Pick<QueryCtx, 'db'>, characterId: string) {
  return ctx.db
    .query('characterSheetPendingStores')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}

/**
 * Cancels a queued derivation that has not started. One already running cannot be cancelled: it
 * checks its token against the pending row instead (`store`).
 */
export async function cancelCharacterSheetPendingStore(
  ctx: SheetStoreScheduling,
  pending: { scheduledId: Id<'_scheduled_functions'> }
) {
  const job = await ctx.db.system.get(pending.scheduledId)
  if (job?.state.kind === 'pending') await ctx.scheduler.cancel(pending.scheduledId)
}

/**
 * Queues the Sheet's derivation after a Character write; reads derive live until it lands. A newer
 * write cancels the pending derivation and queues its own, so a Character has one at a time.
 */
export async function scheduleCharacterSheetSections(
  ctx: SheetStoreScheduling,
  characterId: string
) {
  const pending = await readCharacterSheetPendingStore(ctx, characterId)
  if (pending) await cancelCharacterSheetPendingStore(ctx, pending)
  const token = crypto.randomUUID()
  const scheduledId = await ctx.scheduler.runAfter(CHARACTER_SHEET_STORE_DELAY_MS, storeReference, {
    characterId,
    token
  })
  if (pending)
    await ctx.db.replace('characterSheetPendingStores', pending._id, {
      characterId,
      scheduledId,
      token
    })
  else await ctx.db.insert('characterSheetPendingStores', { characterId, scheduledId, token })
}

/**
 * Queues the Sheet derivation of every Character assigned to the Campaign, after a write to a
 * Campaign-scope input of their fingerprints: the Campaign content head, the Campaign fields Sheets
 * read, its currency systems, its Character states or assignments (ADR 0041 amendment, D215). Bounded by the party; a Character that
 * is not ACTIVE stores nothing when its derivation runs.
 */
export async function scheduleCampaignCharacterSheetSections(
  ctx: SheetStoreScheduling,
  campaignId: string
) {
  for await (const assignment of ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId)))
    await scheduleCharacterSheetSections(ctx, assignment.characterId)
}

/** The Campaign fields a Sheet derivation reads; notebook and counter patches leave them alone. */
export function characterSheetCampaignFields(campaign: Doc<'campaigns'>) {
  return {
    id: campaign.id,
    ownerUserId: campaign.ownerUserId,
    gameSystemId: campaign.gameSystemId,
    status: campaign.status,
    contentMaturity: campaign.contentMaturity ?? null,
    attunementSlotOverride: campaign.attunementSlotOverride ?? null,
    primaryRulesCatalogueId: campaign.primaryRulesCatalogueId,
    additionalRulesCatalogueIds: campaign.additionalRulesCatalogueIds
  }
}
