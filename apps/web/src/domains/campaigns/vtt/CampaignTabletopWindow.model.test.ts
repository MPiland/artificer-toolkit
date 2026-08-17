import { describe, expect, it } from 'vitest'
import { tabletopSession } from './CampaignTabletop.stories.fixtures'
import {
  buildTabletopHref,
  findCurrentTabletopSession,
  tabletopWindowName
} from './CampaignTabletopWindow.model'

describe('CampaignTabletopWindow model', () => {
  it('builds an encoded standalone tabletop route and stable window name', () => {
    expect(buildTabletopHref('campaign/demo', 12)).toBe(
      '/tabletop/campaigns/campaign%2Fdemo/sessions/12'
    )
    expect(tabletopWindowName('campaign/demo', 12)).toBe('artificer-tabletop-campaign-demo-12')
  })

  it('selects the latest open Session for Character Sheet launch', () => {
    expect(
      findCurrentTabletopSession([
        { ...tabletopSession, id: 'finished', sessionNumber: 8, status: 'FINISHED' },
        { ...tabletopSession, id: 'older', sessionNumber: 9 },
        { ...tabletopSession, id: 'current', sessionNumber: 10 }
      ])?.id
    ).toBe('current')
  })
})
