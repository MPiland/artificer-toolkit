import { sql } from 'kysely'
import type { DBLike } from '#types'
import { createAuthoredRouteIdRepository } from '../domains/subjects/repositories/authoredRouteId.js'
import {
  mapCampaign,
  type CampaignAuthorityRecord,
  type CampaignListRecord,
  type CampaignContentMaturity,
  type CampaignFormat,
  type CampaignMembershipStatus,
  type CampaignRecord,
  type CampaignRole,
  type CampaignStatus,
  type CampaignToneTag,
  type RawCampaignListRow,
  type RawCampaignRow,
  type Timestamp
} from './campaignTypes.js'

export function createCampaignLifecycleRepository(db: DBLike) {
  const mapStoredCampaign = (row: Record<string, unknown>, publicId: string): CampaignRecord =>
    mapCampaign({
      ...(row as unknown as RawCampaignRow),
      game_system_id: String(row.game_system_id),
      primary_rules_catalogue_id: String(row.primary_rules_catalogue_id),
      additional_rules_catalogue_ids: [],
      public_id: publicId,
      status: row.status as CampaignStatus
    })
  const requireRulesCatalogues = async (input: {
    gameSystemId: string
    primaryRulesCatalogueId: string
    additionalRulesCatalogueIds: readonly string[]
  }): Promise<void> => {
    if (input.additionalRulesCatalogueIds.length > 31) {
      throw new Error('A Campaign may enable at most 31 additional Rules Catalogues.')
    }
    const catalogueIds = [input.primaryRulesCatalogueId, ...input.additionalRulesCatalogueIds]
    if (new Set(catalogueIds).size !== catalogueIds.length) {
      throw new Error('Campaign Rules Catalogues must be unique.')
    }
    const result = await sql<{ count: string | number }>`
      SELECT count(*) AS count FROM public.rules_catalogues
      WHERE game_system_id = ${input.gameSystemId}::uuid
        AND id IN (${sql.join(catalogueIds.map((id) => sql`${id}::uuid`))})
    `.execute(db)
    if (Number(result.rows[0]?.count ?? 0) !== catalogueIds.length) {
      throw new Error('Rules Catalogues must exist and belong to the Campaign Game System.')
    }
  }
  const listAdditionalRulesCatalogueIds = async (campaignId: string): Promise<string[]> => {
    const result = await sql<{ rules_catalogue_id: string }>`
      SELECT rules_catalogue_id
      FROM public.campaign_additional_rules_catalogues
      WHERE campaign_id = ${campaignId}::uuid
      ORDER BY rules_catalogue_id
    `.execute(db)
    return result.rows.map((row) => row.rules_catalogue_id)
  }
  const listMissingContentSourceIds = async (input: {
    rulesCatalogueIds: readonly string[]
    contentSourceIds: readonly string[]
  }): Promise<string[]> => {
    const sourceIds = [...new Set(input.contentSourceIds)].sort((left, right) =>
      left.localeCompare(right)
    )
    if (sourceIds.length === 0) return []
    if (input.rulesCatalogueIds.length === 0) return sourceIds
    const result = await sql<{ content_source_id: string }>`
      SELECT DISTINCT content_source_id
      FROM public.rules_catalogue_content_sources
      WHERE catalogue_id IN (${sql.join(
        input.rulesCatalogueIds.map((catalogueId) => sql`${catalogueId}::uuid`)
      )})
        AND content_source_id IN (${sql.join(sourceIds.map((sourceId) => sql`${sourceId}::uuid`))})
      ORDER BY content_source_id
    `.execute(db)
    const enabled = new Set(result.rows.map((row) => row.content_source_id))
    return sourceIds.filter((sourceId) => !enabled.has(sourceId))
  }
  return {
    async listForActiveMember(userId: string): Promise<CampaignListRecord[]> {
      const result = await sql<RawCampaignListRow>`
        select campaign.*, campaign_route.public_id,
          coalesce((select array_agg(additional.rules_catalogue_id order by additional.rules_catalogue_id) from campaign_additional_rules_catalogues additional where additional.campaign_id = campaign.id), '{}'::uuid[]) as additional_rules_catalogue_ids,
          membership.role,
          character.id as character_id,
          route.public_id as character_public_id,
          character.label as character_label,
          character.system_id as character_system_id,
          (select count(*) from campaign_memberships counted
            where counted.campaign_id = campaign.id and counted.status = 'ACTIVE') as member_count,
          (select count(*) from campaign_memberships counted
            where counted.campaign_id = campaign.id and counted.status = 'ACTIVE' and counted.role = 'PLAYER') as player_count
        from campaigns campaign
        join authored_route_ids campaign_route
          on campaign_route.subject_kind = 'CAMPAIGN' and campaign_route.subject_id = campaign.id
        join campaign_memberships membership on membership.campaign_id = campaign.id
        left join campaign_character_assignments assignment
          on assignment.campaign_id = campaign.id and assignment.user_id = membership.user_id
        left join characters character on character.id = assignment.character_id
        left join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where membership.user_id = ${userId}::uuid and membership.status = 'ACTIVE'
        order by case when campaign.status = 'ACTIVE' then 0 else 1 end,
          campaign.created_at desc,
          campaign.id desc
      `.execute(db)
      return result.rows.map((row) => ({
        ...mapCampaign(row),
        role: row.role,
        memberCount: Number(row.member_count),
        playerCount: Number(row.player_count),
        assignedCharacter:
          row.character_id &&
          row.character_public_id &&
          row.character_label &&
          row.character_system_id
            ? {
                id: row.character_id,
                publicId: row.character_public_id,
                label: row.character_label,
                systemId: row.character_system_id
              }
            : null
      }))
    },
    async findAuthority(
      campaignId: string,
      userId: string
    ): Promise<CampaignAuthorityRecord | null> {
      const result = await sql<
        RawCampaignRow & {
          membership_role: CampaignRole
          membership_status: CampaignMembershipStatus
          access_started_at: Timestamp
          joined_at: Timestamp
          left_at: Timestamp | null
          character_id: string | null
          character_public_id: string | null
          character_label: string | null
          character_system_id: string | null
        }
      >`
        select campaign.*, campaign_route.public_id,
          coalesce((select array_agg(additional.rules_catalogue_id order by additional.rules_catalogue_id) from campaign_additional_rules_catalogues additional where additional.campaign_id = campaign.id), '{}'::uuid[]) as additional_rules_catalogue_ids,
          membership.role as membership_role, membership.status as membership_status,
          membership.access_started_at, membership.joined_at, membership.left_at,
          character.id as character_id, route.public_id as character_public_id,
          character.label as character_label, character.system_id as character_system_id
        from campaigns campaign
        join authored_route_ids campaign_route
          on campaign_route.subject_kind = 'CAMPAIGN' and campaign_route.subject_id = campaign.id
        join campaign_memberships membership on membership.campaign_id = campaign.id
        left join campaign_character_assignments assignment
          on assignment.campaign_id = campaign.id and assignment.user_id = membership.user_id
        left join characters character on character.id = assignment.character_id
        left join authored_route_ids route
          on route.subject_kind = 'CHARACTER' and route.subject_id = character.id
        where campaign.id = ${campaignId}::uuid and membership.user_id = ${userId}::uuid
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      return {
        campaign: mapCampaign(row),
        membership: {
          campaignId: row.id,
          userId,
          role: row.membership_role,
          status: row.membership_status,
          accessStartedAt: row.access_started_at,
          joinedAt: row.joined_at,
          leftAt: row.left_at
        },
        assignedCharacter:
          row.character_id &&
          row.character_public_id &&
          row.character_label &&
          row.character_system_id
            ? {
                id: row.character_id,
                publicId: row.character_public_id,
                label: row.character_label,
                systemId: row.character_system_id
              }
            : null
      }
    },
    async lockCampaign(campaignId: string): Promise<CampaignRecord | null> {
      const row = await db
        .selectFrom('campaigns')
        .selectAll()
        .where('id', '=', campaignId)
        .forUpdate()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      if (!row || !route) return null
      return mapCampaign({
        ...(row as unknown as RawCampaignRow),
        additional_rules_catalogue_ids: await listAdditionalRulesCatalogueIds(campaignId),
        public_id: route.publicId,
        status: row.status as CampaignStatus
      })
    },
    async countActiveOwned(userId: string): Promise<number> {
      const result = await sql<{
        count: string | number
      }>`select count(*) as count from campaigns where owner_user_id = ${userId}::uuid and status = 'ACTIVE'`.execute(
        db
      )
      return Number(result.rows[0]?.count ?? 0)
    },
    async requireRulesCatalogues(input: {
      gameSystemId: string
      primaryRulesCatalogueId: string
      additionalRulesCatalogueIds: readonly string[]
    }): Promise<void> {
      await requireRulesCatalogues(input)
    },
    async listContentSourceIdsMissingFromRulesCatalogues(input: {
      rulesCatalogueIds: readonly string[]
      contentSourceIds: readonly string[]
    }): Promise<string[]> {
      return listMissingContentSourceIds(input)
    },
    async listContentSourceIdsNotEnabledForCampaign(input: {
      campaignId: string
      contentSourceIds: readonly string[]
    }): Promise<string[]> {
      const campaignResult = await sql<{ primary_rules_catalogue_id: string }>`
        SELECT primary_rules_catalogue_id
        FROM public.campaigns
        WHERE id = ${input.campaignId}::uuid
      `.execute(db)
      const primary = campaignResult.rows[0]?.primary_rules_catalogue_id
      if (!primary) return [...new Set(input.contentSourceIds)]
      return listMissingContentSourceIds({
        rulesCatalogueIds: [primary, ...(await listAdditionalRulesCatalogueIds(input.campaignId))],
        contentSourceIds: input.contentSourceIds
      })
    },
    async listActiveEncounterInitiativeContentSourceIds(campaignId: string): Promise<string[]> {
      const result = await sql<{ content_source_id: string }>`
        SELECT DISTINCT source.content_source_id
        FROM public.encounters encounter
        CROSS JOIN LATERAL (
          VALUES
            (encounter.initiative_policy_snapshot #>> '{policy,contentSourceId}'),
            (encounter.initiative_policy_snapshot #>> '{evaluationGraph,contentSourceId}'),
            (encounter.initiative_policy_snapshot #>> '{orderChoiceGraph,contentSourceId}'),
            (encounter.initiative_policy_snapshot #>> '{tieResolver,contentSourceId}')
        ) AS source(content_source_id)
        WHERE encounter.campaign_id = ${campaignId}::uuid
          AND encounter.status IN ('PREPARED', 'ACTIVE')
          AND source.content_source_id IS NOT NULL
        ORDER BY source.content_source_id
      `.execute(db)
      return result.rows.map((row) => row.content_source_id)
    },
    async listOptionalCombatContentSourceIdsRequiredByCampaign(
      campaignId: string
    ): Promise<string[]> {
      const result = await sql<{ content_source_id: string }>`
        SELECT DISTINCT definition.content_source_id
        FROM public.campaign_play_settings settings
        JOIN public.reusable_definitions definition
          ON definition.id = ANY(settings.optional_combat_rule_definition_ids)
        WHERE settings.campaign_id = ${campaignId}::uuid
        UNION
        SELECT DISTINCT definition.value->>'contentSourceId'
        FROM public.encounters encounter
        CROSS JOIN LATERAL jsonb_array_elements(
          COALESCE(encounter.optional_combat_snapshot->'definitions', '[]'::jsonb)
        ) AS definition(value)
        WHERE encounter.campaign_id = ${campaignId}::uuid
          AND encounter.status IN ('PREPARED', 'ACTIVE')
          AND definition.value->>'contentSourceId' IS NOT NULL
        ORDER BY content_source_id
      `.execute(db)
      return result.rows.map((row) => row.content_source_id)
    },
    async clearAdditionalRulesCatalogues(campaignId: string): Promise<void> {
      await sql`
        DELETE FROM public.campaign_additional_rules_catalogues
        WHERE campaign_id = ${campaignId}::uuid
      `.execute(db)
    },
    async insertAdditionalRulesCatalogues(input: {
      campaignId: string
      gameSystemId: string
      primaryRulesCatalogueId: string
      additionalRulesCatalogueIds: readonly string[]
    }): Promise<void> {
      if (input.additionalRulesCatalogueIds.includes(input.primaryRulesCatalogueId)) {
        throw new Error('The Campaign primary Rules Catalogue cannot be additional.')
      }
      await requireRulesCatalogues(input)
      if (input.additionalRulesCatalogueIds.length === 0) return
      await sql`
        INSERT INTO public.campaign_additional_rules_catalogues (
          campaign_id, rules_catalogue_id, game_system_id
        ) VALUES ${sql.join(
          input.additionalRulesCatalogueIds.map(
            (catalogueId) => sql`(
          ${input.campaignId}::uuid, ${catalogueId}::uuid, ${input.gameSystemId}::uuid
        )`
          )
        )}
      `.execute(db)
    },
    async listAssignmentPrimaryRulesCatalogueIds(campaignId: string): Promise<string[]> {
      const result = await sql<{ primary_rules_catalogue_id: string }>`
        SELECT DISTINCT character.primary_rules_catalogue_id
        FROM public.campaign_character_assignments assignment
        JOIN public.characters character ON character.id = assignment.character_id
        WHERE assignment.campaign_id = ${campaignId}::uuid
        ORDER BY character.primary_rules_catalogue_id
      `.execute(db)
      return result.rows.map((row) => row.primary_rules_catalogue_id)
    },
    async createCampaign(
      ownerUserId: string,
      input: {
        name: string
        description: string | null
        format: CampaignFormat
        tone_tags: CampaignToneTag[]
        tone_details: string | null
        content_maturity: CampaignContentMaturity
        game_system_id: string
        primary_rules_catalogue_id: string
        attunement_slot_override?: number | null
      }
    ): Promise<CampaignRecord> {
      const row = await db
        .insertInto('campaigns')
        .values({ owner_user_id: ownerUserId, ...input })
        .returningAll()
        .executeTakeFirstOrThrow()
      await db.insertInto('campaign_play_settings').values({ campaign_id: row.id }).execute()
      const route = await createAuthoredRouteIdRepository(db).ensure({
        subjectKind: 'CAMPAIGN',
        subjectId: row.id
      })
      return mapStoredCampaign(row, route.publicId)
    },
    async updateCampaign(
      campaignId: string,
      expectedVersion: number,
      input: {
        name?: string
        description?: string | null
        format?: CampaignFormat
        tone_tags?: CampaignToneTag[]
        tone_details?: string | null
        content_maturity?: CampaignContentMaturity
        attunement_slot_override?: number | null
        primary_rules_catalogue_id?: string
      }
    ): Promise<CampaignRecord | null> {
      const row = await db
        .updateTable('campaigns')
        .set({ ...input, version: sql<number>`version + 1`, updated_at: new Date().toISOString() })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returningAll()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      return row && route ? mapStoredCampaign(row, route.publicId) : null
    },
    async advanceCampaignVersion(
      campaignId: string,
      expectedVersion: number
    ): Promise<CampaignRecord | null> {
      const row = await db
        .updateTable('campaigns')
        .set({
          version: sql<number>`version + 1`,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returningAll()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      return row && route ? mapStoredCampaign(row, route.publicId) : null
    },
    async archiveCampaign(
      campaignId: string,
      expectedVersion: number
    ): Promise<CampaignRecord | null> {
      const row = await db
        .updateTable('campaigns')
        .set({
          status: 'ARCHIVED',
          version: sql<number>`version + 1`,
          updated_at: new Date().toISOString()
        })
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returningAll()
        .executeTakeFirst()
      const route = row
        ? await createAuthoredRouteIdRepository(db).findBySubject({
            subjectKind: 'CAMPAIGN',
            subjectId: campaignId
          })
        : null
      if (row) {
        const now = new Date().toISOString()
        await sql`
          update social_listings
          set status = 'CLOSED', version = version + 1, updated_at = ${now}::timestamptz
          where campaign_id = ${campaignId}::uuid and status <> 'CLOSED'
        `.execute(db)
        await sql`
          update social_applications application
          set status = 'EXPIRED', expired_at = ${now}::timestamptz,
            version = application.version + 1, updated_at = ${now}::timestamptz
          from social_listings listing
          where listing.campaign_id = ${campaignId}::uuid
            and application.listing_id = listing.id and application.status = 'SUBMITTED'
        `.execute(db)
        await sql`
          update campaign_invites invite
          set status = 'EXPIRED', expired_at = ${now}::timestamptz,
            version = invite.version + 1, updated_at = ${now}::timestamptz
          from social_listings listing
          where listing.campaign_id = ${campaignId}::uuid
            and invite.listing_id = listing.id and invite.status = 'PENDING'
        `.execute(db)
      }
      return row && route ? mapStoredCampaign(row, route.publicId) : null
    },
    async deleteCampaign(campaignId: string, expectedVersion: number): Promise<boolean> {
      const result = await db
        .deleteFrom('campaigns')
        .where('id', '=', campaignId)
        .where('version', '=', expectedVersion)
        .returning('id')
        .executeTakeFirst()
      if (result)
        await createAuthoredRouteIdRepository(db).delete({
          subjectKind: 'CAMPAIGN',
          subjectId: campaignId
        })
      return Boolean(result)
    }
  }
}
