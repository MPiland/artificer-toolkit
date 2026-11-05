// @vitest-environment node
import { expect, it } from 'vitest'
import { api } from '../_generated/api'
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

const scenarios = REVIEW_SCENARIOS.slice(3)

it('builds the sandbox review Campaign once with its board and play settings', async () => {
  const { t, context, counts } = await reviewDataHarness()
  const names = scenarios.map((scenario) => scenario.campaign)
  const [sandbox] = scenarios
  if (!sandbox) throw new Error('The sandbox review scenario is missing.')

  const first = await seedReviewData(context, scenarios).catch((error: unknown) => {
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
  const built = await counts()
  // The published board as stored, and the Campaign's play settings as its GM reads them.
  const board = await t.run(async (ctx) => {
    const campaign = (await ctx.db.query('campaigns').collect()).find(
      (row) => row.name === sandbox.campaign
    )
    if (!campaign) throw new Error('The sandbox Campaign was not built.')
    const save = (await ctx.db.query('sceneDefinitionSaves').collect()).find(
      (row) => row.settings.campaignId === campaign.id && row.status === 'PUBLISHED'
    )
    if (!save) throw new Error('The sandbox Scene was not published.')
    const entities = (
      await ctx.db
        .query('sceneDefinitionEntities')
        .withIndex('by_saveId', (query) => query.eq('saveId', save.id))
        .collect()
    ).map((row) => row.value)
    const tokens = entities.flatMap((value) =>
      value.collection === 'tokens' ? [value.entity] : []
    )
    return {
      campaignId: campaign.id,
      fogMode: save.settings.fogMode,
      ambientIllumination: save.settings.ambientIllumination,
      barriers: entities
        .flatMap((value) => (value.collection === 'barriers' ? [value.entity.kind] : []))
        .sort(),
      lights: entities.filter((value) => value.collection === 'lights').length,
      hiddenTokens: tokens.filter((token) => token.hidden).length,
      largeTokens: tokens.filter((token) => token.width === 100 && token.height === 100).length
    }
  })
  const { campaignId, ...stored } = board
  const play = await context.gm.client.query(api.campaigns.playSettings.get, { campaignId })
  const second = await seedReviewData(context, scenarios)

  expect(first).toEqual({ created: names, skipped: [] })
  expect(built.runs).toBe(names.length)
  expect(stored).toEqual({
    fogMode: 'PER_PLAYER',
    ambientIllumination: 'DIM',
    barriers: ['DOOR', 'TERRAIN', 'WALL', 'WALL'],
    lights: 1,
    hiddenTokens: 2,
    largeTokens: 1
  })
  expect({
    automationMode: play.automationMode,
    initiativePolicyDefinitionId: play.initiativePolicyDefinitionId
  }).toEqual({ automationMode: 'MANUAL', initiativePolicyDefinitionId: null })
  expect(second).toEqual({ created: [], skipped: names })
  expect(await counts()).toEqual(built)
}, 600_000)
