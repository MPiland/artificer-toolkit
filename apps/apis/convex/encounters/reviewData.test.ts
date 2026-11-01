// @vitest-environment node
import { register } from '@convex-dev/r2/test'
import { register as registerRetrier } from '@convex-dev/action-retrier/test'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { SRD_CONTENT_SOURCE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { goblin } from '@artificer-toolkit/source-data/srd/creatures/goblin.js'
import { wolf } from '@artificer-toolkit/source-data/srd/creatures/wolf.js'
import { readySheetFixture } from '../../tests/fixtures/readyCharacter'
import { createPartyUser } from '../../tests/fixtures/partyPlayer'
import { importedSubject, importSeededSubjects } from '../../tests/fixtures/publication'
import { srdCreatureRecord } from '../../tests/fixtures/srdCreatures'
import { awaitCampaignCheckpoint } from '../../tests/developmentCheckpoint'
import { seedReviewData, type ReviewAccount } from '../../tests/developmentReviewData'
import {
  REVIEW_GM,
  REVIEW_PLAYERS,
  REVIEW_SCENARIOS
} from '../../tests/developmentReviewDataScenarios'
import {
  attachRoomWorker,
  roomDevelopmentClient,
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
  await attachRoomWorker(t)
  const accounts: ReviewAccount[] = []
  let gmCaller: Parameters<typeof roomDevelopmentClient>[0] = null
  for (const [index, spec] of [REVIEW_GM, ...REVIEW_PLAYERS].entries()) {
    const user = await createPartyUser(t, {
      username: spec.username,
      email: `draft_review00000${index}@example.invalid`
    })
    if (index === 0) gmCaller = user.caller
    accounts.push({
      client: roomDevelopmentClient(user.caller),
      userId: user.userId,
      username: spec.username
    })
  }
  const [gm, ...players] = accounts as [ReviewAccount, ...ReviewAccount[]]
  await importSeededSubjects(t, {
    contentSourceId: SRD_CONTENT_SOURCE.id,
    subjects: [wolf, goblin].map((creature) => {
      const document = srdCreatureRecord(creature.id)
      return importedSubject({ ...document, subjectKind: 'CREATURE', document })
    })
  })
  const context = {
    gm,
    players,
    buildSnapshots: seedRoomContentSnapshots,
    checkpoint: (campaignId: string) =>
      awaitCampaignCheckpoint(roomDevelopmentClient(gmCaller), campaignId),
    log: () => undefined
  }
  const counts = () =>
    t.run(async (ctx) => ({
      campaigns: (await ctx.db.query('campaigns').collect()).map((row) => row.name).sort(),
      runs: (await ctx.db.query('encounterRuns').collect()).length
    }))
  const names = REVIEW_SCENARIOS.map((scenario) => scenario.campaign)

  const first = await seedReviewData(context)
  const built = await counts()
  const second = await seedReviewData(context)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.campaigns).toEqual([...names].sort())
  expect(built.runs).toBe(names.length)
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
}, 600_000)
