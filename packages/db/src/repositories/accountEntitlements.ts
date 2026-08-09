import { sql } from 'kysely'
import type { DBLike } from '#types'

export type AccountEntitlementTier = 'FREE' | 'PLAYER' | 'GM' | 'PRO_GM'

export type EntitlementResource =
  | 'storageBytes'
  | 'personalCharacters'
  | 'homebrewRoots'
  | 'activeHostedCampaigns'
  | 'playerSeatsPerCampaign'
  | 'publicListings'
  | 'savedEncounters'

export interface AccountEntitlementUsage {
  storageBytes: number
  personalCharacters: number
  homebrewRoots: number
  activeHostedCampaigns: number
  publicListings: number
  savedEncounters: number
}

export class EntitlementLimitError extends Error {
  constructor(public readonly resource: EntitlementResource) {
    super(`Your account has reached its ${resource} limit.`)
    this.name = 'EntitlementLimitError'
  }
}

function toCount(value: string | number | undefined): number {
  return Number(value ?? 0)
}

export function createAccountEntitlementsRepository(db: DBLike) {
  return {
    async ensureForUser(userId: string): Promise<void> {
      await sql`
        insert into account_entitlements (user_id)
        values (${userId}::uuid)
        on conflict (user_id) do nothing
      `.execute(db)
    },

    async findTier(userId: string): Promise<AccountEntitlementTier> {
      const result = await sql<{ tier: AccountEntitlementTier }>`
        select tier from account_entitlements where user_id = ${userId}::uuid
      `.execute(db)

      return result.rows[0]?.tier ?? 'FREE'
    },

    async lockTier(userId: string): Promise<AccountEntitlementTier> {
      await this.ensureForUser(userId)
      const result = await sql<{ tier: AccountEntitlementTier }>`
        select tier from account_entitlements
        where user_id = ${userId}::uuid
        for update
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error(`Failed to lock entitlements for user "${userId}".`)
      return row.tier
    },

    async characterExistsForUser(userId: string, characterId: string): Promise<boolean> {
      const result = await sql<{ exists: boolean }>`
        select exists (
          select 1 from characters
          where id = ${characterId}::uuid and user_id = ${userId}::uuid
          union all
          select 1 from character_builder_drafts
          where character_id = ${characterId}::uuid and user_id = ${userId}::uuid
        ) as exists
      `.execute(db)
      return result.rows[0]?.exists ?? false
    },

    async countPersonalCharacters(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        select count(*) as count from (
          select id from characters where user_id = ${userId}::uuid
          union
          select character_id from character_builder_drafts where user_id = ${userId}::uuid
        ) owned_characters
      `.execute(db)
      return toCount(result.rows[0]?.count)
    },

    async countHomebrewRoots(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        select count(*) as count from (
          select 'BACKGROUND'::text as subject_kind, id as subject_id from backgrounds where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'CLASS', id from classes where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'CREATURE', id from creatures where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'EQUIPMENT', id from equipment where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'FEAT', id from feats where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'RACE', id from races where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'SPELL', id from spells where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select 'VEHICLE', id from vehicles where user_id = ${userId}::uuid and status = 'ACTIVE'
          union select subject_kind, subject_id from authored_drafts where user_id = ${userId}::uuid
        ) owned_roots
      `.execute(db)
      return toCount(result.rows[0]?.count)
    },

    async countUsage(userId: string): Promise<AccountEntitlementUsage> {
      const [personalCharacters, homebrewRoots, result] = await Promise.all([
        this.countPersonalCharacters(userId),
        this.countHomebrewRoots(userId),
        sql<{
          storage_bytes: string | number
          active_hosted_campaigns: string | number
          public_listings: string | number
          saved_encounters: string | number
        }>`
          select
            (
              select coalesce(sum(case when asset.status in ('PENDING_UPLOAD', 'PROCESSING') then 6291456 else 0 end), 0)
                + coalesce((select sum(variant.byte_size) from media_variants variant
                    join media_assets owned on owned.id = variant.asset_id
                    where owned.owner_user_id = ${userId}::uuid and owned.status = 'READY'), 0)
              from media_assets asset where asset.owner_user_id = ${userId}::uuid
            ) as storage_bytes,
            (select count(*) from campaigns where owner_user_id = ${userId}::uuid and status = 'ACTIVE') as active_hosted_campaigns,
            (select count(*) from campaigns where owner_user_id = ${userId}::uuid and status = 'ACTIVE' and visibility = 'PUBLIC') as public_listings,
            (select count(*) from encounters encounter join campaigns campaign on campaign.id = encounter.campaign_id
              where campaign.owner_user_id = ${userId}::uuid and encounter.status in ('PREPARED', 'ACTIVE')) as saved_encounters
        `.execute(db)
      ])
      const row = result.rows[0]

      return {
        storageBytes: toCount(row?.storage_bytes),
        personalCharacters,
        homebrewRoots,
        activeHostedCampaigns: toCount(row?.active_hosted_campaigns),
        publicListings: toCount(row?.public_listings),
        savedEncounters: toCount(row?.saved_encounters)
      }
    }
  }
}
