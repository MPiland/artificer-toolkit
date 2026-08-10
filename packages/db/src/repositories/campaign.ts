import type { DBLike } from '#types'
import { createCampaignInviteRepository } from './campaignInvites.js'
import { createCampaignLifecycleRepository } from './campaignLifecycle.js'
import { createCampaignMembershipRepository } from './campaignMembership.js'
import { createCampaignOwnershipTransferRepository } from './campaignOwnershipTransfers.js'

export type {
  CampaignAssignmentRecord,
  CampaignAuthorityRecord,
  CampaignCharacterRecord,
  CampaignInviteKind,
  CampaignInviteRecord,
  CampaignListRecord,
  CampaignMembershipProjection,
  CampaignMembershipRecord,
  CampaignMembershipStatus,
  CampaignOwnershipTransferRecord,
  CampaignRecord,
  CampaignRole,
  CampaignStatus,
  CampaignVisibility
} from './campaignTypes.js'

export function createCampaignRepository(db: DBLike) {
  return {
    ...createCampaignLifecycleRepository(db),
    ...createCampaignMembershipRepository(db),
    ...createCampaignInviteRepository(db),
    ...createCampaignOwnershipTransferRepository(db)
  }
}
