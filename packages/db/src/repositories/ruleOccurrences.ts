import { sql } from 'kysely'
import {
  serverRuleExecutionPendingSnapshotDtoSchema,
  serverRuleExecutionReceiptCommandMetadataDtoSchema,
  storedRuleExecutionResultDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionReceiptCommandMetadataDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import type { DBLike, Json } from '#types'
import { checksumCanonicalJson } from '../utils/canonicalJson.js'

type RuntimeTimestamp = Date | string

export type RuleOccurrenceAggregateKind = 'CHARACTER' | 'ENCOUNTER'
export type RuleOccurrenceState = 'PENDING' | 'COMPLETED'

export interface RuleOccurrenceRecord {
  id: string
  aggregateKind: RuleOccurrenceAggregateKind
  aggregateId: string
  rootCommandId: string
  state: RuleOccurrenceState
  version: number
  expectedAggregateVersion: number
  pendingSnapshot: ServerRuleExecutionPendingSnapshotDto | null
  pendingSnapshotChecksum: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface RuleOccurrenceReceipt {
  aggregateKind: RuleOccurrenceAggregateKind
  aggregateId: string
  commandId: string
  commandFingerprint: string
  occurrenceId: string
  aggregateVersion: number
  commandMetadata: ServerRuleExecutionReceiptCommandMetadataDto
  resultPayload: StoredRuleExecutionResultDto
  actorUserId: string
  correlationId: string | null
  commandType: string
}

export class RuleOccurrenceCurrentnessError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuleOccurrenceCurrentnessError'
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

async function encounterOptionalCombatSnapshotChecksum(
  db: DBLike,
  encounterId: string
): Promise<string | null> {
  const row = await db
    .selectFrom('encounters')
    .selectAll()
    .where('id', '=', encounterId)
    .executeTakeFirst()
  if (!row)
    throw new RuleOccurrenceCurrentnessError('Encounter is unavailable for rule occurrence.')
  const checksum = (row as Record<string, unknown>).optional_combat_snapshot_checksum
  return checksum == null ? null : String(checksum)
}

function withEncounterOptionalCombatSnapshotChecksum(
  snapshot: ServerRuleExecutionPendingSnapshotDto,
  checksum: string | null
): ServerRuleExecutionPendingSnapshotDto {
  return serverRuleExecutionPendingSnapshotDtoSchema.parse({
    ...snapshot,
    optionalCombatSnapshotChecksum: checksum
  })
}

function withEncounterOptionalCombatReceiptChecksum(
  metadata: ServerRuleExecutionReceiptCommandMetadataDto,
  checksum: string | null
): ServerRuleExecutionReceiptCommandMetadataDto {
  return serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
    ...metadata,
    optionalCombatSnapshotChecksum: checksum
  })
}

function occurrenceFromRow(
  kind: RuleOccurrenceAggregateKind,
  row: Record<string, unknown>
): RuleOccurrenceRecord {
  const pendingSnapshot =
    row.pending_snapshot == null
      ? null
      : serverRuleExecutionPendingSnapshotDtoSchema.parse(row.pending_snapshot)
  const pendingSnapshotChecksum =
    row.pending_snapshot_checksum == null ? null : String(row.pending_snapshot_checksum)
  if (pendingSnapshot === null) {
    if (pendingSnapshotChecksum !== null)
      throw new Error('Completed rule occurrences cannot retain a pending snapshot checksum.')
  } else if (pendingSnapshotChecksum !== checksumCanonicalJson(pendingSnapshot)) {
    throw new Error('Rule occurrence pending snapshot checksum is invalid.')
  }
  return {
    id: String(row.id),
    aggregateKind: kind,
    aggregateId: String(kind === 'CHARACTER' ? row.character_id : row.encounter_id),
    rootCommandId: String(row.root_command_id),
    state: row.state as RuleOccurrenceState,
    version: Number(row.version),
    expectedAggregateVersion: Number(
      kind === 'CHARACTER' ? row.expected_stream_version : row.expected_encounter_version
    ),
    pendingSnapshot,
    pendingSnapshotChecksum,
    completedAt: row.completed_at == null ? null : iso(row.completed_at as RuntimeTimestamp),
    createdAt: iso(row.created_at as RuntimeTimestamp),
    updatedAt: iso(row.updated_at as RuntimeTimestamp)
  }
}

function receiptFromRow(
  kind: RuleOccurrenceAggregateKind,
  row: Record<string, unknown>
): RuleOccurrenceReceipt {
  const receipt = {
    aggregateKind: kind,
    aggregateId: String(kind === 'CHARACTER' ? row.character_id : row.encounter_id),
    commandId: String(row.command_id),
    commandFingerprint: String(row.command_fingerprint),
    occurrenceId: String(row.occurrence_id),
    aggregateVersion: Number(kind === 'CHARACTER' ? row.stream_version : row.encounter_version),
    commandMetadata: serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(row.command_metadata),
    resultPayload: storedRuleExecutionResultDtoSchema.parse(row.result_payload),
    actorUserId: String(row.actor_user_id),
    correlationId: row.correlation_id == null ? null : String(row.correlation_id),
    commandType: String(row.command_type)
  }
  validateRuleOccurrenceReceiptEnvelope(receipt)
  return receipt
}

/** Cross-column integrity for closed persisted rule receipts. */
export function validateRuleOccurrenceReceiptEnvelope(
  receipt: RuleOccurrenceReceipt
): RuleOccurrenceReceipt {
  const metadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(receipt.commandMetadata)
  const result = storedRuleExecutionResultDtoSchema.parse(receipt.resultPayload)
  const turnMetadata = metadata.transition === 'TURN_EFFECTS'
  const turnResult =
    result.status === 'INITIATIVE_COMPLETE' ||
    result.status === 'TURN_LIFECYCLE_COMPLETE' ||
    (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
  const pendingTurnMetadata = metadata.transition === 'TURN_EFFECTS_PENDING'
  const spatialMetadata = metadata.transition === 'SPATIAL_MOVEMENT'
  const spatialResult =
    result.status === 'ENCOUNTER_OCCURRENCE_PENDING' ||
    result.status === 'MOVEMENT_COMPLETE' ||
    (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  const cleanupMetadata = metadata.transition === 'MAINTENANCE_CLEANUP'
  const cleanupResult = result.status === 'MAINTENANCE_COMPLETE'
  if (
    !turnMetadata &&
    !turnResult &&
    !pendingTurnMetadata &&
    !spatialMetadata &&
    !spatialResult &&
    !cleanupMetadata &&
    !cleanupResult
  )
    return receipt
  if (cleanupMetadata || cleanupResult) {
    if (
      receipt.aggregateKind !== 'ENCOUNTER' ||
      metadata.transition !== 'MAINTENANCE_CLEANUP' ||
      result.status !== 'MAINTENANCE_COMPLETE' ||
      receipt.commandType !== 'REMOVE_ACTOR' ||
      metadata.commandType !== receipt.commandType ||
      result.encounterId !== receipt.aggregateId ||
      result.occurrenceId !== receipt.occurrenceId ||
      result.removedActorId !== metadata.removedActorId ||
      receipt.aggregateVersion !== metadata.expectedAggregateVersion + 1 ||
      result.occurrenceVersion !== 0
    )
      throw new Error('Maintenance cleanup rule receipt is invalid.')
    return receipt
  }
  if (pendingTurnMetadata) {
    if (
      receipt.aggregateKind !== 'ENCOUNTER' ||
      metadata.transition !== 'TURN_EFFECTS_PENDING' ||
      result.status !== 'ENCOUNTER_OCCURRENCE_PENDING' ||
      receipt.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
      metadata.commandType !== receipt.commandType ||
      result.encounterId !== receipt.aggregateId ||
      result.occurrenceId !== receipt.occurrenceId ||
      result.occurrenceVersion !== metadata.occurrenceVersion ||
      result.occurrence.status !== 'PENDING' ||
      result.occurrence.occurrenceId !== receipt.occurrenceId ||
      result.occurrence.occurrenceVersion !== metadata.occurrenceVersion ||
      result.encounterVersion !== receipt.aggregateVersion ||
      receipt.aggregateVersion !== metadata.expectedAggregateVersion ||
      metadata.resolutionCommand.expectedOccurrenceVersion !== metadata.occurrenceVersion - 1 ||
      metadata.resolutionCommand.commandId !== receipt.commandId ||
      metadata.resolutionCommand.commandFingerprint !== receipt.commandFingerprint ||
      metadata.resolutionCommand.actorUserId !== receipt.actorUserId ||
      metadata.resolutionCommand.correlationId !== receipt.correlationId ||
      result.characterTransitions.length !== 0 ||
      (result.occurrence.pending !== null &&
        result.occurrence.pending.encounterVersion !== result.encounterVersion)
    )
      throw new Error('Pending turn-effect rule receipt is invalid.')
    return receipt
  }
  if (spatialMetadata || spatialResult) {
    if (metadata.transition !== 'SPATIAL_MOVEMENT' || !spatialResult)
      throw new Error('Spatial-movement rule receipt is invalid.')
    const spatialMetadataValue = metadata
    const spatialResultValue = result
    const expectedEncounterVersion =
      spatialMetadataValue.expectedEncounterVersion +
      (spatialMetadataValue.encounterVersionTransition === 'ADVANCED' ? 1 : 0)
    const expectedSceneVersion =
      spatialMetadataValue.expectedSceneVersion +
      (spatialMetadataValue.sceneVersionTransition === 'ADVANCED' ? 1 : 0)
    const resultEncounterId = spatialResultValue.encounterId
    const resultEncounterVersion = spatialResultValue.encounterVersion
    const resultOccurrenceId = spatialResultValue.occurrenceId
    const resultOccurrenceVersion = spatialResultValue.occurrenceVersion
    if (
      receipt.aggregateKind !== 'ENCOUNTER' ||
      receipt.commandType !== spatialMetadataValue.commandType ||
      spatialMetadataValue.expectedEncounterVersion <
        spatialMetadataValue.rootExpectedEncounterVersion ||
      spatialMetadataValue.expectedSceneVersion < spatialMetadataValue.rootExpectedSceneVersion ||
      resultEncounterId !== receipt.aggregateId ||
      resultOccurrenceId !== receipt.occurrenceId ||
      resultOccurrenceVersion !== spatialMetadataValue.occurrenceVersion ||
      receipt.aggregateVersion !== resultEncounterVersion ||
      receipt.aggregateVersion !== expectedEncounterVersion
    )
      throw new Error('Spatial-movement rule receipt is invalid.')

    if (spatialResultValue.status === 'ENCOUNTER_OCCURRENCE_PENDING') {
      const rootPending = spatialMetadataValue.commandType === 'MOVE_SCENE_TOKEN'
      if (
        (spatialMetadataValue.commandType !== 'RESOLVE_RULE_OCCURRENCE' && !rootPending) ||
        spatialResultValue.occurrence.status !== 'PENDING' ||
        spatialResultValue.occurrence.occurrenceId !== receipt.occurrenceId ||
        spatialResultValue.occurrence.occurrenceVersion !==
          spatialMetadataValue.occurrenceVersion ||
        (spatialResultValue.occurrence.pending !== null &&
          spatialResultValue.occurrence.pending.encounterVersion !==
            spatialResultValue.encounterVersion)
      )
        throw new Error('Pending spatial-movement receipt result is invalid.')
      if (
        rootPending &&
        (spatialMetadataValue.occurrenceVersion !== 0 ||
          spatialMetadataValue.resolutionCommands.length !== 0 ||
          spatialResultValue.occurrenceVersion !== 0 ||
          spatialResultValue.occurrence.occurrenceVersion !== 0 ||
          spatialMetadataValue.expectedEncounterVersion !==
            spatialMetadataValue.rootExpectedEncounterVersion ||
          spatialMetadataValue.expectedSceneVersion !==
            spatialMetadataValue.rootExpectedSceneVersion)
      )
        throw new Error('Pending root spatial-movement receipt is invalid.')
      const expectedCharacterChanges = spatialResultValue.characterTransitions.map(
        (transition) => ({
          aggregateId: transition.characterId,
          aggregateKind: 'CHARACTER' as const,
          beforeVersion: transition.beforeStreamVersion,
          version: transition.afterStreamVersion
        })
      )
      const storedCharacterChanges = spatialMetadataValue.changedAggregates.filter(
        (aggregate) => aggregate.aggregateKind === 'CHARACTER'
      )
      if (
        checksumCanonicalJson(expectedCharacterChanges) !==
        checksumCanonicalJson(storedCharacterChanges)
      )
        throw new Error('Pending spatial Character changes are invalid.')
    } else {
      if (
        spatialMetadataValue.currentnessChecksum === null ||
        spatialResultValue.sceneVersion !== expectedSceneVersion ||
        spatialResultValue.sceneId !== spatialMetadataValue.sceneId ||
        spatialResultValue.tokenId !== spatialMetadataValue.tokenId ||
        spatialResultValue.movementKind !== spatialMetadataValue.movementKind
      )
        throw new Error('Terminal spatial-movement receipt result is invalid.')

      const characterTransitions = new Map<string, { beforeVersion: number; version: number }>()
      const appendCharacterTransition = (transition: {
        characterId: string
        beforeStreamVersion: number
        afterStreamVersion: number
      }) => {
        const current = characterTransitions.get(transition.characterId)
        if (current && current.version !== transition.beforeStreamVersion)
          throw new Error('Terminal spatial Character transition is invalid.')
        characterTransitions.set(transition.characterId, {
          beforeVersion: current?.beforeVersion ?? transition.beforeStreamVersion,
          version: transition.afterStreamVersion
        })
      }
      for (const execution of spatialResultValue.reactionExecutions)
        if (execution.sourceCommandId === receipt.commandId)
          for (const transition of execution.characterTransitions)
            appendCharacterTransition(transition)
      if (
        spatialResultValue.status === 'BATCH_COMPLETE' &&
        spatialResultValue.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
      )
        for (const transition of spatialResultValue.characterTransitions)
          appendCharacterTransition(transition)
      const expectedCharacterChanges = [...characterTransitions]
        .map(([aggregateId, transition]) => ({
          aggregateId,
          aggregateKind: 'CHARACTER' as const,
          ...transition
        }))
        .sort((left, right) => left.aggregateId.localeCompare(right.aggregateId))
      const storedCharacterChanges = spatialMetadataValue.changedAggregates.filter(
        (aggregate) => aggregate.aggregateKind === 'CHARACTER'
      )
      if (
        checksumCanonicalJson(expectedCharacterChanges) !==
        checksumCanonicalJson(storedCharacterChanges)
      )
        throw new Error('Terminal spatial Character changes are invalid.')
    }

    if (spatialMetadataValue.commandType === 'MOVE_SCENE_TOKEN') {
      if (
        (spatialMetadataValue.encounterVersionTransition !== 'ADVANCED' &&
          !(
            spatialResultValue.status === 'ENCOUNTER_OCCURRENCE_PENDING' &&
            spatialMetadataValue.encounterVersionTransition === 'UNCHANGED'
          )) ||
        spatialMetadataValue.expectedEncounterVersion !==
          spatialMetadataValue.rootExpectedEncounterVersion ||
        spatialMetadataValue.expectedSceneVersion !==
          spatialMetadataValue.rootExpectedSceneVersion ||
        receipt.commandId !== spatialMetadataValue.rootCommandId ||
        receipt.commandFingerprint !== spatialMetadataValue.rootCommandFingerprint ||
        receipt.actorUserId !== spatialMetadataValue.rootInitiatorUserId ||
        receipt.correlationId !== spatialMetadataValue.rootCorrelationId
      )
        throw new Error('Spatial movement root receipt identity is invalid.')
      return receipt
    }

    const resolutionCommand = spatialMetadataValue.resolutionCommands.at(-1)
    if (
      !resolutionCommand ||
      resolutionCommand.expectedOccurrenceVersion !== spatialMetadataValue.occurrenceVersion - 1 ||
      resolutionCommand.commandId !== receipt.commandId ||
      resolutionCommand.commandFingerprint !== receipt.commandFingerprint ||
      resolutionCommand.actorUserId !== receipt.actorUserId ||
      resolutionCommand.correlationId !== receipt.correlationId
    )
      throw new Error('Spatial movement resolution receipt identity is invalid.')
    return receipt
  }
  if (receipt.aggregateKind !== 'ENCOUNTER') {
    throw new Error('Turn-effect rule receipts must belong to an Encounter aggregate.')
  }
  if (metadata.transition !== 'TURN_EFFECTS') {
    throw new Error('Turn-effect rule receipt metadata is invalid.')
  }
  if (receipt.commandType !== metadata.commandType) {
    throw new Error('Turn-effect receipt command type does not match metadata.')
  }
  if (receipt.aggregateVersion !== metadata.expectedAggregateVersion + 1) {
    throw new Error('Turn-effect receipt aggregate version is invalid.')
  }
  const initiative =
    result.status === 'INITIATIVE_COMPLETE'
      ? result.initiative
      : result.status === 'TURN_LIFECYCLE_COMPLETE'
        ? result.initiative
        : result.status === 'MANUAL'
          ? result.initiative
          : result.status === 'BATCH_COMPLETE' &&
              result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
            ? result.initiative
            : null
  const initiativeAdvance =
    result.status === 'INITIATIVE_COMPLETE'
      ? result.initiativeAdvance
      : result.status === 'TURN_LIFECYCLE_COMPLETE'
        ? result.initiativeAdvance
        : result.status === 'MANUAL'
          ? result.initiativeAdvance
          : result.status === 'BATCH_COMPLETE' &&
              result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
            ? result.initiativeAdvance
            : null
  if (
    metadata.initiativeChecksum !== (initiative === null ? null : checksumCanonicalJson(initiative))
  )
    throw new Error('Turn lifecycle initiative evidence is invalid.')
  if (
    metadata.initiativeAdvanceChecksum !==
    (initiativeAdvance === null ? null : checksumCanonicalJson(initiativeAdvance))
  )
    throw new Error('Turn lifecycle initiative advancement evidence is invalid.')
  if (result.status === 'INITIATIVE_COMPLETE') {
    if (
      metadata.selectionChecksum !== null ||
      result.encounterId !== receipt.aggregateId ||
      result.occurrenceId !== receipt.occurrenceId ||
      result.occurrenceVersion !== metadata.terminalOccurrenceVersion ||
      result.commandType !== metadata.commandType ||
      result.commandType !== receipt.commandType
    )
      throw new Error('Initiative-only turn lifecycle receipt is invalid.')
    return receipt
  }
  if (result.status === 'TURN_LIFECYCLE_COMPLETE') {
    const selectionChecksum = checksumCanonicalJson({
      outgoing: result.outgoingTurn.selectionChecksum,
      incoming: result.incomingTurn.selectionChecksum
    })
    if (
      receipt.commandType !== 'ADVANCE_TURN' ||
      metadata.commandType !== 'ADVANCE_TURN' ||
      result.encounterId !== receipt.aggregateId ||
      result.occurrenceId !== receipt.occurrenceId ||
      result.occurrenceVersion !== metadata.terminalOccurrenceVersion ||
      metadata.selectionChecksum !== selectionChecksum
    )
      throw new Error('Turn lifecycle receipt is invalid.')
    return receipt
  }
  if (result.status === 'MANUAL') {
    if (!['START', 'ADVANCE_TURN'].includes(receipt.commandType)) {
      throw new Error('Manual turn-effect receipt command type is invalid.')
    }
    if (
      result.occurrenceId !== receipt.occurrenceId ||
      result.occurrenceVersion !== metadata.terminalOccurrenceVersion
    ) {
      throw new Error('Manual turn-effect receipt occurrence is invalid.')
    }
    return receipt
  }
  if (result.status !== 'BATCH_COMPLETE' || result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS') {
    throw new Error('Turn-effect receipt result is invalid.')
  }
  if (
    result.encounterId !== receipt.aggregateId ||
    result.occurrenceId !== receipt.occurrenceId ||
    result.commandType !== metadata.commandType ||
    result.commandType !== receipt.commandType
  ) {
    throw new Error('Turn-effect receipt identity does not match its envelope.')
  }
  if (result.occurrenceVersion !== metadata.terminalOccurrenceVersion) {
    throw new Error('Turn-effect receipt occurrence version is invalid.')
  }
  for (const execution of result.executions) {
    if (
      checksumCanonicalJson({
        targetActorId: execution.targetActorId,
        ...execution.targetTransition.before
      }) !== execution.targetTransition.checksum
    ) {
      throw new Error('Turn-effect receipt target transition checksum is invalid.')
    }
    if (
      checksumCanonicalJson({
        schemaVersion: 1,
        remainingTicks: execution.lifecycle.beforeRemainingTicks
      }) !== execution.lifecycle.beforeLifecycleChecksum
    ) {
      throw new Error('Turn-effect receipt before lifecycle checksum is invalid.')
    }
    if (
      execution.lifecycle.kind === 'UPDATE' &&
      checksumCanonicalJson({
        schemaVersion: 1,
        remainingTicks: execution.lifecycle.afterRemainingTicks
      }) !== execution.lifecycle.afterLifecycleChecksum
    ) {
      throw new Error('Turn-effect receipt lifecycle checksum is invalid.')
    }
  }
  return receipt
}

/**
 * Server-only repository for the two aggregate-owned occurrence stores. The
 * caller owns aggregate authorization, aggregate locks, and aggregate state
 * mutation; this repository supplies the occurrence/receipt CAS primitives.
 */
export function createRuleOccurrenceRepository(db: DBLike) {
  return {
    async findReceipt(
      aggregateKind: RuleOccurrenceAggregateKind,
      aggregateId: string,
      commandId: string
    ): Promise<RuleOccurrenceReceipt | null> {
      const result =
        aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              SELECT character_id, command_id, command_type, command_fingerprint, occurrence_id,
                     stream_version, command_metadata, result_payload, actor_user_id, correlation_id
              FROM public.character_rule_receipts
              WHERE character_id = ${aggregateId} AND command_id = ${commandId}
            `.execute(db)
          : await sql<Record<string, unknown>>`
              SELECT encounter_id, command_id, command_type, command_fingerprint, occurrence_id,
                     encounter_version, command_metadata, result_payload, actor_user_id, correlation_id
              FROM public.encounter_rule_receipts
              WHERE encounter_id = ${aggregateId} AND command_id = ${commandId}
            `.execute(db)
      const row = result.rows[0]
      return row ? receiptFromRow(aggregateKind, row) : null
    },

    async findTerminalReceiptByOccurrence(
      aggregateKind: RuleOccurrenceAggregateKind,
      aggregateId: string,
      occurrenceId: string
    ): Promise<RuleOccurrenceReceipt | null> {
      const result =
        aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
            SELECT character_id, command_id, command_type, command_fingerprint, occurrence_id,
                   stream_version, command_metadata, result_payload, actor_user_id, correlation_id
            FROM public.character_rule_receipts
            WHERE character_id = ${aggregateId}
              AND occurrence_id = ${occurrenceId}
              AND result_payload ->> 'status' NOT IN ('PAUSED', 'ENCOUNTER_OCCURRENCE_PENDING')
          `.execute(db)
          : await sql<Record<string, unknown>>`
            SELECT encounter_id, command_id, command_type, command_fingerprint, occurrence_id,
                   encounter_version, command_metadata, result_payload, actor_user_id, correlation_id
            FROM public.encounter_rule_receipts
            WHERE encounter_id = ${aggregateId}
              AND occurrence_id = ${occurrenceId}
              AND result_payload ->> 'status' NOT IN ('PAUSED', 'ENCOUNTER_OCCURRENCE_PENDING')
          `.execute(db)
      if (result.rows.length > 1)
        throw new Error('A rule occurrence cannot have multiple terminal receipts.')
      const row = result.rows[0]
      return row ? receiptFromRow(aggregateKind, row) : null
    },

    async lockOccurrence(
      aggregateKind: RuleOccurrenceAggregateKind,
      aggregateId: string,
      occurrenceId: string
    ): Promise<RuleOccurrenceRecord | null> {
      const result =
        aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              SELECT * FROM public.character_rule_occurrences
              WHERE id = ${occurrenceId} AND character_id = ${aggregateId} FOR UPDATE
            `.execute(db)
          : await sql<Record<string, unknown>>`
              SELECT * FROM public.encounter_rule_occurrences
              WHERE id = ${occurrenceId} AND encounter_id = ${aggregateId} FOR UPDATE
            `.execute(db)
      const row = result.rows[0]
      const occurrence = row ? occurrenceFromRow(aggregateKind, row) : null
      if (occurrence?.aggregateKind === 'ENCOUNTER' && occurrence.pendingSnapshot) {
        if (!Object.hasOwn(occurrence.pendingSnapshot, 'optionalCombatSnapshotChecksum')) {
          throw new RuleOccurrenceCurrentnessError(
            'Encounter pending rule occurrence has no optional combat policy pin.'
          )
        }
        const currentChecksum = await encounterOptionalCombatSnapshotChecksum(db, aggregateId)
        if (occurrence.pendingSnapshot.optionalCombatSnapshotChecksum !== currentChecksum) {
          throw new RuleOccurrenceCurrentnessError(
            'Encounter optional combat policy changed before rule occurrence resume.'
          )
        }
      }
      return occurrence
    },

    /**
     * Root Scene commands can commit a genuine Scene child event before their
     * Encounter-owned occurrence settles.  Replay therefore resolves the
     * occurrence by the aggregate-scoped root command identity, never by an
     * unscoped occurrence id supplied by a client.
     */
    async findEncounterByRootCommand(
      encounterId: string,
      rootCommandId: string
    ): Promise<RuleOccurrenceRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_rule_occurrences
        WHERE encounter_id = ${encounterId} AND root_command_id = ${rootCommandId}
      `.execute(db)
      const row = result.rows[0]
      return row ? occurrenceFromRow('ENCOUNTER', row) : null
    },

    /**
     * Encounter roots are locked by the caller before this lookup. The partial
     * unique index is the persistence backstop; this scoped lock is the
     * service-level fresh-start gate.
     */
    async lockPendingEncounter(encounterId: string): Promise<RuleOccurrenceRecord | null> {
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_rule_occurrences
        WHERE encounter_id = ${encounterId} AND state = 'PENDING'
        FOR UPDATE
      `.execute(db)
      const row = result.rows[0]
      return row ? occurrenceFromRow('ENCOUNTER', row) : null
    },

    async listPendingEncounters(encounterIds: readonly string[]): Promise<RuleOccurrenceRecord[]> {
      if (encounterIds.length === 0) return []
      const result = await sql<Record<string, unknown>>`
        SELECT * FROM public.encounter_rule_occurrences
        WHERE state = 'PENDING'
          AND encounter_id IN (${sql.join(encounterIds.map((id) => sql`${id}::uuid`))})
        ORDER BY encounter_id, id
      `.execute(db)
      return result.rows.map((row) => occurrenceFromRow('ENCOUNTER', row))
    },

    async createPending(input: {
      aggregateKind: RuleOccurrenceAggregateKind
      occurrenceId: string
      aggregateId: string
      campaignId?: string
      rootCommandId: string
      expectedAggregateVersion: number
      pendingSnapshot: ServerRuleExecutionPendingSnapshotDto
    }): Promise<RuleOccurrenceRecord> {
      if (input.aggregateKind === 'ENCOUNTER' && !input.campaignId) {
        throw new Error('Encounter rule occurrences require their owning Campaign identity.')
      }
      const pendingSnapshot =
        input.aggregateKind === 'ENCOUNTER'
          ? withEncounterOptionalCombatSnapshotChecksum(
              serverRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot),
              await encounterOptionalCombatSnapshotChecksum(db, input.aggregateId)
            )
          : serverRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot)
      const pendingSnapshotChecksum = checksumCanonicalJson(pendingSnapshot)
      const result =
        input.aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              INSERT INTO public.character_rule_occurrences (
                id, character_id, root_command_id, state, version, expected_stream_version, pending_snapshot, pending_snapshot_checksum
              ) VALUES (
                ${input.occurrenceId}, ${input.aggregateId}, ${input.rootCommandId}, 'PENDING', 0,
                ${input.expectedAggregateVersion}, ${json(pendingSnapshot as unknown as Json)}::jsonb, ${pendingSnapshotChecksum}
              ) RETURNING *
            `.execute(db)
          : await sql<Record<string, unknown>>`
              INSERT INTO public.encounter_rule_occurrences (
                id, encounter_id, campaign_id, root_command_id, state, version,
                expected_encounter_version, pending_snapshot, pending_snapshot_checksum
              ) VALUES (
                ${input.occurrenceId}, ${input.aggregateId}, ${input.campaignId ?? null},
                ${input.rootCommandId}, 'PENDING', 0, ${input.expectedAggregateVersion},
                ${json(pendingSnapshot as unknown as Json)}::jsonb, ${pendingSnapshotChecksum}
              ) RETURNING *
            `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Rule occurrence was not created.')
      return occurrenceFromRow(input.aggregateKind, row)
    },

    async createCompleted(input: {
      aggregateKind: RuleOccurrenceAggregateKind
      occurrenceId: string
      aggregateId: string
      campaignId?: string
      rootCommandId: string
      aggregateVersion: number
    }): Promise<RuleOccurrenceRecord> {
      if (input.aggregateKind === 'ENCOUNTER' && !input.campaignId) {
        throw new Error('Encounter rule occurrences require their owning Campaign identity.')
      }
      const result =
        input.aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              INSERT INTO public.character_rule_occurrences (
                id, character_id, root_command_id, state, version, expected_stream_version, completed_at
              ) VALUES (
                ${input.occurrenceId}, ${input.aggregateId}, ${input.rootCommandId}, 'COMPLETED', 0,
                ${input.aggregateVersion}, now()
              ) RETURNING *
            `.execute(db)
          : await sql<Record<string, unknown>>`
              INSERT INTO public.encounter_rule_occurrences (
                id, encounter_id, campaign_id, root_command_id, state, version,
                expected_encounter_version, completed_at
              ) VALUES (
                ${input.occurrenceId}, ${input.aggregateId}, ${input.campaignId},
                ${input.rootCommandId}, 'COMPLETED', 0, ${input.aggregateVersion}, now()
              ) RETURNING *
            `.execute(db)
      const row = result.rows[0]
      if (!row) throw new Error('Completed rule occurrence was not created.')
      return occurrenceFromRow(input.aggregateKind, row)
    },

    async advancePending(input: {
      aggregateKind: RuleOccurrenceAggregateKind
      aggregateId: string
      occurrenceId: string
      expectedOccurrenceVersion: number
      expectedAggregateVersion: number
      nextAggregateVersion: number
      pendingSnapshot: ServerRuleExecutionPendingSnapshotDto
    }): Promise<RuleOccurrenceRecord> {
      const pendingSnapshot =
        input.aggregateKind === 'ENCOUNTER'
          ? withEncounterOptionalCombatSnapshotChecksum(
              serverRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot),
              await encounterOptionalCombatSnapshotChecksum(db, input.aggregateId)
            )
          : serverRuleExecutionPendingSnapshotDtoSchema.parse(input.pendingSnapshot)
      const pendingSnapshotChecksum = checksumCanonicalJson(pendingSnapshot)
      const result =
        input.aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              UPDATE public.character_rule_occurrences
              SET version = version + 1, expected_stream_version = ${input.nextAggregateVersion},
                  pending_snapshot = ${json(pendingSnapshot as unknown as Json)}::jsonb,
                  pending_snapshot_checksum = ${pendingSnapshotChecksum}, updated_at = now()
              WHERE id = ${input.occurrenceId} AND character_id = ${input.aggregateId}
                AND state = 'PENDING'
                AND version = ${input.expectedOccurrenceVersion}
                AND expected_stream_version = ${input.expectedAggregateVersion}
              RETURNING *
            `.execute(db)
          : await sql<Record<string, unknown>>`
              UPDATE public.encounter_rule_occurrences
              SET version = version + 1, expected_encounter_version = ${input.nextAggregateVersion},
                  pending_snapshot = ${json(pendingSnapshot as unknown as Json)}::jsonb,
                  pending_snapshot_checksum = ${pendingSnapshotChecksum}, updated_at = now()
              WHERE id = ${input.occurrenceId} AND encounter_id = ${input.aggregateId}
                AND state = 'PENDING'
                AND version = ${input.expectedOccurrenceVersion}
                AND expected_encounter_version = ${input.expectedAggregateVersion}
              RETURNING *
            `.execute(db)
      const row = result.rows[0]
      if (!row)
        throw new RuleOccurrenceCurrentnessError(
          'Rule occurrence changed before it could pause again.'
        )
      return occurrenceFromRow(input.aggregateKind, row)
    },

    async complete(input: {
      aggregateKind: RuleOccurrenceAggregateKind
      aggregateId: string
      occurrenceId: string
      expectedOccurrenceVersion: number
      expectedAggregateVersion: number
      nextAggregateVersion: number
    }): Promise<RuleOccurrenceRecord> {
      const result =
        input.aggregateKind === 'CHARACTER'
          ? await sql<Record<string, unknown>>`
              UPDATE public.character_rule_occurrences
              SET state = 'COMPLETED', version = version + 1,
                  expected_stream_version = ${input.nextAggregateVersion}, pending_snapshot = NULL, pending_snapshot_checksum = NULL,
                  completed_at = now(), updated_at = now()
              WHERE id = ${input.occurrenceId} AND character_id = ${input.aggregateId}
                AND state = 'PENDING'
                AND version = ${input.expectedOccurrenceVersion}
                AND expected_stream_version = ${input.expectedAggregateVersion}
              RETURNING *
            `.execute(db)
          : await sql<Record<string, unknown>>`
              UPDATE public.encounter_rule_occurrences
              SET state = 'COMPLETED', version = version + 1,
                  expected_encounter_version = ${input.nextAggregateVersion}, pending_snapshot = NULL, pending_snapshot_checksum = NULL,
                  completed_at = now(), updated_at = now()
              WHERE id = ${input.occurrenceId} AND encounter_id = ${input.aggregateId}
                AND state = 'PENDING'
                AND version = ${input.expectedOccurrenceVersion}
                AND expected_encounter_version = ${input.expectedAggregateVersion}
              RETURNING *
            `.execute(db)
      const row = result.rows[0]
      if (!row)
        throw new RuleOccurrenceCurrentnessError('Rule occurrence changed before completion.')
      return occurrenceFromRow(input.aggregateKind, row)
    },

    async appendReceipt(
      input: RuleOccurrenceReceipt & {
        commandType: string
        commandMetadata: ServerRuleExecutionReceiptCommandMetadataDto
      }
    ): Promise<void> {
      const commandMetadata =
        input.aggregateKind === 'ENCOUNTER'
          ? withEncounterOptionalCombatReceiptChecksum(
              serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(input.commandMetadata),
              await encounterOptionalCombatSnapshotChecksum(db, input.aggregateId)
            )
          : serverRuleExecutionReceiptCommandMetadataDtoSchema.parse(input.commandMetadata)
      const resultPayload = storedRuleExecutionResultDtoSchema.parse(input.resultPayload)
      validateRuleOccurrenceReceiptEnvelope({
        ...input,
        commandMetadata,
        resultPayload
      })
      if (input.aggregateKind === 'CHARACTER') {
        await sql`
          INSERT INTO public.character_rule_receipts (
            character_id, occurrence_id, command_id, command_type, command_fingerprint,
            stream_version, command_metadata, result_payload, actor_user_id, correlation_id
          ) VALUES (
            ${input.aggregateId}, ${input.occurrenceId}, ${input.commandId}, ${input.commandType},
            ${input.commandFingerprint}, ${input.aggregateVersion}, ${json(commandMetadata)}::jsonb,
            ${json(resultPayload)}::jsonb, ${input.actorUserId}, ${input.correlationId}
          )
        `.execute(db)
        return
      }

      await sql`
        INSERT INTO public.encounter_rule_receipts (
          encounter_id, campaign_id, occurrence_id, command_id, command_type, command_fingerprint,
          encounter_version, command_metadata, result_payload, actor_user_id, correlation_id
        ) SELECT
          encounter.id, encounter.campaign_id, ${input.occurrenceId}, ${input.commandId},
          ${input.commandType}, ${input.commandFingerprint}, ${input.aggregateVersion},
          ${json(commandMetadata)}::jsonb, ${json(resultPayload)}::jsonb,
          ${input.actorUserId}, ${input.correlationId}
        FROM public.encounters encounter
        WHERE encounter.id = ${input.aggregateId}
      `.execute(db)
    }
  }
}
