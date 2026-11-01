import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { components, internal } from '../../convex/_generated/api'
import { readySheetFixture } from './readyCharacter'
import { createPartyUser } from './partyPlayer'
import type { ReviewAccount, ReviewContext } from '../developmentReviewData'
import { REVIEW_GM, REVIEW_PLAYERS } from '../developmentReviewDataScenarios'
import {
  attachRoomWorker,
  checkpointRoom,
  closeRoom,
  roomDevelopmentClient,
  seedRoomContentSnapshots
} from './localRoomWorker'

/** The review accounts and room-aware context `seedReviewData` runs against inside convex-test. */
export async function reviewDataHarness() {
  const { t } = await readySheetFixture()
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  // The Characters are built from the SRD corpus, as on the seeded local backend.
  await t.action(internal.content.seed.seed, {})
  await attachRoomWorker(t)
  const accounts: ReviewAccount[] = []
  const roomClients: ReturnType<typeof roomDevelopmentClient>[] = []
  for (const [index, spec] of [REVIEW_GM, ...REVIEW_PLAYERS].entries()) {
    const user = await createPartyUser(t, {
      username: spec.username,
      email: `draft_review00000${index}@example.invalid`
    })
    const client = roomDevelopmentClient(user.caller)
    roomClients.push(client)
    accounts.push({ client, userId: user.userId, username: spec.username })
  }
  const [gm, ...players] = accounts as [ReviewAccount, ...ReviewAccount[]]
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const context: ReviewContext = {
    gm,
    players,
    grantGmTier: (userId) =>
      t.mutation(internal.accountEntitlements.setTier, { userId, tier: 'GM' }).then(() => {}),
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
  const counts = () =>
    t.run(async (ctx) => ({
      campaigns: (await ctx.db.query('campaigns').collect()).map((row) => row.name).sort(),
      runs: (await ctx.db.query('encounterRuns').collect()).length
    }))
  return { context, counts }
}
