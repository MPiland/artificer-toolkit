import type { CampaignDetailDto } from '#app/lib/api'
import { getCampaignTabs } from './campaignAccess'

describe('Campaign access presentation', () => {
  it('keeps owner workspaces out while exposing the player content-sharing surface', () => {
    const campaign = createCampaign()

    expect(getCampaignTabs(campaign)).toEqual([
      'sessions',
      'announcements',
      'party',
      'notes',
      'files',
      'inventory',
      'table',
      'content'
    ])
  })

  it('includes PARTY chat and owner-only workspaces for the GM', () => {
    const campaign = createCampaign({
      role: 'OWNER',
      capabilities: {
        ...createCampaign().capabilities,
        manageSharedContent: true,
        managePartyInventory: true,
        readPartyChat: false,
        shareOwnedContent: false,
        transferOwnInventory: false
      }
    })

    expect(getCampaignTabs(campaign)).toContain('content')
    expect(getCampaignTabs(campaign)).toEqual([
      'sessions',
      'announcements',
      'party',
      'notes',
      'files',
      'inventory',
      'table',
      'content',
      'settings'
    ])
  })
})

function createCampaign(overrides: Partial<CampaignDetailDto> = {}): CampaignDetailDto {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    publicId: '4fzz7',
    name: 'The Ashen Road',
    description: null,
    format: 'ONGOING',
    toneTags: ['HEROIC'],
    toneDetails: null,
    contentMaturity: 'STANDARD',
    status: 'ACTIVE',
    role: 'PLAYER',
    version: 1,
    memberCount: 2,
    playerCount: 1,
    createdAt: '2026-08-06T12:00:00.000Z',
    updatedAt: '2026-08-06T12:00:00.000Z',
    attunementSlotOverride: null,
    assignedCharacter: null,
    memberships: [],
    capabilities: {
      edit: false,
      archive: false,
      delete: false,
      invite: false,
      manageMembers: false,
      manageCharacters: false,
      assignOwnCharacter: true,
      manageSharedContent: false,
      shareOwnedContent: true,
      managePartyInventory: false,
      transferOwnInventory: true,
      manageNotes: false,
      contributeSessionNotes: true,
      readTableChat: true,
      readPartyChat: false
    },
    ...overrides
  }
}
