import type { CampaignDetailDto } from '@artificer-toolkit/schema/api/campaignCore'
import type { CampaignSessionDto } from '@artificer-toolkit/schema/api/campaignSessions'

export type CampaignTab =
  | 'sessions'
  | 'announcements'
  | 'party'
  | 'notes'
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

export type SessionWorkspaceView = 'PREPARE' | 'RUN' | 'CLOSEOUT'

export function getSessionWorkspaceViews(
  role: CampaignDetailDto['role'],
  status: CampaignSessionDto['status']
): SessionWorkspaceView[] {
  return role === 'OWNER'
    ? ['PREPARE', 'RUN', 'CLOSEOUT']
    : [status === 'OPEN' ? 'RUN' : 'CLOSEOUT']
}
