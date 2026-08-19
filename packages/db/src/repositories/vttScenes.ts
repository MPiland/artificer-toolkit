import { sql } from 'kysely'

import {
  encounterSceneStateDtoSchema,
  sceneDefinitionDtoSchema,
  sceneEventDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneCurrentProjectionSchema,
  type SceneCurrentProjection
} from '@artificer-toolkit/schema/projections/scene'
import type {
  EncounterSceneState,
  SceneDefinition,
  SceneDelta,
  SceneEvent
} from '@artificer-toolkit/shared/vtt'

import type { DBLike } from '#types'
import { checksumSceneCurrentProjection } from '../utils/versionedProjectionChecksum.js'

type RuntimeTimestamp = Date | string

export interface CampaignSceneDefinitionRecord {
  createdAt: string
  definition: SceneDefinition
  updatedAt: string
}

export interface EncounterSceneRecord {
  attachCommandFingerprint: string
  attachCommandId: string
  createdAt: string
  definitionSnapshot: SceneDefinition
  projectionChecksum: string
  projectionSchemaVersion: number
  state: EncounterSceneState
  updatedAt: string
}

export interface EncounterSceneEventRecord {
  commandFingerprint: string
  commandType: string
  createdAt: string
  event: SceneEvent
  id: string
}

export interface LockedLiveSceneCommandContext {
  campaignStatus: 'ACTIVE' | 'ARCHIVED'
  leaseAuthorityId: string | null
  membershipRole: 'OWNER' | 'PLAYER'
  priorEvent: EncounterSceneEventRecord | null
  scene: EncounterSceneRecord
}

function iso(value: RuntimeTimestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function json(value: unknown): string {
  return JSON.stringify(value)
}

function definitionFromRow(row: Record<string, unknown>): CampaignSceneDefinitionRecord {
  return {
    createdAt: iso(row.created_at as RuntimeTimestamp),
    definition: sceneDefinitionDtoSchema.parse(row.definition),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function encounterSceneFromRow(row: Record<string, unknown>): EncounterSceneRecord {
  const currentProjection = sceneCurrentProjectionSchema.parse({
    sceneId: row.id,
    streamVersion: row.version,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    projection: encounterSceneStateDtoSchema.parse(row.projection)
  })
  if (checksumSceneCurrentProjection(currentProjection) !== currentProjection.projectionChecksum) {
    throw new Error(`Encounter scene "${currentProjection.sceneId}" projection checksum is invalid.`)
  }
  return {
    attachCommandFingerprint: String(row.attach_command_fingerprint),
    attachCommandId: String(row.attach_command_id),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    definitionSnapshot: sceneDefinitionDtoSchema.parse(row.definition_snapshot),
    projectionChecksum: currentProjection.projectionChecksum,
    projectionSchemaVersion: currentProjection.projectionSchemaVersion,
    state: currentProjection.projection,
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function eventFromRow(row: Record<string, unknown>): EncounterSceneEventRecord {
  return {
    commandFingerprint: String(row.command_fingerprint),
    commandType: String(row.command_type),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    event: sceneEventDtoSchema.parse({
      actorUserId: row.actor_user_id,
      commandId: row.command_id,
      delta: row.delta,
      sceneId: row.scene_id,
      version: row.version
    }),
    id: String(row.id)
  }
}

function priorEventFromLiveContextRow(
  row: Record<string, unknown>
): EncounterSceneEventRecord | null {
  if (row.prior_event_id === null || row.prior_event_id === undefined) return null
  return eventFromRow({
    actor_user_id: row.prior_actor_user_id,
    command_fingerprint: row.prior_command_fingerprint,
    command_id: row.prior_command_id,
    command_type: row.prior_command_type,
    created_at: row.prior_created_at,
    delta: row.prior_delta,
    id: row.prior_event_id,
    scene_id: row.prior_scene_id,
    version: row.prior_version
  })
}

export function createVttSceneRepository(db: DBLike) {
  return {
    async listDefinitions(campaignId: string): Promise<CampaignSceneDefinitionRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_scene_definitions
        WHERE campaign_id = ${campaignId}
        ORDER BY updated_at DESC, id DESC
      `.execute(db)
      return result.rows.map(definitionFromRow)
    },

    async findDefinition(
      campaignId: string,
      definitionId: string
    ): Promise<CampaignSceneDefinitionRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_scene_definitions
        WHERE campaign_id = ${campaignId} AND id = ${definitionId}
      `.execute(db)
      return result.rows[0] ? definitionFromRow(result.rows[0]) : null
    },

    async createDefinition(definition: SceneDefinition): Promise<CampaignSceneDefinitionRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.campaign_scene_definitions (
          id, campaign_id, name, version, definition
        ) VALUES (
          ${definition.id}, ${definition.campaignId}, ${definition.name}, ${definition.version},
          ${json(definition)}::jsonb
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Campaign scene definition was not created.')
      return definitionFromRow(row)
    },

    async updateDefinition(
      definition: SceneDefinition,
      expectedVersion: number
    ): Promise<CampaignSceneDefinitionRecord | null> {
      const result = await sql<Record<string, unknown>>`
        UPDATE public.campaign_scene_definitions
        SET name = ${definition.name}, version = ${definition.version},
            definition = ${json(definition)}::jsonb, updated_at = now()
        WHERE id = ${definition.id} AND campaign_id = ${definition.campaignId}
          AND version = ${expectedVersion}
        RETURNING *
      `.execute(db)
      return result.rows[0] ? definitionFromRow(result.rows[0]) : null
    },

    async deleteDefinition(
      campaignId: string,
      definitionId: string,
      expectedVersion: number
    ): Promise<boolean> {
      const result = await sql<{ id: string }>`
        DELETE FROM public.campaign_scene_definitions
        WHERE campaign_id = ${campaignId} AND id = ${definitionId}
          AND version = ${expectedVersion}
        RETURNING id
      `.execute(db)
      return result.rows.length > 0
    },

    async findByEncounter(encounterId: string): Promise<EncounterSceneRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_scenes WHERE encounter_id = ${encounterId}
      `.execute(db)
      return result.rows[0] ? encounterSceneFromRow(result.rows[0]) : null
    },

    async lockByEncounter(encounterId: string): Promise<EncounterSceneRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_scenes WHERE encounter_id = ${encounterId} FOR UPDATE
      `.execute(db)
      return result.rows[0] ? encounterSceneFromRow(result.rows[0]) : null
    },

    async lockLiveCommandContext(input: {
      actorUserId: string
      authorityId: string
      campaignId: string
      commandId: string
      encounterId: string
      sessionId: string
    }): Promise<LockedLiveSceneCommandContext | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT
          scene.*,
          campaign.status AS campaign_status,
          lease.authority_id AS lease_authority_id,
          membership.role AS membership_role,
          prior.id AS prior_event_id,
          prior.actor_user_id AS prior_actor_user_id,
          prior.command_fingerprint AS prior_command_fingerprint,
          prior.command_id AS prior_command_id,
          prior.command_type AS prior_command_type,
          prior.created_at AS prior_created_at,
          prior.delta AS prior_delta,
          prior.scene_id AS prior_scene_id,
          prior.version AS prior_version
        FROM public.encounter_scenes AS scene
        INNER JOIN public.encounters AS encounter
          ON encounter.id = scene.encounter_id
          AND encounter.campaign_id = scene.campaign_id
        INNER JOIN public.campaigns AS campaign
          ON campaign.id = encounter.campaign_id
        INNER JOIN public.campaign_memberships AS membership
          ON membership.campaign_id = campaign.id
          AND membership.user_id = ${input.actorUserId}
          AND membership.status = 'ACTIVE'
        INNER JOIN public.campaign_sessions AS session
          ON session.id = encounter.session_id
          AND session.campaign_id = campaign.id
          AND session.status = 'OPEN'
        LEFT JOIN public.live_session_command_leases AS lease
          ON lease.session_id = session.id
          AND lease.expires_at > now()
        LEFT JOIN public.encounter_scene_events AS prior
          ON prior.encounter_id = encounter.id
          AND prior.command_id = ${input.commandId}
        WHERE scene.encounter_id = ${input.encounterId}
          AND campaign.id = ${input.campaignId}
          AND session.id = ${input.sessionId}
          AND encounter.campaign_id = ${input.campaignId}
          AND encounter.session_id = ${input.sessionId}
        FOR UPDATE OF scene, session
        FOR SHARE OF campaign, membership
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      const membershipRole = row.membership_role
      if (membershipRole !== 'OWNER' && membershipRole !== 'PLAYER') {
        throw new Error('Live Scene command membership role is invalid.')
      }
      const campaignStatus = row.campaign_status
      if (campaignStatus !== 'ACTIVE' && campaignStatus !== 'ARCHIVED') {
        throw new Error('Live Scene command Campaign status is invalid.')
      }
      const leaseAuthorityId = row.lease_authority_id
      if (leaseAuthorityId !== null && typeof leaseAuthorityId !== 'string') {
        throw new Error('Live Scene command lease authority is invalid.')
      }
      return {
        campaignStatus,
        leaseAuthorityId,
        membershipRole,
        priorEvent: priorEventFromLiveContextRow(row),
        scene: encounterSceneFromRow(row)
      }
    },

    async createEncounterScene(input: {
      attachCommandFingerprint: string
      attachCommandId: string
      definitionSnapshot: SceneDefinition
      projection: SceneCurrentProjection
    }): Promise<EncounterSceneRecord> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(`Encounter scene "${projection.sceneId}" projection checksum is invalid.`)
      }
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_scenes (
          id, campaign_id, encounter_id, definition_id, definition_version, definition_snapshot,
          projection, version, projection_schema_version, projection_checksum,
          attach_command_id, attach_command_fingerprint
        ) VALUES (
          ${projection.projection.id}, ${projection.projection.campaignId},
          ${projection.projection.encounterId}, ${projection.projection.definitionId},
          ${projection.projection.definitionVersion}, ${json(input.definitionSnapshot)}::jsonb,
          ${json(projection.projection)}::jsonb, ${projection.streamVersion},
          ${projection.projectionSchemaVersion}, ${projection.projectionChecksum},
          ${input.attachCommandId},
          ${input.attachCommandFingerprint}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Encounter scene was not created.')
      return encounterSceneFromRow(row)
    },

    async updateProjection(input: {
      expectedVersion: number
      projection: SceneCurrentProjection
    }): Promise<boolean> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(`Encounter scene "${projection.sceneId}" projection checksum is invalid.`)
      }
      const result = await sql<{ id: string }>`
        UPDATE public.encounter_scenes
        SET projection = ${json(projection.projection)}::jsonb,
            version = ${projection.streamVersion},
            projection_schema_version = ${projection.projectionSchemaVersion},
            projection_checksum = ${projection.projectionChecksum},
            updated_at = now()
        WHERE id = ${projection.projection.id}
          AND encounter_id = ${projection.projection.encounterId}
          AND version = ${input.expectedVersion}
        RETURNING id
      `.execute(db)
      return result.rows.length === 1
    },

    async publishLiveCommand(input: {
      commandFingerprint: string
      commandType: string
      encounterId: string
      event: SceneEvent
      eventId: string
      expectedVersion: number
      projection: SceneCurrentProjection
    }): Promise<boolean> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(`Encounter scene "${projection.sceneId}" projection checksum is invalid.`)
      }
      const result = await sql<{ scene_id: string }>`
        WITH appended_event AS (
          INSERT INTO public.encounter_scene_events (
            id, scene_id, encounter_id, version, command_id, command_type,
            command_fingerprint, delta, actor_user_id
          ) VALUES (
            ${input.eventId}, ${input.event.sceneId}, ${input.encounterId}, ${input.event.version},
            ${input.event.commandId}, ${input.commandType}, ${input.commandFingerprint},
            ${json(input.event.delta as SceneDelta)}::jsonb, ${input.event.actorUserId}
          ) RETURNING id
        ), updated_scene AS (
          UPDATE public.encounter_scenes AS scene
          SET projection = ${json(projection.projection)}::jsonb,
              version = ${projection.streamVersion},
              projection_schema_version = ${projection.projectionSchemaVersion},
              projection_checksum = ${projection.projectionChecksum},
              updated_at = now()
          FROM appended_event
          WHERE scene.id = ${projection.projection.id}
            AND scene.encounter_id = ${projection.projection.encounterId}
            AND scene.version = ${input.expectedVersion}
          RETURNING scene.id
        )
        SELECT updated_scene.id AS scene_id
        FROM updated_scene
      `.execute(db)
      return result.rows.length === 1
    },

    async findEventByCommand(
      encounterId: string,
      commandId: string
    ): Promise<EncounterSceneEventRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_scene_events
        WHERE encounter_id = ${encounterId} AND command_id = ${commandId}
      `.execute(db)
      return result.rows[0] ? eventFromRow(result.rows[0]) : null
    },

    async listEventsAfter(sceneId: string, version: number): Promise<EncounterSceneEventRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_scene_events
        WHERE scene_id = ${sceneId} AND version > ${version}
        ORDER BY version ASC
      `.execute(db)
      return result.rows.map(eventFromRow)
    },

    async listEvents(sceneId: string): Promise<EncounterSceneEventRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_scene_events
        WHERE scene_id = ${sceneId}
        ORDER BY version ASC
      `.execute(db)
      return result.rows.map(eventFromRow)
    },

    async appendEvent(input: {
      commandFingerprint: string
      commandType: string
      event: SceneEvent
      id: string
      encounterId: string
    }): Promise<EncounterSceneEventRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_scene_events (
          id, scene_id, encounter_id, version, command_id, command_type,
          command_fingerprint, delta, actor_user_id
        ) VALUES (
          ${input.id}, ${input.event.sceneId}, ${input.encounterId}, ${input.event.version},
          ${input.event.commandId}, ${input.commandType}, ${input.commandFingerprint},
          ${json(input.event.delta as SceneDelta)}::jsonb, ${input.event.actorUserId}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Encounter scene event was not created.')
      return eventFromRow(row)
    }
  }
}
