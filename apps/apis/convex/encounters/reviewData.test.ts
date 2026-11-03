// @vitest-environment node
import { expect, it } from 'vitest'
import { api } from '../_generated/api'
import { seedReviewData } from '../../tests/developmentReviewData'
import { REVIEW_SCENARIOS, REVIEW_SPARES } from '../../tests/developmentReviewDataScenarios'
import {
  roomErrorLogs,
  useLocalRoomWorker,
  useRealTimeClock
} from '../../tests/fixtures/localRoomWorker'
import { reviewDataHarness } from '../../tests/fixtures/reviewDataHarness'

useLocalRoomWorker()
useRealTimeClock()

// The Worker keeps every room it has hosted until the test ends, so the last Campaign is built by
// reviewDataFireAndThunder.test.ts on a Worker of its own.
const scenarios = REVIEW_SCENARIOS.slice(0, 2)

it('builds the review Campaigns once and skips every finished one on a re-run', async () => {
  const { context, counts } = await reviewDataHarness()
  const names = scenarios.map((scenario) => scenario.campaign)
  // The admin's role and every spare's Campaigns, as each account reads them.
  const accounts = async () => ({
    adminRole: (await context.admin!.client.query(api.account.identity, {})).role,
    spareCampaigns: await Promise.all(
      context.spares.map(
        async (spare) =>
          (
            await spare.client.query(api.campaigns.queries.list, {
              paginationOpts: { cursor: null, numItems: 8 }
            })
          ).page.length
      )
    )
  })
  expect((await accounts()).adminRole).toBe('user')

  const first = await seedReviewData(context, scenarios).catch((error: unknown) => {
    throw new Error(['Review seed failed:', String(error), ...roomErrorLogs()].join(' | '))
  })
  const built = await counts()
  const promoted = await accounts()
  const second = await seedReviewData(context, scenarios)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.campaigns).toEqual([...names].sort())
  expect(built.runs).toBe(names.length)
  expect(promoted).toEqual({
    adminRole: 'superadmin',
    spareCampaigns: REVIEW_SPARES.map(() => 0)
  })
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
  expect(await accounts()).toEqual(promoted)
}, 600_000)
