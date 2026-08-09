import type { CampaignDetailDto } from '#app/lib/api'

export type CampaignTab = 'sessions' | 'notes' | 'party' | 'inventory' | 'content' | 'settings'

export function getCampaignTabs(campaign: CampaignDetailDto): CampaignTab[] {
  return [
    'sessions',
    'party',
    ...(campaign.capabilities.manageNotes || campaign.capabilities.contributeSessionNotes
      ? (['notes'] as const)
      : []),
    ...(campaign.capabilities.managePartyInventory || campaign.capabilities.transferOwnInventory
      ? (['inventory'] as const)
      : []),
    ...(campaign.capabilities.manageContent || campaign.capabilities.submitContent
      ? (['content'] as const)
      : []),
    ...(campaign.role === 'OWNER' ? (['settings'] as const) : [])
  ]
}
