// @vitest-environment node
import { expect, it } from 'vitest'
import { seedReviewData } from '../../tests/developmentReviewData'
import { reviewScenariosForSet } from '../../tests/developmentReviewDataScenarios'
import { reviewRoster, reviewTarget } from '../../tests/developmentReviewTarget'
import {
  roomErrorLogs,
  useLocalRoomWorker,
  useRealTimeClock
} from '../../tests/fixtures/localRoomWorker'
import {
  expectBuilderReadyCharacters,
  reviewDataHarness,
  reviewSetContext
} from '../../tests/fixtures/reviewDataHarness'

useLocalRoomWorker()
useRealTimeClock()

const managedEnv = {
  CONVEX_URL: 'https://tester-staging-123.convex.cloud',
  CONVEX_SITE_URL: 'https://tester-staging-123.convex.site',
  REVIEW_MANAGED_CONFIRM: 'tester-staging-123',
  REVIEW_MANAGED_ADMIN_KEY: 'managed-admin-key-value',
  REVIEW_WORKER_CONTROL_SECRET: 'worker-control-secret-value',
  REVIEW_MAILBOX: 'mekhit02@gmail.com'
}

// The sandbox scenario is the smallest review Campaign; the sets share every other code path.
const sandboxOf = (set: number) => reviewScenariosForSet(set).slice(3)

it('builds independent Campaigns per tester set and skips a finished set', async () => {
  const { t } = await reviewDataHarness()
  const contexts = new Map(
    await Promise.all(
      [1, 2].map(
        async (set) =>
          [
            set,
            await reviewSetContext(t, reviewRoster(reviewTarget(managedEnv, { set })), set)
          ] as const
      )
    )
  )
  const seed = (set: number) =>
    seedReviewData(contexts.get(set)!, sandboxOf(set)).catch((error: unknown) => {
      throw new Error(
        [
          'Review seed failed:',
          (error instanceof Error && error.stack) || String(error),
          ...roomErrorLogs()
        ].join(' | '),
        {
          cause: error
        }
      )
    })
  const campaigns = () =>
    t.run(async (ctx) =>
      (await ctx.db.query('campaigns').collect()).map((row) => ({
        name: row.name,
        id: row.id,
        owner: row.ownerUserId
      }))
    )

  expect((await seed(1)).created).toEqual(['Review: Sandbox (set 1)'])
  expect((await seed(2)).created).toEqual(['Review: Sandbox (set 2)'])
  await expectBuilderReadyCharacters(t)
  const built = await campaigns()
  const [one, two] = ['Review: Sandbox (set 1)', 'Review: Sandbox (set 2)'].map((name) =>
    built.find((row) => row.name === name)
  )
  expect(built).toHaveLength(2)
  expect(one!.owner).toBe(contexts.get(1)!.gm.userId)
  expect(two!.owner).toBe(contexts.get(2)!.gm.userId)
  expect(one!.owner).not.toBe(two!.owner)

  // A re-run is a no-op for both sets.
  expect(await seed(1)).toEqual({ created: [], skipped: ['Review: Sandbox (set 1)'] })
  expect(await seed(2)).toEqual({ created: [], skipped: ['Review: Sandbox (set 2)'] })
  expect(await campaigns()).toEqual(built)
}, 240_000)
