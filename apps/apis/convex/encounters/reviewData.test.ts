// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { seedReviewData } from '../../tests/developmentReviewData'
import { REVIEW_SCENARIOS } from '../../tests/developmentReviewDataScenarios'
import { roomErrorLogs, useLocalRoomWorker } from '../../tests/fixtures/localRoomWorker'
import { reviewDataHarness } from '../../tests/fixtures/reviewDataHarness'

useLocalRoomWorker()
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setTimeout', 'clearTimeout'] })
})
afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

// The Worker keeps every room it has hosted until the test ends, so the last Campaign is built by
// reviewDataFireAndThunder.test.ts on a Worker of its own.
const scenarios = REVIEW_SCENARIOS.slice(0, 2)

it('builds the review Campaigns once and skips every finished one on a re-run', async () => {
  const { context, counts } = await reviewDataHarness()
  const names = scenarios.map((scenario) => scenario.campaign)

  const first = await seedReviewData(context, scenarios).catch((error: unknown) => {
    throw new Error(['Review seed failed:', String(error), ...roomErrorLogs()].join(' | '))
  })
  const built = await counts()
  const second = await seedReviewData(context, scenarios)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.campaigns).toEqual([...names].sort())
  expect(built.runs).toBe(names.length)
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
}, 600_000)
