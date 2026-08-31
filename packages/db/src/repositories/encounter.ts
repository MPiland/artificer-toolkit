import { sql } from 'kysely'

import {
  encounterCurrentProjectionSchema,
  assertEncounterProjectionBlueprintHeader,
  encounterProjectionBlueprintHeaderSchema,
  legacyEncounterCurrentProjectionV1Schema,
  upgradeLegacyEncounterCurrentProjectionV1,
  type EncounterCurrentProjection
} from '@artificer-toolkit/schema/projections/encounter'
import { encounterBlueprintDtoSchema } from '@artificer-toolkit/schema/api/encounters'
import {
  encounterInitiativePolicySnapshotDtoSchema,
  type EncounterInitiativePolicySnapshotDto
} from '@artificer-toolkit/schema/shared/initiativePolicySnapshot'
import {
  encounterOptionalCombatSnapshotDtoSchema,
  type EncounterOptionalCombatSnapshotDto
} from '@artificer-toolkit/schema/shared/optionalCombat'
import {
  createEncounterInitiativeRoundDtoSchema,
  encounterInitiativeParticipantDtoSchema,
  encounterInitiativeRoundDtoSchema,
  encounterInitiativeRoundStateDtoSchema,
  encounterInitiativeSideDtoSchema,
  updateEncounterInitiativeParticipantDtoSchema,
  updateEncounterInitiativeRoundDtoSchema,
  updateEncounterInitiativeSideDtoSchema,
  type CreateEncounterInitiativeRoundDto,
  type EncounterInitiativeParticipantDto,
  type EncounterInitiativeRoundDto,
  type EncounterInitiativeRoundStateDto,
  type EncounterInitiativeSideDto,
  type UpdateEncounterInitiativeParticipantDto,
  type UpdateEncounterInitiativeRoundDto,
  type UpdateEncounterInitiativeSideDto
} from '@artificer-toolkit/schema/shared/initiativeState'

import type { DBLike, Json } from '#types'
import {
  checksumEncounterCurrentProjection,
  checksumLegacyEncounterCurrentProjectionV1
} from '../utils/versionedProjectionChecksum.js'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

type RuntimeTimestamp = Date | string

export type EncounterStatus = 'PREPARED' | 'ACTIVE' | 'COMPLETED'
export type EncounterActorKind = 'CHARACTER' | 'CREATURE' | 'CUSTOM'
export type EncounterAutomationMode = 'AUTOMATIC' | 'ASSISTED' | 'MANUAL'
export type EncounterManualReminderMode = 'OFF' | 'SUBTLE'

export interface EncounterBlueprintEnemy {
  kind: 'CREATURE' | 'CUSTOM'
  sourceId: string | null
  sourceRevision: number | null
  label: string
  systemId: string | null
  maxHitPoints: number
  snapshot: Json
}

export interface EncounterBlueprintRecord {
  id: string
  ownerUserId: string
  gameSystemId: string
  name: string
  version: number
  setupChecksum: string
  enemies: EncounterBlueprintEnemy[]
  createdAt: string
  updatedAt: string
}

export interface EncounterActorRecord {
  id: string
  encounterId: string
  /** Always present for persisted Encounter actors; absent only in legacy in-memory fixtures. */
  sideId?: string
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

export type EncounterSideRelationshipKind = 'ALLIED' | 'NEUTRAL' | 'HOSTILE'

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
  gameSystemId: string
  blueprintId: string
  blueprintVersion: number
  blueprintChecksum: string
  rulePackRevisionId: string | null
  /** Absent only in legacy in-memory fixtures and pre-migration rows. */
  initiativePolicySnapshot?: EncounterInitiativePolicySnapshotDto | null
  initiativePolicySnapshotChecksum?: string | null
  optionalCombatSnapshot?: EncounterOptionalCombatSnapshotDto | null
  optionalCombatSnapshotChecksum?: string | null
  automationMode: EncounterAutomationMode
  manualReminderMode: EncounterManualReminderMode
  name: string
  status: EncounterStatus
  version: number
  round: number
  currentActorId: string | null
  /**
   * Current normalized initiative state when this aggregate was read from the
   * repository. `undefined` is reserved for legacy in-memory fixtures.
   */
  initiativeRoundState?: EncounterInitiativeRoundStateRecord | null
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

export type EncounterInitiativeRoundRecord = EncounterInitiativeRoundDto
export type EncounterInitiativeParticipantRecord = EncounterInitiativeParticipantDto
export type EncounterInitiativeSideRecord = EncounterInitiativeSideDto
export type EncounterInitiativeRoundStateRecord = EncounterInitiativeRoundStateDto

export class EncounterInitiativeStateCurrentnessError extends Error {
  constructor(message: string) {
    super(message)
  }
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
    sideId: row.side_id == null ? undefined : String(row.side_id),
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

function occurrencePointerFromRow(
  row: Record<string, unknown>,
  prefix: 'evaluation' | 'tie'
): { occurrenceId: string | null; resultChecksum: string | null } {
  return {
    occurrenceId:
      row[`${prefix}_occurrence_id`] == null ? null : String(row[`${prefix}_occurrence_id`]),
    resultChecksum:
      row[`${prefix}_result_checksum`] == null ? null : String(row[`${prefix}_result_checksum`])
  }
}

function initiativeRoundFromRow(row: Record<string, unknown>): EncounterInitiativeRoundRecord {
  return encounterInitiativeRoundDtoSchema.parse({
    encounterId: row.encounter_id,
    round: Number(row.round),
    procedure: row.procedure,
    cadence: row.cadence,
    status: row.status,
    policySnapshotChecksum:
      row.policy_snapshot_checksum == null ? null : String(row.policy_snapshot_checksum),
    nextTurnOrderOrdinal: Number(row.next_turn_order_ordinal),
    version: Number(row.version),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  })
}

function initiativeParticipantFromRow(
  row: Record<string, unknown>
): EncounterInitiativeParticipantRecord {
  return encounterInitiativeParticipantDtoSchema.parse({
    encounterId: row.encounter_id,
    round: Number(row.round),
    actorId: row.actor_id,
    sideId: row.side_id,
    status: row.status,
    initiativeScore: row.initiative_score == null ? null : Number(row.initiative_score),
    evaluation: occurrencePointerFromRow(row, 'evaluation'),
    tie: occurrencePointerFromRow(row, 'tie'),
    declaration: row.declaration == null ? null : row.declaration,
    declarationChecksum: row.declaration_checksum == null ? null : String(row.declaration_checksum),
    turnOrderOrdinal: row.turn_order_ordinal == null ? null : Number(row.turn_order_ordinal),
    version: Number(row.version),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  })
}

function initiativeSideFromRow(row: Record<string, unknown>): EncounterInitiativeSideRecord {
  if (row.procedure !== 'SIDE_ROLL') {
    throw new Error('Initiative side state must belong to a SIDE_ROLL round.')
  }
  return encounterInitiativeSideDtoSchema.parse({
    encounterId: row.encounter_id,
    round: Number(row.round),
    sideId: row.side_id,
    status: row.status,
    initiativeScore: row.initiative_score == null ? null : Number(row.initiative_score),
    evaluation: occurrencePointerFromRow(row, 'evaluation'),
    tie: occurrencePointerFromRow(row, 'tie'),
    sideOrderOrdinal: row.side_order_ordinal == null ? null : Number(row.side_order_ordinal),
    version: Number(row.version),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  })
}

function encounterFromRow(
  row: Record<string, unknown>,
  actors: EncounterActorRecord[],
  reminders: EncounterReminderRecord[] = [],
  initiativeRoundState: EncounterInitiativeRoundStateRecord | null = null
): EncounterRecord {
  const initiativePolicySnapshot =
    row.initiative_policy_snapshot == null
      ? null
      : encounterInitiativePolicySnapshotDtoSchema.parse(row.initiative_policy_snapshot)
  const initiativePolicySnapshotChecksum =
    row.initiative_policy_snapshot_checksum == null
      ? null
      : String(row.initiative_policy_snapshot_checksum)
  if ((initiativePolicySnapshot === null) !== (initiativePolicySnapshotChecksum === null)) {
    throw new Error('Encounter initiative policy snapshot and checksum must be stored together.')
  }
  if (
    initiativePolicySnapshot !== null &&
    checksumCanonicalJson(initiativePolicySnapshot) !== initiativePolicySnapshotChecksum
  ) {
    throw new Error('Encounter initiative policy snapshot checksum is invalid.')
  }
  const optionalCombatSnapshot =
    row.optional_combat_snapshot == null
      ? null
      : encounterOptionalCombatSnapshotDtoSchema.parse(row.optional_combat_snapshot)
  const optionalCombatSnapshotChecksum =
    row.optional_combat_snapshot_checksum == null
      ? null
      : String(row.optional_combat_snapshot_checksum)
  if ((optionalCombatSnapshot === null) !== (optionalCombatSnapshotChecksum === null)) {
    throw new Error('Encounter optional combat snapshot and checksum must be stored together.')
  }
  if (
    optionalCombatSnapshot !== null &&
    checksumCanonicalJson(optionalCombatSnapshot) !== optionalCombatSnapshotChecksum
  ) {
    throw new Error('Encounter optional combat snapshot checksum is invalid.')
  }
  if (
    optionalCombatSnapshot !== null &&
    optionalCombatSnapshot.gameSystemId !== String(row.game_system_id)
  ) {
    throw new Error('Encounter optional combat snapshot must use the Encounter Game System.')
  }
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    sessionId: String(row.session_id),
    gameSystemId: String(row.game_system_id),
    blueprintId: String(row.blueprint_id),
    blueprintVersion: Number(row.blueprint_version),
    blueprintChecksum: String(row.blueprint_checksum),
    rulePackRevisionId:
      row.rule_pack_revision_id == null ? null : String(row.rule_pack_revision_id),
    initiativePolicySnapshot,
    initiativePolicySnapshotChecksum,
    optionalCombatSnapshot,
    optionalCombatSnapshotChecksum,
    automationMode: row.automation_mode as EncounterAutomationMode,
    manualReminderMode: row.manual_reminder_mode as EncounterManualReminderMode,
    name: String(row.name),
    status: row.status as EncounterStatus,
    version: Number(row.version),
    round: Number(row.round),
    currentActorId: row.current_actor_id == null ? null : String(row.current_actor_id),
    initiativeRoundState,
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

function blueprintFromRow(row: Record<string, unknown>): EncounterBlueprintRecord {
  return {
    id: String(row.id),
    ownerUserId: String(row.owner_user_id),
    gameSystemId: String(row.game_system_id),
    name: String(row.name),
    version: Number(row.version),
    setupChecksum: String(row.setup_checksum),
    enemies: row.enemies as EncounterBlueprintEnemy[],
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

/**
 * Reads the one normalized initiative state owned by the Encounter's current
 * round. Callers holding the Encounter root lock may use this read for a
 * consistent projection; mutation paths use `lockInitiativeRound` below.
 */
async function readInitiativeRoundState(
  db: DBLike,
  encounterId: string,
  round: number
): Promise<EncounterInitiativeRoundStateRecord | null> {
  if (round < 1) return null
  const headerResult = await sql<Record<string, unknown>>`
    SELECT * FROM public.encounter_initiative_rounds
    WHERE encounter_id = ${encounterId} AND round = ${round}
  `.execute(db)
  const header = headerResult.rows[0]
  if (!header) return null

  const [sidesResult, participantsResult] = await Promise.all([
    sql<Record<string, unknown>>`
      SELECT * FROM public.encounter_initiative_sides
      WHERE encounter_id = ${encounterId} AND round = ${round}
      ORDER BY side_id ASC
    `.execute(db),
    sql<Record<string, unknown>>`
      SELECT * FROM public.encounter_initiative_participants
      WHERE encounter_id = ${encounterId} AND round = ${round}
      ORDER BY actor_id ASC
    `.execute(db)
  ])
  return encounterInitiativeRoundStateDtoSchema.parse({
    round: initiativeRoundFromRow(header),
    sides: sidesResult.rows.map(initiativeSideFromRow),
    participants: participantsResult.rows.map(initiativeParticipantFromRow)
  })
}

async function readEncounter(db: DBLike, encounterId: string): Promise<EncounterRecord | null> {
  const result = await sql<Record<string, unknown>>`
    SELECT * FROM public.encounters WHERE id = ${encounterId}
  `.execute(db)
  const row = result.rows[0]
  if (!row) return null
  const [encounterActors, encounterReminders, initiativeRoundState] = await Promise.all([
    actors(db, encounterId),
    reminders(db, encounterId),
    readInitiativeRoundState(db, encounterId, Number(row.round))
  ])
  return encounterFromRow(row, encounterActors, encounterReminders, initiativeRoundState)
}

export function createEncounterRepository(db: DBLike) {
  return {
    async listBlueprints(
      ownerUserId: string,
      gameSystemId: string
    ): Promise<EncounterBlueprintRecord[]> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_blueprints
        WHERE owner_user_id = ${ownerUserId} AND game_system_id = ${gameSystemId}
        ORDER BY updated_at DESC, id DESC
      `.execute(db)
      return result.rows.map(blueprintFromRow)
    },

    async lockBlueprint(
      blueprintId: string,
      ownerUserId: string
    ): Promise<EncounterBlueprintRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_blueprints
        WHERE id = ${blueprintId} AND owner_user_id = ${ownerUserId} FOR UPDATE
      `.execute(db)
      return result.rows[0] ? blueprintFromRow(result.rows[0]) : null
    },

    async findBlueprintByOwnerCommand(
      ownerUserId: string,
      commandId: string
    ): Promise<{
      blueprint: EncounterBlueprintRecord
      commandFingerprint: string
    } | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_blueprints
        WHERE owner_user_id = ${ownerUserId} AND command_id = ${commandId}
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            blueprint: blueprintFromRow(row),
            commandFingerprint: String(row.command_fingerprint)
          }
        : null
    },

    async createBlueprint(input: {
      id: string
      ownerUserId: string
      gameSystemId: string
      commandId: string
      commandFingerprint: string
      name: string
      setupChecksum: string
      enemies: EncounterBlueprintEnemy[]
    }): Promise<EncounterBlueprintRecord | null> {
      const result = await sql<Record<string, unknown>>`
        INSERT INTO public.encounter_blueprints (
          id, owner_user_id, game_system_id, command_id, command_fingerprint, name, setup_checksum, enemies
        ) VALUES (
          ${input.id}, ${input.ownerUserId}, ${input.gameSystemId}, ${input.commandId}, ${input.commandFingerprint},
          ${input.name}, ${input.setupChecksum}, ${json(input.enemies as unknown as Json)}::jsonb
        )
        ON CONFLICT (owner_user_id, command_id) DO NOTHING
        RETURNING *
      `.execute(db)
      const row = result.rows[0]
      return row ? blueprintFromRow(row) : null
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

    async listVersionMetadataForCampaign(campaignId: string): Promise<EncounterVersionMetadata[]> {
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
      return result.rows.map((row) => ({
        id: row.id,
        version: Number(row.version)
      }))
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

    async countBlueprintsForOwner(userId: string): Promise<number> {
      const result = await sql<{ count: string | number }>`
        SELECT count(*) AS count
        FROM public.encounter_blueprints blueprint
        WHERE blueprint.owner_user_id = ${userId}
      `.execute(db)
      return Number(result.rows[0]?.count ?? 0)
    },

    async findBlueprintUpdateReceipt(
      ownerUserId: string,
      commandId: string
    ): Promise<{
      commandFingerprint: string
      resultPayload: ReturnType<typeof encounterBlueprintDtoSchema.parse>
    } | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT command_fingerprint, result_payload FROM public.encounter_blueprint_events
        WHERE owner_user_id = ${ownerUserId} AND command_id = ${commandId}
      `.execute(db)
      const row = result.rows[0]
      return row
        ? {
            commandFingerprint: String(row.command_fingerprint),
            resultPayload: encounterBlueprintDtoSchema.parse(row.result_payload)
          }
        : null
    },

    async updateBlueprint(input: {
      blueprintId: string
      expectedVersion: number
      name: string
      enemies: EncounterBlueprintEnemy[]
      setupChecksum: string
    }): Promise<EncounterBlueprintRecord | null> {
      const result = await sql<Record<string, unknown>>`
        UPDATE public.encounter_blueprints SET name = ${input.name}, enemies = ${json(input.enemies as unknown as Json)}::jsonb,
          setup_checksum = ${input.setupChecksum}, version = version + 1, updated_at = now()
        WHERE id = ${input.blueprintId} AND version = ${input.expectedVersion} RETURNING *
      `.execute(db)
      return result.rows[0] ? blueprintFromRow(result.rows[0]) : null
    },

    async appendBlueprintUpdateReceipt(input: {
      blueprintId: string
      blueprintVersion: number
      ownerUserId: string
      commandId: string
      commandFingerprint: string
      resultPayload: ReturnType<typeof encounterBlueprintDtoSchema.parse>
      actorUserId: string
    }): Promise<void> {
      const resultPayload = encounterBlueprintDtoSchema.parse(input.resultPayload)
      if (
        resultPayload.id !== input.blueprintId ||
        resultPayload.version !== input.blueprintVersion
      ) {
        throw new Error('Encounter Blueprint receipt identity does not match its result.')
      }
      await sql`
        INSERT INTO public.encounter_blueprint_events (blueprint_id, blueprint_version, owner_user_id, command_id, command_type, command_fingerprint, result_payload, actor_user_id)
        VALUES (${input.blueprintId}, ${input.blueprintVersion}, ${input.ownerUserId}, ${input.commandId}, 'UPDATE', ${input.commandFingerprint}, ${json(resultPayload as unknown as Json)}::jsonb, ${input.actorUserId})
      `.execute(db)
    },

    async lock(encounterId: string): Promise<EncounterRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounters WHERE id = ${encounterId} FOR UPDATE
      `.execute(db)
      const row = result.rows[0]
      if (!row) return null
      const [encounterActors, encounterReminders, initiativeRoundState] = await Promise.all([
        actors(db, encounterId),
        reminders(db, encounterId),
        readInitiativeRoundState(db, encounterId, Number(row.round))
      ])
      return encounterFromRow(row, encounterActors, encounterReminders, initiativeRoundState)
    },

    /**
     * The caller must already hold the Encounter root lock. This method locks
     * the normalized header, then sides by side UUID, then participants by
     * actor UUID so initiative work shares one deterministic lock order.
     */
    async lockInitiativeRound(input: {
      encounterId: string
      round: number
    }): Promise<EncounterInitiativeRoundStateRecord | null> {
      const headerResult = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_initiative_rounds
        WHERE encounter_id = ${input.encounterId} AND round = ${input.round}
        FOR UPDATE
      `.execute(db)
      const header = headerResult.rows[0]
      if (!header) return null

      const sidesResult = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_initiative_sides
        WHERE encounter_id = ${input.encounterId} AND round = ${input.round}
        ORDER BY side_id ASC
        FOR UPDATE
      `.execute(db)
      const participantsResult = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_initiative_participants
        WHERE encounter_id = ${input.encounterId} AND round = ${input.round}
        ORDER BY actor_id ASC
        FOR UPDATE
      `.execute(db)

      return encounterInitiativeRoundStateDtoSchema.parse({
        round: initiativeRoundFromRow(header),
        sides: sidesResult.rows.map(initiativeSideFromRow),
        participants: participantsResult.rows.map(initiativeParticipantFromRow)
      })
    },

    /**
     * The caller must already hold the Encounter root lock. One statement
     * creates the round header and snapshots its actors; SIDE_ROLL additionally
     * snapshots the distinct currently represented sides.
     */
    async createInitiativeRound(
      input: CreateEncounterInitiativeRoundDto
    ): Promise<EncounterInitiativeRoundRecord> {
      const parsed = createEncounterInitiativeRoundDtoSchema.parse(input)
      const result = await sql<Record<string, unknown>>`
        WITH created_round AS (
          INSERT INTO public.encounter_initiative_rounds (
            encounter_id, round, procedure, cadence, status, policy_snapshot_checksum
          )
          SELECT
            encounter.id,
            ${parsed.round},
            ${parsed.procedure},
            ${parsed.cadence},
            'PREPARING',
            ${parsed.policySnapshotChecksum}
          FROM public.encounters encounter
          WHERE encounter.id = ${parsed.encounterId}
          RETURNING *
        ), created_participants AS (
          INSERT INTO public.encounter_initiative_participants (
            encounter_id, round, actor_id, side_id, status
          )
          SELECT ${parsed.encounterId}, ${parsed.round}, actor.id, actor.side_id, 'UNRESOLVED'
          FROM public.encounter_actors actor
          JOIN created_round ON true
          WHERE actor.encounter_id = ${parsed.encounterId}
          RETURNING actor_id, side_id
        ), created_sides AS (
          INSERT INTO public.encounter_initiative_sides (
            encounter_id, round, side_id, status
          )
          SELECT ${parsed.encounterId}, ${parsed.round}, participant.side_id, 'UNRESOLVED'
          FROM created_participants participant
          JOIN created_round ON created_round.procedure = 'SIDE_ROLL'
          GROUP BY participant.side_id
          RETURNING side_id
        )
        SELECT * FROM created_round
      `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Initiative round was not created.')
      return initiativeRoundFromRow(row)
    },

    async updateInitiativeRound(
      input: UpdateEncounterInitiativeRoundDto
    ): Promise<EncounterInitiativeRoundRecord> {
      const parsed = updateEncounterInitiativeRoundDtoSchema.parse(input)
      const result = await sql<Record<string, unknown>>`
        UPDATE public.encounter_initiative_rounds
        SET status = ${parsed.status},
            next_turn_order_ordinal = ${parsed.nextTurnOrderOrdinal},
            version = version + 1,
            updated_at = now()
        WHERE encounter_id = ${parsed.encounterId}
          AND round = ${parsed.round}
          AND version = ${parsed.expectedVersion}
          AND next_turn_order_ordinal <= ${parsed.nextTurnOrderOrdinal}
          AND (
            status = ${parsed.status}
            OR (status = 'PREPARING' AND ${parsed.status} = 'ACTIVE')
            OR (status = 'ACTIVE' AND ${parsed.status} = 'COMPLETED')
          )
        RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new EncounterInitiativeStateCurrentnessError(
          'Initiative round changed before it could be updated.'
        )
      }
      return initiativeRoundFromRow(row)
    },

    async updateInitiativeParticipant(
      input: UpdateEncounterInitiativeParticipantDto
    ): Promise<EncounterInitiativeParticipantRecord> {
      const parsed = updateEncounterInitiativeParticipantDtoSchema.parse(input)
      const result = await sql<Record<string, unknown>>`
        UPDATE public.encounter_initiative_participants
        SET status = ${parsed.status},
            initiative_score = ${parsed.initiativeScore},
            evaluation_occurrence_id = ${parsed.evaluation.occurrenceId},
            evaluation_result_checksum = ${parsed.evaluation.resultChecksum},
            tie_occurrence_id = ${parsed.tie.occurrenceId},
            tie_result_checksum = ${parsed.tie.resultChecksum},
            declaration = ${parsed.declaration === null ? null : json(parsed.declaration as unknown as Json)}::jsonb,
            declaration_checksum = ${parsed.declarationChecksum},
            turn_order_ordinal = ${parsed.turnOrderOrdinal},
            version = version + 1,
            updated_at = now()
        WHERE encounter_id = ${parsed.encounterId}
          AND round = ${parsed.round}
          AND actor_id = ${parsed.actorId}
          AND version = ${parsed.expectedVersion}
          AND (
            turn_order_ordinal IS NULL
            OR turn_order_ordinal = ${parsed.turnOrderOrdinal}
          )
          AND (
            evaluation_occurrence_id IS NULL
            OR (
              evaluation_occurrence_id = ${parsed.evaluation.occurrenceId}
              AND evaluation_result_checksum = ${parsed.evaluation.resultChecksum}
            )
          )
          AND (
            tie_occurrence_id IS NULL
            OR (
              tie_occurrence_id = ${parsed.tie.occurrenceId}
              AND tie_result_checksum = ${parsed.tie.resultChecksum}
            )
          )
          AND (
            turn_order_ordinal IS NULL
            OR initiative_score IS NOT DISTINCT FROM ${parsed.initiativeScore}
          )
          AND (
            status = ${parsed.status}
            OR (
              status = 'UNRESOLVED'
              AND ${parsed.status} IN ('PENDING', 'EVALUATED', 'READY')
            )
            OR (
              status = 'PENDING'
              AND ${parsed.status} IN ('EVALUATED', 'READY')
            )
            OR (
              status = 'EVALUATED'
              AND ${parsed.status} IN ('PENDING', 'READY')
            )
            OR (status = 'READY' AND ${parsed.status} = 'ACTIVE')
            OR (status = 'ACTIVE' AND ${parsed.status} = 'ACTED')
          )
        RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new EncounterInitiativeStateCurrentnessError(
          'Initiative participant changed before it could be updated.'
        )
      }
      return initiativeParticipantFromRow(row)
    },

    async updateInitiativeSide(
      input: UpdateEncounterInitiativeSideDto
    ): Promise<EncounterInitiativeSideRecord> {
      const parsed = updateEncounterInitiativeSideDtoSchema.parse(input)
      const result = await sql<Record<string, unknown>>`
        UPDATE public.encounter_initiative_sides
        SET status = ${parsed.status},
            initiative_score = ${parsed.initiativeScore},
            evaluation_occurrence_id = ${parsed.evaluation.occurrenceId},
            evaluation_result_checksum = ${parsed.evaluation.resultChecksum},
            tie_occurrence_id = ${parsed.tie.occurrenceId},
            tie_result_checksum = ${parsed.tie.resultChecksum},
            side_order_ordinal = ${parsed.sideOrderOrdinal},
            version = version + 1,
            updated_at = now()
        WHERE encounter_id = ${parsed.encounterId}
          AND round = ${parsed.round}
          AND side_id = ${parsed.sideId}
          AND version = ${parsed.expectedVersion}
          AND (
            side_order_ordinal IS NULL
            OR side_order_ordinal = ${parsed.sideOrderOrdinal}
          )
          AND (
            evaluation_occurrence_id IS NULL
            OR (
              evaluation_occurrence_id = ${parsed.evaluation.occurrenceId}
              AND evaluation_result_checksum = ${parsed.evaluation.resultChecksum}
            )
          )
          AND (
            tie_occurrence_id IS NULL
            OR (
              tie_occurrence_id = ${parsed.tie.occurrenceId}
              AND tie_result_checksum = ${parsed.tie.resultChecksum}
            )
          )
          AND (
            side_order_ordinal IS NULL
            OR initiative_score IS NOT DISTINCT FROM ${parsed.initiativeScore}
          )
          AND (
            status = ${parsed.status}
            OR (
              status = 'UNRESOLVED'
              AND ${parsed.status} IN ('PENDING', 'EVALUATED', 'READY')
            )
            OR (
              status = 'PENDING'
              AND ${parsed.status} IN ('EVALUATED', 'READY')
            )
            OR (
              status = 'EVALUATED'
              AND ${parsed.status} IN ('PENDING', 'READY')
            )
            OR (status = 'READY' AND ${parsed.status} = 'ACTIVE')
            OR (status = 'ACTIVE' AND ${parsed.status} = 'COMPLETED')
          )
        RETURNING *
      `.execute(db)
      const row = result.rows[0]
      if (!row) {
        throw new EncounterInitiativeStateCurrentnessError(
          'Initiative side changed before it could be updated.'
        )
      }
      return initiativeSideFromRow(row)
    },

    async create(input: {
      id: string
      campaignId: string
      sessionId: string
      gameSystemId: string
      blueprintId: string
      blueprintVersion: number
      blueprintChecksum: string
      rulePackRevisionId?: string | null
      initiativePolicySnapshot: EncounterInitiativePolicySnapshotDto | null
      initiativePolicySnapshotChecksum: string | null
      optionalCombatSnapshot: EncounterOptionalCombatSnapshotDto | null
      optionalCombatSnapshotChecksum: string | null
      automationMode: EncounterAutomationMode
      manualReminderMode: EncounterManualReminderMode
      name: string
    }): Promise<EncounterRecord> {
      await sql`
        INSERT INTO public.encounters (
          id, campaign_id, session_id, game_system_id, blueprint_id, blueprint_version, blueprint_checksum, rule_pack_revision_id,
          initiative_policy_snapshot, initiative_policy_snapshot_checksum, optional_combat_snapshot, optional_combat_snapshot_checksum,
          automation_mode, manual_reminder_mode, name
        ) VALUES (
          ${input.id}, ${input.campaignId}, ${input.sessionId}, ${input.gameSystemId}, ${input.blueprintId}, ${input.blueprintVersion}, ${input.blueprintChecksum},
          ${input.rulePackRevisionId ?? null}, ${input.initiativePolicySnapshot === null ? null : json(input.initiativePolicySnapshot as unknown as Json)}::jsonb,
          ${input.initiativePolicySnapshotChecksum}, ${input.optionalCombatSnapshot === null ? null : json(input.optionalCombatSnapshot as unknown as Json)}::jsonb,
          ${input.optionalCombatSnapshotChecksum}, ${input.automationMode}, ${input.manualReminderMode}, ${input.name}
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

    async replaceOptionalCombatSnapshot(input: {
      encounterId: string
      snapshot: EncounterOptionalCombatSnapshotDto
      checksum: string
    }): Promise<void> {
      await sql`
        UPDATE public.encounters
        SET optional_combat_snapshot = ${json(input.snapshot as unknown as Json)}::jsonb,
            optional_combat_snapshot_checksum = ${input.checksum},
            updated_at = now()
        WHERE id = ${input.encounterId}
      `.execute(db)
    },

    async addActor(input: {
      id: string
      encounterId: string
      sideId: string
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
          id, encounter_id, side_id, kind, source_id, source_revision, label, system_id, stable_tie_key,
          public, current_hit_points, max_hit_points, temp_hit_points, conditions, resources,
          gm_notes, initiative, manual_order, snapshot
        ) VALUES (
          ${input.id}, ${input.encounterId}, ${input.sideId}, ${input.kind}, ${input.sourceId}, ${input.sourceRevision},
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

    async createSide(input: {
      id: string
      encounterId: string
      label: string
      sortOrder: number
    }): Promise<void> {
      await sql`
        INSERT INTO public.encounter_sides (id, encounter_id, label, sort_order)
        VALUES (${input.id}, ${input.encounterId}, ${input.label}, ${input.sortOrder})
      `.execute(db)
    },

    async setSideRelationship(input: {
      encounterId: string
      firstSideId: string
      secondSideId: string
      relationshipKind: EncounterSideRelationshipKind
    }): Promise<void> {
      if (input.firstSideId === input.secondSideId) {
        throw new Error('An Encounter side is implicitly allied with itself.')
      }
      const [firstSideId, secondSideId] = [input.firstSideId, input.secondSideId].sort()
      await sql`
        INSERT INTO public.encounter_side_relationships (
          encounter_id, first_side_id, second_side_id, relationship_kind
        ) VALUES (
          ${input.encounterId}, ${firstSideId}, ${secondSideId}, ${input.relationshipKind}
        )
        ON CONFLICT (encounter_id, first_side_id, second_side_id)
        DO UPDATE SET relationship_kind = EXCLUDED.relationship_kind, updated_at = now()
      `.execute(db)
    },

    async lockActorRelationship(input: {
      encounterId: string
      firstActorId: string
      secondActorId: string
    }): Promise<EncounterSideRelationshipKind | null> {
      const result = await sql<{
        relationship_kind: EncounterSideRelationshipKind | null
      }>`
        SELECT CASE
          WHEN first_actor.side_id = second_actor.side_id THEN 'ALLIED'
          ELSE relationship.relationship_kind
        END AS relationship_kind
        FROM public.encounter_actors first_actor
        JOIN public.encounter_actors second_actor
          ON second_actor.encounter_id = first_actor.encounter_id
        LEFT JOIN public.encounter_side_relationships relationship
          ON relationship.encounter_id = first_actor.encounter_id
         AND relationship.first_side_id = LEAST(first_actor.side_id, second_actor.side_id)
         AND relationship.second_side_id = GREATEST(first_actor.side_id, second_actor.side_id)
        WHERE first_actor.encounter_id = ${input.encounterId}
          AND first_actor.id = ${input.firstActorId}
          AND second_actor.id = ${input.secondActorId}
        FOR SHARE OF first_actor, second_actor
      `.execute(db)
      return result.rows[0]?.relationship_kind ?? null
    },

    async updateActor(actor: EncounterActorRecord): Promise<void> {
      await sql`
        UPDATE public.encounter_actors
        SET source_revision = ${actor.sourceRevision}, label = ${actor.label}, public = ${actor.public}, current_hit_points = ${actor.currentHitPoints},
            max_hit_points = ${actor.maxHitPoints}, temp_hit_points = ${actor.tempHitPoints},
            conditions = ${json(actor.conditions)}::jsonb, resources = ${json(actor.resources)}::jsonb,
            gm_notes = ${actor.gmNotes}, initiative = ${actor.initiative}, manual_order = ${actor.manualOrder},
            updated_at = now()
        WHERE id = ${actor.id} AND encounter_id = ${actor.encounterId}
      `.execute(db)
    },

    async upsertReminder(
      input: Omit<EncounterReminderRecord, 'encounterId'> & {
        encounterId: string
      }
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
        ? {
            systemId: row.system_id,
            code: row.ruleset_code,
            version: row.ruleset_version
          }
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
      const existing = await sql<{
        projection_checksum: string
        stream_version: number
      }>`
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
          encounter.version AS encounter_version,
          encounter.game_system_id,
          encounter.blueprint_id,
          encounter.blueprint_version,
          encounter.blueprint_checksum,
          encounter.automation_mode,
          encounter.manual_reminder_mode
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
      let header
      try {
        header = encounterProjectionBlueprintHeaderSchema.parse({
          encounterId: row.encounter_id,
          gameSystemId: row.game_system_id,
          blueprintId: row.blueprint_id,
          blueprintVersion: Number(row.blueprint_version),
          blueprintChecksum: row.blueprint_checksum,
          automationMode: row.automation_mode,
          manualReminderMode: row.manual_reminder_mode
        })
      } catch {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${input.encounterId}" projection is stale or invalid.`
        )
      }
      const current = encounterCurrentProjectionSchema.safeParse(row.projection)
      const isLegacyProjection = !current.success
      let legacyProjectionChecksum: string | null = null
      let projection: EncounterCurrentProjection
      try {
        projection = current.success
          ? assertEncounterProjectionBlueprintHeader({
              header,
              projection: current.data
            })
          : (() => {
              const legacy = legacyEncounterCurrentProjectionV1Schema.safeParse(row.projection)
              if (
                !legacy.success ||
                checksumLegacyEncounterCurrentProjectionV1(legacy.data) !==
                  legacy.data.projectionChecksum
              ) {
                throw new EncounterCurrentProjectionMismatchError(
                  `Encounter "${input.encounterId}" projection is stale or invalid.`
                )
              }
              legacyProjectionChecksum = legacy.data.projectionChecksum
              const upgraded = upgradeLegacyEncounterCurrentProjectionV1({
                header,
                projection: legacy.data
              })
              return encounterCurrentProjectionSchema.parse({
                ...upgraded,
                projectionChecksum: checksumEncounterCurrentProjection(upgraded)
              })
            })()
      } catch {
        throw new EncounterCurrentProjectionMismatchError(
          `Encounter "${input.encounterId}" projection is stale or invalid.`
        )
      }
      if (
        projection.encounterId !== row.encounter_id ||
        projection.streamVersion !== Number(row.stream_version) ||
        projection.streamVersion !== input.expectedStreamVersion ||
        checksumEncounterCurrentProjection(projection) !== projection.projectionChecksum ||
        (isLegacyProjection
          ? Number(row.projection_schema_version) !== 1 ||
            legacyProjectionChecksum !== row.projection_checksum
          : projection.projectionSchemaVersion !== Number(row.projection_schema_version) ||
            projection.projectionChecksum !== row.projection_checksum)
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
