import { describe, expect, it } from 'vitest'
import { getCampaignCapabilities } from '../domains/campaign/campaignCapabilities.js'

describe('Campaign capabilities', () => {
  it('keeps role and archive policy consistent', () => {
    expect(getCampaignCapabilities('ACTIVE', 'OWNER')).toMatchObject({
      edit: true,
      assignOwnCharacter: true,
      transferOwnInventory: true,
      readTableChat: true,
      readPartyChat: false
    })
    expect(getCampaignCapabilities('ACTIVE', 'PLAYER')).toMatchObject({
      edit: false,
      assignOwnCharacter: true,
      readPartyChat: true
    })

    expect(getCampaignCapabilities('ACTIVE', 'OWNER').manageActiveCampaign).toBe(true)
    expect(getCampaignCapabilities('ACTIVE', 'PLAYER').manageActiveCampaign).toBe(false)
    expect(getCampaignCapabilities('ARCHIVED', 'OWNER').manageActiveCampaign).toBe(false)

    const archivedOwner = getCampaignCapabilities('ARCHIVED', 'OWNER')
    expect(archivedOwner.delete).toBe(true)
    expect(archivedOwner.readTableChat).toBe(true)
    expect(archivedOwner.readPartyChat).toBe(false)
    expect(
      Object.entries(archivedOwner)
        .filter(([key]) => !key.startsWith('read') && key !== 'delete')
        .every(([, value]) => value === false)
    ).toBe(true)

    const archived = getCampaignCapabilities('ARCHIVED', 'PLAYER')
    expect(archived.readPartyChat).toBe(true)
    expect(
      Object.entries(archived)
        .filter(([key]) => !key.startsWith('read'))
        .every(([, value]) => value === false)
    ).toBe(true)
  })
})
