import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { components, internal } from '../../convex/_generated/api'
import { readySheetFixture } from './readyCharacter'
import { createPartyUser } from './partyPlayer'
import type { ReviewAccount, ReviewContext } from '../developmentReviewData'
import {
  REVIEW_ADMIN,
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SPARES
} from '../developmentReviewDataScenarios'
import type { ReviewRoster } from '../developmentReviewTarget'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  roomDevelopmentClient,
  seedRoomContentSnapshots
} from './localRoomWorker'

type TestConvex = Awaited<ReturnType<typeof readySheetFixture>>['t']

/** The review accounts and room-aware context `seedReviewData` runs against inside convex-test. */
export async function reviewDataHarness() {
  const { t } = await readySheetFixture()
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  // The Characters are built from the SRD corpus, as on the seeded local backend.
  await t.action(internal.content.seed.seed, {})
  await attachRoomWorker(t)
  const context = await reviewSetContext(t, {
    gm: REVIEW_GM,
    players: REVIEW_PLAYERS,
    admin: REVIEW_ADMIN,
    spares: REVIEW_SPARES
  })
  const counts = () =>
    t.run(async (ctx) => ({
      campaigns: (await ctx.db.query('campaigns').collect()).map((row) => row.name).sort(),
      runs: (await ctx.db.query('encounterRuns').collect()).length
    }))
  return { t, context, counts }
}

/** One roster's accounts and context in an already prepared convex-test world; `set` keeps emails apart. */
export async function reviewSetContext(
  t: TestConvex,
  roster: ReviewRoster,
  set = 0
): Promise<ReviewContext> {
  const accounts: ReviewAccount[] = []
  const roomClients: ReturnType<typeof roomDevelopmentClient>[] = []
  const specs = [
    roster.gm,
    ...roster.players,
    ...(roster.admin ? [roster.admin] : []),
    ...roster.spares
  ]
  for (const [index, spec] of specs.entries()) {
    const user = await createPartyUser(t, {
      username: spec.username,
      email: `draft_review${set}0000${index}@example.invalid`
    })
    const client = roomDevelopmentClient(user.caller)
    roomClients.push(client)
    accounts.push({ client, userId: user.userId, username: spec.username })
  }
  const [gm] = accounts as [ReviewAccount]
  const players = accounts.slice(1, 1 + roster.players.length)
  const admin = roster.admin ? accounts[1 + roster.players.length] : undefined
  const spares = accounts.slice(1 + roster.players.length + (roster.admin ? 1 : 0))
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  return {
    gm,
    players,
    admin,
    spares,
    grantGmTier: (userId) =>
      t.mutation(internal.accountEntitlements.setTier, { userId, tier: 'GM' }).then(() => {}),
    grantSuperadmin: (userId) =>
      t.mutation(internal.authAdmin.setRole, { userId, role: 'superadmin' }).then(() => {}),
    // Each finished Campaign's room is closed from both ends, so the next one activates on a quiet Worker.
    releaseRoom: async (campaignId) => {
      for (const client of roomClients) client.closeRooms()
      await closeRoom(campaignId)
    },
    buildSnapshots: seedRoomContentSnapshots,
    checkpoint: async (campaignId) => {
      await checkpointRoom(campaignId)
    },
    log: (message) => console.log(message)
  }
}
