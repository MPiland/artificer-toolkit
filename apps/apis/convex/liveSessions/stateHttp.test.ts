import { makeFunctionReference } from 'convex/server'
import { ConvexError } from 'convex/values'
import { afterEach, expect, it, vi } from 'vitest'
import type {
  CampaignDetailDto,
  CreateCampaignInput
} from '@artificer-toolkit/schema/api/campaignCore'
import { SRD_RULES_CATALOGUE } from '@artificer-toolkit/source-data/srd/catalogue.js'
import { srdSystemRecord } from '@artificer-toolkit/source-data/srd/vocabulary.js'
import { fixture } from '../../tests/fixtures/characters'
import { isConvexExecutionTimeout } from './stateHttp'

const createCampaign = makeFunctionReference<'mutation', CreateCampaignInput, CampaignDetailDto>(
  'campaigns/create:create'
)
const secret = 'private-state-http-test-secret-at-least-32-bytes'

afterEach(() => {
  vi.unstubAllEnvs()
})

it('returns an expected Encounter rejection as structured data and redacts other failures', async () => {
  const base = await fixture()
  const campaign = await base.owner.caller.mutation(createCampaign, {
    name: 'State HTTP fixture',
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    contentMaturity: 'STANDARD',
    gameSystemId: srdSystemRecord.id,
    primaryRulesCatalogueId: SRD_RULES_CATALOGUE.id
  })
  await base.t.run(async (ctx) => {
    const row = await ctx.db
      .query('campaigns')
      .withIndex('by_publicId', (q) => q.eq('id', campaign.id))
      .unique()
    if (!row) throw new Error('Missing Campaign.')
    await ctx.db.patch(row._id, { status: 'ARCHIVED' })
  })
  vi.stubEnv('LIVE_SESSION_WORKER_SECRET', secret)
  const forward = (expectedUserId: string) =>
    base.owner.caller.fetch('/live-sessions/encounter-command', {
      method: 'POST',
      headers: { 'x-artificer-live-session-secret': secret },
      body: JSON.stringify({
        campaignId: campaign.id,
        authorityEpoch: crypto.randomUUID(),
        expectedUserId,
        expectedRole: 'OWNER',
        command: {
          type: 'SET_ROUND',
          encounterId: crypto.randomUUID(),
          commandId: crypto.randomUUID(),
          expectedVersion: 0,
          round: 2
        }
      })
    })

  // The rejection crosses the private route as ConvexError data.
  const archived = await forward(base.owner.userId)
  expect(archived.status).toBe(422)
  expect(await archived.json()).toEqual({
    code: 'DOMAIN_REJECTED',
    reason: 'CAMPAIGN_NOT_ACTIVE',
    message: 'Archived Campaigns are read-only.'
  })

  const mismatched = await forward(base.other.userId)
  expect(mismatched.status).toBe(409)
  expect(await mismatched.text()).toBe('Live Session Encounter command unavailable.')
})

it('reports only a Convex execution timeout as retryable, never a stale-state or domain failure (D47)', () => {
  expect(
    isConvexExecutionTimeout(new Error('Function execution timed out (maximum duration: 1s)'))
  ).toBe(true)
  expect(isConvexExecutionTimeout(new Error('Live Session authority sequence is stale.'))).toBe(
    false
  )
  expect(isConvexExecutionTimeout(new ConvexError('Function execution timed out'))).toBe(false)
  expect(isConvexExecutionTimeout('Function execution timed out')).toBe(false)
})
