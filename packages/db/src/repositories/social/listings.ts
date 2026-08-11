import { sql } from 'kysely'

import type { DBLike } from '#types'

import type {
  SocialDiscoveryFilters,
  SocialListingRecord,
  SocialListingStatus,
  SocialListingWrite,
  SocialPlayMode,
  SocialRecurrence,
  SocialSafetyPractice,
  SocialScheduleKind
} from './types.js'
import type { CampaignContentMaturity, CampaignFormat, CampaignToneTag } from '../campaignTypes.js'

type RawListing = {
  id: string
  campaign_id: string
  campaign_owner_user_id: string
  campaign_status: 'ACTIVE' | 'ARCHIVED'
  host_profile_id: string
  host_username: string
  status: SocialListingStatus
  audience: 'PRIVATE' | 'PUBLIC'
  moderation_status: 'VISIBLE' | 'HIDDEN'
  system_id: string
  system_label: string
  ruleset_code: string
  ruleset_version: string
  title: string
  summary: string
  campaign_format: CampaignFormat
  tone_tags: CampaignToneTag[]
  tone_details: string | null
  content_maturity: CampaignContentMaturity
  play_mode: SocialPlayMode
  capacity: number
  active_player_count: string | number
  schedule_kind: SocialScheduleKind
  time_zone: string
  schedule_summary: string
  starts_at: string | Date | null
  weekday: number | null
  local_start_time: string | null
  recurrence: SocialRecurrence | null
  city: string | null
  state_code: string | null
  content_guidance: string
  attendance_policy: string
  allowed_content_rules: string
  table_conduct: string
  content_boundaries: string
  safety_practices: SocialSafetyPractice[]
  safety_details: string
  is_free: boolean
  price_amount: string | number | null
  price_currency: string | null
  published_at: string | Date | null
  version: number
  created_at: string | Date
  updated_at: string | Date
}

const listingColumns = sql.raw(`
  listing.id, listing.campaign_id,
  campaign.owner_user_id as campaign_owner_user_id,
  campaign.status as campaign_status,
  host.id as host_profile_id, host_account.username as host_username,
  listing.status, listing.audience, listing.moderation_status,
  listing.system_id, system.label as system_label,
  system.ruleset_code, system.ruleset_version,
  listing.title, listing.summary, listing.campaign_format, listing.tone_tags,
  listing.tone_details, listing.content_maturity, listing.play_mode, listing.capacity,
  coalesce(player_count.active_player_count, 0) as active_player_count,
  listing.schedule_kind, listing.time_zone, listing.schedule_summary,
  listing.starts_at, listing.weekday, listing.local_start_time, listing.recurrence,
  listing.city, listing.state_code, listing.content_guidance,
  listing.attendance_policy, listing.allowed_content_rules, listing.table_conduct,
  listing.content_boundaries, listing.safety_practices, listing.safety_details,
  listing.is_free, listing.price_amount, listing.price_currency,
  listing.published_at, listing.version, listing.created_at, listing.updated_at
`)

const listingJoins = sql.raw(`
  join campaigns campaign on campaign.id = listing.campaign_id
  join social_profiles host on host.user_id = campaign.owner_user_id
  join profiles host_account on host_account.id = campaign.owner_user_id
  join systems system on system.id = listing.system_id
  left join lateral (
    select count(*) as active_player_count
    from campaign_memberships membership
    where membership.campaign_id = listing.campaign_id
      and membership.role = 'PLAYER' and membership.status = 'ACTIVE'
  ) player_count on true
`)

function mapListing(row: RawListing): SocialListingRecord {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    campaignOwnerUserId: row.campaign_owner_user_id,
    campaignStatus: row.campaign_status,
    hostProfileId: row.host_profile_id,
    hostUsername: row.host_username,
    status: row.status,
    audience: row.audience,
    moderationStatus: row.moderation_status,
    systemId: row.system_id,
    systemLabel: row.system_label,
    rulesetCode: row.ruleset_code,
    rulesetVersion: row.ruleset_version,
    title: row.title,
    summary: row.summary,
    campaignFormat: row.campaign_format,
    toneTags: row.tone_tags,
    toneDetails: row.tone_details,
    contentMaturity: row.content_maturity,
    playMode: row.play_mode,
    capacity: row.capacity,
    activePlayerCount: Number(row.active_player_count),
    scheduleKind: row.schedule_kind,
    timeZone: row.time_zone,
    scheduleSummary: row.schedule_summary,
    startsAt: row.starts_at,
    weekday: row.weekday,
    localStartTime: row.local_start_time,
    recurrence: row.recurrence,
    city: row.city,
    stateCode: row.state_code,
    contentGuidance: row.content_guidance,
    attendancePolicy: row.attendance_policy,
    allowedContentRules: row.allowed_content_rules,
    tableConduct: row.table_conduct,
    contentBoundaries: row.content_boundaries,
    safetyPractices: row.safety_practices,
    safetyDetails: row.safety_details,
    isFree: row.is_free,
    priceAmount: row.price_amount,
    priceCurrency: row.price_currency,
    publishedAt: row.published_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function safetyArray(practices: SocialSafetyPractice[]) {
  return sql`array[${sql.join(practices.map((practice) => sql`${practice}`))}]::text[]`
}

function toneArray(tags: CampaignToneTag[]) {
  return sql`array[${sql.join(tags.map((tag) => sql`${tag}`))}]::text[]`
}

function listingValues(input: SocialListingWrite) {
  return sql`
    ${input.title}, ${input.summary}, ${input.audience}, ${input.systemId}::uuid,
    ${input.campaignFormat}, ${toneArray(input.toneTags)}, ${input.toneDetails},
    ${input.contentMaturity}, ${input.playMode}, ${input.capacity},
    ${input.scheduleKind}, ${input.timeZone}, ${input.scheduleSummary},
    ${input.startsAt}::timestamptz, ${input.weekday}, ${input.localStartTime}::time,
    ${input.recurrence}, ${input.city}, ${input.stateCode},
    ${input.contentGuidance}, ${input.attendancePolicy}, ${input.allowedContentRules},
    ${input.tableConduct}, ${input.contentBoundaries},
    ${safetyArray(input.safetyPractices)}, ${input.safetyDetails},
    ${input.isFree}, ${input.priceAmount}, ${input.priceCurrency}
  `
}

export function createSocialListingRepository(db: DBLike) {
  const findListing = async (
    predicate: ReturnType<typeof sql>
  ): Promise<SocialListingRecord | null> => {
    const result = await sql<RawListing>`
      select ${listingColumns}
      from social_listings listing
      ${listingJoins}
      where ${predicate}
    `.execute(db)
    const row = result.rows[0]
    return row ? mapListing(row) : null
  }

  return {
    async findSocialListingById(listingId: string): Promise<SocialListingRecord | null> {
      return findListing(sql`listing.id = ${listingId}::uuid`)
    },

    async findSocialListingByCampaign(campaignId: string): Promise<SocialListingRecord | null> {
      return findListing(sql`listing.campaign_id = ${campaignId}::uuid`)
    },

    async findOwnedSocialListing(
      ownerUserId: string,
      listingId: string
    ): Promise<SocialListingRecord | null> {
      return findListing(
        sql`listing.id = ${listingId}::uuid and campaign.owner_user_id = ${ownerUserId}::uuid`
      )
    },

    async findVisibleSocialListing(
      viewerProfileId: string,
      listingId: string
    ): Promise<SocialListingRecord | null> {
      return findListing(sql`
        listing.id = ${listingId}::uuid
        and listing.status = 'OPEN' and listing.audience = 'PUBLIC'
        and listing.moderation_status = 'VISIBLE'
        and campaign.status = 'ACTIVE' and host.status = 'ACTIVE'
        and host.adult_attested_at is not null and host.us_attested_at is not null
        and not exists (
          select 1 from social_blocks block
          where (block.blocker_profile_id = ${viewerProfileId}::uuid
              and block.blocked_profile_id = host.id)
            or (block.blocker_profile_id = host.id
              and block.blocked_profile_id = ${viewerProfileId}::uuid)
        )
      `)
    },

    async listOwnedSocialListings(ownerUserId: string): Promise<SocialListingRecord[]> {
      const result = await sql<RawListing>`
        select ${listingColumns}
        from social_listings listing
        ${listingJoins}
        where campaign.owner_user_id = ${ownerUserId}::uuid
        order by case listing.status when 'OPEN' then 0 when 'DRAFT' then 1 else 2 end,
          listing.updated_at desc, listing.id desc
      `.execute(db)
      return result.rows.map(mapListing)
    },

    async searchSocialListings(
      viewerProfileId: string,
      filters: SocialDiscoveryFilters
    ): Promise<SocialListingRecord[]> {
      const conditions = [
        sql`listing.status = 'OPEN'`,
        sql`listing.audience = 'PUBLIC'`,
        sql`listing.moderation_status = 'VISIBLE'`,
        sql`campaign.status = 'ACTIVE'`,
        sql`host.status = 'ACTIVE'`,
        sql`host.adult_attested_at is not null`,
        sql`host.us_attested_at is not null`,
        sql`not exists (
          select 1 from social_blocks block
          where (block.blocker_profile_id = ${viewerProfileId}::uuid
              and block.blocked_profile_id = host.id)
            or (block.blocker_profile_id = host.id
              and block.blocked_profile_id = ${viewerProfileId}::uuid)
        )`
      ]
      if (filters.query)
        conditions.push(
          sql`listing.search_vector @@ websearch_to_tsquery('simple', ${filters.query})`
        )
      if (filters.systemId) conditions.push(sql`listing.system_id = ${filters.systemId}::uuid`)
      if (filters.rulesetCode) conditions.push(sql`system.ruleset_code = ${filters.rulesetCode}`)
      if (filters.rulesetVersion)
        conditions.push(sql`system.ruleset_version = ${filters.rulesetVersion}`)
      if (filters.campaignFormat)
        conditions.push(sql`listing.campaign_format = ${filters.campaignFormat}`)
      if (filters.contentMaturity)
        conditions.push(sql`listing.content_maturity = ${filters.contentMaturity}`)
      if (filters.toneTags?.length)
        conditions.push(sql`listing.tone_tags && ${toneArray(filters.toneTags)}`)
      if (filters.playMode) conditions.push(sql`listing.play_mode = ${filters.playMode}`)
      if (filters.timeZone) conditions.push(sql`listing.time_zone = ${filters.timeZone}`)
      if (filters.scheduleKind)
        conditions.push(sql`listing.schedule_kind = ${filters.scheduleKind}`)
      if (filters.weekday !== undefined) conditions.push(sql`listing.weekday = ${filters.weekday}`)
      if (filters.stateCode) conditions.push(sql`listing.state_code = ${filters.stateCode}`)
      if (filters.city) conditions.push(sql`lower(listing.city) = lower(${filters.city})`)
      if (filters.minimumAvailableSeats !== undefined)
        conditions.push(
          sql`listing.capacity - coalesce(player_count.active_player_count, 0) >= ${filters.minimumAvailableSeats}`
        )
      if (filters.safetyPractices?.length)
        conditions.push(sql`listing.safety_practices @> ${safetyArray(filters.safetyPractices)}`)
      if (filters.cursor)
        conditions.push(
          sql`(listing.published_at, listing.id) < (${filters.cursor.publishedAt}::timestamptz, ${filters.cursor.listingId}::uuid)`
        )

      const result = await sql<RawListing>`
        select ${listingColumns}
        from social_listings listing
        ${listingJoins}
        where ${sql.join(conditions, sql` and `)}
        order by listing.published_at desc, listing.id desc
        limit ${filters.limit + 1}
      `.execute(db)
      return result.rows.map(mapListing)
    },

    async createSocialListing(
      campaignId: string,
      input: SocialListingWrite
    ): Promise<SocialListingRecord> {
      const result = await sql<{ id: string }>`
        insert into social_listings (
          campaign_id, title, summary, audience, system_id, campaign_format, tone_tags,
          tone_details, content_maturity, play_mode, capacity, schedule_kind, time_zone,
          schedule_summary, starts_at, weekday, local_start_time, recurrence, city, state_code,
          content_guidance, attendance_policy, allowed_content_rules, table_conduct,
          content_boundaries, safety_practices, safety_details,
          is_free, price_amount, price_currency
        ) values (${campaignId}::uuid, ${listingValues(input)})
        returning id
      `.execute(db)
      const id = result.rows[0]?.id
      if (!id) throw new Error('Failed to create Social listing.')
      const listing = await findListing(sql`listing.id = ${id}::uuid`)
      if (!listing) throw new Error('Failed to read created Social listing.')
      return listing
    },

    async updateSocialListing(
      listingId: string,
      expectedVersion: number,
      input: SocialListingWrite,
      now: string
    ): Promise<SocialListingRecord | null> {
      const result = await sql<{ id: string }>`
        update social_listings
        set (
          title, summary, audience, system_id, campaign_format, tone_tags,
          tone_details, content_maturity, play_mode, capacity, schedule_kind, time_zone,
          schedule_summary, starts_at, weekday, local_start_time, recurrence, city, state_code,
          content_guidance, attendance_policy, allowed_content_rules, table_conduct,
          content_boundaries, safety_practices, safety_details,
          is_free, price_amount, price_currency
        ) = (${listingValues(input)}),
          status = case when status = 'CLOSED' then 'DRAFT' else status end,
          version = version + 1, updated_at = ${now}::timestamptz
        where id = ${listingId}::uuid and version = ${expectedVersion}
        returning id
      `.execute(db)
      return result.rows[0] ? findListing(sql`listing.id = ${listingId}::uuid`) : null
    },

    async syncSocialListingCampaignProjection(input: {
      listingId: string
      expectedVersion: number
      title: string
      campaignFormat: CampaignFormat
      toneTags: CampaignToneTag[]
      toneDetails: string | null
      contentMaturity: CampaignContentMaturity
      now: string
    }): Promise<SocialListingRecord | null> {
      const result = await sql<{ id: string }>`
        update social_listings
        set title = ${input.title}, campaign_format = ${input.campaignFormat},
          tone_tags = ${toneArray(input.toneTags)}, tone_details = ${input.toneDetails},
          content_maturity = ${input.contentMaturity}, version = version + 1,
          updated_at = ${input.now}::timestamptz
        where id = ${input.listingId}::uuid and version = ${input.expectedVersion}
        returning id
      `.execute(db)
      return result.rows[0] ? findListing(sql`listing.id = ${input.listingId}::uuid`) : null
    },

    async setSocialListingStatus(input: {
      listingId: string
      expectedVersion: number
      status: SocialListingStatus
      now: string
    }): Promise<SocialListingRecord | null> {
      const result = await sql<{ id: string }>`
        update social_listings
        set status = ${input.status},
          published_at = case when ${input.status} = 'OPEN'
            then coalesce(published_at, ${input.now}::timestamptz) else published_at end,
          version = version + 1, updated_at = ${input.now}::timestamptz
        where id = ${input.listingId}::uuid and version = ${input.expectedVersion}
        returning id
      `.execute(db)
      return result.rows[0] ? findListing(sql`listing.id = ${input.listingId}::uuid`) : null
    },

    async lockSocialListing(listingId: string): Promise<SocialListingRecord | null> {
      const result = await sql<RawListing>`
        select ${listingColumns}
        from social_listings listing
        ${listingJoins}
        where listing.id = ${listingId}::uuid
        for update of listing
      `.execute(db)
      const row = result.rows[0]
      return row ? mapListing(row) : null
    },

    async deleteDraftSocialListing(listingId: string, expectedVersion: number): Promise<boolean> {
      const result = await sql<{ id: string }>`
        delete from social_listings
        where id = ${listingId}::uuid and version = ${expectedVersion} and status = 'DRAFT'
        returning id
      `.execute(db)
      return Boolean(result.rows[0])
    }
  }
}
