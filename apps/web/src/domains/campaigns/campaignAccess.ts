import type { CampaignDetailDto } from '#app/lib/api'

export type CampaignTab =
  | 'sessions'
  | 'announcements'
  | 'party'
  | 'notes'
  | 'files'
  | 'inventory'
  | 'table'
  | 'content'
  | 'settings'

export function getCampaignTabs(campaign: CampaignDetailDto): CampaignTab[] {
  return [
    'sessions',
    'announcements',
    'party',
    ...(campaign.capabilities.manageNotes || campaign.capabilities.contributeSessionNotes
      ? (['notes'] as const)
      : []),
    'files',
    ...(campaign.capabilities.managePartyInventory || campaign.capabilities.transferOwnInventory
      ? (['inventory'] as const)
      : []),
    'table',
    ...(campaign.capabilities.manageSharedContent || campaign.capabilities.shareOwnedContent
      ? (['content'] as const)
      : []),
    ...(campaign.role === 'OWNER' ? (['settings'] as const) : [])
  ]
}
