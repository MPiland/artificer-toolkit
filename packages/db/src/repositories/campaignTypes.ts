export type CampaignRole = 'OWNER' | 'PLAYER'
export type CampaignStatus = 'ACTIVE' | 'ARCHIVED'
export type CampaignVisibility = 'PRIVATE' | 'PUBLIC'
export type CampaignMembershipStatus = 'ACTIVE' | 'LEFT'
export type CampaignInviteKind = 'LINK' | 'USERNAME' | 'EMAIL'

export type Timestamp = string | Date

export interface CampaignRecord {
  id: string
  publicId: string
  ownerUserId: string
  name: string
  description: string | null
  attunementSlotOverride: number | null
  status: CampaignStatus
  visibility: CampaignVisibility
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CampaignListRecord extends CampaignRecord {
  role: CampaignRole
  memberCount: number
  playerCount: number
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignMembershipRecord {
  campaignId: string
  userId: string
  role: CampaignRole
  status: CampaignMembershipStatus
  accessStartedAt: Timestamp
  joinedAt: Timestamp
  leftAt: Timestamp | null
}

export interface CampaignCharacterRecord {
  id: string
  publicId: string
  userId: string
  label: string
  systemId: string
  status: string
}

export interface CampaignAssignmentRecord {
  campaignId: string
  characterId: string
  userId: string
  assignedAt: Timestamp
}

export interface CampaignAuthorityRecord {
  campaign: CampaignRecord
  membership: CampaignMembershipRecord
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignMembershipProjection {
  userId: string
  username: string
  role: CampaignRole
  accessStartedAt: Timestamp
  acceptedAt: Timestamp
  assignedCharacter: Omit<CampaignCharacterRecord, 'userId' | 'status'> | null
}

export interface CampaignInviteRecord {
  id: string
  campaignId: string
  createdBy: string
  kind: CampaignInviteKind
  targetUserId: string | null
  targetEmail: string | null
  expiresAt: Timestamp
  revokedAt: Timestamp | null
  createdAt: Timestamp
}

export interface CampaignOwnershipTransferRecord {
  campaignId: string
  fromUserId: string
  toUserId: string
  expiresAt: Timestamp
}

export interface RawCampaignRow {
  id: string
  public_id: string
  owner_user_id: string
  name: string
  description: string | null
  attunement_slot_override?: number | null
  status: CampaignStatus
  visibility: CampaignVisibility
  version: number
  created_at: Timestamp
  updated_at: Timestamp
}

export interface RawCampaignListRow extends RawCampaignRow {
  role: CampaignRole
  member_count: string | number
  player_count: string | number
  character_id: string | null
  character_public_id: string | null
  character_label: string | null
  character_system_id: string | null
}

export function mapCampaign(row: RawCampaignRow): CampaignRecord {
  return {
    id: row.id,
    publicId: row.public_id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description,
    attunementSlotOverride: row.attunement_slot_override ?? null,
    status: row.status,
    visibility: row.visibility,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
