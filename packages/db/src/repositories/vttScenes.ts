import { sql } from 'kysely'

import {
  encounterSceneStateDtoSchema,
  sceneDefinitionDtoSchema,
  sceneEventDtoSchema
} from '@artificer-toolkit/schema/api/vttScenes'
import type {
  EncounterSceneState,
  SceneDefinition,
  SceneDelta,
  SceneEvent
} from '@artificer-toolkit/shared/vtt'

import type { DBLike } from '#types'

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
  return {
    attachCommandFingerprint: String(row.attach_command_fingerprint),
    attachCommandId: String(row.attach_command_id),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    definitionSnapshot: sceneDefinitionDtoSchema.parse(row.definition_snapshot),
    state: encounterSceneStateDtoSchema.parse(row.projection),
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

    async createEncounterScene(input: {
      attachCommandFingerprint: string
      attachCommandId: string
      definitionSnapshot: SceneDefinition
      state: EncounterSceneState
    }): Promise<EncounterSceneRecord> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_scenes (
          id, campaign_id, encounter_id, definition_id, definition_version, definition_snapshot,
          projection, version, attach_command_id, attach_command_fingerprint
        ) VALUES (
          ${input.state.id}, ${input.state.campaignId}, ${input.state.encounterId},
          ${input.state.definitionId},
          ${input.state.definitionVersion}, ${json(input.definitionSnapshot)}::jsonb,
          ${json(input.state)}::jsonb, ${input.state.version}, ${input.attachCommandId},
          ${input.attachCommandFingerprint}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Encounter scene was not created.')
      return encounterSceneFromRow(row)
    },

    async updateProjection(state: EncounterSceneState, expectedVersion: number): Promise<boolean> {
      const result = await sql<{ id: string }>`
        UPDATE public.encounter_scenes
        SET projection = ${json(state)}::jsonb, version = ${state.version}, updated_at = now()
        WHERE id = ${state.id} AND encounter_id = ${state.encounterId}
          AND version = ${expectedVersion}
        RETURNING id
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
