// @vitest-environment node
import { expect, it } from 'vitest'
import { seedReviewData } from '../../tests/developmentReviewData'
import { REVIEW_SCENARIOS } from '../../tests/developmentReviewDataScenarios'
import {
  roomErrorLogs,
  useLocalRoomWorker,
  useRealTimeClock
} from '../../tests/fixtures/localRoomWorker'
import { reviewDataHarness } from '../../tests/fixtures/reviewDataHarness'

useLocalRoomWorker()
useRealTimeClock()
useRealTimeClock()

const scenarios = REVIEW_SCENARIOS.slice(2, 3)

it('builds the area-spell review Campaign once and skips it on a re-run', async () => {
  const { context, counts } = await reviewDataHarness()
  const names = scenarios.map((scenario) => scenario.campaign)

  const first = await seedReviewData(context, scenarios).catch((error: unknown) => {
    throw new Error(['Review seed failed:', String(error), ...roomErrorLogs()].join(' | '))
  })
  const built = await counts()
  const second = await seedReviewData(context, scenarios)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.runs).toBe(names.length)
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
}, 600_000)
