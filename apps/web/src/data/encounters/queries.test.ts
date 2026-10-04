import { getFunctionName } from 'convex/server'
import { expect, it } from 'vitest'
import { api as convexApi } from '@artificer-toolkit/apis/convex/api'
import { getCampaignEncounters, getEncounter } from './queries'

const campaignId = '00000000-0000-4000-8000-000000000002'
const encounterId = '00000000-0000-4000-8000-000000000004'

it('subscribes to the campaign encounter summaries and one encounter', () => {
  expect(getCampaignEncounters(campaignId).queryKey).toEqual([
    'convexQuery',
    getFunctionName(convexApi.encounters.projectionReads.list),
    { campaignId }
  ])
  expect(getEncounter(encounterId).queryKey).toEqual([
    'convexQuery',
    getFunctionName(convexApi.encounters.projectionReads.get),
    { encounterId }
  ])
})

it('skips without an encounter', () => {
  expect(getEncounter(null).queryKey[2]).toBe('skip')
})
