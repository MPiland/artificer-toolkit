import { makeFunctionReference } from 'convex/server'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

// Queued Sheet section stores (ADR 0041). Kept apart from the fingerprint and derivation code
// because every tracked mutation queues through here (`lib/mutations.ts` triggers) and loads it.

/** Triggers queue through the unwrapped writer, so only these two are required. */
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

/**
 * How long Campaign-scope background work (the party's Sheet stores, the departure reconcile step)
 * waits. The write that queues it also reruns every open Campaign subscription at once; on a
 * shared runner those reruns time-slice against the 1 s limit, so queued mutations start after the
 * subscribers settle (D216).
 */
export const CAMPAIGN_BACKGROUND_SETTLE_MS = 1_500

/**
 * How long a Campaign-scope Sheet store waits: the settle delay, then the ordinary debounce. A
 * departure reconcile step runs at the settle point and its own write replaces the store of the
 * Character it moves, so that Character derives once instead of before and after the step (D216).
 */
export const CAMPAIGN_SHEET_STORE_DELAY_MS =
  CAMPAIGN_BACKGROUND_SETTLE_MS + CHARACTER_SHEET_STORE_DELAY_MS

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
async function cancelCharacterSheetPendingStore(
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
 * Clears a Character's pending store once its Sheet is stored or the Character is deleted. A
 * Campaign's chain starts its next store once this transaction commits (D215).
 */
export async function settleCharacterSheetPendingStore(
  ctx: SheetStoreScheduling,
  pending: Doc<'characterSheetPendingStores'>
) {
  await cancelCharacterSheetPendingStore(ctx, pending)
  await ctx.db.delete('characterSheetPendingStores', pending._id)
  if (pending.campaignId !== undefined)
    await scheduleNextCampaignCharacterSheetStore(ctx, pending.campaignId, 0)
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
  characterId: string,
  delayMs = CHARACTER_SHEET_STORE_DELAY_MS
) {
  const pending = await readCharacterSheetPendingStore(ctx, characterId)
  if (pending) await cancelCharacterSheetPendingStore(ctx, pending)
  // A store that replaces one in a Campaign's chain stays in it, so it starts the next on landing.
  const store = {
    characterId,
    token: crypto.randomUUID(),
    retried: false,
    ...(pending?.campaignId === undefined ? {} : { campaignId: pending.campaignId })
  }
  const jobs = await scheduleCharacterSheetStore(ctx, store, delayMs)
  if (pending)
    await ctx.db.replace('characterSheetPendingStores', pending._id, { ...store, ...jobs })
  else await ctx.db.insert('characterSheetPendingStores', { ...store, ...jobs })
  return jobs.scheduledId
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
  await scheduleNextCampaignCharacterSheetStore(ctx, campaignId, CAMPAIGN_SHEET_STORE_DELAY_MS)
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
