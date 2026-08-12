import { describe, expect, it } from 'vitest'
import { isCampaignTableSettingsEditable } from './CampaignTableSettings'

describe('CampaignTableSettings access', () => {
  it('is editable only for an active owner', () => {
    expect(isCampaignTableSettingsEditable({ role: 'OWNER', status: 'ACTIVE' })).toBe(true)
    expect(isCampaignTableSettingsEditable({ role: 'PLAYER', status: 'ACTIVE' })).toBe(false)
    expect(isCampaignTableSettingsEditable({ role: 'OWNER', status: 'ARCHIVED' })).toBe(false)
  })
})
