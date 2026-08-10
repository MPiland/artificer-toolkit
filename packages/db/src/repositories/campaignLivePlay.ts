import { sql } from 'kysely'

import type { DBLike, Json } from '#types'

type Timestamp = Date | string

export type CampaignClockBoundaryKind = 'DAWN' | 'DUSK' | 'DAILY'

export interface CampaignClock {
  campaignId: string
  day: number
  minuteOfDay: number
  running: boolean
  runningSince: string | null
  dawnMinute: number
  duskMinute: number
  processedBoundaryAbsoluteMinute: number
  version: number
  updatedAt: string
}

interface LivePlayCommand {
  campaignId: string
  commandId: string
  commandType: string
  inputFingerprint: string
  resultPayload: Json
  createdAt: string
}

function iso(value: Timestamp): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new Error(`Invalid database timestamp "${value}".`)
  return date.toISOString()
}

function optionalIso(value: Timestamp | null): string | null {
  return value === null ? null : iso(value)
}

function clockFromRow(row: Record<string, unknown>): CampaignClock {
  return {
    campaignId: String(row.campaign_id),
    day: Number(row.day),
    minuteOfDay: Number(row.minute_of_day),
    running: Boolean(row.running),
    runningSince: optionalIso(row.running_since as Timestamp | null),
    dawnMinute: Number(row.dawn_minute),
    duskMinute: Number(row.dusk_minute),
    processedBoundaryAbsoluteMinute: Number(row.processed_boundary_absolute_minute),
    version: Number(row.version),
    updatedAt: iso(row.updated_at as Timestamp)
  }
}

function commandFromRow(row: Record<string, unknown>): LivePlayCommand {
  return {
    campaignId: String(row.campaign_id),
    commandId: String(row.command_id),
    commandType: String(row.command_type),
    inputFingerprint: String(row.input_fingerprint),
    resultPayload: row.result_payload as Json,
    createdAt: iso(row.created_at as Timestamp)
  }
}

export function createCampaignLivePlayRepository(db: DBLike) {
  return {
    async findClock(campaignId: string): Promise<CampaignClock | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_clocks WHERE campaign_id = ${campaignId}::uuid
      `.execute(db)
      return result.rows[0] ? clockFromRow(result.rows[0]) : null
    },

    async lockClock(campaignId: string): Promise<CampaignClock | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_clocks WHERE campaign_id = ${campaignId}::uuid FOR UPDATE
      `.execute(db)
      return result.rows[0] ? clockFromRow(result.rows[0]) : null
    },

    async insertClock(input: {
      campaignId: string
      day: number
      minuteOfDay: number
      dawnMinute: number
      duskMinute: number
      processedBoundaryAbsoluteMinute: number
    }): Promise<CampaignClock> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.campaign_clocks (
          campaign_id, day, minute_of_day, dawn_minute, dusk_minute,
          processed_boundary_absolute_minute
        ) VALUES (
          ${input.campaignId}::uuid, ${input.day}, ${input.minuteOfDay}, ${input.dawnMinute},
          ${input.duskMinute}, ${input.processedBoundaryAbsoluteMinute}
        ) RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Campaign clock was not created.')
      return clockFromRow(row)
    },

    async updateClock(input: {
      campaignId: string
      day: number
      minuteOfDay: number
      running: boolean
      runningSince: string | null
      dawnMinute: number
      duskMinute: number
      processedBoundaryAbsoluteMinute: number
      expectedVersion: number
    }): Promise<CampaignClock | null> {
      const result = await sql<Record<string, unknown>>`
        UPDATE public.campaign_clocks
        SET day = ${input.day}, minute_of_day = ${input.minuteOfDay}, running = ${input.running},
            running_since = ${input.runningSince}, dawn_minute = ${input.dawnMinute},
            dusk_minute = ${input.duskMinute},
            processed_boundary_absolute_minute = ${input.processedBoundaryAbsoluteMinute},
            version = version + 1, updated_at = now()
        WHERE campaign_id = ${input.campaignId}::uuid AND version = ${input.expectedVersion}
        RETURNING *
      `.execute(db)
      return result.rows[0] ? clockFromRow(result.rows[0]) : null
    },

    async findCommand(campaignId: string, commandId: string): Promise<LivePlayCommand | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.campaign_live_play_commands
        WHERE campaign_id = ${campaignId}::uuid AND command_id = ${commandId}::uuid
      `.execute(db)
      return result.rows[0] ? commandFromRow(result.rows[0]) : null
    },

    async insertCommand(input: {
      campaignId: string
      commandId: string
      commandType: string
      inputFingerprint: string
      resultPayload: Json
    }): Promise<void> {
      await sql`
        INSERT INTO public.campaign_live_play_commands (
          campaign_id, command_id, command_type, input_fingerprint, result_payload
        ) VALUES (
          ${input.campaignId}::uuid, ${input.commandId}::uuid, ${input.commandType},
          ${input.inputFingerprint}, ${JSON.stringify(input.resultPayload)}::jsonb
        )
      `.execute(db)
    },

    async hasRecovery(input: {
      campaignId: string
      boundaryAbsoluteMinute: number
      characterId: string
      resourceKey: string
    }): Promise<boolean> {
      const result = await sql<{ id: string }>`
        SELECT id FROM public.campaign_clock_recoveries
        WHERE campaign_id = ${input.campaignId}::uuid
          AND boundary_absolute_minute = ${input.boundaryAbsoluteMinute}
          AND character_id = ${input.characterId}::uuid
          AND resource_key = ${input.resourceKey}
      `.execute(db)
      return result.rows.length > 0
    },

    async insertRecovery(input: {
      campaignId: string
      boundaryAbsoluteMinute: number
      boundaryKind: CampaignClockBoundaryKind
      characterId: string
      resourceKey: string
      eventId: string
    }): Promise<void> {
      await sql`
        INSERT INTO public.campaign_clock_recoveries (
          campaign_id, boundary_absolute_minute, boundary_kind, character_id, resource_key, event_id
        ) VALUES (
          ${input.campaignId}::uuid, ${input.boundaryAbsoluteMinute}, ${input.boundaryKind},
          ${input.characterId}::uuid, ${input.resourceKey}, ${input.eventId}::uuid
        )
      `.execute(db)
    }
  }
}
