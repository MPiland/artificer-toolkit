import { sql } from 'kysely'

import {
  encounterCurrentProjectionSchema,
  type EncounterCurrentProjection
} from '@artificer-toolkit/schema/projections/encounter'

import type { DBLike, Json } from '#types'
import { checksumEncounterCurrentProjection } from '../utils/versionedProjectionChecksum.js'

type RuntimeTimestamp = Date | string

export type EncounterStatus = 'PREPARED' | 'ACTIVE' | 'COMPLETED'
export type EncounterActorKind = 'CHARACTER' | 'CREATURE' | 'CUSTOM'

export interface EncounterTemplateEnemy {
  kind: 'CREATURE' | 'CUSTOM'
  sourceId: string | null
  sourceRevision: number | null
  label: string
  systemId: string | null
  maxHitPoints: number
  snapshot: Json
}

export interface EncounterTemplateRecord {
  id: string
  campaignId: string
  name: string
  version: number
  enemies: EncounterTemplateEnemy[]
  createdAt: string
  updatedAt: string
}

export interface EncounterActorRecord {
  id: string
  encounterId: string
  kind: EncounterActorKind
  sourceId: string | null
  sourceRevision: number | null
  label: string
  systemId: string | null
  stableTieKey: string
  public: boolean
  currentHitPoints: number
  maxHitPoints: number
  tempHitPoints: number
  conditions: Json
  resources: Json
  gmNotes: string | null
  initiative: number | null
  manualOrder: number | null
  snapshot: Json
  createdAt: string
  updatedAt: string
}

export interface EncounterReminderRecord {
  id: string
  encounterId: string
  label: string
  timing: 'ROUND_START' | 'ROUND_END' | 'ROUND_NUMBER' | 'TURN_START' | 'TURN_END'
  round: number | null
  actorId: string | null
  public: boolean
  notes: string | null
  order: number
}

export interface EncounterRecord {
  id: string
  campaignId: string
  sessionId: string
  templateId: string
  templateVersion: number
  rulePackRevisionId: string | null
  name: string
  status: EncounterStatus
  version: number
  round: number
  currentActorId: string | null
  createdAt: string
  updatedAt: string
  actors: EncounterActorRecord[]
  reminders: EncounterReminderRecord[]
}

/**
 * Relational envelope used to locate a committed Encounter projection. It
 * deliberately excludes actor and reminder rows so gameplay reads do not
 * rehydrate the normalized aggregate before reading that projection.
 */
export interface EncounterVersionMetadata {
  campaignId: string
  id: string
  sessionId: string
  status: EncounterStatus
  version: number
}

export interface EncounterEventRecord {
  id: string
  encounterId: string
  campaignId: string
  version: number
  commandId: string
  commandType: string
  commandFingerprint: string
  commandPayload: Json
  resultPayload: Json
  actorUserId: string
  correlationId: string | null
  createdAt: string
}

export interface EncounterRulesetRecord {
  systemId: string
  code: string
  version: string
}

export class EncounterCurrentProjectionMismatchError extends Error {
  constructor(message: string) {
    super(message)
  }
}

function iso(value: RuntimeTimestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function json(value: Json): string {
  return JSON.stringify(value)
}

function actorFromRow(row: Record<string, unknown>): EncounterActorRecord {
  return {
    id: String(row.id),
    encounterId: String(row.encounter_id),
    kind: row.kind as EncounterActorKind,
    sourceId: row.source_id == null ? null : String(row.source_id),
    sourceRevision: row.source_revision == null ? null : Number(row.source_revision),
    label: String(row.label),
    systemId: row.system_id == null ? null : String(row.system_id),
    stableTieKey: String(row.stable_tie_key),
    public: Boolean(row.public),
    currentHitPoints: Number(row.current_hit_points),
    maxHitPoints: Number(row.max_hit_points),
    tempHitPoints: Number(row.temp_hit_points),
    conditions: row.conditions as Json,
    resources: row.resources as Json,
    gmNotes: row.gm_notes == null ? null : String(row.gm_notes),
    initiative: row.initiative == null ? null : Number(row.initiative),
    manualOrder: row.manual_order == null ? null : Number(row.manual_order),
    snapshot: row.snapshot as Json,
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function encounterFromRow(
  row: Record<string, unknown>,
  actors: EncounterActorRecord[],
  reminders: EncounterReminderRecord[] = []
): EncounterRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    sessionId: String(row.session_id),
    templateId: String(row.template_id),
    templateVersion: Number(row.template_version),
    rulePackRevisionId:
      row.rule_pack_revision_id == null ? null : String(row.rule_pack_revision_id),
    name: String(row.name),
    status: row.status as EncounterStatus,
    version: Number(row.version),
    round: Number(row.round),
    currentActorId: row.current_actor_id == null ? null : String(row.current_actor_id),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp),
    actors,
    reminders
  }
}

function reminderFromRow(row: Record<string, unknown>): EncounterReminderRecord {
  return {
    id: String(row.id),
    encounterId: String(row.encounter_id),
    label: String(row.label),
    timing: row.timing as EncounterReminderRecord['timing'],
    round: row.round == null ? null : Number(row.round),
    actorId: row.actor_id == null ? null : String(row.actor_id),
    public: Boolean(row.public),
    notes: row.notes == null ? null : String(row.notes),
    order: Number(row.sort_order)
  }
}

function templateFromRow(row: Record<string, unknown>): EncounterTemplateRecord {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    name: String(row.name),
    version: Number(row.version),
    enemies: row.enemies as EncounterTemplateEnemy[],
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function eventFromRow(row: Record<string, unknown>): EncounterEventRecord {
  return {
    id: String(row.id),
    encounterId: String(row.encounter_id),
    campaignId: String(row.campaign_id),
    version: Number(row.version),
    commandId: String(row.command_id),
    commandType: String(row.command_type),
    commandFingerprint: String(row.command_fingerprint),
    commandPayload: row.command_payload as Json,
    resultPayload: row.result_payload as Json,
    actorUserId: String(row.actor_user_id),
    correlationId: row.correlation_id == null ? null : String(row.correlation_id),
    createdAt: iso(row.created_at as RuntimeTimestamp)
  }
}

async function actors(db: DBLike, encounterId: string): Promise<EncounterActorRecord[]> {
  const result = await sql<Record<string, unknown>>`
    SELECT *
    FROM public.encounter_actors
    WHERE encounter_id = ${encounterId}
    ORDER BY COALESCE(manual_order, 2147483647), initiative DESC NULLS LAST, stable_tie_key ASC
  `.execute(db)
  return result.rows.map(actorFromRow)
}

async function reminders(db: DBLike, encounterId: string): Promise<EncounterReminderRecord[]> {
  const result = await sql<Record<string, unknown>>`
    SELECT * FROM public.encounter_reminders WHERE encounter_id = ${encounterId}
    ORDER BY sort_order, id
  `.execute(db)
  return result.rows.map(reminderFromRow)
}

async function readEncounter(db: DBLike, encounterId: string): Promise<EncounterRecord | null> {
  const result = await sql<Record<string, unknown>>`
    SELECT * FROM public.encounters WHERE id = ${encounterId}
  `.execute(db)
  const row = result.rows[0]
  if (!row) return null
  const [encounterActors, encounterReminders] = await Promise.all([
    actors(db, encounterId),
    reminders(db, encounterId)
  ])
  return encounterFromRow(row, encounterActors, encounterReminders)
}

export function createEncounterRepository(db: DBLike) {
  return {
    async listTemplates(campaignId: string): Promise<EncounterTemplateRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_templates
        WHERE campaign_id = ${campaignId}
        ORDER BY updated_at DESC, id DESC
      `.execute(db)
      return result.rows.map(templateFromRow)
    },

    async findTemplate(
      campaignId: string,
      templateId: string
    ): Promise<EncounterTemplateRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_templates
        WHERE campaign_id = ${campaignId} AND id = ${templateId}
      `.execute(db)
      return result.rows[0] ? templateFromRow(result.rows[0]) : null
    },

    async findTemplateByCampaignCommand(
      campaignId: string,
      commandId: string
    ): Promise<{ template: EncounterTemplateRecord; commandFingerprint: string } | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_templates
        WHERE campaign_id = ${campaignId} AND command_id = ${commandId}
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            template: templateFromRow(row),
            commandFingerprint: String(row.command_fingerprint)
          }
        : null
    },

    async createTemplate(input: {
      id: string
      campaignId: string
      commandId: string
      commandFingerprint: string
      name: string
      enemies: EncounterTemplateEnemy[]
    }): Promise<EncounterTemplateRecord | null> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_templates (
          id, campaign_id, command_id, command_fingerprint, name, enemies
        ) VALUES (
          ${input.id}, ${input.campaignId}, ${input.commandId}, ${input.commandFingerprint},
          ${input.name}, ${json(input.enemies as unknown as Json)}::jsonb
        )
        ON CONFLICT (campaign_id, command_id) DO NOTHING
        RETURNING *
      `.execute(db)
      const row = result.rows[0]
      return row ? templateFromRow(row) : null
    },

    async find(encounterId: string): Promise<EncounterRecord | null> {
      return readEncounter(db, encounterId)
    },

    async findVersionMetadata(encounterId: string): Promise<EncounterVersionMetadata | null> {
      const result = await sql<{
        campaign_id: string
        id: string
        session_id: string
        status: EncounterStatus
        version: number
      }>`
        SELECT id, campaign_id, session_id, status, version
        FROM public.encounters
        WHERE id = ${encounterId}
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            campaignId: row.campaign_id,
            id: row.id,
            sessionId: row.session_id,
            status: row.status,
            version: Number(row.version)
          }
        : null
    },

    async findActiveForCampaign(campaignId: string): Promise<EncounterRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounters
        WHERE campaign_id = ${campaignId} AND status = 'ACTIVE'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `.execute(db)
      const row = result.rows[0]
      return row ? readEncounter(db, String(row.id)) : null
    },

    async findActiveVersionMetadataForCampaign(
      campaignId: string
    ): Promise<EncounterVersionMetadata | null> {
      const result = await sql<{
        campaign_id: string
        id: string
        session_id: string
        status: EncounterStatus
        version: number
      }>`
        SELECT id, campaign_id, session_id, status, version
        FROM public.encounters
        WHERE campaign_id = ${campaignId} AND status = 'ACTIVE'
        ORDER BY updated_at DESC, id DESC
        LIMIT 1
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            campaignId: row.campaign_id,
            id: row.id,
            sessionId: row.session_id,
            status: row.status,
            version: Number(row.version)
          }
        : null
    },

    async listForCampaign(campaignId: string): Promise<EncounterRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounters
        WHERE campaign_id = ${campaignId}
        ORDER BY
          CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PREPARED' THEN 1 ELSE 2 END,
          updated_at DESC,
          id DESC
      `.execute(db)
      return Promise.all(result.rows.map((row) => readEncounter(db, String(row.id)))).then(
        (encounters) =>
          encounters.filter((encounter): encounter is EncounterRecord => encounter !== null)
      )
    },

    async listVersionMetadataForCampaign(
      campaignId: string
    ): Promise<EncounterVersionMetadata[]> {
      const result = await sql<{
        campaign_id: string
        id: string
        session_id: string
        status: EncounterStatus
        version: number
      }>`
        SELECT id, campaign_id, session_id, status, version
        FROM public.encounters
        WHERE campaign_id = ${campaignId}
        ORDER BY
          CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PREPARED' THEN 1 ELSE 2 END,
          updated_at DESC,
          id DESC
      `.execute(db)
      return result.rows.map((row) => ({
        campaignId: row.campaign_id,
        id: row.id,
        sessionId: row.session_id,
        status: row.status,
        version: Number(row.version)
      }))
    },

    async listVersionMetadataForSession(
      campaignId: string,
      sessionId: string
    ): Promise<Array<{ id: string; version: number }>> {
      const result = await sql<{ id: string; version: number }>`
        SELECT id, version
        FROM public.encounters
        WHERE campaign_id = ${campaignId} AND session_id = ${sessionId}
        ORDER BY id ASC
      `.execute(db)
      return result.rows.map((row) => ({ id: row.id, version: Number(row.version) }))
    },

    async countSavedForOwner(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        SELECT count(*) AS count
        FROM public.encounters encounter
        JOIN public.campaigns campaign ON campaign.id = encounter.campaign_id
        WHERE campaign.owner_user_id = ${userId}
          AND encounter.status IN ('PREPARED', 'ACTIVE')
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    },

    async countTemplatesForOwner(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        SELECT count(*) AS count
        FROM public.encounter_templates template
        JOIN public.campaigns campaign ON campaign.id = template.campaign_id
        WHERE campaign.owner_user_id = ${userId}
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    },

    async lock(encounterId: string): Promise<EncounterRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounters WHERE id = ${encounterId} FOR UPDATE
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      const [encounterActors, encounterReminders] = await Promise.all([
        actors(db, encounterId),
        reminders(db, encounterId)
      ])
      return encounterFromRow(row, encounterActors, encounterReminders)
    },

    async create(input: {
      id: string
      campaignId: string
      sessionId: string
      templateId: string
      templateVersion: number
      rulePackRevisionId?: string | null
      name: string
    }): Promise<EncounterRecord> {
      await sql`
        INSERT INTO public.encounters (
          id, campaign_id, session_id, template_id, template_version, rule_pack_revision_id, name
        ) VALUES (
          ${input.id}, ${input.campaignId}, ${input.sessionId}, ${input.templateId}, ${input.templateVersion},
          ${input.rulePackRevisionId ?? null}, ${input.name}
        )
      `.execute(db)
      const result = await readEncounter(db, input.id)
      if (!result) throw new Error('Encounter was not created.')
      return result
    },

    async update(input: {
      encounterId: string
      status: EncounterStatus
      version: number
      round: number
      currentActorId: string | null
    }): Promise<void> {
      await sql`
        UPDATE public.encounters
        SET status = ${input.status}, version = ${input.version}, round = ${input.round},
            current_actor_id = ${input.currentActorId}, updated_at = now()
        WHERE id = ${input.encounterId}
      `.execute(db)
    },

    async setRulePackRevision(encounterId: string, rulePackRevisionId: string): Promise<void> {
      await sql`
        UPDATE public.encounters
        SET rule_pack_revision_id = ${rulePackRevisionId}, updated_at = now()
        WHERE id = ${encounterId}
      `.execute(db)
    },

    async addActor(input: {
      id: string
      encounterId: string
      kind: EncounterActorKind
      sourceId: string | null
      sourceRevision: number | null
      label: string
      systemId: string | null
      stableTieKey: string
      public: boolean
      currentHitPoints: number
      maxHitPoints: number
      tempHitPoints: number
      conditions: Json
      resources: Json
      gmNotes: string | null
      initiative: number | null
      manualOrder: number | null
      snapshot: Json
    }): Promise<EncounterActorRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_actors (
          id, encounter_id, kind, source_id, source_revision, label, system_id, stable_tie_key,
          public, current_hit_points, max_hit_points, temp_hit_points, conditions, resources,
          gm_notes, initiative, manual_order, snapshot
        ) VALUES (
          ${input.id}, ${input.encounterId}, ${input.kind}, ${input.sourceId}, ${input.sourceRevision},
          ${input.label}, ${input.systemId}, ${input.stableTieKey}, ${input.public},
          ${input.currentHitPoints}, ${input.maxHitPoints}, ${input.tempHitPoints},
          ${json(input.conditions)}::jsonb, ${json(input.resources)}::jsonb, ${input.gmNotes},
          ${input.initiative}, ${input.manualOrder}, ${json(input.snapshot)}::jsonb
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Encounter actor was not created.')
      return actorFromRow(row)
    },

    async updateActor(actor: EncounterActorRecord): Promise<void> {
      await sql`
        UPDATE public.encounter_actors
        SET label = ${actor.label}, public = ${actor.public}, current_hit_points = ${actor.currentHitPoints},
            max_hit_points = ${actor.maxHitPoints}, temp_hit_points = ${actor.tempHitPoints},
            conditions = ${json(actor.conditions)}::jsonb, resources = ${json(actor.resources)}::jsonb,
            gm_notes = ${actor.gmNotes}, initiative = ${actor.initiative}, manual_order = ${actor.manualOrder},
            updated_at = now()
        WHERE id = ${actor.id} AND encounter_id = ${actor.encounterId}
      `.execute(db)
    },

    async upsertReminder(
      input: Omit<EncounterReminderRecord, 'encounterId'> & { encounterId: string }
    ): Promise<void> {
      await sql`
        INSERT INTO public.encounter_reminders (id, encounter_id, label, timing, round, actor_id, public, notes, sort_order)
        VALUES (${input.id}, ${input.encounterId}, ${input.label}, ${input.timing}, ${input.round}, ${input.actorId}, ${input.public}, ${input.notes}, ${input.order})
        ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, timing = EXCLUDED.timing, round = EXCLUDED.round,
          actor_id = EXCLUDED.actor_id, public = EXCLUDED.public, notes = EXCLUDED.notes, sort_order = EXCLUDED.sort_order
      `.execute(db)
    },

    async removeReminder(encounterId: string, reminderId: string): Promise<boolean> {
      const result =
        await sql`DELETE FROM public.encounter_reminders WHERE encounter_id = ${encounterId} AND id = ${reminderId}`.execute(
          db
        )
      return Number(result.numAffectedRows) > 0
    },

    async removeActor(encounterId: string, actorId: string): Promise<boolean> {
      const result = await sql<{ id: string }>`
        DELETE FROM public.encounter_actors
        WHERE encounter_id = ${encounterId} AND id = ${actorId}
        RETURNING id
      `.execute(db)
      return result.rows.length > 0
    },

    async reorder(encounterId: string, actorIds: string[]): Promise<void> {
      for (const [manualOrder, actorId] of actorIds.entries()) {
        await sql`
          UPDATE public.encounter_actors
          SET manual_order = ${manualOrder}, updated_at = now()
          WHERE encounter_id = ${encounterId} AND id = ${actorId}
        `.execute(db)
      }
    },

    async findEventByCommand(
      encounterId: string,
      commandId: string
    ): Promise<EncounterEventRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_events
        WHERE encounter_id = ${encounterId} AND command_id = ${commandId}
      `.execute(db)
      return result.rows[0] ? eventFromRow(result.rows[0]) : null
    },

    async findEventByCampaignCommand(
      campaignId: string,
      commandId: string
    ): Promise<EncounterEventRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_events
        WHERE campaign_id = ${campaignId} AND command_id = ${commandId}
      `.execute(db)
      return result.rows[0] ? eventFromRow(result.rows[0]) : null
    },

    async findRuleset(systemId: string): Promise<EncounterRulesetRecord | null> {
      const result = await sql<{
        system_id: string
        ruleset_code: string
        ruleset_version: string
      }>`
        SELECT id AS system_id, ruleset_code, ruleset_version
        FROM public.systems WHERE id = ${systemId}
      `.execute(db)
      const row = result.rows[0]
      return row
        ? { systemId: row.system_id, code: row.ruleset_code, version: row.ruleset_version }
        : null
    },

    async publishCurrentProjection(
      input: EncounterCurrentProjection
    ): Promise<EncounterCurrentProjection> {
      const projection = encounterCurrentProjectionSchema.parse(input)
      if (checksumEncounterCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${projection.encounterId}" projection checksum does not match its contents.`
        )
      }
      const encounter = await sql<{ version: number }>`
        SELECT version FROM public.encounters
        WHERE id = ${projection.encounterId}
        FOR UPDATE
      `.execute(db)
      if (encounter.rows[0]?.version !== projection.streamVersion) {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${projection.encounterId}" changed before its projection was published.`
        )
      }
      const existing = await sql<{ projection_checksum: string; stream_version: number }>`
        SELECT stream_version, projection_checksum
        FROM public.encounter_current_projections
        WHERE encounter_id = ${projection.encounterId}
        FOR UPDATE
      `.execute(db)
      const current = existing.rows[0]
      if (
        current &&
        (current.stream_version > projection.streamVersion ||
          (current.stream_version === projection.streamVersion &&
            current.projection_checksum !== projection.projectionChecksum))
      ) {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${projection.encounterId}" already has a conflicting newer projection.`
        )
      }
      if (current?.projection_checksum === projection.projectionChecksum) return projection

      await sql`
        INSERT INTO public.encounter_current_projections (
          encounter_id, stream_version, projection_schema_version, projection_checksum, projection
        ) VALUES (
          ${projection.encounterId}, ${projection.streamVersion},
          ${projection.projectionSchemaVersion}, ${projection.projectionChecksum},
          ${json(projection as unknown as Json)}::jsonb
        )
        ON CONFLICT (encounter_id) DO UPDATE SET
          stream_version = EXCLUDED.stream_version,
          projection_schema_version = EXCLUDED.projection_schema_version,
          projection_checksum = EXCLUDED.projection_checksum,
          projection = EXCLUDED.projection,
          updated_at = now()
      `.execute(db)
      return projection
    },

    async requireCurrentProjection(input: {
      encounterId: string
      expectedStreamVersion: number
    }): Promise<EncounterCurrentProjection> {
      const result = await sql<Record<string, unknown>>`
        SELECT
          projection.encounter_id,
          projection.stream_version,
          projection.projection_schema_version,
          projection.projection_checksum,
          projection.projection,
          encounter.version AS encounter_version
        FROM public.encounter_current_projections projection
        JOIN public.encounters encounter ON encounter.id = projection.encounter_id
        WHERE projection.encounter_id = ${input.encounterId}
      `.execute(db)
      const row = result.rows[0]
      if (!row || Number(row.encounter_version) !== input.expectedStreamVersion) {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${input.encounterId}" has no current projection for the requested stream version.`
        )
      }
      const projection = encounterCurrentProjectionSchema.parse(row.projection)
      if (
        projection.encounterId !== row.encounter_id ||
        projection.streamVersion !== Number(row.stream_version) ||
        projection.projectionSchemaVersion !== Number(row.projection_schema_version) ||
        projection.projectionChecksum !== row.projection_checksum ||
        projection.streamVersion !== input.expectedStreamVersion ||
        checksumEncounterCurrentProjection(projection) !== projection.projectionChecksum
      ) {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${input.encounterId}" projection is stale or invalid.`
        )
      }
      return projection
    },

    async appendEvent(input: {
      id: string
      encounterId: string
      campaignId: string
      version: number
      commandId: string
      commandType: string
      commandFingerprint: string
      commandPayload: Json
      resultPayload: Json
      actorUserId: string
      correlationId: string | null
    }): Promise<EncounterEventRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_events (
          id, encounter_id, campaign_id, version, command_id, command_type, command_fingerprint,
          command_payload, result_payload, actor_user_id, correlation_id
        ) VALUES (
          ${input.id}, ${input.encounterId}, ${input.campaignId}, ${input.version}, ${input.commandId},
          ${input.commandType}, ${input.commandFingerprint}, ${json(input.commandPayload)}::jsonb,
          ${json(input.resultPayload)}::jsonb, ${input.actorUserId}, ${input.correlationId}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Encounter event was not created.')
      return eventFromRow(row)
    },

    async listEvents(encounterId: string): Promise<EncounterEventRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_events
        WHERE encounter_id = ${encounterId}
        ORDER BY version ASC, created_at ASC, id ASC
      `.execute(db)
      return result.rows.map(eventFromRow)
    },

    async listEventsPage(
      encounterId: string,
      cursor: string | undefined,
      limit: number,
      visibility: 'ALL' | 'TABLE' = 'ALL'
    ): Promise<EncounterEventRecord[]> {
      const result = cursor
        ? visibility === 'TABLE'
          ? await sql<Record<string, unknown>>`
              SELECT event.* FROM public.encounter_events event
              CROSS JOIN public.encounter_events cursor_event
              WHERE event.encounter_id = ${encounterId} AND cursor_event.id = ${cursor}
                AND event.command_type IN ('ROLL_ENEMY_ACTION', 'RESOLVE_ACTION')
                AND event.command_payload->>'visibility' = 'TABLE'
                AND (event.version, event.created_at, event.id) < (cursor_event.version, cursor_event.created_at, cursor_event.id)
              ORDER BY event.version DESC, event.created_at DESC, event.id DESC
              LIMIT ${limit}
            `.execute(db)
          : await sql<Record<string, unknown>>`
            SELECT event.* FROM public.encounter_events event
            CROSS JOIN public.encounter_events cursor_event
            WHERE event.encounter_id = ${encounterId} AND cursor_event.id = ${cursor}
              AND (event.version, event.created_at, event.id) < (cursor_event.version, cursor_event.created_at, cursor_event.id)
            ORDER BY event.version DESC, event.created_at DESC, event.id DESC
            LIMIT ${limit}
          `.execute(db)
        : visibility === 'TABLE'
          ? await sql<Record<string, unknown>>`
              SELECT * FROM public.encounter_events event
              WHERE event.encounter_id = ${encounterId}
                AND event.command_type IN ('ROLL_ENEMY_ACTION', 'RESOLVE_ACTION')
                AND event.command_payload->>'visibility' = 'TABLE'
              ORDER BY event.version DESC, event.created_at DESC, event.id DESC
              LIMIT ${limit}
            `.execute(db)
          : await sql<Record<string, unknown>>`
            SELECT * FROM public.encounter_events WHERE encounter_id = ${encounterId}
            ORDER BY version DESC, created_at DESC, id DESC LIMIT ${limit}
          `.execute(db)
      return result.rows.map(eventFromRow)
    },

    async countEvents(encounterId: string): Promise<number> {
      const result = await sql<{ count: number | string }>`
        SELECT count(*)::int AS count FROM public.encounter_events WHERE encounter_id = ${encounterId}
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    }
  }
}
