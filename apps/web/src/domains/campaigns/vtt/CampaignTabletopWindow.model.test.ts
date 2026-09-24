import { describe, expect, it } from 'vitest'
import { buildTabletopHref, tabletopWindowName } from './CampaignTabletopWindow.model'

describe('CampaignTabletopWindow model', () => {
  it('builds an encoded standalone tabletop route and stable window name', () => {
    expect(buildTabletopHref('campaign/demo')).toBe('/tabletop/campaigns/campaign%2Fdemo')
    expect(tabletopWindowName('campaign/demo')).toBe('artificer-tabletop-campaign-demo')
  })
})
