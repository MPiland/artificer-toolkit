export type CampaignRole = 'OWNER' | 'PLAYER'
export type CampaignStatus = 'ACTIVE' | 'ARCHIVED'
export type CampaignFormat = 'ONE_SHOT' | 'ONGOING'
export type CampaignToneTag =
  | 'LIGHTHEARTED'
  | 'HEROIC'
  | 'SERIOUS'
  | 'DARK'
  | 'GRITTY'
  | 'HORROR'
  | 'COMEDIC'
  | 'COZY'
export type CampaignContentMaturity = 'STANDARD' | 'MATURE'
export type CampaignMembershipStatus = 'ACTIVE' | 'LEFT'
export type CampaignInviteStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'

export type Timestamp = string | Date

export interface CampaignRecord {
  id: string
  publicId: string
  ownerUserId: string
  name: string
  description: string | null
  format: CampaignFormat
  toneTags: CampaignToneTag[]
  toneDetails: string | null
  contentMaturity: CampaignContentMaturity
  gameSystemId: string
  primaryRulesCatalogueId: string
  additionalRulesCatalogueIds: string[]
  attunementSlotOverride: number | null
  status: CampaignStatus
  version: number
  createdAt: Timestamp
  updatedAt: Timestamp
}

export interface CampaignListRecord extends CampaignRecord {
  role: CampaignRole
  memberCount: number
  playerCount: number
  assignedCharacter: Omit<
    CampaignCharacterRecord,
    'userId' | 'status' | 'primaryRulesCatalogueId'
  > | null
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
  primaryRulesCatalogueId: string
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
  assignedCharacter: Omit<
    CampaignCharacterRecord,
    'userId' | 'status' | 'primaryRulesCatalogueId'
  > | null
}

export interface CampaignMembershipProjection {
  userId: string
  username: string
  role: CampaignRole
  accessStartedAt: Timestamp
  acceptedAt: Timestamp
  assignedCharacter: Omit<
    CampaignCharacterRecord,
    'userId' | 'status' | 'primaryRulesCatalogueId'
  > | null
}

export interface CampaignInviteRecord {
  id: string
  listingId: string
  campaignId: string
  createdBy: string
  recipientUserId: string
  recipientUsername: string
  listingVersion: number
  status: CampaignInviteStatus
  expiresAt: Timestamp
  respondedAt: Timestamp | null
  revokedAt: Timestamp | null
  expiredAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  version: number
}

export interface CampaignInviteProjection extends CampaignInviteRecord {
  listingTitle: string
  contentMaturity: CampaignContentMaturity
  hostProfileId: string
  hostUsername: string
}

export interface CampaignInviteRecipientRecord {
  userId: string
  profileId: string
  username: string
  status: 'ACTIVE' | 'SUSPENDED'
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
  format: string
  tone_tags: string[]
  tone_details: string | null
  content_maturity: string
  game_system_id: string
  primary_rules_catalogue_id: string
  additional_rules_catalogue_ids: string[]
  attunement_slot_override?: number | null
  status: CampaignStatus
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
    format: row.format as CampaignFormat,
    toneTags: row.tone_tags as CampaignToneTag[],
    toneDetails: row.tone_details,
    contentMaturity: row.content_maturity as CampaignContentMaturity,
    gameSystemId: requireCampaignBinding(row.game_system_id, 'Game System'),
    primaryRulesCatalogueId: requireCampaignBinding(
      row.primary_rules_catalogue_id,
      'primary Rules Catalogue'
    ),
    additionalRulesCatalogueIds: row.additional_rules_catalogue_ids,
    attunementSlotOverride: row.attunement_slot_override ?? null,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function requireCampaignBinding(value: string, label: string): string {
  if (!value) throw new Error(`Campaign is missing its ${label} binding.`)
  return value
}
