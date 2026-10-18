import {
  getCampaignTabs,
  getSessionWorkspaceViews,
  isCampaignTableSettingsEditable
} from './campaignAccess'
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

describe('getSessionWorkspaceViews', () => {
  it('keeps GM preparation private', () => {
    expect(getSessionWorkspaceViews('OWNER', 'OPEN')).toEqual(['PREPARE', 'RUN', 'CLOSEOUT'])
    expect(getSessionWorkspaceViews('PLAYER', 'OPEN')).toEqual(['RUN'])
  })

  it('sends players to shared history after finish', () => {
    expect(getSessionWorkspaceViews('PLAYER', 'FINISHED')).toEqual(['CLOSEOUT'])
  })
})

describe('CampaignTableSettings access', () => {
  it('is editable only for an active owner', () => {
    expect(isCampaignTableSettingsEditable({ role: 'OWNER', status: 'ACTIVE' })).toBe(true)
    expect(isCampaignTableSettingsEditable({ role: 'PLAYER', status: 'ACTIVE' })).toBe(false)
    expect(isCampaignTableSettingsEditable({ role: 'OWNER', status: 'ARCHIVED' })).toBe(false)
  })
})
