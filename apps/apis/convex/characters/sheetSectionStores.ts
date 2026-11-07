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

type CharacterSheetStoreCheck = { characterId: string; token: string; campaignId?: string }

const verifyReference = makeFunctionReference<'mutation', CharacterSheetStoreCheck, null>(
  'characters/sheetSectionDerivation:verify'
)

/** How long a queued derivation waits, so a burst of writes (a Builder session) derives once. */
export const CHARACTER_SHEET_STORE_DELAY_MS = 300

/** How long after a store is due its check runs, and how often it looks again until it ran. */
export const CHARACTER_SHEET_STORE_CHECK_MS = 2_000

export function readCharacterSheetPendingStore(ctx: Pick<QueryCtx, 'db'>, characterId: string) {
  return ctx.db
    .query('characterSheetPendingStores')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}

/**
 * Cancels a queued derivation and its check while they have not started. A derivation already
 * running cannot be cancelled: it checks its token against the pending row instead (`store`).
 */
export async function cancelCharacterSheetPendingStore(
  ctx: SheetStoreScheduling,
  pending: { scheduledId?: Id<'_scheduled_functions'>; checkId?: Id<'_scheduled_functions'> }
) {
  for (const jobId of [pending.scheduledId, pending.checkId]) {
    if (!jobId) continue
    const job = await ctx.db.system.get(jobId)
    if (job?.state.kind === 'pending') await ctx.scheduler.cancel(jobId)
  }
}

/**
 * Schedules a store and its check. A store that lands cancels the check; one that fails rolls that
 * back, so the check runs and queues it once more.
 */
async function scheduleCharacterSheetStore(
  ctx: SheetStoreScheduling,
  store: CharacterSheetStoreCheck,
  delayMs: number
) {
  const { characterId, token, campaignId } = store
  const check = { characterId, token, ...(campaignId === undefined ? {} : { campaignId }) }
  return {
    scheduledId: await ctx.scheduler.runAfter(delayMs, storeReference, { characterId, token }),
    checkId: await ctx.scheduler.runAfter(
      delayMs + CHARACTER_SHEET_STORE_CHECK_MS,
      verifyReference,
      check
    )
  }
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
  const store = { characterId, token: crypto.randomUUID(), retried: false }
  const jobs = await scheduleCharacterSheetStore(ctx, store, CHARACTER_SHEET_STORE_DELAY_MS)
  if (pending)
    await ctx.db.replace('characterSheetPendingStores', pending._id, { ...store, ...jobs })
  else await ctx.db.insert('characterSheetPendingStores', { ...store, ...jobs })
}

/**
 * Starts the Campaign's next waiting store unless one of its stores is already scheduled or
 * running, so the party's stores run one at a time (D215).
 */
export async function scheduleNextCampaignCharacterSheetStore(
  ctx: SheetStoreScheduling,
  campaignId: string,
  delayMs: number
) {
  const chain = await ctx.db
    .query('characterSheetPendingStores')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))
    .collect()
  const next = chain[0]
  if (!next || chain.some((store) => store.scheduledId !== undefined)) return
  await ctx.db.patch(
    'characterSheetPendingStores',
    next._id,
    await scheduleCharacterSheetStore(ctx, next, delayMs)
  )
}

/**
 * Queues the Sheet derivation of every Character assigned to the Campaign, after a write to a
 * Campaign-scope input of their fingerprints: the Campaign content head, the Campaign fields Sheets
 * read, its currency systems, its Character states or assignments (ADR 0041 Amendment 1, D215).
 * The stores run as a chain, one at a time: each starts the next when it commits. A Character whose
 * store is already queued is left alone: that store has not committed, so it reads this write.
 */
export async function scheduleCampaignCharacterSheetSections(
  ctx: SheetStoreScheduling,
  campaignId: string
) {
  for await (const assignment of ctx.db
    .query('campaignCharacterAssignments')
    .withIndex('by_campaignId', (q) => q.eq('campaignId', campaignId))) {
    if (await readCharacterSheetPendingStore(ctx, assignment.characterId)) continue
    await ctx.db.insert('characterSheetPendingStores', {
      characterId: assignment.characterId,
      token: crypto.randomUUID(),
      campaignId,
      retried: false
    })
  }
  await scheduleNextCampaignCharacterSheetStore(ctx, campaignId, CHARACTER_SHEET_STORE_DELAY_MS)
}

/**
 * Runs only when its store did not land and cancel it (D215). Until the store has run it looks
 * again; a store that failed or was canceled while its pending row is still current is queued once
 * more; after a second failure the row is dropped and logged, and the stored sections stay stale
 * (reads derive live). Then its Campaign's next waiting store starts.
 */
export async function verifyCharacterSheetStore(
  ctx: SheetStoreScheduling,
  check: CharacterSheetStoreCheck
) {
  const { characterId, token, campaignId } = check
  const pending = await readCharacterSheetPendingStore(ctx, characterId)
  if (pending?.token === token && pending.scheduledId) {
    const job = await ctx.db.system.get(pending.scheduledId)
    if (job?.state.kind === 'pending' || job?.state.kind === 'inProgress') {
      const checkId = await ctx.scheduler.runAfter(
        CHARACTER_SHEET_STORE_CHECK_MS,
        verifyReference,
        check
      )
      await ctx.db.patch('characterSheetPendingStores', pending._id, { checkId })
      return
    }
    if (!pending.retried) {
      await ctx.db.patch('characterSheetPendingStores', pending._id, {
        ...(await scheduleCharacterSheetStore(ctx, check, 0)),
        retried: true
      })
      return
    }
    console.error(`Character ${characterId} Sheet store failed twice; its sections stay stale.`)
    await ctx.db.delete('characterSheetPendingStores', pending._id)
  }
  if (campaignId !== undefined) await scheduleNextCampaignCharacterSheetStore(ctx, campaignId, 0)
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
