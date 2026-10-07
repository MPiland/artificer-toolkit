import { getCampaignTabs } from './campaignAccess'
import { createCampaignDetail } from './campaignDetail.fixtures'

describe('Campaign access presentation', () => {
  it('keeps owner workspaces out while exposing the player content-sharing surface', () => {
    const campaign = createCampaignDetail({ role: 'PLAYER' })

    expect(getCampaignTabs(campaign)).toEqual([
      'sessions',
      'announcements',
      'party',
      'notes',
      'inventory',
      'table',
      'content'
    ])
  })

  it('includes PARTY chat and owner-only workspaces for the GM', () => {
    const campaign = createCampaignDetail({ role: 'OWNER' })

    expect(getCampaignTabs(campaign)).toContain('content')
    expect(getCampaignTabs(campaign)).toEqual([
      'sessions',
      'announcements',
      'party',
      'notes',
      'inventory',
      'table',
      'content',
      'settings'
    ])
  })
})
