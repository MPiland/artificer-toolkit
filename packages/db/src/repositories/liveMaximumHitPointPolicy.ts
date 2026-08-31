import { sql } from 'kysely'

import {
  campaignCharacterMechanicsProjectionSchema,
  type CampaignCharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/campaignCharacterMechanics'
import type {
  CharacterRulePolicyInput,
  CharacterRulePolicyOutput
} from '@artificer-toolkit/schema/api/characterRules'
import {
  characterMechanicsProjectionSchema,
  type CharacterMechanicsProjection
} from '@artificer-toolkit/schema/projections/characterMechanics'
import type {
  CharacterEvent,
  CharacterSheetCommandAppliedEvent
} from '@artificer-toolkit/shared/core'

import type { DBLike, Json } from '#types'
import {
  checksumCampaignCharacterMechanicsProjection,
  checksumCharacterMechanicsCommandLane,
  checksumCharacterMechanicsCommandState,
  checksumCharacterMechanicsProjection
} from '../utils/index.js'

export class LiveMaximumHitPointPolicyContextError extends Error {
  constructor(
    message: string,
    readonly reason: 'ACCESS' | 'STATE' = 'STATE'
  ) {
    super(message)
    this.name = 'LiveMaximumHitPointPolicyContextError'
  }
}

function parsePriorEvent(value: Json): CharacterSheetCommandAppliedEvent {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    value.type !== 'CHARACTER_SHEET_COMMAND_APPLIED' ||
    typeof value.eventId !== 'string' ||
    typeof value.characterId !== 'string' ||
    typeof value.actorId !== 'string' ||
    typeof value.commandId !== 'string' ||
    typeof value.occurredAt !== 'string' ||
    !Number.isInteger(value.schemaVersion) ||
    typeof value.commandType !== 'string' ||
    typeof value.commandFingerprint !== 'string' ||
    typeof value.summary !== 'string'
  ) {
    throw new LiveMaximumHitPointPolicyContextError(
      'The prior Character command receipt is invalid.'
    )
  }
  return {
    type: 'CHARACTER_SHEET_COMMAND_APPLIED',
    eventId: value.eventId,
    characterId: value.characterId,
    actorId: value.actorId,
    commandId: value.commandId,
    occurredAt: value.occurredAt,
    schemaVersion: Number(value.schemaVersion),
    commandType: value.commandType,
    commandFingerprint: value.commandFingerprint,
    summary: value.summary,
    ...(typeof value.committedStreamVersion === 'number'
      ? { committedStreamVersion: value.committedStreamVersion }
      : {})
  }
}

interface CharacterProjectionRow {
  authored_version_vector: Json
  bounded_registry: Json
  character_id: string
  command_lane_checksum: string
  command_state: Json
  command_state_checksum: string
  compiled_action_entry_points: Json
  evaluator_version: string
  initiative_actor_facts: Json
  model_contract_version: number
  normalized_facts: Json
  pinned_sense_definitions: Json
  projection_checksum: string
  projection_schema_version: number
  rule_pack_checksum: string
  rule_pack_revision_id: string
  rule_result: Json
  rule_snapshot: Json
  stream_version: number
  vocabulary_snapshot_checksum: string
  vocabulary_snapshot_id: string
  vocabulary_snapshot_version: number
}

interface OverlayRow {
  base_mechanics_projection_checksum: string
  campaign_id: string
  character_id: string
  manual_maximum_modifier_owner: 'CHARACTER' | 'CAMPAIGN' | null
  mechanical_context_checksum: string
  projection_checksum: string
  projection_kind: 'BASE_REFERENCE' | 'MATERIALIZED'
  projection_schema_version: number
  rule_policy_input: Json | null
  rule_policy_output: Json | null
  stream_version: number
}

interface LockContextRow extends CharacterProjectionRow {
  adjustment_id: string | null
  adjustment_value: number | null
  character_rule_pack_revision_id: string | null
  character_status: string | null
  character_stream_version: number | null
  character_user_id: string | null
  context_status: 'ACCESS' | 'STATE' | 'OK'
  event_data: Json | null
  hit_points_current: number | null
  hit_points_temp: number | null
  overlay_base_mechanics_projection_checksum: string | null
  overlay_campaign_id: string | null
  overlay_character_id: string | null
  overlay_manual_maximum_modifier_owner: 'CHARACTER' | 'CAMPAIGN' | null
  overlay_mechanical_context_checksum: string | null
  overlay_projection_checksum: string | null
  overlay_projection_kind: 'BASE_REFERENCE' | 'MATERIALIZED' | null
  overlay_projection_schema_version: number | null
  overlay_rule_policy_input: Json | null
  overlay_rule_policy_output: Json | null
  overlay_stream_version: number | null
}

function parseMechanics(row: CharacterProjectionRow): CharacterMechanicsProjection {
  const projection = characterMechanicsProjectionSchema.parse({
    characterId: row.character_id,
    commandState: row.command_state,
    commandStateChecksum: row.command_state_checksum,
    commandLaneChecksum: row.command_lane_checksum,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    characterStreamVersion: row.stream_version,
    authoredVersionVector: row.authored_version_vector,
    systemVocabularySnapshotId: row.vocabulary_snapshot_id,
    systemVocabularySnapshotVersion: row.vocabulary_snapshot_version,
    systemVocabularySnapshotChecksum: row.vocabulary_snapshot_checksum,
    ruleRevisionId: row.rule_pack_revision_id,
    ruleRevisionChecksum: row.rule_pack_checksum,
    evaluatorVersion: row.evaluator_version,
    modelContractVersion: row.model_contract_version,
    ruleSnapshot: row.rule_snapshot,
    rulePolicyInput: row.normalized_facts,
    rulePolicyOutput: row.rule_result,
    initiativeActorFacts: row.initiative_actor_facts,
    pinnedSenseDefinitions: row.pinned_sense_definitions,
    ruleRegistry: row.bounded_registry,
    compiledActionEntryPoints: row.compiled_action_entry_points
  })
  if (
    checksumCharacterMechanicsCommandState(projection.commandState) !==
      projection.commandStateChecksum ||
    checksumCharacterMechanicsCommandLane(projection) !== projection.commandLaneChecksum ||
    checksumCharacterMechanicsProjection(projection) !== projection.projectionChecksum
  ) {
    throw new LiveMaximumHitPointPolicyContextError(
      'The committed Character mechanics projection is invalid.'
    )
  }
  return projection
}

function parseOverlay(row: OverlayRow): CampaignCharacterMechanicsProjection {
  const projection = campaignCharacterMechanicsProjectionSchema.parse({
    campaignId: row.campaign_id,
    characterId: row.character_id,
    characterStreamVersion: row.stream_version,
    baseMechanicsProjectionChecksum: row.base_mechanics_projection_checksum,
    mechanicalContextChecksum: row.mechanical_context_checksum,
    manualMaximumModifierOwner: row.manual_maximum_modifier_owner,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    kind: row.projection_kind,
    ...(row.projection_kind === 'MATERIALIZED'
      ? {
          rulePolicyInput: row.rule_policy_input,
          rulePolicyOutput: row.rule_policy_output
        }
      : {})
  })
  if (checksumCampaignCharacterMechanicsProjection(projection) !== projection.projectionChecksum) {
    throw new LiveMaximumHitPointPolicyContextError('The Campaign mechanics projection is invalid.')
  }
  return projection
}

export interface LockedLiveMaximumHitPointPolicyContext {
  campaignId: string
  character: {
    id: string
    ruleRevisionId: string
    streamVersion: number
    userId: string
  }
  existingAdjustment: { id: string; value: number } | null
  hitPoints: { current: number; temp: number | null }
  mechanics: CharacterMechanicsProjection
  overlay: CampaignCharacterMechanicsProjection
  priorEvent: CharacterSheetCommandAppliedEvent | null
}

/** Bounded live Max-HP admission. Campaign, assignment, Character, then HP state. */
export function createLiveMaximumHitPointPolicyRepository(db: DBLike) {
  return {
    async prepareAndCommit(input: {
      context: LockedLiveMaximumHitPointPolicyContext
      event: CharacterEvent
      nextAdjustment: { actorId: string; id: string; value: number } | null
      nextHitPoints: { current: number; temp: number | null }
      nextCharacterCommandState: CharacterMechanicsProjection['commandState']
      nextBasePolicy: Pick<CharacterMechanicsProjection, 'rulePolicyInput' | 'rulePolicyOutput'>
      nextCampaignPolicy: {
        rulePolicyInput: CharacterRulePolicyInput
        rulePolicyOutput: CharacterRulePolicyOutput
      } | null
      nextManualMaximumModifierOwner: 'CHARACTER' | 'CAMPAIGN' | null
    }): Promise<number> {
      const { context } = input
      const previousMechanics = context.mechanics
      const previousOverlay = context.overlay
      const nextStreamVersion = context.character.streamVersion + 1
      const commandStateChecksum = checksumCharacterMechanicsCommandState(
        input.nextCharacterCommandState
      )
      const mechanicsCandidate = {
        ...previousMechanics,
        characterStreamVersion: nextStreamVersion,
        commandState: input.nextCharacterCommandState,
        commandStateChecksum,
        commandLaneChecksum: '0'.repeat(64),
        projectionChecksum: '0'.repeat(64),
        rulePolicyInput: input.nextBasePolicy.rulePolicyInput,
        rulePolicyOutput: input.nextBasePolicy.rulePolicyOutput
      }
      const parsedMechanics = characterMechanicsProjectionSchema.parse({
        ...mechanicsCandidate,
        commandLaneChecksum: checksumCharacterMechanicsCommandLane(mechanicsCandidate)
      })
      const mechanics = {
        ...parsedMechanics,
        projectionChecksum: checksumCharacterMechanicsProjection(parsedMechanics)
      }
      if (
        (previousOverlay.kind === 'MATERIALIZED' && input.nextCampaignPolicy == null) ||
        (previousOverlay.kind === 'BASE_REFERENCE' && input.nextCampaignPolicy != null)
      ) {
        throw new LiveMaximumHitPointPolicyContextError(
          'The next Campaign mechanics policy does not match the committed projection kind.'
        )
      }
      const overlayCandidate = {
        campaignId: previousOverlay.campaignId,
        characterId: previousOverlay.characterId,
        characterStreamVersion: nextStreamVersion,
        baseMechanicsProjectionChecksum: mechanics.projectionChecksum,
        mechanicalContextChecksum: previousOverlay.mechanicalContextChecksum,
        manualMaximumModifierOwner: input.nextManualMaximumModifierOwner,
        projectionSchemaVersion: previousOverlay.projectionSchemaVersion,
        projectionChecksum: '0'.repeat(64),
        kind: previousOverlay.kind,
        ...(input.nextCampaignPolicy ?? {})
      }
      const parsedOverlay = campaignCharacterMechanicsProjectionSchema.parse(overlayCandidate)
      const overlay = {
        ...parsedOverlay,
        projectionChecksum: checksumCampaignCharacterMechanicsProjection(parsedOverlay)
      }
      const adjustmentWrite = input.nextAdjustment
        ? sql`
            insert into public.character_hitpoint_adjustments (
              id, character_id, field_kind, integer_value, created_by, updated_by
            ) values (
              ${input.nextAdjustment.id}, ${context.character.id}, 'MAXIMUM_MODIFIER',
              ${input.nextAdjustment.value}, ${input.nextAdjustment.actorId}, ${input.nextAdjustment.actorId}
            ) on conflict (character_id, field_kind) do update set
              integer_value = excluded.integer_value,
              updated_by = excluded.updated_by,
              updated_at = now()
            where public.character_hitpoint_adjustments.id = ${context.existingAdjustment?.id ?? null}
            returning id
          `
        : sql`
            delete from public.character_hitpoint_adjustments
            where character_id = ${context.character.id}
              and field_kind = 'MAXIMUM_MODIFIER'
              and id = ${context.existingAdjustment?.id ?? null}
            returning id
          `
      const result = await sql<{ stream_version: number }>`
        with adjustment as (${adjustmentWrite}),
        hit_points as (
          update public.character_hitpoint_state set
            current = ${input.nextHitPoints.current}, temp = ${input.nextHitPoints.temp}
          from adjustment
          where character_hitpoint_state.character_id = ${context.character.id}
            and character_hitpoint_state.current = ${context.hitPoints.current}
            and character_hitpoint_state.temp is not distinct from ${context.hitPoints.temp}
          returning character_hitpoint_state.character_id
        ), character as (
          update public.characters set stream_version = ${mechanics.characterStreamVersion}
          from hit_points
          where characters.id = ${context.character.id}
            and characters.stream_version = ${context.character.streamVersion}
          returning characters.id, characters.stream_version
        ), base as (
          update public.character_mechanics_projections set
            stream_version = ${mechanics.characterStreamVersion},
            command_state = ${JSON.stringify(mechanics.commandState)}::jsonb,
            command_state_checksum = ${mechanics.commandStateChecksum},
            command_lane_checksum = ${mechanics.commandLaneChecksum},
            projection_checksum = ${mechanics.projectionChecksum},
            normalized_facts = ${JSON.stringify(mechanics.rulePolicyInput)}::jsonb,
            rule_result = ${JSON.stringify(mechanics.rulePolicyOutput)}::jsonb,
            compiled_action_entry_points = ${JSON.stringify(mechanics.compiledActionEntryPoints)}::jsonb,
            updated_at = now()
          from character
          where character_mechanics_projections.character_id = ${context.character.id}
            and character_mechanics_projections.stream_version = ${context.character.streamVersion}
            and character_mechanics_projections.projection_checksum = ${context.mechanics.projectionChecksum}
            and character_mechanics_projections.authored_version_vector = ${JSON.stringify(mechanics.authoredVersionVector)}::jsonb
            and character_mechanics_projections.vocabulary_snapshot_id = ${mechanics.systemVocabularySnapshotId}
            and character_mechanics_projections.rule_pack_revision_id = ${mechanics.ruleRevisionId}
            and character_mechanics_projections.rule_pack_checksum = ${mechanics.ruleRevisionChecksum}
            and character_mechanics_projections.evaluator_version = ${mechanics.evaluatorVersion}
            and character_mechanics_projections.model_contract_version = ${mechanics.modelContractVersion}
            and character_mechanics_projections.projection_schema_version = ${mechanics.projectionSchemaVersion}
            and character_mechanics_projections.rule_snapshot = ${JSON.stringify(mechanics.ruleSnapshot)}::jsonb
            and character_mechanics_projections.bounded_registry = ${JSON.stringify(mechanics.ruleRegistry)}::jsonb
          returning character_mechanics_projections.character_id
        ), campaign_overlay as (
          update public.campaign_character_mechanics_projections set
            stream_version = ${overlay.characterStreamVersion},
            base_mechanics_projection_checksum = ${overlay.baseMechanicsProjectionChecksum},
            mechanical_context_checksum = ${overlay.mechanicalContextChecksum},
            manual_maximum_modifier_owner = ${overlay.manualMaximumModifierOwner},
            projection_schema_version = ${overlay.projectionSchemaVersion},
            projection_checksum = ${overlay.projectionChecksum},
            projection_kind = ${overlay.kind},
            rule_policy_input = ${overlay.kind === 'MATERIALIZED' ? JSON.stringify(overlay.rulePolicyInput) : null}::jsonb,
            rule_policy_output = ${overlay.kind === 'MATERIALIZED' ? JSON.stringify(overlay.rulePolicyOutput) : null}::jsonb,
            updated_at = now()
          from base
          where campaign_character_mechanics_projections.campaign_id = ${context.campaignId}
            and campaign_character_mechanics_projections.character_id = ${context.character.id}
            and campaign_character_mechanics_projections.stream_version = ${context.overlay.characterStreamVersion}
            and campaign_character_mechanics_projections.projection_checksum = ${context.overlay.projectionChecksum}
            and campaign_character_mechanics_projections.base_mechanics_projection_checksum = ${context.overlay.baseMechanicsProjectionChecksum}
            and campaign_character_mechanics_projections.mechanical_context_checksum = ${context.overlay.mechanicalContextChecksum}
          returning campaign_character_mechanics_projections.character_id
        ), event as (
          insert into public.character_events (
            event_id, character_id, event_type, event_data, schema_version, actor_id, command_id, occurred_at
          ) select
            ${input.event.eventId}, ${input.event.characterId}, ${input.event.type},
            ${JSON.stringify(input.event)}::jsonb, ${input.event.schemaVersion}, ${input.event.actorId},
            ${input.event.commandId}, ${input.event.occurredAt}::timestamptz
          from campaign_overlay
          on conflict (character_id, command_id) do nothing
          returning character_id
        )
        select stream_version from character where exists (select 1 from event)
      `.execute(db)
      const committed = result.rows[0]?.stream_version
      if (committed == null) {
        throw new LiveMaximumHitPointPolicyContextError('The live Max-HP commit lost currentness.')
      }
      return committed
    },
    async lockContext(input: {
      authorityId: string
      characterId: string
      commandId: string
      expectedCampaignId: string
      expectedStreamVersion: number
      sessionId: string
      userId: string
    }): Promise<LockedLiveMaximumHitPointPolicyContext> {
      const result = await sql<LockContextRow>`
        with active_campaign as materialized (
          select campaign.id
          from public.campaigns campaign
          where campaign.id = ${input.expectedCampaignId} and campaign.status = 'ACTIVE'
          for share
        ), assignment as materialized (
          select assignment.campaign_id
          from public.campaign_character_assignments assignment
          join active_campaign campaign on campaign.id = assignment.campaign_id
          where assignment.character_id = ${input.characterId}
          for update
        ), character_lock as materialized (
          select character.id, character.user_id, character.status, character.rule_pack_revision_id,
            character.stream_version
          from public.characters character
          join assignment on true
          where character.id = ${input.characterId}
          for update
        ), hit_points as materialized (
          select hit_points.current, hit_points.temp
          from public.character_hitpoint_state hit_points
          join character_lock character on true
          where hit_points.character_id = character.id
          for update
        ), admission as materialized (
          select membership.role
          from hit_points
          join active_campaign campaign on true
          join character_lock character on true
          join public.campaign_memberships membership
            on membership.campaign_id = campaign.id
            and membership.user_id = ${input.userId}
            and membership.status = 'ACTIVE'
          join public.campaign_sessions session
            on session.id = ${input.sessionId}
            and session.campaign_id = campaign.id
            and session.status = 'OPEN'
          join public.campaign_session_attendance attendance
            on attendance.session_id = session.id
            and attendance.campaign_id = campaign.id
            and attendance.character_id = character.id
            and attendance.present = true
          join public.live_session_command_leases lease
            on lease.session_id = session.id
            and lease.authority_id = ${input.authorityId}
            and lease.expires_at > now()
          for share of membership, session, attendance, lease
        ), base as materialized (
          select projection.character_id, projection.command_state, projection.command_state_checksum,
            projection.command_lane_checksum, projection.stream_version, projection.authored_version_vector,
            projection.vocabulary_snapshot_id, snapshot.vocabulary_version as vocabulary_snapshot_version,
            snapshot.checksum as vocabulary_snapshot_checksum, projection.rule_pack_revision_id,
            projection.rule_pack_checksum, projection.evaluator_version, projection.model_contract_version,
            projection.projection_schema_version, projection.projection_checksum, projection.rule_snapshot,
            projection.normalized_facts, projection.bounded_registry, projection.rule_result,
            projection.initiative_actor_facts, projection.pinned_sense_definitions,
            projection.compiled_action_entry_points
          from public.character_mechanics_projections projection
          join character_lock character on character.id = projection.character_id
          join public.system_vocabulary_snapshots snapshot on snapshot.id = projection.vocabulary_snapshot_id
          for update of projection
        ), overlay as materialized (
          select overlay.campaign_id, overlay.character_id, overlay.stream_version,
            overlay.base_mechanics_projection_checksum, overlay.mechanical_context_checksum,
            overlay.manual_maximum_modifier_owner, overlay.projection_schema_version,
            overlay.projection_checksum, overlay.projection_kind, overlay.rule_policy_input,
            overlay.rule_policy_output
          from public.campaign_character_mechanics_projections overlay
          join assignment on assignment.campaign_id = overlay.campaign_id
          join character_lock character on character.id = overlay.character_id
          for update of overlay
        ), adjustment as materialized (
          select adjustment.id, adjustment.integer_value
          from public.character_hitpoint_adjustments adjustment
          join overlay on overlay.character_id = adjustment.character_id
          where adjustment.field_kind = 'MAXIMUM_MODIFIER'
          for update of adjustment
        ), prior_event as materialized (
          select event.event_data
          from public.character_events event
          join overlay on overlay.character_id = event.character_id
          where event.command_id = ${input.commandId}
          limit 1
        )
        select
          case
            when not exists (select 1 from active_campaign)
              or not exists (select 1 from assignment)
              then 'ACCESS'
            when not exists (select 1 from character_lock)
              or not exists (select 1 from hit_points)
              or (select status from character_lock) <> 'ACTIVE'
              or (select rule_pack_revision_id from character_lock) is null
              then 'STATE'
            when not exists (select 1 from admission)
              or (select user_id from character_lock) <> ${input.userId}
                and (select role from admission) <> 'OWNER'
              then 'ACCESS'
            when not exists (select 1 from base)
              or not exists (select 1 from overlay)
              then 'STATE'
            else 'OK'
          end as context_status,
          character.id as character_id,
          character.user_id as character_user_id,
          character.status as character_status,
          character.rule_pack_revision_id as character_rule_pack_revision_id,
          character.stream_version as character_stream_version,
          hit_points.current as hit_points_current,
          hit_points.temp as hit_points_temp,
          base.*, overlay.campaign_id as overlay_campaign_id,
          overlay.character_id as overlay_character_id,
          overlay.stream_version as overlay_stream_version,
          overlay.base_mechanics_projection_checksum as overlay_base_mechanics_projection_checksum,
          overlay.mechanical_context_checksum as overlay_mechanical_context_checksum,
          overlay.manual_maximum_modifier_owner as overlay_manual_maximum_modifier_owner,
          overlay.projection_schema_version as overlay_projection_schema_version,
          overlay.projection_checksum as overlay_projection_checksum,
          overlay.projection_kind as overlay_projection_kind,
          overlay.rule_policy_input as overlay_rule_policy_input,
          overlay.rule_policy_output as overlay_rule_policy_output,
          adjustment.id as adjustment_id,
          adjustment.integer_value as adjustment_value, prior_event.event_data
        from (values (true)) as scope(present)
        left join character_lock character on true
        left join hit_points on true
        left join base on true
        left join overlay on true
        left join adjustment on true
        left join prior_event on true
      `.execute(db)
      const row = result.rows[0]
      if (!row || row.context_status !== 'OK') {
        throw new LiveMaximumHitPointPolicyContextError(
          'The live Max-HP command context is unavailable.',
          row?.context_status === 'ACCESS' ? 'ACCESS' : 'STATE'
        )
      }
      let priorEvent = row.event_data ? parsePriorEvent(row.event_data) : null
      if (priorEvent === null && row.character_stream_version !== input.expectedStreamVersion) {
        const receipt = await sql<{ event_data: Json }>`
          select event_data
          from public.character_events
          where character_id = ${input.characterId} and command_id = ${input.commandId}
          limit 1
        `.execute(db)
        priorEvent = receipt.rows[0] ? parsePriorEvent(receipt.rows[0].event_data) : null
      }
      const mechanics = parseMechanics(row)
      if (
        row.overlay_campaign_id === null ||
        row.overlay_character_id === null ||
        row.overlay_stream_version === null ||
        row.overlay_base_mechanics_projection_checksum === null ||
        row.overlay_mechanical_context_checksum === null ||
        row.overlay_projection_schema_version === null ||
        row.overlay_projection_checksum === null ||
        row.overlay_projection_kind === null
      ) {
        throw new LiveMaximumHitPointPolicyContextError(
          'The Campaign mechanics projection is unavailable.'
        )
      }
      const overlay = parseOverlay({
        campaign_id: row.overlay_campaign_id,
        character_id: row.overlay_character_id,
        stream_version: row.overlay_stream_version,
        base_mechanics_projection_checksum: row.overlay_base_mechanics_projection_checksum,
        mechanical_context_checksum: row.overlay_mechanical_context_checksum,
        manual_maximum_modifier_owner: row.overlay_manual_maximum_modifier_owner,
        projection_schema_version: row.overlay_projection_schema_version,
        projection_checksum: row.overlay_projection_checksum,
        projection_kind: row.overlay_projection_kind,
        rule_policy_input: row.overlay_rule_policy_input,
        rule_policy_output: row.overlay_rule_policy_output
      })
      if (
        row.character_user_id === null ||
        row.character_rule_pack_revision_id === null ||
        row.character_stream_version === null ||
        row.hit_points_current === null ||
        mechanics.characterStreamVersion !== row.character_stream_version ||
        mechanics.ruleRevisionId !== row.character_rule_pack_revision_id ||
        overlay.projectionSchemaVersion !== 3 ||
        overlay.characterStreamVersion !== row.character_stream_version ||
        overlay.baseMechanicsProjectionChecksum !== mechanics.projectionChecksum
      ) {
        throw new LiveMaximumHitPointPolicyContextError('The live Max-HP command context is stale.')
      }
      return {
        campaignId: input.expectedCampaignId,
        character: {
          id: row.character_id,
          userId: row.character_user_id,
          ruleRevisionId: row.character_rule_pack_revision_id,
          streamVersion: row.character_stream_version
        },
        existingAdjustment:
          row.adjustment_id !== null && row.adjustment_value !== null
            ? { id: row.adjustment_id, value: row.adjustment_value }
            : null,
        hitPoints: {
          current: row.hit_points_current,
          temp: row.hit_points_temp
        },
        mechanics,
        overlay,
        priorEvent
      }
    }
  }
}
