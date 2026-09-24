import { describe, expect, it } from 'vitest'
import { buildTabletopHref, tabletopWindowName } from './CampaignTabletopWindow.model'

describe('CampaignTabletopWindow model', () => {
  it('builds an encoded standalone tabletop route and stable window name', () => {
    expect(buildTabletopHref('campaign/demo', 12)).toBe(
      '/tabletop/campaigns/campaign%2Fdemo/sessions/12'
    )
    expect(tabletopWindowName('campaign/demo', 12)).toBe('artificer-tabletop-campaign-demo-12')
  })
})
