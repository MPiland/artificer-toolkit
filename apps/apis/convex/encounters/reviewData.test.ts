// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { components, internal } from '../_generated/api'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { createPartyUser } from '../../tests/fixtures/partyPlayer'
import { seedReviewData, type ReviewAccount } from '../../tests/developmentReviewData'
import {
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SCENARIOS
} from '../../tests/developmentReviewDataScenarios'
import {
  attachRoomWorker,
  checkpointRoom,
  roomDevelopmentClient,
  roomAllLogs,
  roomErrorLogs,
  seedRoomContentSnapshots,
  useLocalRoomWorker
} from '../../tests/fixtures/localRoomWorker'

useLocalRoomWorker()
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

it('builds the review Campaigns once and skips every finished one on a re-run', async () => {
  const { t } = await readySheetFixture()
  register(t)
  registerRetrier(t, 'r2/actionRetrier')
  // The Characters are built from the SRD corpus, as on the seeded local backend.
  await t.action(internal.content.seed.seed, {})
  await attachRoomWorker(t)
  const accounts: ReviewAccount[] = []
  for (const [index, spec] of [REVIEW_GM, ...REVIEW_PLAYERS].entries()) {
    const user = await createPartyUser(t, {
      username: spec.username,
      email: `draft_review00000${index}@example.invalid`
    })
    accounts.push({
      client: roomDevelopmentClient(user.caller),
      userId: user.userId,
      username: spec.username
    })
  }
  const [gm, ...players] = accounts as [ReviewAccount, ...ReviewAccount[]]
  await t.run((ctx) =>
    ctx.runMutation(components.betterAuth.adapter.updateMany, {
      input: { model: 'session', update: { expiresAt: Date.now() + 3 * 86_400_000 } },
      paginationOpts: { cursor: null, numItems: 10 }
    })
  )
  const context = {
    gm,
    players,
    grantGmTier: (userId: string) =>
      t.mutation(internal.accountEntitlements.setTier, { userId, tier: 'GM' }).then(() => {}),
    buildSnapshots: seedRoomContentSnapshots,
    checkpoint: async (campaignId: string) => {
      await checkpointRoom(campaignId)
    },
    log: (message: string) => console.log(message)
  }
  const counts = () =>
    t.run(async (ctx) => ({
      campaigns: (await ctx.db.query('campaigns').collect()).map((row) => row.name).sort(),
      runs: (await ctx.db.query('encounterRuns').collect()).length
    }))
  const names = REVIEW_SCENARIOS.map((scenario) => scenario.campaign)

  const first = await seedReviewData(context, REVIEW_SCENARIOS.slice(2)).catch((error: unknown) => {
    throw new Error(
      ['Review seed failed:', String(error), ...roomErrorLogs(), ...roomAllLogs().slice(-30)].join(
        ' | '
      )
    )
  })
  const built = await counts()
  const second = await seedReviewData(context)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.campaigns).toEqual([...names].sort())
  expect(built.runs).toBe(names.length)
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
}, 600_000)
