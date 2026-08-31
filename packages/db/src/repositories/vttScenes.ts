import { sql } from 'kysely'

import {
  campaignLiveScenePresentationReceiptDtoSchema,
  campaignSceneStateDtoSchema,
  sceneDefinitionDtoSchema,
  sceneEventDtoSchema,
  type CampaignLiveScenePresentationReceiptDto
} from '@artificer-toolkit/schema/api/vttScenes'
import {
  sceneCurrentProjectionSchema,
  type SceneCurrentProjection
} from '@artificer-toolkit/schema/projections/scene'
import type {
  CampaignSceneState,
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

export interface CampaignLiveSceneRecord {
  materializationCommandFingerprint: string
  materializationCommandId: string
  createdAt: string
  definitionSnapshot: SceneDefinition
  projectionChecksum: string
  projectionSchemaVersion: number
  state: CampaignSceneState
  updatedAt: string
}

export interface CampaignSceneEventRecord {
  commandFingerprint: string
  commandType: string
  createdAt: string
  event: SceneEvent
  id: string
}

export interface LockedLiveSceneCommandContext {
  membershipRole: 'OWNER' | 'PLAYER'
  priorEvent: CampaignSceneEventRecord | null
  scene: CampaignLiveSceneRecord
}

const SESSION_SCENE_PRESENTATION_EVENT_KIND = 'SESSION_SCENE_PRESENTATION_SET'

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

function campaignLiveSceneFromRow(row: Record<string, unknown>): CampaignLiveSceneRecord {
  const currentProjection = sceneCurrentProjectionSchema.parse({
    sceneId: row.id,
    streamVersion: row.version,
    projectionSchemaVersion: row.projection_schema_version,
    projectionChecksum: row.projection_checksum,
    projection: campaignSceneStateDtoSchema.parse(row.projection)
  })
  if (checksumSceneCurrentProjection(currentProjection) !== currentProjection.projectionChecksum) {
    throw new Error(
      `Campaign live Scene "${currentProjection.sceneId}" projection checksum is invalid.`
    )
  }
  return {
    materializationCommandFingerprint: String(row.materialization_command_fingerprint),
    materializationCommandId: String(row.materialization_command_id),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    definitionSnapshot: sceneDefinitionDtoSchema.parse(row.definition_snapshot),
    projectionChecksum: currentProjection.projectionChecksum,
    projectionSchemaVersion: currentProjection.projectionSchemaVersion,
    state: currentProjection.projection,
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function eventFromRow(row: Record<string, unknown>): CampaignSceneEventRecord {
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

function sessionPresentationReceiptFromRow(
  row: Record<string, unknown>
): CampaignLiveScenePresentationReceiptDto {
  return campaignLiveScenePresentationReceiptDtoSchema.parse(row.payload)
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

    async findLiveScene(sceneId: string): Promise<CampaignLiveSceneRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_live_scenes WHERE id = ${sceneId}
      `.execute(db)
      return result.rows[0] ? campaignLiveSceneFromRow(result.rows[0]) : null
    },

    async listLiveScenes(campaignId: string): Promise<CampaignLiveSceneRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_live_scenes
        WHERE campaign_id = ${campaignId}
        ORDER BY created_at, id
      `.execute(db)
      return result.rows.map(campaignLiveSceneFromRow)
    },

    async lockLiveScene(sceneId: string): Promise<CampaignLiveSceneRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_live_scenes WHERE id = ${sceneId} FOR UPDATE
      `.execute(db)
      return result.rows[0] ? campaignLiveSceneFromRow(result.rows[0]) : null
    },

    async findEncounterBinding(
      encounterId: string
    ): Promise<{ commandFingerprint: string; commandId: string; sceneId: string } | null> {
      const result = await sql<{
        command_fingerprint: string
        command_id: string
        scene_id: string
      }>`
        SELECT scene_id, command_id, command_fingerprint
        FROM public.encounter_scene_bindings
        WHERE encounter_id = ${encounterId}
      `.execute(db)
      return result.rows[0]
        ? {
            commandFingerprint: result.rows[0].command_fingerprint,
            commandId: result.rows[0].command_id,
            sceneId: result.rows[0].scene_id
          }
        : null
    },

    async findSessionPresentation(
      sessionId: string
    ): Promise<{ sceneId: string | null; version: number } | null> {
      const result = await sql<{ scene_id: string | null; version: number }>`
        SELECT scene_id, version FROM public.campaign_session_scene_presentations
        WHERE session_id = ${sessionId}
      `.execute(db)
      return result.rows[0]
        ? { sceneId: result.rows[0].scene_id, version: Number(result.rows[0].version) }
        : null
    },

    async lockSession(
      campaignId: string,
      sessionId: string
    ): Promise<{ id: string; status: 'OPEN' | 'FINISHED' } | null> {
      const result = await sql<{ id: string; status: 'OPEN' | 'FINISHED' }>`
        SELECT id, status FROM public.campaign_sessions
        WHERE id = ${sessionId} AND campaign_id = ${campaignId}
        FOR UPDATE
      `.execute(db)
      return result.rows[0] ?? null
    },

    async findSessionCampaignId(sessionId: string): Promise<string | null> {
      const result = await sql<{ campaign_id: string }>`
        SELECT campaign_id FROM public.campaign_sessions WHERE id = ${sessionId}
      `.execute(db)
      return result.rows[0]?.campaign_id ?? null
    },

    async findSessionScenePresentationReceipt(input: {
      campaignId: string
      commandId: string
    }): Promise<CampaignLiveScenePresentationReceiptDto | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT payload FROM public.campaign_events
        WHERE campaign_id = ${input.campaignId}
          AND idempotency_key = ${input.commandId}
          AND kind = ${SESSION_SCENE_PRESENTATION_EVENT_KIND}
      `.execute(db)
      return result.rows[0] ? sessionPresentationReceiptFromRow(result.rows[0]) : null
    },

    async appendSessionScenePresentationReceipt(input: {
      actorUserId: string
      campaignId: string
      commandId: string
      receipt: CampaignLiveScenePresentationReceiptDto
    }): Promise<void> {
      const receipt = campaignLiveScenePresentationReceiptDtoSchema.parse(input.receipt)
      await sql`
        INSERT INTO public.campaign_events (
          campaign_id, actor_user_id, subject_user_id, subject_character_id,
          kind, visibility, payload, idempotency_key
        ) VALUES (
          ${input.campaignId}, ${input.actorUserId}, NULL, NULL,
          ${SESSION_SCENE_PRESENTATION_EVENT_KIND}, 'TABLE', ${json(receipt)}::jsonb,
          ${input.commandId}
        )
      `.execute(db)
    },

    async presentSessionScene(input: {
      campaignId: string
      commandFingerprint: string
      commandId: string
      expectedVersion: number | null
      sceneId: string | null
      sessionId: string
    }): Promise<boolean> {
      const result = await sql<{ session_id: string }>`
        WITH inserted AS (
          INSERT INTO public.campaign_session_scene_presentations (
            session_id, campaign_id, scene_id, version, command_id, command_fingerprint
          )
          SELECT ${input.sessionId}, ${input.campaignId}, ${input.sceneId}, 0,
                 ${input.commandId}, ${input.commandFingerprint}
          WHERE ${input.expectedVersion}::integer IS NULL
          ON CONFLICT (session_id) DO NOTHING
          RETURNING session_id
        ), updated AS (
          UPDATE public.campaign_session_scene_presentations
          SET scene_id = ${input.sceneId},
              version = version + 1,
              command_id = ${input.commandId},
              command_fingerprint = ${input.commandFingerprint},
              updated_at = now()
          WHERE session_id = ${input.sessionId}
            AND ${input.expectedVersion}::integer IS NOT NULL
            AND version = ${input.expectedVersion}
          RETURNING session_id
        )
        SELECT session_id FROM inserted
        UNION ALL
        SELECT session_id FROM updated
      `.execute(db)
      return result.rows.length === 1
    },

    async bindEncounterToScene(input: {
      campaignId: string
      commandFingerprint: string
      commandId: string
      encounterId: string
      sceneId: string
    }): Promise<boolean> {
      const result = await sql<{ encounter_id: string }>`
        INSERT INTO public.encounter_scene_bindings (
          encounter_id, campaign_id, scene_id, command_id, command_fingerprint
        ) VALUES (
          ${input.encounterId}, ${input.campaignId}, ${input.sceneId},
          ${input.commandId}, ${input.commandFingerprint}
        ) ON CONFLICT (encounter_id) DO NOTHING
        RETURNING encounter_id
      `.execute(db)
      return result.rows.length === 1
    },

    async setActorTokenBinding(input: {
      actorId: string
      encounterId: string
      sceneId: string
      tokenId: string
    }): Promise<void> {
      await sql`
        INSERT INTO public.encounter_scene_actor_token_bindings (
          encounter_id, actor_id, scene_id, token_id
        ) VALUES (${input.encounterId}, ${input.actorId}, ${input.sceneId}, ${input.tokenId})
        ON CONFLICT (encounter_id, actor_id) DO UPDATE
        SET token_id = EXCLUDED.token_id, scene_id = EXCLUDED.scene_id, updated_at = now()
      `.execute(db)
    },

    async removeActorTokenBinding(input: {
      actorId: string
      encounterId: string
    }): Promise<boolean> {
      const result = await sql<{ actor_id: string }>`
        DELETE FROM public.encounter_scene_actor_token_bindings
        WHERE encounter_id = ${input.encounterId} AND actor_id = ${input.actorId}
        RETURNING actor_id
      `.execute(db)
      return result.rows.length === 1
    },

    async listActorTokenBindings(
      encounterId: string
    ): Promise<{ actorId: string; tokenId: string }[]> {
      const result = await sql<{ actor_id: string; token_id: string }>`
        SELECT actor_id, token_id FROM public.encounter_scene_actor_token_bindings
        WHERE encounter_id = ${encounterId} ORDER BY actor_id
      `.execute(db)
      return result.rows.map((row) => ({ actorId: row.actor_id, tokenId: row.token_id }))
    },

    async lockLiveCommandContext(input: {
      actorUserId: string
      authorityId: string
      campaignId: string
      commandId: string
      encounterId: string
      sceneId: string
      sessionId: string
    }): Promise<LockedLiveSceneCommandContext | null> {
      const session = await sql<{ id: string }>`
        SELECT id
        FROM public.campaign_sessions
        WHERE id = ${input.sessionId}
        FOR UPDATE
      `.execute(db)
      if (!session.rows[0]) return null

      const lease = await sql<{ session_id: string }>`
        SELECT session_id
        FROM public.live_session_command_leases
        WHERE session_id = ${input.sessionId}
          AND authority_id = ${input.authorityId}
          AND expires_at > now()
        FOR UPDATE
      `.execute(db)
      if (!lease.rows[0]) return null

      const result = await sql<Record<string, unknown>>`
        SELECT
          scene.*,
          membership.role AS membership_role,
          campaign.id AS campaign_id
        FROM public.campaign_live_scenes AS scene
        INNER JOIN public.encounter_scene_bindings AS binding
          ON binding.scene_id = scene.id
          AND binding.campaign_id = scene.campaign_id
        INNER JOIN public.encounters AS encounter
          ON encounter.id = binding.encounter_id
          AND encounter.campaign_id = binding.campaign_id
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
        INNER JOIN public.campaign_session_scene_presentations AS presentation
          ON presentation.session_id = session.id
          AND presentation.campaign_id = campaign.id
          AND presentation.scene_id = scene.id
        INNER JOIN public.live_session_command_leases AS lease
          ON lease.session_id = session.id
          AND lease.authority_id = ${input.authorityId}
          AND lease.expires_at > now()
        WHERE scene.id = ${input.sceneId}
          AND binding.encounter_id = ${input.encounterId}
          AND campaign.id = ${input.campaignId}
          AND session.id = ${input.sessionId}
          AND encounter.campaign_id = ${input.campaignId}
          AND encounter.session_id = ${input.sessionId}
          AND campaign.status = 'ACTIVE'
        FOR UPDATE OF scene, presentation
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      const membershipRole = row.membership_role
      if (membershipRole !== 'OWNER' && membershipRole !== 'PLAYER') {
        throw new Error('Live Scene command membership role is invalid.')
      }
      const prior = await sql<Record<string, unknown>>`
        SELECT *
        FROM public.campaign_scene_events
        WHERE scene_id = ${input.sceneId}
          AND command_id = ${input.commandId}
      `.execute(db)
      return {
        membershipRole,
        priorEvent: prior.rows[0] ? eventFromRow(prior.rows[0]) : null,
        scene: campaignLiveSceneFromRow(row)
      }
    },

    async createCampaignLiveScene(input: {
      materializationCommandFingerprint: string
      materializationCommandId: string
      definitionSnapshot: SceneDefinition
      projection: SceneCurrentProjection
    }): Promise<CampaignLiveSceneRecord> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(
          `Campaign live Scene "${projection.sceneId}" projection checksum is invalid.`
        )
      }
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.campaign_live_scenes (
          id, campaign_id, definition_id, definition_version, definition_snapshot,
          projection, version, projection_schema_version, projection_checksum,
          materialization_command_id, materialization_command_fingerprint
        ) VALUES (
          ${projection.projection.id}, ${projection.projection.campaignId},
          ${projection.projection.definitionId},
          ${projection.projection.definitionVersion}, ${json(input.definitionSnapshot)}::jsonb,
          ${json(projection.projection)}::jsonb, ${projection.streamVersion},
          ${projection.projectionSchemaVersion}, ${projection.projectionChecksum},
          ${input.materializationCommandId},
          ${input.materializationCommandFingerprint}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Campaign live Scene was not created.')
      return campaignLiveSceneFromRow(row)
    },

    async updateProjection(input: {
      expectedVersion: number
      projection: SceneCurrentProjection
    }): Promise<boolean> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(
          `Campaign live Scene "${projection.sceneId}" projection checksum is invalid.`
        )
      }
      const result = await sql<{ id: string }>`
        UPDATE public.campaign_live_scenes
        SET projection = ${json(projection.projection)}::jsonb,
            version = ${projection.streamVersion},
            projection_schema_version = ${projection.projectionSchemaVersion},
            projection_checksum = ${projection.projectionChecksum},
            updated_at = now()
        WHERE id = ${projection.projection.id}
          AND version = ${input.expectedVersion}
        RETURNING id
      `.execute(db)
      return result.rows.length === 1
    },

    async publishLiveCommand(input: {
      commandFingerprint: string
      commandType: string
      encounterId: string | null
      event: SceneEvent
      eventId: string
      expectedVersion: number
      projection: SceneCurrentProjection
    }): Promise<boolean> {
      const projection = sceneCurrentProjectionSchema.parse(input.projection)
      if (checksumSceneCurrentProjection(projection) !== projection.projectionChecksum) {
        throw new Error(
          `Campaign live Scene "${projection.sceneId}" projection checksum is invalid.`
        )
      }
      const result = await sql<{ event_id: string }>`
        WITH updated_scene AS (
          UPDATE public.campaign_live_scenes
          SET projection = ${json(projection.projection)}::jsonb,
              version = ${projection.streamVersion},
              projection_schema_version = ${projection.projectionSchemaVersion},
              projection_checksum = ${projection.projectionChecksum},
              updated_at = now()
          WHERE id = ${projection.projection.id}
            AND version = ${input.expectedVersion}
          RETURNING id
        ), appended_event AS (
          INSERT INTO public.campaign_scene_events (
            id, scene_id, encounter_id, version, command_id, command_type,
            command_fingerprint, delta, actor_user_id
          )
          SELECT
            ${input.eventId}, ${input.event.sceneId}, ${input.encounterId}, ${input.event.version},
            ${input.event.commandId}, ${input.commandType}, ${input.commandFingerprint},
            ${json(input.event.delta as SceneDelta)}::jsonb, ${input.event.actorUserId}
          FROM updated_scene
          RETURNING id
        )
        SELECT appended_event.id AS event_id
        FROM appended_event
        INNER JOIN updated_scene ON true
      `.execute(db)
      return result.rows.length === 1
    },

    async findEventByCommand(
      sceneId: string,
      commandId: string
    ): Promise<CampaignSceneEventRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_scene_events
        WHERE scene_id = ${sceneId} AND command_id = ${commandId}
      `.execute(db)
      return result.rows[0] ? eventFromRow(result.rows[0]) : null
    },

    async listEventsAfter(sceneId: string, version: number): Promise<CampaignSceneEventRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_scene_events
        WHERE scene_id = ${sceneId} AND version > ${version}
        ORDER BY version ASC
      `.execute(db)
      return result.rows.map(eventFromRow)
    },

    async listEvents(sceneId: string): Promise<CampaignSceneEventRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_scene_events
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
      encounterId: string | null
    }): Promise<CampaignSceneEventRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.campaign_scene_events (
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
