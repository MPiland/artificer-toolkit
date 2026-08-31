import { createHash, randomInt, randomUUID } from 'node:crypto'
import { sql } from 'kysely'

import {
  createCampaignRepository,
  createCampaignSettingsRepository,
  createRuleOccurrenceRepository,
  createReusableDefinitionRepository,
  createSpatialRuleEffectRepository,
  createVttSceneRepository,
  createCharacterRepository,
  createAccountEntitlementsRepository,
  createAuthoredVersionRepository,
  createEncounterRepository,
  createRulePackRepository,
  withTransaction,
  type DBLike,
  type CampaignRoomEntry,
  type EncounterActorRecord,
  type EncounterRecord,
  type EncounterStatus,
  type EncounterBlueprintEnemy,
  type RuleOccurrenceRecord,
  type RuleOccurrenceReceipt,
  checksumCanonicalJson,
  type Json
} from '@artificer-toolkit/db'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import type { CreatureAuthored } from '@artificer-toolkit/shared/subjects/authored'
import type { CampaignSceneState } from '@artificer-toolkit/shared/vtt'
import {
  encounterCommandResultDtoSchema,
  MAX_ENCOUNTER_ACTORS,
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  createEncounterBlueprintInputDtoSchema,
  updateEncounterBlueprintInputDtoSchema,
  encounterBlueprintDtoSchema,
  encounterBlueprintListDtoSchema,
  type CreateEncounterBlueprintInputDto,
  type UpdateEncounterBlueprintInputDto,
  type CreateEncounterInputDto,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type EncounterRuleOccurrenceSummaryDto,
  type EncounterBlueprintDto,
  type EncounterGmProjectionDto,
  type EncounterPlayerProjectionDto,
  type UpdateEncounterActorInputDto
} from '@artificer-toolkit/schema/api/encounters'
import type {
  LiveSessionAggregateVersionDto,
  LiveSessionSceneVisionContextDto
} from '@artificer-toolkit/schema/api/liveSessions'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import { encounterProjectionEventSchema } from '@artificer-toolkit/schema/projections/encounter'
import { AUTHORED_LIMITS } from '@artificer-toolkit/schema/shared/authoredLimits'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RollRecordDto } from '@artificer-toolkit/schema/api/rolls'
import type { RuleResolutionEvidenceDto } from '@artificer-toolkit/schema/api/rules'
import type { MovementReactionChoiceSelectionDto } from '@artificer-toolkit/schema/shared/reaction'
import { executeDiceConfiguration } from '../rolls/rollService.js'
import { ENTITLEMENT_LIMITS, assertEntitlementLimit } from '../account/entitlementService.js'
import { executeCharacterSheetCommand } from '../character/sheetService.js'
import { getCharacterSheetForUser } from '../character/characterApplicationService.js'
import {
  assertActiveCampaignMember,
  resolveCampaignAuthority,
  CampaignAccessError,
  CampaignConflictError
} from '../campaign/campaignService.js'
import { insertPreEvaluatedCampaignTableRoll } from '../campaign/campaignChatService.js'
import { broadcastCampaignInvalidation } from '../campaign/realtimeService.js'
import type { LiveSessionCommandAuthority } from '../campaign/liveSessionCommandAuthority.js'
import {
  executeEnemyRoll,
  featureChargeUsed,
  snapshotFeatureDefinitions,
  stableActors,
  withFeatureChargeUsed
} from './encounterActorState.js'
import {
  evaluateEncounterActorRuleSnapshot,
  findEncounterFeatureResource,
  refreshEncounterActorRuleSnapshot,
  type EncounterActorRuleSnapshot,
  requireEncounterActorRuleResult
} from './encounterActorRuleEvaluation.js'
import {
  EncounterConflictError,
  EncounterNotFoundError,
  EncounterValidationError
} from './encounterErrors.js'
import { lockEncounterRuleExecutionCommandContext } from './encounterRuleExecutionCommandContext.js'
import {
  lockEncounterActiveEffectTargets,
  refreshLockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import {
  compileEncounterCurrentProjection,
  projectGm,
  projectPlayerEncounterProjection
} from './encounterProjection.js'
import { commitSpatialSceneMovement } from './vttSceneService.js'
import {
  evaluateEncounterSpatialMovementRuleBatch,
  type FrozenMovementReactionRemainder,
  type SpatialMovementRuleResolution
} from './encounterSpatialMovementRuleService.js'
import {
  appendEncounterMovementReactionActionEvidenceCommand,
  appendEncounterMovementReactionResolutionCommand,
  movementReactionRemainderAfterCompletedAction,
  movementReactionRemainderAfterCurrentChoice,
  retainEncounterLegendaryResistanceChoice,
  retainEncounterMovementReactionActionEvidence,
  resolveEncounterMovementReactionChoice,
  startEncounterAutomaticMovementReactionEvidenceAtBoundary,
  startEncounterMovementReactionAtBoundary
} from './encounterMovementReactionContinuation.js'
import { executeAutomaticEncounterMovementReaction } from './encounterAutomaticMovementReaction.js'
import { discoverEncounterLegendaryResistanceCandidate } from './encounterLegendaryResistanceDiscovery.js'
import { startEncounterLegendaryResistanceChoice } from './encounterLegendaryResistanceChoice.js'
import { resumeEncounterLegendaryResistanceChoice } from './encounterLegendaryResistanceChoice.js'
import { withTargetEncounterFeatureResourceConsumption } from './encounterActionSettlementCore.js'
import { prepareCurrentEncounterMovementReactionAction } from './encounterMovementReactionActionCoordinator.js'
import { executeEncounterMovementReactionAction } from './encounterMovementReactionActionExecution.js'
import { settleEncounterMovementReactionAction } from './encounterMovementReactionActionSettlement.js'
import {
  movementCommandCharacterAggregateVersions,
  terminalMovementChangedAggregates,
  type MovementCommandTransition,
  type MovementChangedAggregate
} from './encounterMovementChangedAggregates.js'
import { projectEncounterSpatialOccurrenceSummary } from './encounterSpatialOccurrenceSummary.js'
import { parseEncounterProjectionEvent } from './encounterProjectionReplay.js'
import {
  executeEncounterActorDirectRuleAction,
  resumeEncounterActorDirectRuleAction
} from './encounterActorDirectRuleActionService.js'
import {
  executeEncounterCharacterRuleAction,
  resumeEncounterCharacterRuleAction
} from './encounterCharacterRuleActionService.js'
import {
  createEncounterActionStartIntent,
  lockEncounterActionSceneContext
} from './encounterActionSceneContext.js'
import { resolveEncounterInitiativePolicySnapshot } from './encounterInitiativePolicy.js'
import { resolveEncounterOptionalCombatSnapshot } from './encounterOptionalCombatPolicy.js'
import {
  applyEncounterInitiativeAdvanceCommand,
  applyStagedInitiativeState,
  createStagedInitiativeRoundState,
  resumeEncounterInitiativeDeclarationCommand,
  resumeEncounterInitiativeCommand,
  serializeStagedInitiativeRoundState,
  startEncounterInitiativeCommand
} from './encounterInitiativeCommandCoordinator.js'
import { planEncounterInitiativeAdvance } from './encounterInitiativeStateSettlement.js'
import {
  createEncounterInitiativePendingSnapshot,
  createEncounterInitiativeDeclarationPendingSnapshot,
  projectEncounterInitiativePendingSummary
} from './encounterInitiativeOccurrence.js'
import { requireEncounterInitiativeTerminalSettlement } from './encounterInitiativeTerminalSettlement.js'
import { createEncounterInitiativeDeclarationRequest } from './encounterInitiativeDeclarationSources.js'
import type { LockedEncounterInitiativeActorSource } from './encounterInitiativeFactSources.js'
import {
  applyEvaluatedTurnEffectBatch,
  executeEncounterTurnCharacterActiveEffects,
  evaluateEncounterTurnCharacterActiveEffects,
  projectEncounterAfterEvaluatedTurnEffectBatch,
  restoreEvaluatedEncounterTurnEffectBatch
} from './encounterCharacterActiveRuleEffectService.js'
import {
  getPendingEncounterConcentrationRuleOccurrence,
  resolveEncounterConcentrationRuleOccurrence
} from './encounterCharacterRuleActionService.js'
import { cleanupRemovedEncounterActorMaintainedEffects } from './encounterActorMaintainedCleanup.js'
import { createRuleExecutionCommandFingerprint } from '../rules/ruleExecutionOccurrenceService.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { createMovementReactionChoiceDefinition } from '../rules/movementReactionChoice.js'
import {
  encounterInitiativeSettlementDtoSchema,
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  storedRuleExecutionResultDtoSchema
} from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  EncounterInitiativeAdvancePlanDto,
  InitiativeBeforePinDto,
  EncounterInitiativeSettlementDto,
  PendingCompletedTurnPhaseDto,
  StagedInitiativeRoundStateDto,
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionPendingApplicationContextDto,
  ServerRuleExecutionContinuationDto,
  StoredRuleExecutionResultDto,
  TurnCoordinatorRootDto,
  TurnResolutionCommandDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  discoverEncounterRechargeCandidates,
  executeEncounterRechargeCandidate,
  type EncounterRechargeCandidate,
  type EncounterRechargeExecution
} from './encounterRechargeLifecycle.js'
import {
  createEncounterLegendaryActionChoicePendingSnapshot,
  declinedEncounterLegendaryAction,
  discoverEncounterLegendaryActionWindows,
  discoverEncounterLegendaryActionWindow,
  executeEncounterLegendaryAction,
  prepareEncounterLegendaryAction,
  settleEncounterLegendaryAction,
  type EncounterLegendaryActionEvidence
} from './encounterLegendaryActionExecution.js'
import {
  applyStagedLegendaryActionRefreshes,
  stageEncounterLegendaryActionRefreshes
} from './encounterLegendaryActionDiscovery.js'
import {
  encounterSystemIds,
  requireCompatibleActiveRulePackRevision,
  resolveActiveRulePackForSystems
} from './encounterRuleIdentity.js'

function fingerprint(input: unknown): string {
  return createHash('sha256').update(JSON.stringify(input)).digest('hex')
}

function encounterActionStartFingerprint(
  input: Extract<EncounterCommandInputDto, { type: 'RESOLVE_ACTION' }>,
  userId: string
): string {
  return createRuleExecutionCommandFingerprint(
    { aggregateKind: 'ENCOUNTER', aggregateId: input.encounterId, actorUserId: userId },
    {
      commandId: input.commandId,
      correlationId: null,
      expectedAggregateVersion: input.expectedVersion
    },
    'RULE_EXECUTION_START',
    {
      intentChecksum: checksumRuleDocument(
        createEncounterActionStartIntent({
          actionId: input.actionId,
          actorId: input.actorId,
          sceneContext: input.sceneContext ?? null,
          targetActorId: input.targetActorId
        })
      )
    }
  )
}

function encounterActionResumeIntent(
  input: Extract<EncounterCommandInputDto, { type: 'RESOLVE_RULE_OCCURRENCE' }>
) {
  switch (input.resolution.kind) {
    case 'SYSTEM_ROLL':
      return { kind: 'SYSTEM' as const, requestId: input.resolution.requestId }
    case 'ENTER_DICE':
      return {
        kind: 'PHYSICAL' as const,
        requestId: input.resolution.requestId,
        rawFaces: input.resolution.rawFaces
      }
    case 'ENTER_INTEGER':
      return {
        kind: 'INTEGER' as const,
        requestId: input.resolution.requestId,
        value: input.resolution.value
      }
    case 'DECLINE':
      return { kind: 'LEGENDARY_RESISTANCE' as const, selection: 'DECLINE' as const }
    case 'OPTION':
      return { kind: 'LEGENDARY_RESISTANCE' as const, selection: 'USE' as const }
    default:
      return null
  }
}

function encounterActionResumeFingerprint(
  input: Extract<EncounterCommandInputDto, { type: 'RESOLVE_RULE_OCCURRENCE' }>,
  userId: string
): string | null {
  const resolutionIntent = encounterActionResumeIntent(input)
  if (!resolutionIntent) return null
  return createRuleExecutionCommandFingerprint(
    { aggregateKind: 'ENCOUNTER', aggregateId: input.encounterId, actorUserId: userId },
    {
      commandId: input.commandId,
      correlationId: input.correlationId,
      expectedAggregateVersion: input.expectedVersion
    },
    'RULE_EXECUTION_RESUME',
    {
      occurrenceId: input.occurrenceId,
      expectedOccurrenceVersion: input.expectedOccurrenceVersion,
      resolutionIntentChecksum: checksumRuleDocument(resolutionIntent)
    }
  )
}

function requireEncounterKernelPendingSnapshot(
  snapshot: RuleOccurrenceRecord['pendingSnapshot']
): ServerKernelRuleExecutionPendingSnapshotDto {
  if (!snapshot || !isServerKernelRuleExecutionPendingSnapshot(snapshot))
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  return snapshot
}

function completedTurnPhaseEvidence(input: {
  selectionChecksum: string | null
  result: StoredRuleExecutionResultDto | null
}) {
  if (input.result === null)
    return { kind: 'NONE' as const, selectionChecksum: input.selectionChecksum }
  if (input.result.status === 'MANUAL') {
    if (input.selectionChecksum === null)
      throw new EncounterConflictError('Manual turn evidence lacks its exact selection checksum.')
    return {
      kind: 'MANUAL' as const,
      selectionChecksum: input.selectionChecksum,
      reminder: input.result.reminder
    }
  }
  if (
    input.result.status !== 'BATCH_COMPLETE' ||
    input.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    input.selectionChecksum === null
  )
    throw new EncounterConflictError('Turn phase did not produce terminal turn evidence.')
  return {
    kind: 'EXECUTED' as const,
    selectionChecksum: input.selectionChecksum,
    executions: input.result.executions,
    characterTransitions: input.result.characterTransitions,
    encounterActorTransitions: input.result.encounterActorTransitions
  }
}

function pendingTurnPhase(input: {
  selectionChecksum: string | null
  result: StoredRuleExecutionResultDto | null
  executions?: ReadonlyArray<
    Extract<
      StoredRuleExecutionResultDto,
      { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
    >['executions'][number]
  >
}): PendingCompletedTurnPhaseDto {
  if (input.executions) {
    if (!input.selectionChecksum) {
      throw new EncounterConflictError('A staged turn phase lacks its selection checksum.')
    }
    return {
      kind: 'STAGED',
      plan: { selectionChecksum: input.selectionChecksum, executions: [...input.executions] }
    }
  }
  if (input.result?.status === 'MANUAL') {
    if (!input.selectionChecksum) {
      throw new EncounterConflictError('A manual turn phase lacks its selection checksum.')
    }
    return { kind: 'MANUAL', selectionChecksum: input.selectionChecksum, result: input.result }
  }
  if (input.result !== null) {
    throw new EncounterConflictError('A paused turn phase must be staged or manual.')
  }
  return { kind: 'NONE' }
}

function completedPendingTurnPhaseEvidence(input: {
  phase: PendingCompletedTurnPhaseDto
  restoredResult?: StoredRuleExecutionResultDto | null
}) {
  if (input.phase.kind === 'NONE')
    return completedTurnPhaseEvidence({ selectionChecksum: null, result: null })
  if (input.phase.kind === 'MANUAL') {
    return completedTurnPhaseEvidence({
      selectionChecksum: input.phase.selectionChecksum,
      result: input.phase.result
    })
  }
  if (!input.restoredResult) {
    throw new EncounterConflictError('A staged turn phase has not been terminally restored.')
  }
  return completedTurnPhaseEvidence({
    selectionChecksum: input.phase.plan.selectionChecksum,
    result: input.restoredResult
  })
}

function boundariesForStagedTurnPlan(
  plan: Extract<PendingCompletedTurnPhaseDto, { kind: 'STAGED' }>['plan']
) {
  const boundaries = new Map<
    number,
    { ordinal: 0 | 1; stage: 'START_OF_TURN' | 'END_OF_TURN'; actorId: string }
  >()
  for (const execution of plan.executions) {
    const existing = boundaries.get(execution.boundaryOrdinal)
    if (
      existing &&
      (existing.stage !== execution.stage || existing.actorId !== execution.targetActorId)
    ) {
      throw new EncounterConflictError('A staged turn plan contains inconsistent boundaries.')
    }
    boundaries.set(execution.boundaryOrdinal, {
      ordinal: execution.boundaryOrdinal as 0 | 1,
      stage: execution.stage,
      actorId: execution.targetActorId
    })
  }
  return [...boundaries.values()].sort((left, right) => left.ordinal - right.ordinal)
}

function turnLifecycleSelectionChecksum(input: {
  outgoing: { selectionChecksum: string | null }
  incoming: { selectionChecksum: string | null }
  legendaryActions?: ReadonlyArray<{ selectionChecksum: string }>
  legendaryActionRefreshes?: ReadonlyArray<unknown>
}): string {
  return checksumCanonicalJson({
    outgoing: input.outgoing.selectionChecksum,
    incoming: input.incoming.selectionChecksum,
    ...(input.legendaryActions?.length
      ? { legendaryActions: input.legendaryActions.map((action) => action.selectionChecksum) }
      : {}),
    ...(input.legendaryActionRefreshes?.length
      ? { legendaryActionRefreshes: input.legendaryActionRefreshes }
      : {})
  })
}

function checksumBlueprintSetup(name: string, enemies: EncounterBlueprintEnemy[]): string {
  return checksumCanonicalJson({ name, enemies })
}

type FrozenEncounterActorRuleSource = {
  revisionId: string
  revisionChecksum: string
  snapshotChecksum: string
}

function checksumEncounterActorRuleSnapshot(snapshot: EncounterActorRuleSnapshot): string {
  return checksumCanonicalJson({
    revisionId: snapshot.revisionId,
    facts: snapshot.facts,
    output: snapshot.output
  })
}

async function requireImmutableEncounterActorRuleRevision(input: {
  db: DBLike
  revisionId: string
  expectedChecksum?: string
}) {
  const revision = await createRulePackRepository(input.db).getRevision(input.revisionId)
  if (
    !revision ||
    revision.state === 'DRAFT' ||
    (input.expectedChecksum !== undefined && revision.checksum !== input.expectedChecksum)
  ) {
    throw new EncounterConflictError('The frozen Encounter actor-rule source is unavailable.')
  }
  return revision
}

function toEncounterBlueprintDto(blueprint: {
  id: string
  gameSystemId: string
  name: string
  version: number
  enemies: unknown
  createdAt: string
  updatedAt: string
  setupChecksum: string
}): EncounterBlueprintDto {
  return encounterBlueprintDtoSchema.parse({
    id: blueprint.id,
    gameSystemId: blueprint.gameSystemId,
    name: blueprint.name,
    version: blueprint.version,
    enemies: blueprint.enemies,
    createdAt: blueprint.createdAt,
    updatedAt: blueprint.updatedAt,
    setupChecksum: blueprint.setupChecksum
  })
}

interface EncounterCreatureSource {
  authored: CreatureAuthored
  checksum: string
  version: number
  versionId: string
}

async function loadActiveEncounterCreatures(
  db: DBLike,
  userId: string,
  creatureIds: readonly string[]
): Promise<Map<string, EncounterCreatureSource>> {
  if (creatureIds.length === 0) return new Map()
  const records = await createAuthoredVersionRepository(db).findActiveByIds({
    subjectKind: 'CREATURE',
    subjectIds: creatureIds,
    userId,
    includeMaster: true
  })
  return new Map(
    [...records.entries()].map(([creatureId, record]) => [
      creatureId,
      {
        authored: parseEncounterCreatureDocument(record.authored.document),
        checksum: record.authored.checksum,
        version: record.authored.version,
        versionId: record.authored.versionId
      }
    ])
  )
}

function parseEncounterCreatureDocument(document: unknown): CreatureAuthored {
  try {
    const creature = creatureAuthoredDtoSchema.parse(document)
    return {
      ...creature,
      damageVulnerabilities: creature.damageVulnerabilities ?? [],
      damageResistances: creature.damageResistances ?? [],
      damageImmunities: creature.damageImmunities ?? [],
      conditionImmunities: creature.conditionImmunities ?? []
    } as unknown as CreatureAuthored
  } catch {
    throw new EncounterValidationError('Creature is unavailable.')
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: unknown }).code === '23505'
  )
}

function requireActor(encounter: EncounterRecord, actorId: string): EncounterActorRecord {
  const actor = encounter.actors.find((candidate) => candidate.id === actorId)
  if (!actor) throw new EncounterValidationError('Encounter actor was not found.')
  return actor
}

async function applyCharacterCommand(
  db: DBLike,
  userId: string,
  actor: EncounterActorRecord,
  input: UpdateEncounterActorInputDto,
  liveSessionAuthority?: LiveSessionCommandAuthority
): Promise<{ actor: EncounterActorRecord; correlationId: string }> {
  const command = input.characterCommand
  if (!command) return { actor, correlationId: '' }
  if (actor.kind !== 'CHARACTER' || !actor.sourceId) {
    throw new EncounterValidationError('Sheet command does not target this Character actor.')
  }
  const correlationId = randomUUID()
  const result = await executeCharacterSheetCommand({
    db,
    characterId: actor.sourceId,
    command,
    userId,
    ...(liveSessionAuthority ? { liveSessionAuthority } : {})
  })
  await sql`
    UPDATE public.character_events
    SET event_data = event_data || jsonb_build_object('correlationId', ${correlationId}::text)
    WHERE character_id = ${actor.sourceId} AND command_id = ${command.commandId}
  `.execute(db)
  return {
    correlationId,
    actor: {
      ...actor,
      currentHitPoints: Math.max(result.sheet.overview.currentHitPoints, 0),
      maxHitPoints: Math.max(result.sheet.overview.maxHitPoints, 0),
      tempHitPoints: Math.max(result.sheet.overview.tempHitPoints, 0),
      conditions: result.sheet.overview.conditions as unknown as Json
    }
  }
}

function commandResult(
  encounter: EncounterRecord,
  actorRules: EncounterActorRuleOutput,
  roll: RollRecordDto | null = null
): EncounterCommandResultDto {
  return encounterCommandResultDtoSchema.parse({
    projection: projectGm(encounter, actorRules),
    roll,
    resolution: null
  })
}

export async function createEncounter(
  db: DBLike,
  userId: string,
  input: CreateEncounterInputDto
): Promise<EncounterGmProjectionDto> {
  return withTransaction(db, async (trx) => {
    const encounterRepository = createEncounterRepository(trx)
    const campaign = createCampaignRepository(trx)
    const lockedCampaign = await campaign.lockCampaign(input.campaignId)
    if (!lockedCampaign) {
      throw new CampaignConflictError('Campaign not found.')
    }
    if (lockedCampaign.ownerUserId !== userId) throw new CampaignAccessError()
    if (lockedCampaign.status !== 'ACTIVE') {
      throw new CampaignConflictError('Archived Campaigns are read-only.')
    }
    const session = await sql<{ id: string; status: string }>`
      SELECT id, status FROM public.campaign_sessions
      WHERE id = ${input.sessionId} AND campaign_id = ${input.campaignId}
      FOR UPDATE
    `.execute(trx)
    if (session.rows[0]?.status !== 'OPEN') {
      throw new EncounterConflictError('Encounters can only be added to open Sessions.')
    }
    const commandFingerprint = fingerprint(input)
    const prior = await encounterRepository.findEventByCampaignCommand(
      input.campaignId,
      input.commandId
    )
    if (prior) {
      if (prior.commandType !== 'CREATE' || prior.commandFingerprint !== commandFingerprint) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      const existing = await encounterRepository.find(prior.encounterId)
      if (!existing) throw new EncounterNotFoundError()
      return (
        await encounterRepository.requireCurrentProjection({
          encounterId: existing.id,
          expectedStreamVersion: existing.version
        })
      ).projection
    }
    const blueprint = await encounterRepository.lockBlueprint(input.blueprintId, userId)
    if (!blueprint) throw new EncounterNotFoundError()
    const campaignSystem = await sql<{ game_system_id: string }>`
      SELECT game_system_id FROM public.campaigns WHERE id = ${input.campaignId} FOR UPDATE
    `.execute(trx)
    if (campaignSystem.rows[0]?.game_system_id !== blueprint.gameSystemId) {
      throw new EncounterValidationError(
        'Encounter Blueprint does not match the Campaign Game System.'
      )
    }
    const attendance = await sql<{ character_id: string }>`
      SELECT character_id FROM public.campaign_session_attendance
      WHERE session_id = ${input.sessionId} AND present = true
      ORDER BY character_id ASC
    `.execute(trx)
    if (attendance.rows.length + blueprint.enemies.length > MAX_ENCOUNTER_ACTORS) {
      throw new EncounterValidationError(
        `Encounters support at most ${MAX_ENCOUNTER_ACTORS} actors.`
      )
    }
    const attendingCharacters = (
      await Promise.all(
        attendance.rows.map(async (row) => {
          const [character, authored, sheet] = await Promise.all([
            createCharacterRepository(trx).findById(row.character_id),
            createCharacterRepository(trx).findAuthoredById(row.character_id),
            getCharacterSheetForUser(trx, row.character_id, userId)
          ])
          return character && authored && sheet ? { character, authored, sheet } : null
        })
      )
    ).filter((entry) => entry !== null)
    const { revision: activeRuleRevision } = await resolveActiveRulePackForSystems(trx, [
      blueprint.gameSystemId,
      ...attendingCharacters.map(({ authored }) => authored.systemId),
      ...blueprint.enemies.map((enemy) => enemy.systemId)
    ])
    const settings = await createCampaignSettingsRepository(trx).find(input.campaignId)
    const initiativePolicy = await resolveEncounterInitiativePolicySnapshot({
      db: trx,
      campaignId: input.campaignId,
      gameSystemId: blueprint.gameSystemId,
      settings
    })
    const optionalCombat = await resolveEncounterOptionalCombatSnapshot({
      db: trx,
      campaignId: input.campaignId,
      gameSystemId: blueprint.gameSystemId,
      definitionIds: settings?.optionalCombatRuleDefinitionIds ?? []
    })
    let created: EncounterRecord
    try {
      created = await encounterRepository.create({
        id: randomUUID(),
        campaignId: input.campaignId,
        sessionId: input.sessionId,
        gameSystemId: blueprint.gameSystemId,
        blueprintId: blueprint.id,
        blueprintVersion: blueprint.version,
        blueprintChecksum: blueprint.setupChecksum,
        rulePackRevisionId: activeRuleRevision.id,
        initiativePolicySnapshot: initiativePolicy?.snapshot ?? null,
        initiativePolicySnapshotChecksum: initiativePolicy?.checksum ?? null,
        optionalCombatSnapshot: optionalCombat.snapshot,
        optionalCombatSnapshotChecksum: optionalCombat.checksum,
        automationMode: settings?.automationMode ?? 'ASSISTED',
        manualReminderMode: settings?.manualReminderMode ?? 'OFF',
        name: blueprint.name
      })
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new EncounterConflictError('This Campaign already has an active Encounter.')
      }
      throw error
    }
    const partySideId = randomUUID()
    const oppositionSideId = randomUUID()
    await encounterRepository.createSide({
      id: partySideId,
      encounterId: created.id,
      label: 'Party',
      sortOrder: 0
    })
    await encounterRepository.createSide({
      id: oppositionSideId,
      encounterId: created.id,
      label: 'Opposition',
      sortOrder: 1
    })
    await encounterRepository.setSideRelationship({
      encounterId: created.id,
      firstSideId: partySideId,
      secondSideId: oppositionSideId,
      relationshipKind: 'HOSTILE'
    })
    for (const { character, authored, sheet } of attendingCharacters) {
      await encounterRepository.addActor({
        id: randomUUID(),
        encounterId: created.id,
        sideId: partySideId,
        kind: 'CHARACTER',
        sourceId: character.id,
        sourceRevision: character.stream_version,
        label: authored.label,
        systemId: authored.systemId,
        stableTieKey: randomUUID(),
        public: true,
        currentHitPoints: Math.max(sheet.overview.currentHitPoints, 0),
        maxHitPoints: Math.max(sheet.overview.maxHitPoints, 0),
        tempHitPoints: Math.max(sheet.overview.tempHitPoints, 0),
        conditions: sheet.overview.conditions as unknown as Json,
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        snapshot: {
          kind: 'CHARACTER',
          id: authored.id,
          label: authored.label,
          systemId: authored.systemId,
          sourceRevision: character.stream_version
        } as unknown as Json
      })
    }
    for (const enemy of blueprint.enemies) {
      await encounterRepository.addActor({
        id: randomUUID(),
        encounterId: created.id,
        sideId: oppositionSideId,
        kind: enemy.kind,
        sourceId: enemy.sourceId,
        sourceRevision: enemy.sourceRevision,
        label: enemy.label,
        systemId: enemy.systemId,
        stableTieKey: randomUUID(),
        public: true,
        currentHitPoints: enemy.maxHitPoints,
        maxHitPoints: enemy.maxHitPoints,
        tempHitPoints: 0,
        conditions: [],
        resources: {},
        gmNotes: null,
        initiative: null,
        manualOrder: null,
        snapshot: enemy.snapshot
      })
    }
    const hydrated = await encounterRepository.find(created.id)
    if (!hydrated) throw new EncounterNotFoundError()
    created = hydrated
    const actorRuleSnapshot = await evaluateEncounterActorRuleSnapshot({
      db: trx,
      encounter: created
    })
    for (const actor of actorRuleSnapshot.actorUpdates) {
      await encounterRepository.updateActor(actor)
    }
    created = actorRuleSnapshot.reconciledEncounter
    const projection = projectGm(created, actorRuleSnapshot.snapshot.output)
    const currentProjection = compileEncounterCurrentProjection(
      projection,
      actorRuleSnapshot.snapshot
    )
    await encounterRepository.publishCurrentProjection(currentProjection)
    await encounterRepository.appendEvent({
      id: randomUUID(),
      encounterId: created.id,
      campaignId: created.campaignId,
      version: 0,
      commandId: input.commandId,
      commandType: 'CREATE',
      commandFingerprint,
      commandPayload: input as unknown as Json,
      resultPayload: encounterProjectionEventSchema.parse({
        command: commandResult(created, actorRuleSnapshot.snapshot.output),
        currentProjection,
        ruleReceipt: null
      }) as unknown as Json,
      actorUserId: userId,
      correlationId: null
    })
    return projection
  })
}

export async function createEncounterBlueprint(
  db: DBLike,
  userId: string,
  rawInput: CreateEncounterBlueprintInputDto
) {
  const input = createEncounterBlueprintInputDtoSchema.parse(rawInput)
  return withTransaction(db, async (trx) => {
    const commandFingerprint = fingerprint(input)
    const repository = createEncounterRepository(trx)
    const prior = await repository.findBlueprintByOwnerCommand(userId, input.commandId)
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return toEncounterBlueprintDto(prior.blueprint)
    }

    const tier = await createAccountEntitlementsRepository(trx).lockTier(userId)
    assertEntitlementLimit(
      'savedEncounters',
      await repository.countBlueprintsForOwner(userId),
      ENTITLEMENT_LIMITS[tier].savedEncounters
    )
    const creatureIds = [
      ...new Set(
        input.enemies.flatMap((enemy) => (enemy.kind === 'CREATURE' ? [enemy.sourceId] : []))
      )
    ]
    const creatures = await loadActiveEncounterCreatures(trx, userId, creatureIds)
    const enemies: EncounterBlueprintEnemy[] = input.enemies.map((enemy) => {
      if (enemy.kind === 'CUSTOM') {
        return {
          kind: 'CUSTOM' as const,
          sourceId: null,
          sourceRevision: null,
          label: enemy.label,
          systemId: input.gameSystemId,
          maxHitPoints: enemy.maxHitPoints,
          snapshot: {
            kind: 'CUSTOM',
            label: enemy.label,
            maxHitPoints: enemy.maxHitPoints,
            systemId: input.gameSystemId
          } as unknown as Json
        }
      }

      const source = creatures.get(enemy.sourceId)
      if (!source) {
        throw new EncounterValidationError('Creature is unavailable.')
      }
      const creature = source.authored
      if (creature.systemId !== input.gameSystemId) {
        throw new EncounterValidationError(
          'Creature does not match the Encounter Blueprint Game System.'
        )
      }
      const maxHitPoints = Math.max(creature.hitPoints, 0)
      const sourceRevision = source.version
      return {
        kind: 'CREATURE' as const,
        sourceId: creature.id,
        sourceRevision,
        label: creature.label,
        systemId: creature.systemId,
        maxHitPoints,
        snapshot: {
          kind: 'CREATURE',
          id: creature.id,
          label: creature.label,
          systemId: creature.systemId,
          sourceRevision,
          sourceVersionId: source.versionId,
          sourceChecksum: source.checksum,
          maxHitPoints,
          payload: creature as unknown as Json
        } as unknown as Json
      }
    })
    if (
      new TextEncoder().encode(JSON.stringify(enemies)).byteLength >
      AUTHORED_LIMITS.mutationPayloadBytes
    ) {
      throw new EncounterValidationError('Encounter Blueprint snapshots are too large.')
    }
    const setupChecksum = checksumBlueprintSetup(input.name, enemies)
    const blueprint = await repository.createBlueprint({
      id: randomUUID(),
      ownerUserId: userId,
      gameSystemId: input.gameSystemId,
      commandId: input.commandId,
      commandFingerprint,
      name: input.name,
      setupChecksum,
      enemies
    })
    if (blueprint) return toEncounterBlueprintDto(blueprint)

    const concurrent = await repository.findBlueprintByOwnerCommand(userId, input.commandId)
    if (!concurrent) throw new Error('Encounter Blueprint was not created.')
    if (concurrent.commandFingerprint !== commandFingerprint) {
      throw new EncounterConflictError('Command ID was already used with different input.')
    }
    return toEncounterBlueprintDto(concurrent.blueprint)
  })
}

export async function listEncounterBlueprints(db: DBLike, userId: string, gameSystemId: string) {
  return encounterBlueprintListDtoSchema.parse(
    (await createEncounterRepository(db).listBlueprints(userId, gameSystemId)).map(
      toEncounterBlueprintDto
    )
  )
}

export async function updateEncounterBlueprint(
  db: DBLike,
  userId: string,
  rawInput: UpdateEncounterBlueprintInputDto
) {
  const input = updateEncounterBlueprintInputDtoSchema.parse(rawInput)
  return withTransaction(db, async (trx) => {
    const repository = createEncounterRepository(trx)
    const commandFingerprint = fingerprint(input)
    const locked = await repository.lockBlueprint(input.blueprintId, userId)
    if (!locked) throw new EncounterNotFoundError()
    const prior = await repository.findBlueprintUpdateReceipt(userId, input.commandId)
    if (prior) {
      if (prior.commandFingerprint !== commandFingerprint) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      return encounterBlueprintDtoSchema.parse(prior.resultPayload)
    }
    if (locked.version !== input.expectedVersion) {
      throw new EncounterConflictError('Encounter Blueprint version is stale.')
    }
    const creatureIds = [
      ...new Set(
        input.enemies.flatMap((enemy) => (enemy.kind === 'CREATURE' ? [enemy.sourceId] : []))
      )
    ]
    const creatures = await loadActiveEncounterCreatures(trx, userId, creatureIds)
    const enemies: EncounterBlueprintEnemy[] = input.enemies.map((enemy) => {
      if (enemy.kind === 'CUSTOM') {
        return {
          kind: 'CUSTOM',
          sourceId: null,
          sourceRevision: null,
          label: enemy.label,
          systemId: locked.gameSystemId,
          maxHitPoints: enemy.maxHitPoints,
          snapshot: {
            kind: 'CUSTOM',
            label: enemy.label,
            maxHitPoints: enemy.maxHitPoints,
            systemId: locked.gameSystemId
          } as unknown as Json
        }
      }
      const source = creatures.get(enemy.sourceId)
      if (!source || source.authored.systemId !== locked.gameSystemId) {
        throw new EncounterValidationError(
          'Creature is unavailable or does not match the Encounter Blueprint Game System.'
        )
      }
      const creature = source.authored
      const maxHitPoints = Math.max(creature.hitPoints, 0)
      return {
        kind: 'CREATURE',
        sourceId: creature.id,
        sourceRevision: source.version,
        label: creature.label,
        systemId: creature.systemId,
        maxHitPoints,
        snapshot: {
          kind: 'CREATURE',
          id: creature.id,
          label: creature.label,
          systemId: creature.systemId,
          sourceRevision: source.version,
          sourceVersionId: source.versionId,
          sourceChecksum: source.checksum,
          maxHitPoints,
          payload: creature as unknown as Json
        } as unknown as Json
      }
    })
    if (
      new TextEncoder().encode(JSON.stringify(enemies)).byteLength >
      AUTHORED_LIMITS.mutationPayloadBytes
    ) {
      throw new EncounterValidationError('Encounter Blueprint snapshots are too large.')
    }
    const blueprint = await repository.updateBlueprint({
      blueprintId: locked.id,
      expectedVersion: input.expectedVersion,
      name: input.name,
      enemies,
      setupChecksum: checksumBlueprintSetup(input.name, enemies)
    })
    if (!blueprint) throw new EncounterConflictError('Encounter Blueprint version is stale.')
    const result = toEncounterBlueprintDto(blueprint)
    await repository.appendBlueprintUpdateReceipt({
      blueprintId: result.id,
      blueprintVersion: result.version,
      ownerUserId: userId,
      commandId: input.commandId,
      commandFingerprint,
      resultPayload: result,
      actorUserId: userId
    })
    return result
  })
}

export interface EncounterCommandServiceTiming {
  evaluationLane: 'NONE' | 'ENCOUNTER_ACTOR' | 'ENCOUNTER_ACTION'
  actorEvaluationMs: number
  actorZenEvaluationMs: number
  actionEvaluationMs: number
  actionZenEvaluationMs: number
  totalMs: number
}

export interface EncounterCommandExecutionResult {
  replayed: boolean
  response: EncounterCommandResultDto
  ruleSnapshot?: EncounterActorRuleSnapshot
  spatialChangedAggregates?: LiveSessionAggregateVersionDto[]
  spatialSceneState?: CampaignSceneState
  spatialTerminalBatch?: Extract<
    StoredRuleExecutionResultDto,
    { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
  >
}

type ResolveRuleOccurrenceCommand = Extract<
  EncounterCommandInputDto,
  { type: 'RESOLVE_RULE_OCCURRENCE' }
>

type D20ResolveRuleOccurrenceCommand = Omit<ResolveRuleOccurrenceCommand, 'resolution'> & {
  resolution: Extract<
    ResolveRuleOccurrenceCommand['resolution'],
    { kind: 'ENTER_DICE' | 'SYSTEM_ROLL' }
  >
}

type MovementReactionResolveRuleOccurrenceCommand = Omit<
  ResolveRuleOccurrenceCommand,
  'resolution'
> & {
  resolution: Extract<ResolveRuleOccurrenceCommand['resolution'], { kind: 'DECLINE' | 'OPTION' }>
}

type InitiativeResolveRuleOccurrenceCommand = Omit<ResolveRuleOccurrenceCommand, 'resolution'> & {
  resolution: Extract<
    ResolveRuleOccurrenceCommand['resolution'],
    { kind: 'ENTER_INTEGER' | 'SYSTEM_ROLL' | 'INITIATIVE_ENTITY' | 'INITIATIVE_DECLARATION' }
  >
}

type MovementResolveRuleOccurrenceCommand =
  | D20ResolveRuleOccurrenceCommand
  | MovementReactionResolveRuleOccurrenceCommand

type RechargeResolveRuleOccurrenceCommand = Omit<ResolveRuleOccurrenceCommand, 'resolution'> & {
  resolution: Extract<
    ResolveRuleOccurrenceCommand['resolution'],
    { kind: 'ENTER_INTEGER' | 'SYSTEM_ROLL' }
  >
}

type TurnRechargePendingContext = Extract<
  ServerRuleExecutionPendingApplicationContextDto,
  { kind: 'ENCOUNTER_TURN_RECHARGE' }
>
type TurnRechargeCandidate = TurnRechargePendingContext['currentCandidate']
type TurnRechargeExecution = TurnRechargePendingContext['completedExecutions'][number]
type CompletedTurnRechargePlan = NonNullable<
  Extract<
    ServerRuleExecutionPendingApplicationContextDto,
    { kind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS' }
  >['root']['completedRechargePlan']
>

function isD20ResolveRuleOccurrenceCommand(
  command: ResolveRuleOccurrenceCommand
): command is D20ResolveRuleOccurrenceCommand {
  return command.resolution.kind === 'ENTER_DICE' || command.resolution.kind === 'SYSTEM_ROLL'
}

function isRechargeResolveRuleOccurrenceCommand(
  command: ResolveRuleOccurrenceCommand
): command is RechargeResolveRuleOccurrenceCommand {
  return command.resolution.kind === 'ENTER_INTEGER' || command.resolution.kind === 'SYSTEM_ROLL'
}

function isMovementReactionResolveRuleOccurrenceCommand(
  command: ResolveRuleOccurrenceCommand
): command is MovementReactionResolveRuleOccurrenceCommand {
  return command.resolution.kind === 'DECLINE' || command.resolution.kind === 'OPTION'
}

function isInitiativeResolveRuleOccurrenceCommand(
  command: ResolveRuleOccurrenceCommand
): command is InitiativeResolveRuleOccurrenceCommand {
  return (
    command.resolution.kind === 'ENTER_INTEGER' ||
    command.resolution.kind === 'SYSTEM_ROLL' ||
    command.resolution.kind === 'INITIATIVE_ENTITY' ||
    command.resolution.kind === 'INITIATIVE_DECLARATION'
  )
}

function isEncounterActionRuleOccurrence(input: {
  pendingApplicationContext: ServerRuleExecutionPendingApplicationContextDto | undefined
  receipt: RuleOccurrenceReceipt | null
}): boolean {
  if (
    input.pendingApplicationContext?.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
    input.pendingApplicationContext?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION'
  ) {
    return true
  }
  const result = input.receipt?.resultPayload
  return (
    result?.status === 'COMPLETE' &&
    (result.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
      result.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
}

function isActorDirectActionOccurrence(input: {
  pendingApplicationContext: ServerRuleExecutionPendingApplicationContextDto | undefined
  receipt: RuleOccurrenceReceipt | null
}): boolean {
  if (input.pendingApplicationContext?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION') return true
  return (
    input.receipt?.resultPayload.status === 'COMPLETE' &&
    input.receipt.resultPayload.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
}

function actionOccurrenceSummaryFromReceipt(input: {
  receipt: RuleOccurrenceReceipt
  encounterVersion: number
  role: 'OWNER' | 'PLAYER'
  userId: string
}): EncounterRuleOccurrenceSummaryDto | null {
  const { receipt, role, userId } = input
  const result = receipt.resultPayload
  if (
    result.status === 'ENCOUNTER_OCCURRENCE_PENDING' &&
    receipt.commandMetadata.transition === 'TURN_EFFECTS_PENDING' &&
    'resolutionCommand' in receipt.commandMetadata &&
    receipt.commandMetadata.resolutionCommand.kind === 'ENTER_INTEGER'
  ) {
    if (role !== 'OWNER' && receipt.actorUserId !== userId) return null
    return result.occurrence
  }
  if (result.status === 'PAUSED' && result.pending?.kind === 'LEGENDARY_RESISTANCE_CHOICE') {
    return {
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      status: 'PENDING',
      outcome: null,
      pending:
        role === 'OWNER'
          ? {
              kind: 'LEGENDARY_RESISTANCE_CHOICE',
              occurrenceId: result.occurrenceId,
              occurrenceVersion: result.occurrenceVersion,
              encounterVersion: input.encounterVersion,
              targetActorId: result.pending.targetActorId,
              options: [{ optionId: result.pending.useOptionId }],
              allowedResponses: ['DECLINE', 'OPTION']
            }
          : null
    }
  }
  if (result.status === 'PAUSED' && result.pending?.kind === 'D20_EVIDENCE') {
    if (result.request.min !== 1 || result.request.max !== 20) return null
    if (role !== 'OWNER' && receipt.actorUserId !== userId) return null
    return {
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      status: 'PENDING',
      outcome: null,
      pending: {
        kind: 'D20_EVIDENCE',
        occurrenceId: result.occurrenceId,
        occurrenceVersion: result.occurrenceVersion,
        encounterVersion: input.encounterVersion,
        request: {
          requestId: result.request.requestId,
          min: result.request.min,
          max: result.request.max,
          rollMode: result.pending.rollMode
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    }
  }
  if (
    result.status === 'COMPLETE' &&
    (result.applicationOutputs.kind === 'CHARACTER_MECHANICS_BATCH' ||
      result.applicationOutputs.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  ) {
    return {
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  }
  if (result.status === 'MANUAL') {
    return {
      occurrenceId: result.occurrenceId,
      occurrenceVersion: result.occurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  }
  return null
}

function isLegendaryTurnResolutionCommand(command: TurnResolutionCommandDto): boolean {
  return (
    command.kind === 'LEGENDARY_DECLINE' ||
    command.kind === 'LEGENDARY_OPTION' ||
    command.kind === 'LEGENDARY_ENTER_DICE' ||
    command.kind === 'LEGENDARY_SYSTEM_ROLL'
  )
}

type EncounterMovementTerminalResult = Extract<
  StoredRuleExecutionResultDto,
  | {
      status: 'BATCH_COMPLETE'
      batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT'
    }
  | { status: 'MOVEMENT_COMPLETE' }
>

function isEncounterMovementTerminalResult(
  result: StoredRuleExecutionResultDto
): result is EncounterMovementTerminalResult {
  return (
    result.status === 'MOVEMENT_COMPLETE' ||
    (result.status === 'BATCH_COMPLETE' && result.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT')
  )
}

function rechargePlanSelectionChecksum(candidates: readonly EncounterRechargeCandidate[]): string {
  return checksumCanonicalJson({ candidates })
}

function rechargePendingCandidate(
  candidate: EncounterRechargeCandidate,
  ordinal: number
): TurnRechargeCandidate {
  return { ...candidate, ordinal }
}

function rechargeCompletedExecution(input: {
  ordinal: number
  result: Extract<EncounterRechargeExecution, { kind: 'COMPLETE' }>
}): TurnRechargeExecution {
  if (input.result.rawDie === null)
    throw new EncounterConflictError('Recharge completion lacks its required d6 evidence.')
  return {
    ordinal: input.ordinal,
    candidate: rechargePendingCandidate(input.result.candidate, input.ordinal),
    execution: input.result.execution,
    recharged: input.result.recharged,
    beforeUsed: input.result.candidate.beforeUsed,
    afterUsed: input.result.afterUsed,
    rawDie: input.result.rawDie
  }
}

function assertRechargeCandidateCurrent(input: {
  encounter: EncounterRecord
  actorRules: EncounterActorRuleOutput
  candidate: TurnRechargeCandidate
  currentActorId: string | null
}): EncounterActorRecord {
  if (input.currentActorId === null || input.candidate.actorId !== input.currentActorId)
    throw new EncounterConflictError('Recharge candidate no longer belongs to the current actor.')
  const actor = requireActor(input.encounter, input.candidate.actorId)
  if (actor.kind !== 'CREATURE')
    throw new EncounterConflictError('Recharge candidate actor is no longer a Creature.')
  const feature = snapshotFeatureDefinitions(actor).find(
    (candidate) => candidate.id === input.candidate.featureId
  )
  if (!feature || checksumRuleDocument(feature) !== input.candidate.featureVersionChecksum)
    throw new EncounterConflictError('Recharge Feature source changed before resolution.')
  const resource = findEncounterFeatureResource(input.actorRules, actor.id, feature.id)
  if (
    !resource ||
    resource.maximum !== input.candidate.maximum ||
    resource.used !== input.candidate.beforeUsed
  ) {
    throw new EncounterConflictError('Recharge Feature state changed before resolution.')
  }
  return actor
}

function stageCompletedRechargePlan(input: {
  encounter: EncounterRecord
  actorRules: EncounterActorRuleOutput
  plan: CompletedTurnRechargePlan
  currentActorId: string | null
}): { encounter: EncounterRecord; actor: EncounterActorRecord | null } {
  let stagedEncounter = input.encounter
  let stagedActor: EncounterActorRecord | null = null
  for (const execution of input.plan.executions) {
    const actor = assertRechargeCandidateCurrent({
      encounter: stagedEncounter,
      actorRules: input.actorRules,
      candidate: execution.candidate,
      currentActorId: input.currentActorId
    })
    if (execution.beforeUsed !== execution.candidate.beforeUsed)
      throw new EncounterConflictError('Recharge execution evidence is stale.')
    const next = {
      ...actor,
      resources: withFeatureChargeUsed(actor, execution.candidate.featureId, execution.afterUsed)
    }
    stagedEncounter = {
      ...stagedEncounter,
      actors: stagedEncounter.actors.map((candidate) =>
        candidate.id === next.id ? next : candidate
      )
    }
    stagedActor = next
  }
  return { encounter: stagedEncounter, actor: stagedActor }
}

function completedRechargePlan(
  selectionChecksum: string,
  executions: readonly TurnRechargeExecution[]
): CompletedTurnRechargePlan | null {
  if (executions.length === 0) return null
  return { selectionChecksum, executions: [...executions] }
}

function rechargeExecutionsForRoot(root: {
  completedRechargePlan?: CompletedTurnRechargePlan | null
}): readonly TurnRechargeExecution[] {
  return root.completedRechargePlan?.executions ?? []
}

function rechargePendingSnapshot(input: {
  continuation: ServerRuleExecutionContinuationDto
  root: TurnRechargePendingContext['root']
  selectionChecksum: string
  completedExecutions: readonly TurnRechargeExecution[]
  currentCandidate: TurnRechargeCandidate
  remainingCandidates: readonly TurnRechargeCandidate[]
}): ServerKernelRuleExecutionPendingSnapshotDto {
  return serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
    snapshotKind: 'KERNEL_EVIDENCE',
    ...input.continuation,
    applicationContext: {
      kind: 'ENCOUNTER_TURN_RECHARGE',
      schemaVersion: 1,
      phase: 'START_OF_TURN',
      root: input.root,
      selectionChecksum: input.selectionChecksum,
      completedExecutions: input.completedExecutions,
      currentCandidate: input.currentCandidate,
      remainingCandidates: input.remainingCandidates
    }
  })
}

export interface ExecuteEncounterCommandOptions {
  committedRuleSnapshot?: EncounterActorRuleSnapshot
  onTiming?: (timing: EncounterCommandServiceTiming) => void
  liveSessionAuthority?: LiveSessionCommandAuthority
  /** Server-composed only; fixed turn effects fail closed without it. */
  rulesRuntime?: RulesRuntimeService
  /** Authoritative live Scene vision used only while resuming spatial movement. */
  sceneVisionContext?: LiveSessionSceneVisionContextDto
  /** Test-only deterministic occurrence identity factory. */
  createRuleOccurrenceId?: () => string
  /** Test-only trusted server d20 seam for Automatic active-effect turns. */
  rollD20?: () => number
  /** Test-only trusted server d6 seam for Automatic Recharge. */
  rollD6?: () => number
}

function actionOccurrenceSummary(input: {
  occurrence: RuleOccurrenceRecord
  encounterVersion: number
  role: 'OWNER' | 'PLAYER'
  assignedCharacterId: string | null
}): EncounterRuleOccurrenceSummaryDto {
  const snapshot = input.occurrence.pendingSnapshot
  const context = snapshot?.applicationContext
  if (input.occurrence.state === 'PENDING') {
    if (!snapshot || !isServerKernelRuleExecutionPendingSnapshot(snapshot)) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    if (
      context?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' &&
      context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
    ) {
      return {
        occurrenceId: input.occurrence.id,
        occurrenceVersion: input.occurrence.version,
        status: 'PENDING',
        outcome: null,
        pending:
          input.role === 'OWNER'
            ? {
                kind: 'LEGENDARY_RESISTANCE_CHOICE',
                occurrenceId: input.occurrence.id,
                occurrenceVersion: input.occurrence.version,
                encounterVersion: input.encounterVersion,
                targetActorId: context.targetActorId,
                options: [{ optionId: context.phase.resistance.useOptionId }],
                allowedResponses: ['DECLINE', 'OPTION']
              }
            : null
      }
    }
    const actionSourceCharacterId =
      context?.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION'
        ? context.sourceCharacterId
        : context?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION'
          ? context.sourceCharacterId
          : null
    if (
      !actionSourceCharacterId ||
      (input.role !== 'OWNER' && input.assignedCharacterId !== actionSourceCharacterId) ||
      snapshot.request.kind !== 'INTEGER_RANGE' ||
      snapshot.request.min !== 1 ||
      snapshot.request.max !== 20
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const rollMode =
      context?.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION'
        ? context.d20?.rollMode
        : context?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' &&
            context.phase.kind === 'ACTION_EVIDENCE'
          ? context.phase.d20?.rollMode
          : null
    if (!rollMode) throw new EncounterConflictError('Rule occurrence is unavailable.')
    return {
      occurrenceId: input.occurrence.id,
      occurrenceVersion: input.occurrence.version,
      status: 'PENDING',
      outcome: null,
      pending: {
        kind: 'D20_EVIDENCE',
        occurrenceId: input.occurrence.id,
        occurrenceVersion: input.occurrence.version,
        encounterVersion: input.encounterVersion,
        request: { requestId: snapshot.request.requestId, min: 1, max: 20, rollMode },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    }
  }
  return {
    occurrenceId: input.occurrence.id,
    occurrenceVersion: input.occurrence.version,
    status: 'COMPLETE',
    outcome: null,
    pending: null
  }
}

export async function executeEncounterCommandWithRuleSnapshot(
  db: DBLike,
  userId: string,
  input: EncounterCommandInputDto,
  options: ExecuteEncounterCommandOptions = {}
): Promise<EncounterCommandExecutionResult> {
  if (input.type === 'RESOLVE_ACTION') {
    if (!options.rulesRuntime) {
      throw new EncounterValidationError('Encounter action resolution requires the rules runtime.')
    }
    const runtime = options.rulesRuntime
    return withTransaction(db, async (trx) => {
      const locked = await lockEncounterRuleExecutionCommandContext(trx, {
        actorUserId: userId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.encounterId,
        ...(options.liveSessionAuthority
          ? { liveSessionAuthority: options.liveSessionAuthority }
          : {})
      })
      const receipts = createRuleOccurrenceRepository(trx)
      const replayReceipt = await receipts.findReceipt(
        'ENCOUNTER',
        locked.encounter.id,
        input.commandId
      )
      const replaySummary = replayReceipt
        ? actionOccurrenceSummaryFromReceipt({
            receipt: replayReceipt,
            encounterVersion: replayReceipt.aggregateVersion,
            role: locked.context.role,
            userId
          })
        : null
      if (replayReceipt && replaySummary) {
        if (
          replayReceipt.commandFingerprint !== encounterActionStartFingerprint(input, userId) ||
          replayReceipt.actorUserId !== userId ||
          replayReceipt.correlationId !== null
        ) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        const projection = await createEncounterRepository(trx).requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.context.currentVersion
        })
        return {
          replayed: true,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: replaySummary
          })
        }
      }
      if (locked.encounter.status !== 'ACTIVE') {
        throw new EncounterConflictError('Only active Encounters can resolve actions.')
      }
      const actionSceneContext = await lockEncounterActionSceneContext({
        db: trx,
        encounterId: locked.encounter.id,
        actorId: input.actorId,
        targetActorId: input.targetActorId,
        request: input.sceneContext ?? null
      })
      const target = requireActor(locked.encounter, input.targetActorId)
      const result =
        target.kind === 'CHARACTER'
          ? await executeEncounterCharacterRuleAction({
              db: trx,
              runtime,
              command: {
                actionId: input.actionId,
                actorId: input.actorId,
                actorUserId: userId,
                commandId: input.commandId,
                correlationId: null,
                encounterId: input.encounterId,
                expectedEncounterVersion: input.expectedVersion,
                sceneContext: actionSceneContext,
                targetActorId: input.targetActorId,
                ...(options.liveSessionAuthority
                  ? { liveSessionAuthority: options.liveSessionAuthority }
                  : {})
              }
            })
          : await executeEncounterActorDirectRuleAction({
              db: trx,
              runtime,
              command: {
                actionId: input.actionId,
                actorId: input.actorId,
                actorUserId: userId,
                commandId: input.commandId,
                correlationId: null,
                encounterId: input.encounterId,
                expectedEncounterVersion: input.expectedVersion,
                sceneContext: actionSceneContext,
                targetActorId: input.targetActorId,
                ...(options.liveSessionAuthority
                  ? { liveSessionAuthority: options.liveSessionAuthority }
                  : {})
              }
            })
      const occurrence = await receipts.lockOccurrence(
        'ENCOUNTER',
        locked.encounter.id,
        result.occurrenceId
      )
      if (!occurrence) throw new EncounterConflictError('Rule occurrence is unavailable.')
      const metadata = await createEncounterRepository(trx).findVersionMetadata(locked.encounter.id)
      if (!metadata) throw new EncounterNotFoundError()
      const current = await createEncounterRepository(trx).requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: metadata.version
      })
      const concentrationPending =
        result.status === 'COMPLETE' && 'pending' in result ? result.pending : null
      const occurrenceSummary = concentrationPending
        ? {
            occurrenceId: concentrationPending.occurrenceId,
            occurrenceVersion: concentrationPending.occurrenceVersion,
            status: 'PENDING' as const,
            outcome: null,
            pending: concentrationPending
          }
        : actionOccurrenceSummary({
            occurrence,
            encounterVersion: metadata.version,
            role: locked.context.role,
            assignedCharacterId: locked.context.assignedCharacterId
          })
      return {
        replayed: replayReceipt !== null,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            locked.context.role === 'OWNER'
              ? current.projection
              : projectPlayerEncounterProjection(current.projection),
          roll: null,
          resolution: null,
          occurrence: occurrenceSummary
        })
      }
    })
  }
  if (input.type === 'RESOLVE_RULE_OCCURRENCE') {
    return withTransaction(db, async (trx) => {
      const locked = await lockEncounterRuleExecutionCommandContext(trx, {
        actorUserId: userId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.encounterId,
        ...(options.liveSessionAuthority
          ? { liveSessionAuthority: options.liveSessionAuthority }
          : {})
      })
      const occurrences = createRuleOccurrenceRepository(trx)
      const receipt = await occurrences.findReceipt(
        'ENCOUNTER',
        locked.encounter.id,
        input.commandId
      )
      const receiptSummary = receipt
        ? actionOccurrenceSummaryFromReceipt({
            receipt,
            encounterVersion: receipt.aggregateVersion,
            role: locked.context.role,
            userId
          })
        : null
      if (receipt && receiptSummary) {
        if (
          receipt.occurrenceId !== input.occurrenceId ||
          receipt.commandFingerprint !== encounterActionResumeFingerprint(input, userId) ||
          receipt.actorUserId !== userId ||
          receipt.correlationId !== input.correlationId
        ) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        const projection = await createEncounterRepository(trx).requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.context.currentVersion
        })
        return {
          replayed: true,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: receiptSummary
          })
        }
      }
      const occurrence = await occurrences.lockOccurrence(
        'ENCOUNTER',
        locked.encounter.id,
        input.occurrenceId
      )
      if (!occurrence) throw new EncounterConflictError('Rule occurrence is unavailable.')
      const terminalReceipt =
        occurrence.state === 'COMPLETED'
          ? await occurrences.findTerminalReceiptByOccurrence(
              'ENCOUNTER',
              locked.encounter.id,
              occurrence.id
            )
          : null
      const routedReceipt = receipt ?? terminalReceipt
      const kernelPendingApplicationContext =
        occurrence.pendingSnapshot !== null &&
        isServerKernelRuleExecutionPendingSnapshot(occurrence.pendingSnapshot)
          ? occurrence.pendingSnapshot.applicationContext
          : undefined
      const aggregatePendingApplicationContext =
        occurrence.pendingSnapshot !== null &&
        isServerAggregateChoicePendingSnapshot(occurrence.pendingSnapshot)
          ? occurrence.pendingSnapshot.applicationContext
          : undefined
      const movementOccurrence =
        kernelPendingApplicationContext?.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
        kernelPendingApplicationContext?.kind === 'ENCOUNTER_MOVEMENT_REACTION' ||
        routedReceipt?.commandMetadata.transition === 'SPATIAL_MOVEMENT'
      if (movementOccurrence) {
        if (
          !isD20ResolveRuleOccurrenceCommand(input) &&
          !isMovementReactionResolveRuleOccurrenceCommand(input)
        ) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        return resolveEncounterSpatialMovementRuleOccurrence({
          db: trx,
          runtime: options.rulesRuntime,
          userId,
          command: input,
          locked,
          occurrence,
          commandReceipt: routedReceipt,
          ...(options.rollD20 ? { rollD20: options.rollD20 } : {}),
          sceneVisionContext: options.sceneVisionContext
        })
      }
      const legendaryReceiptResolution =
        routedReceipt?.commandMetadata.transition === 'TURN_EFFECTS_PENDING'
          ? 'resolutionCommand' in routedReceipt.commandMetadata &&
            routedReceipt.commandMetadata.resolutionCommand.commandId === input.commandId
            ? routedReceipt.commandMetadata.resolutionCommand
            : null
          : routedReceipt?.commandMetadata.transition === 'TURN_EFFECTS'
            ? (routedReceipt.commandMetadata.resolutionCommands.find(
                (entry) => entry.commandId === input.commandId
              ) ?? null)
            : null
      const legendaryReceipt =
        legendaryReceiptResolution !== null &&
        isLegendaryTurnResolutionCommand(legendaryReceiptResolution)
      const legendaryOccurrence =
        aggregatePendingApplicationContext?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
        kernelPendingApplicationContext?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
        legendaryReceipt
      if (legendaryOccurrence) {
        if (legendaryReceipt) {
          if (
            !isD20ResolveRuleOccurrenceCommand(input) &&
            !isMovementReactionResolveRuleOccurrenceCommand(input)
          ) {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          return resolveEncounterLegendaryActionRuleOccurrence({
            db: trx,
            runtime: options.rulesRuntime,
            userId,
            command: input,
            locked,
            occurrence,
            commandReceipt: routedReceipt,
            ...(options.rollD20 ? { rollD20: options.rollD20 } : {}),
            ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
          })
        }
        if (aggregatePendingApplicationContext?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE') {
          if (!isMovementReactionResolveRuleOccurrenceCommand(input)) {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          return resolveEncounterLegendaryActionRuleOccurrence({
            db: trx,
            runtime: options.rulesRuntime,
            userId,
            command: input,
            locked,
            occurrence,
            commandReceipt: routedReceipt,
            ...(options.rollD20 ? { rollD20: options.rollD20 } : {}),
            ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
          })
        }
        if (!isD20ResolveRuleOccurrenceCommand(input)) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        return resolveEncounterLegendaryActionRuleOccurrence({
          db: trx,
          runtime: options.rulesRuntime,
          userId,
          command: input,
          locked,
          occurrence,
          commandReceipt: routedReceipt,
          ...(options.rollD20 ? { rollD20: options.rollD20 } : {}),
          ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
        })
      }
      if (kernelPendingApplicationContext?.kind === 'ENCOUNTER_TURN_RECHARGE') {
        if (!isRechargeResolveRuleOccurrenceCommand(input)) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        return resolveEncounterTurnRuleOccurrence({
          db: trx,
          runtime: options.rulesRuntime,
          userId,
          command: input,
          locked,
          occurrence,
          commandReceipt: receipt,
          ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
        })
      }
      const terminalResolution =
        routedReceipt?.commandMetadata.transition === 'TURN_EFFECTS'
          ? routedReceipt.commandMetadata.resolutionCommands.find(
              (entry) => entry.commandId === input.commandId
            )
          : null
      if (
        kernelPendingApplicationContext?.kind === 'ENCOUNTER_INITIATIVE' ||
        aggregatePendingApplicationContext?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' ||
        terminalResolution?.kind === 'ENTER_INTEGER' ||
        terminalResolution?.kind === 'INITIATIVE_SYSTEM_ROLL' ||
        terminalResolution?.kind === 'INITIATIVE_ENTITY' ||
        terminalResolution?.kind === 'INITIATIVE_DECLARATION'
      ) {
        if (!isInitiativeResolveRuleOccurrenceCommand(input)) {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        return resolveEncounterInitiativeRuleOccurrence({
          db: trx,
          runtime: options.rulesRuntime,
          userId,
          command: input,
          locked,
          occurrence,
          ...(options.rollD20 ? { rollD20: options.rollD20 } : {})
        })
      }
      if (
        isEncounterActionRuleOccurrence({
          pendingApplicationContext: kernelPendingApplicationContext,
          receipt: routedReceipt
        })
      ) {
        if (!options.rulesRuntime) {
          throw new EncounterValidationError(
            'Rule occurrence resolution requires the rules runtime.'
          )
        }
        const actorDirect = isActorDirectActionOccurrence({
          pendingApplicationContext: kernelPendingApplicationContext,
          receipt: routedReceipt
        })
        const actionResolution = (() => {
          if (
            actorDirect &&
            kernelPendingApplicationContext?.kind === 'ENCOUNTER_ACTOR_RULE_ACTION' &&
            kernelPendingApplicationContext.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
          ) {
            if (input.resolution.kind === 'DECLINE')
              return { kind: 'LEGENDARY_RESISTANCE' as const, selection: 'DECLINE' as const }
            if (
              input.resolution.kind === 'OPTION' &&
              input.resolution.optionId ===
                kernelPendingApplicationContext.phase.resistance.useOptionId
            ) {
              return { kind: 'LEGENDARY_RESISTANCE' as const, selection: 'USE' as const }
            }
            throw new EncounterConflictError('Legendary Resistance choice is unavailable.')
          }
          if (input.resolution.kind === 'SYSTEM_ROLL') {
            return { kind: 'SYSTEM' as const, requestId: input.resolution.requestId }
          }
          if (input.resolution.kind === 'ENTER_DICE') {
            return {
              kind: 'PHYSICAL' as const,
              requestId: input.resolution.requestId,
              rawFaces: input.resolution.rawFaces
            }
          }
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        })()
        const result = actorDirect
          ? await resumeEncounterActorDirectRuleAction({
              db: trx,
              runtime: options.rulesRuntime,
              command: {
                actorUserId: userId,
                commandId: input.commandId,
                correlationId: input.correlationId,
                encounterId: input.encounterId,
                expectedEncounterVersion: input.expectedVersion,
                expectedOccurrenceVersion: input.expectedOccurrenceVersion,
                occurrenceId: input.occurrenceId,
                resolution: actionResolution,
                ...(options.liveSessionAuthority
                  ? { liveSessionAuthority: options.liveSessionAuthority }
                  : {})
              }
            })
          : await resumeEncounterCharacterRuleAction({
              db: trx,
              runtime: options.rulesRuntime,
              command: {
                actorUserId: userId,
                commandId: input.commandId,
                correlationId: input.correlationId,
                encounterId: input.encounterId,
                expectedEncounterVersion: input.expectedVersion,
                expectedOccurrenceVersion: input.expectedOccurrenceVersion,
                occurrenceId: input.occurrenceId,
                resolution: actionResolution,
                ...(options.liveSessionAuthority
                  ? { liveSessionAuthority: options.liveSessionAuthority }
                  : {})
              }
            })
        const currentOccurrence = await occurrences.lockOccurrence(
          'ENCOUNTER',
          locked.encounter.id,
          result.occurrenceId
        )
        if (!currentOccurrence) throw new EncounterConflictError('Rule occurrence is unavailable.')
        const metadata = await createEncounterRepository(trx).findVersionMetadata(
          locked.encounter.id
        )
        if (!metadata) throw new EncounterNotFoundError()
        const current = await createEncounterRepository(trx).requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: metadata.version
        })
        const concentrationPending =
          result.status === 'COMPLETE' && 'pending' in result ? result.pending : null
        const occurrenceSummary = concentrationPending
          ? {
              occurrenceId: concentrationPending.occurrenceId,
              occurrenceVersion: concentrationPending.occurrenceVersion,
              status: 'PENDING' as const,
              outcome: null,
              pending: concentrationPending
            }
          : actionOccurrenceSummary({
              occurrence: currentOccurrence,
              encounterVersion: metadata.version,
              role: locked.context.role,
              assignedCharacterId: locked.context.assignedCharacterId
            })
        return {
          replayed: receipt !== null || terminalReceipt !== null,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? current.projection
                : projectPlayerEncounterProjection(current.projection),
            roll: null,
            resolution: null,
            occurrence: occurrenceSummary
          })
        }
      }
      if (!isD20ResolveRuleOccurrenceCommand(input))
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const turnOccurrence =
        occurrence.pendingSnapshot?.applicationContext.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
        routedReceipt?.commandMetadata.transition === 'TURN_EFFECTS'
      if (turnOccurrence) {
        return resolveEncounterTurnRuleOccurrence({
          db: trx,
          runtime: options.rulesRuntime,
          userId,
          command: input,
          locked,
          occurrence,
          ...(options.liveSessionAuthority
            ? { liveSessionAuthority: options.liveSessionAuthority }
            : {})
        })
      }
      if (!options.rulesRuntime)
        throw new EncounterValidationError('Rule occurrence resolution requires the rules runtime.')
      const settled = await resolveEncounterConcentrationRuleOccurrence({
        db: trx,
        runtime: options.rulesRuntime,
        lockedContext: locked,
        lockedOccurrence: occurrence,
        command: {
          actorUserId: userId,
          commandId: input.commandId,
          correlationId: input.correlationId,
          encounterId: input.encounterId,
          expectedEncounterVersion: input.expectedVersion,
          expectedOccurrenceVersion: input.expectedOccurrenceVersion,
          occurrenceId: input.occurrenceId,
          resolution: input.resolution,
          ...(options.liveSessionAuthority
            ? { liveSessionAuthority: options.liveSessionAuthority }
            : {})
        }
      })
      if (
        settled.result.status !== 'COMPLETE' ||
        settled.result.applicationOutputs.kind !== 'CONCENTRATION_CHECK'
      ) {
        throw new EncounterConflictError('Concentration occurrence resolution did not complete.')
      }
      const output = settled.result.applicationOutputs
      return {
        replayed: settled.replayed,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            settled.role === 'OWNER'
              ? settled.projection.projection
              : projectPlayerEncounterProjection(settled.projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: settled.result.occurrenceId,
            occurrenceVersion: settled.result.occurrenceVersion,
            status: 'COMPLETE',
            outcome: output.outcome,
            pending: settled.pending
          }
        })
      }
    })
  }
  const startedAt = performance.now()
  let evaluationLane: EncounterCommandServiceTiming['evaluationLane'] = 'NONE'
  let actorEvaluationMs = 0
  let actorZenEvaluationMs = 0
  let actionEvaluationMs = 0
  let actionZenEvaluationMs = 0
  const { command, replayed, tableEntry, ruleSnapshot } = await withTransaction(db, async (trx) => {
    const repository = createEncounterRepository(trx)
    const lockedContext = await lockEncounterRuleExecutionCommandContext(trx, {
      actorUserId: userId,
      encounterId: input.encounterId,
      ...(options.liveSessionAuthority
        ? { liveSessionAuthority: options.liveSessionAuthority }
        : {})
    })
    const locked = lockedContext.encounter
    const matchingCommittedRuleSnapshot =
      options.committedRuleSnapshot?.encounterVersion === locked.version &&
      options.committedRuleSnapshot.revisionId === locked.rulePackRevisionId
        ? options.committedRuleSnapshot
        : undefined
    const commandFingerprint = fingerprint(input)
    const prior = await repository.findEventByCampaignCommand(locked.campaignId, input.commandId)
    if (prior) {
      if (
        prior.encounterId !== input.encounterId ||
        prior.commandFingerprint !== commandFingerprint ||
        prior.commandType !== input.type
      ) {
        throw new EncounterConflictError('Command ID was already used with different input.')
      }
      const priorResult = parseEncounterProjectionEvent(prior.resultPayload, {
        encounterId: locked.id,
        gameSystemId: locked.gameSystemId,
        blueprintId: locked.blueprintId,
        blueprintVersion: locked.blueprintVersion,
        blueprintChecksum: locked.blueprintChecksum,
        automationMode: locked.automationMode,
        manualReminderMode: locked.manualReminderMode
      })
      const receiptRepository = createRuleOccurrenceRepository(trx)
      if (priorResult.ruleReceipt === null) {
        if (await receiptRepository.findReceipt('ENCOUNTER', locked.id, input.commandId)) {
          throw new EncounterConflictError('Encounter replay rule receipt is inconsistent.')
        }
      } else {
        const receipt = await receiptRepository.findReceipt('ENCOUNTER', locked.id, input.commandId)
        if (
          !receipt ||
          receipt.occurrenceId !== priorResult.ruleReceipt.occurrenceId ||
          receipt.commandFingerprint !== commandFingerprint ||
          receipt.commandType !== input.type ||
          receipt.aggregateId !== locked.id ||
          receipt.aggregateVersion !== prior.version ||
          !['TURN_EFFECTS', 'MAINTENANCE_CLEANUP'].includes(receipt.commandMetadata.transition) ||
          ![
            'BATCH_COMPLETE',
            'MANUAL',
            'INITIATIVE_COMPLETE',
            'TURN_LIFECYCLE_COMPLETE',
            'MAINTENANCE_COMPLETE'
          ].includes(receipt.resultPayload.status) ||
          checksumCanonicalJson(receipt.resultPayload) !== priorResult.ruleReceipt.resultChecksum
        ) {
          throw new EncounterConflictError('Encounter replay rule receipt is invalid.')
        }
        if (
          receipt.commandMetadata.transition === 'MAINTENANCE_CLEANUP' ||
          receipt.resultPayload.status === 'MAINTENANCE_COMPLETE'
        ) {
          if (
            receipt.commandMetadata.transition !== 'MAINTENANCE_CLEANUP' ||
            input.type !== 'REMOVE_ACTOR' ||
            receipt.commandMetadata.commandType !== input.type ||
            receipt.commandMetadata.removedActorId !== input.actorId ||
            receipt.resultPayload.status !== 'MAINTENANCE_COMPLETE'
          )
            throw new EncounterConflictError('Encounter replay maintenance receipt is invalid.')
        } else if (
          receipt.commandMetadata.transition !== 'TURN_EFFECTS' ||
          !['BATCH_COMPLETE', 'MANUAL', 'INITIATIVE_COMPLETE', 'TURN_LIFECYCLE_COMPLETE'].includes(
            receipt.resultPayload.status
          )
        )
          throw new EncounterConflictError('Encounter replay rule receipt is invalid.')
      }
      return {
        command: priorResult.command,
        replayed: true,
        tableEntry: null,
        ruleSnapshot: priorResult.currentProjection.ruleSnapshot
      }
    }
    const occurrenceRepository = createRuleOccurrenceRepository(trx)
    const pendingOccurrence =
      'lockPendingEncounter' in occurrenceRepository
        ? await occurrenceRepository.lockPendingEncounter(locked.id)
        : null
    if (pendingOccurrence) {
      const aggregateChoice = pendingOccurrence.pendingSnapshot
      if (
        aggregateChoice &&
        isServerAggregateChoicePendingSnapshot(aggregateChoice) &&
        aggregateChoice.applicationContext.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
      ) {
        const context = aggregateChoice.applicationContext
        if (
          pendingOccurrence.rootCommandId !== input.commandId ||
          context.root.commandFingerprint !== commandFingerprint
        ) {
          throw new EncounterConflictError('An Encounter rule occurrence is awaiting resolution.')
        }
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              status: 'PENDING',
              outcome: null,
              pending:
                lockedContext.context.role === 'OWNER'
                  ? legendaryActionPendingSummary(pendingOccurrence, locked.version)
                  : null
            }
          }),
          replayed: true,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      if (
        aggregateChoice &&
        isServerAggregateChoicePendingSnapshot(aggregateChoice) &&
        aggregateChoice.applicationContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
      ) {
        const context = aggregateChoice.applicationContext
        if (
          pendingOccurrence.rootCommandId !== input.commandId ||
          context.root.commandFingerprint !== commandFingerprint ||
          (lockedContext.context.role !== 'OWNER' && context.request.controllerUserId !== userId)
        ) {
          throw new EncounterConflictError('An Encounter rule occurrence is awaiting resolution.')
        }
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              status: 'PENDING',
              outcome: null,
              pending: projectEncounterInitiativePendingSummary({
                pendingSnapshot: aggregateChoice,
                occurrenceVersion: pendingOccurrence.version,
                encounterVersion: locked.version
              })
            }
          }),
          replayed: true,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      const pendingSnapshot = requireEncounterKernelPendingSnapshot(
        pendingOccurrence.pendingSnapshot
      )
      const context = pendingSnapshot.applicationContext
      if (
        pendingOccurrence.rootCommandId === input.commandId &&
        context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' &&
        context.root.commandFingerprint === commandFingerprint
      ) {
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        const pending = turnContinuationPendingSummary(pendingOccurrence, locked.version)
        if (!pending)
          throw new EncounterConflictError('Legendary Action occurrence is unavailable.')
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              status: 'PENDING',
              outcome: null,
              pending: lockedContext.context.role === 'OWNER' ? pending : null
            }
          }),
          replayed: true,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      if (
        pendingOccurrence.rootCommandId === input.commandId &&
        context?.kind === 'ENCOUNTER_INITIATIVE' &&
        context.root.commandFingerprint === commandFingerprint
      ) {
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        const pending = projectEncounterInitiativePendingSummary({
          pendingSnapshot,
          occurrenceVersion: pendingOccurrence.version,
          encounterVersion: locked.version
        })
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              status: 'PENDING',
              outcome: null,
              pending
            }
          }),
          replayed: true,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      if (
        pendingOccurrence.rootCommandId === input.commandId &&
        context?.kind === 'ENCOUNTER_TURN_RECHARGE' &&
        context.root.commandFingerprint === commandFingerprint
      ) {
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        const pending = rechargePendingSummary(pendingOccurrence, locked.version)
        if (!pending) throw new EncounterConflictError('Recharge occurrence is unavailable.')
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              status: 'PENDING',
              outcome: null,
              pending
            }
          }),
          replayed: true,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      if (
        pendingOccurrence.rootCommandId !== input.commandId ||
        context?.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
        context.root.commandFingerprint !== commandFingerprint
      )
        throw new EncounterConflictError('An Encounter rule occurrence is awaiting resolution.')
      const projection = await repository.requireCurrentProjection({
        encounterId: locked.id,
        expectedStreamVersion: locked.version
      })
      if (!context.currentCandidate.d20Policy)
        throw new EncounterConflictError('Turn-effect occurrence lacks d20 policy.')
      return {
        command: encounterCommandResultDtoSchema.parse({
          projection:
            lockedContext.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: pendingOccurrence.id,
            occurrenceVersion: pendingOccurrence.version,
            status: 'PENDING',
            outcome: null,
            pending: {
              kind: 'D20_EVIDENCE',
              occurrenceId: pendingOccurrence.id,
              occurrenceVersion: pendingOccurrence.version,
              encounterVersion: locked.version,
              request: {
                requestId: pendingSnapshot.request.requestId,
                min: 1,
                max: 20,
                rollMode: context.currentCandidate.d20Policy.rollMode
              },
              allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
            }
          }
        }),
        replayed: true,
        tableEntry: null,
        ruleSnapshot: projection.ruleSnapshot
      }
    }
    if (locked.version !== input.expectedVersion) {
      throw new EncounterConflictError('Encounter version is stale.')
    }
    if (locked.status === 'COMPLETED') {
      throw new EncounterConflictError('Completed Encounters are read-only.')
    }
    let nextStatus: EncounterStatus = locked.status
    let nextRound = locked.round
    let nextCurrentActorId = locked.currentActorId
    let correlationId: string | null = null
    let rolled: RollRecordDto | null = null
    let resolution: RuleResolutionEvidenceDto | null = null
    let tableEntry: CampaignRoomEntry | null = null
    let actorRuleSnapshot = matchingCommittedRuleSnapshot
    let workingEncounter = locked
    let turnOccurrenceId: string | null = null
    let initiativeSettlement: EncounterInitiativeSettlementDto | null = null
    let initiativeAdvancePlan: EncounterInitiativeAdvancePlanDto | null = null
    let stagedInitiativeApplication: {
      beforePin: InitiativeBeforePinDto
      stagedRoundState: StagedInitiativeRoundStateDto
      initiativeAdvance?: EncounterInitiativeAdvancePlanDto
    } | null = null
    let turnBoundaries:
      | readonly {
          ordinal: 0 | 1
          stage: 'START_OF_TURN' | 'END_OF_TURN'
          actorId: string | null
        }[]
      | null = null
    let maintenanceCleanup:
      | Awaited<ReturnType<typeof cleanupRemovedEncounterActorMaintainedEffects>>['result']
      | null = null
    const stagedActorUpdates = new Map<string, EncounterActorRecord>()
    // Owner-start Legendary Action recovery is occurrence-local until terminal
    // commit. Other staged actor updates may flush while automatic execution runs.
    const stagedLegendaryRefreshActorUpdates = new Map<string, EncounterActorRecord>()

    const evaluateActorSnapshot = async (
      encounter: EncounterRecord,
      revisionId?: string | null,
      previousSnapshot?: EncounterActorRuleSnapshot,
      persistActorUpdates = true
    ): Promise<EncounterActorRuleSnapshot> => {
      const evaluationStartedAt = performance.now()
      const evaluated = await evaluateEncounterActorRuleSnapshot({
        db: trx,
        encounter,
        revisionId,
        previousSnapshot
      })
      for (const actor of evaluated.actorUpdates) {
        if (persistActorUpdates) await repository.updateActor(actor)
        else stagedActorUpdates.set(actor.id, actor)
      }
      workingEncounter = evaluated.reconciledEncounter
      actorEvaluationMs += performance.now() - evaluationStartedAt
      actorZenEvaluationMs += evaluated.zenEvaluationMs
      if (evaluationLane === 'NONE') evaluationLane = 'ENCOUNTER_ACTOR'
      return evaluated.snapshot
    }

    const currentActorRules = async (persistActorUpdates = true) => {
      if (actorRuleSnapshot) return actorRuleSnapshot.output
      let revisionId = workingEncounter.rulePackRevisionId
      if (!revisionId) {
        revisionId = (
          await resolveActiveRulePackForSystems(trx, encounterSystemIds(workingEncounter))
        ).revision.id
      }
      actorRuleSnapshot = await evaluateActorSnapshot(
        workingEncounter,
        revisionId,
        undefined,
        persistActorUpdates
      )
      return actorRuleSnapshot.output
    }

    const prepareFrozenActorRuleSource = async (): Promise<FrozenEncounterActorRuleSource> => {
      const active = await resolveActiveRulePackForSystems(
        trx,
        encounterSystemIds(workingEncounter)
      )
      const revision = await requireImmutableEncounterActorRuleRevision({
        db: trx,
        revisionId: active.revision.id,
        expectedChecksum: active.revision.checksum
      })
      const snapshot = await evaluateActorSnapshot(workingEncounter, revision.id, undefined, false)
      actorRuleSnapshot = snapshot
      return {
        revisionId: revision.id,
        revisionChecksum: revision.checksum,
        snapshotChecksum: checksumEncounterActorRuleSnapshot(snapshot)
      }
    }

    const stageLegendaryActionRefreshesAtStart = async (
      actorId: string,
      root: TurnCoordinatorRootDto
    ) => {
      const actorRules = await currentActorRules(false)
      if (workingEncounter.automationMode === 'MANUAL') return actorRules
      const staged = await stageEncounterLegendaryActionRefreshes({
        actorId,
        encounter: workingEncounter,
        actorRules,
        definitions: createReusableDefinitionRepository(trx)
      })
      if (staged.refreshes.length === 0 || !staged.refreshedActor) return actorRules
      root.stagedLegendaryActionRefreshes = [
        ...(root.stagedLegendaryActionRefreshes ?? []),
        ...staged.refreshes.map((refresh, ordinal) => ({
          ...refresh,
          ordinal: (root.stagedLegendaryActionRefreshes?.length ?? 0) + ordinal
        }))
      ]
      stagedLegendaryRefreshActorUpdates.set(staged.refreshedActor.id, staged.refreshedActor)
      workingEncounter = {
        ...workingEncounter,
        actors: workingEncounter.actors.map((actor) =>
          actor.id === staged.refreshedActor!.id ? staged.refreshedActor! : actor
        )
      }
      actorRuleSnapshot = undefined
      return currentActorRules(false)
    }

    switch (input.type) {
      case 'UPDATE_ACTOR': {
        const current = requireActor(locked, input.actorId)
        if (
          current.kind === 'CHARACTER' &&
          (input.currentHitPoints !== undefined ||
            input.tempHitPoints !== undefined ||
            input.conditions !== undefined)
        ) {
          throw new EncounterValidationError(
            'Character HP must be changed through its Sheet command.'
          )
        }
        const characterMutation = await applyCharacterCommand(
          trx,
          userId,
          current,
          input,
          options.liveSessionAuthority
        )
        let next = characterMutation.actor
        if (input.currentHitPoints !== undefined)
          next = { ...next, currentHitPoints: input.currentHitPoints }
        if (input.tempHitPoints !== undefined)
          next = { ...next, tempHitPoints: input.tempHitPoints }
        if (input.conditions !== undefined) next = { ...next, conditions: input.conditions }
        if (input.gmNotes !== undefined) next = { ...next, gmNotes: input.gmNotes }
        if (input.public !== undefined) next = { ...next, public: input.public }
        await repository.updateActor(next)
        if (input.characterCommand) correlationId = characterMutation.correlationId
        break
      }
      case 'REMOVE_ACTOR': {
        requireActor(locked, input.actorId)
        const cleanup = await cleanupRemovedEncounterActorMaintainedEffects({
          trx,
          encounter: locked,
          removedActorId: input.actorId,
          attunementSlotOverride: lockedContext.context.attunementSlotOverride
        })
        for (const actor of cleanup.changedCharacterActors) await repository.updateActor(actor)
        maintenanceCleanup = cleanup.result
        if (!(await repository.removeActor(locked.id, input.actorId))) {
          throw new EncounterConflictError('Encounter actor changed before removal.')
        }
        if (nextCurrentActorId === input.actorId) nextCurrentActorId = null
        break
      }
      case 'SET_INITIATIVE': {
        const current = requireActor(locked, input.actorId)
        await repository.updateActor({
          ...current,
          initiative: input.initiative,
          manualOrder: input.manualOrder === undefined ? current.manualOrder : input.manualOrder
        })
        break
      }
      case 'ROLL_ACTOR_INITIATIVE': {
        const current = requireActor(locked, input.actorId)
        let modifier = 0
        if (current.kind === 'CHARACTER' && current.sourceId) {
          modifier =
            (await getCharacterSheetForUser(trx, current.sourceId, userId))?.overview.initiative ??
            0
        } else {
          modifier = requireEncounterActorRuleResult(
            await currentActorRules(),
            current.id
          ).initiativeModifier
        }
        const result = executeDiceConfiguration({ configuration: '1d20' })
        await repository.updateActor({
          ...current,
          initiative: result.evidence.total + modifier
        })
        break
      }
      case 'REORDER': {
        const expected = new Set(locked.actors.map((candidate) => candidate.id))
        if (
          input.actorIds.length !== expected.size ||
          input.actorIds.some((id) => !expected.has(id))
        ) {
          throw new EncounterValidationError(
            'Reorder must include each Encounter actor exactly once.'
          )
        }
        await repository.reorder(locked.id, input.actorIds)
        break
      }
      case 'START':
        if (locked.status !== 'PREPARED')
          throw new EncounterConflictError('Only prepared Encounters can start.')
        if (!locked.rulePackRevisionId) {
          await resolveActiveRulePackForSystems(trx, [
            input.systemId ?? null,
            ...encounterSystemIds(locked)
          ])
        }
        if (locked.actors.length === 0)
          throw new EncounterValidationError('Add an actor before starting.')
        turnOccurrenceId = options.createRuleOccurrenceId?.() ?? randomUUID()
        const stagedInitiativeRoundState = createStagedInitiativeRoundState({
          encounter: workingEncounter,
          round: 1
        })
        const initiative = await startEncounterInitiativeCommand({
          trx,
          repository,
          encounter: workingEncounter,
          round: 1,
          occurrenceId: turnOccurrenceId,
          runtime: options.rulesRuntime ?? null,
          attunementSlotOverride: lockedContext.context.attunementSlotOverride,
          getEncounterActorSnapshot: async () => ({
            rules: await currentActorRules(false),
            encounter: workingEncounter
          }),
          legacyOrderedActorIds: stableActors(workingEncounter).map((actor) => actor.id),
          stagedRoundState: stagedInitiativeRoundState,
          allowDeclarationPending: true,
          integerSource: ({ min, max }) =>
            min === 1 && max === 20 && options.rollD20 ? options.rollD20() : randomInt(min, max + 1)
        })
        if (initiative.kind === 'PENDING') {
          if (!workingEncounter.initiativePolicySnapshotChecksum) {
            throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
          }
          const pendingSnapshot = createEncounterInitiativePendingSnapshot({
            root: {
              rootCommandId: input.commandId,
              commandFingerprint,
              commandType: 'START',
              initiatorUserId: userId,
              correlationId: null,
              expectedEncounterVersion: locked.version,
              round: 1,
              policySnapshotChecksum: workingEncounter.initiativePolicySnapshotChecksum,
              initiativeBeforePin: {
                kind: 'INITIAL_START',
                actorIds: workingEncounter.actors.map((actor) => actor.id).sort()
              },
              stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
              startSystemId: input.systemId ?? null,
              resolutionCommands: []
            },
            pending: initiative.pending
          })
          const occurrence = await occurrenceRepository.createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId: turnOccurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: requireEncounterKernelPendingSnapshot(
                    occurrence.pendingSnapshot
                  ),
                  occurrenceVersion: occurrence.version,
                  encounterVersion: locked.version
                })
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }
        if (initiative.kind === 'DECLARATION_PENDING') {
          if (!workingEncounter.initiativePolicySnapshotChecksum) {
            throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
          }
          const request = createEncounterInitiativeDeclarationRequest({
            requestId: `initiative-declaration:${turnOccurrenceId}:${initiative.actorId}`,
            encounterId: locked.id,
            round: 1,
            actorId: initiative.actorId,
            participantExpectedVersion: initiative.state.participants.find(
              (participant) => participant.actorId === initiative.actorId
            )!.version,
            controllerUserId: await initiativeDeclarationControllerUserId({
              db: trx,
              locked: lockedContext,
              source: initiative.source
            }),
            source: initiative.source
          })
          const occurrence = await occurrenceRepository.createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId: turnOccurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot: createEncounterInitiativeDeclarationPendingSnapshot({
              occurrenceId: turnOccurrenceId,
              root: {
                rootCommandId: input.commandId,
                commandFingerprint,
                commandType: 'START',
                initiatorUserId: userId,
                correlationId: null,
                expectedEncounterVersion: locked.version,
                round: 1,
                policySnapshotChecksum: workingEncounter.initiativePolicySnapshotChecksum,
                initiativeBeforePin: {
                  kind: 'INITIAL_START',
                  actorIds: workingEncounter.actors.map((actor) => actor.id).sort()
                },
                stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
                startSystemId: input.systemId ?? null,
                resolutionCommands: []
              },
              request
            })
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: occurrence.pendingSnapshot!,
                  occurrenceVersion: occurrence.version,
                  encounterVersion: locked.version
                })
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }
        initiativeSettlement = encounterInitiativeSettlementDtoSchema.parse({
          round: initiative.state.round.round,
          cadence: initiative.state.round.cadence,
          procedure: initiative.state.round.procedure,
          policySnapshotChecksum: initiative.state.round.policySnapshotChecksum,
          orderedActorIds: initiative.orderedActorIds,
          orderedSideIds: initiative.orderedSideIds,
          evidence: initiative.evidence
        })
        stagedInitiativeApplication = {
          beforePin: {
            kind: 'INITIAL_START',
            actorIds: workingEncounter.actors.map((actor) => actor.id).sort()
          },
          stagedRoundState: serializeStagedInitiativeRoundState(initiative.state)
        }
        nextStatus = 'ACTIVE'
        nextRound = 1
        nextCurrentActorId = initiative.orderedActorIds[0] ?? null
        turnBoundaries = [{ ordinal: 0, stage: 'START_OF_TURN', actorId: nextCurrentActorId }]
        break
      case 'ADVANCE_TURN': {
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can advance.')
        if (!locked.currentActorId)
          throw new EncounterConflictError('The active Encounter has no current actor.')
        const initiativeState = await repository.lockInitiativeRound({
          encounterId: locked.id,
          round: locked.round
        })
        if (!initiativeState)
          throw new EncounterConflictError('The normalized initiative round is unavailable.')
        initiativeAdvancePlan = planEncounterInitiativeAdvance({
          state: initiativeState,
          currentActorId: locked.currentActorId
        })
        nextRound =
          initiativeAdvancePlan.kind === 'SAME_ROUND'
            ? initiativeAdvancePlan.round
            : initiativeAdvancePlan.nextRound
        nextCurrentActorId =
          initiativeAdvancePlan.kind === 'SAME_ROUND'
            ? initiativeAdvancePlan.nextActorId
            : initiativeAdvancePlan.firstActorId
        turnBoundaries = [
          {
            ordinal: 0,
            stage: 'END_OF_TURN',
            actorId: initiativeAdvancePlan.currentActorId
          }
        ]
        break
      }
      case 'PREVIOUS_TURN': {
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can move turns.')
        const ordered = stableActors(locked)
        if (ordered.length === 0)
          throw new EncounterValidationError('Add an actor before moving turns.')
        const currentIndex = ordered.findIndex(
          (candidate) => candidate.id === locked.currentActorId
        )
        const index = currentIndex < 0 ? 0 : currentIndex
        const previousIndex = (index - 1 + ordered.length) % ordered.length
        if (index === 0 && nextRound > 1) nextRound -= 1
        nextCurrentActorId = ordered[previousIndex].id
        break
      }
      case 'SET_CURRENT_ACTOR':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters have a current turn.')
        if (input.actorId !== null) requireActor(locked, input.actorId)
        nextCurrentActorId = input.actorId
        break
      case 'SET_ROUND':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters have a round to correct.')
        nextRound = input.round
        break
      case 'REPLACE_OPTIONAL_COMBAT_RULES': {
        if (locked.status !== 'PREPARED' && locked.status !== 'ACTIVE') {
          throw new EncounterConflictError(
            'Only prepared or active Encounters can change optional combat rules.'
          )
        }
        const optionalCombat = await resolveEncounterOptionalCombatSnapshot({
          db: trx,
          campaignId: locked.campaignId,
          gameSystemId: locked.gameSystemId,
          definitionIds: input.definitionIds
        })
        await repository.replaceOptionalCombatSnapshot({
          encounterId: locked.id,
          snapshot: optionalCombat.snapshot,
          checksum: optionalCombat.checksum
        })
        break
      }
      case 'ADJUST_FEATURE_RESOURCE': {
        const actorRules = await currentActorRules()
        const current = requireActor(workingEncounter, input.actorId)
        if (current.kind === 'CHARACTER') {
          throw new EncounterValidationError(
            'Character resources must be changed through the Character Sheet.'
          )
        }
        const feature = snapshotFeatureDefinitions(current).find(
          (candidate) => candidate.id === input.featureId
        )
        const maximum = feature
          ? (findEncounterFeatureResource(actorRules, current.id, feature.id)?.maximum ?? null)
          : null
        if (!feature || maximum === null) {
          throw new EncounterValidationError('This enemy feature does not have usable charges.')
        }
        const used = featureChargeUsed(current, feature.id)
        const nextUsed = input.direction === 'USE' ? used + input.amount : used - input.amount
        if (nextUsed < 0 || nextUsed > maximum) {
          throw new EncounterValidationError('The enemy feature does not have that many charges.')
        }
        await repository.updateActor({
          ...current,
          resources: withFeatureChargeUsed(current, feature.id, nextUsed)
        })
        break
      }
      case 'UPSERT_REMINDER': {
        if (input.reminder.actorId !== null) requireActor(locked, input.reminder.actorId)
        await repository.upsertReminder({
          id: input.reminder.id ?? randomUUID(),
          encounterId: locked.id,
          label: input.reminder.label,
          timing: input.reminder.timing,
          round: input.reminder.round,
          actorId: input.reminder.actorId,
          public: input.reminder.public,
          notes: input.reminder.notes,
          order: input.reminder.order
        })
        break
      }
      case 'REMOVE_REMINDER':
        if (!(await repository.removeReminder(locked.id, input.reminderId)))
          throw new EncounterValidationError('Encounter reminder was not found.')
        break
      case 'ROLL_ENEMY_ACTION': {
        const actorRules = await currentActorRules()
        const current = requireActor(workingEncounter, input.actorId)
        if (current.kind === 'CHARACTER') {
          throw new EncounterValidationError('Enemy actions must target an enemy actor.')
        }
        const feature = snapshotFeatureDefinitions(current).find(
          (candidate) => candidate.id === input.featureId
        )
        const definition = feature?.rollDefinitions?.find(
          (candidate) => candidate.id === input.rollDefinitionId
        )
        if (!feature || !definition) {
          throw new EncounterValidationError('Enemy roll definition was not found.')
        }
        const resource = findEncounterFeatureResource(actorRules, current.id, feature.id)
        const maximum = resource?.maximum ?? null
        const used = featureChargeUsed(current, feature.id)
        if (definition.chargeCost) {
          if (maximum === null || used + definition.chargeCost > maximum) {
            throw new EncounterValidationError('The enemy feature does not have enough charges.')
          }
          await repository.updateActor({
            ...current,
            resources: withFeatureChargeUsed(current, feature.id, used + definition.chargeCost)
          })
        }
        const result = executeEnemyRoll(definition.expression, definition.rollMode ?? 'NORMAL')
        const ruleset = current.systemId ? await repository.findRuleset(current.systemId) : null
        if (!ruleset) throw new EncounterValidationError('Enemy system ruleset was not found.')
        rolled = {
          id: result.id,
          normalizedExpression: result.normalizedExpression,
          evidence: result.evidence,
          characterId: null,
          characterLabel: current.label,
          source: {
            kind: definition.kind,
            label: `${feature.label}: ${definition.label}`.slice(0, 80)
          },
          ruleset,
          createdAt: new Date().toISOString()
        }
        if (input.visibility === 'TABLE') {
          tableEntry = await insertPreEvaluatedCampaignTableRoll(
            trx,
            {
              campaignId: locked.campaignId,
              clientNonce: input.commandId,
              roll: rolled
            },
            userId
          )
        }
        break
      }
      case 'UPGRADE_RULE_PACK': {
        if (locked.status !== 'PREPARED') {
          throw new EncounterConflictError('Only prepared Encounters can change rule revisions.')
        }
        const revision = await requireCompatibleActiveRulePackRevision(
          trx,
          locked,
          input.revisionId
        )
        await repository.setRulePackRevision(locked.id, revision.id)
        break
      }
      case 'COMPLETE':
        if (locked.status !== 'ACTIVE')
          throw new EncounterConflictError('Only active Encounters can complete.')
        nextStatus = 'COMPLETED'
        nextCurrentActorId = null
        break
    }

    const nextVersion = locked.version + 1
    let ruleReceipt: { occurrenceId: string; resultChecksum: string } | null = null
    if (turnBoundaries) {
      if (input.type !== 'START' && input.type !== 'ADVANCE_TURN') {
        throw new EncounterConflictError('Turn-effect boundaries require a turn command.')
      }
      const turnCommandType = input.type
      const stagesOutgoingBeforeIncoming = turnCommandType === 'ADVANCE_TURN'
      const occurrenceId = turnOccurrenceId ?? options.createRuleOccurrenceId?.() ?? randomUUID()
      const frozenSource =
        stagesOutgoingBeforeIncoming || workingEncounter.automationMode === 'ASSISTED'
          ? await prepareFrozenActorRuleSource()
          : null
      const turnCoordinatorRoot: TurnRechargePendingContext['root'] = {
        rootCommandId: input.commandId,
        commandFingerprint,
        commandType: turnCommandType,
        initiatorUserId: userId,
        correlationId: null,
        expectedEncounterVersion: locked.version,
        startSystemId: turnCommandType === 'START' ? (input.systemId ?? null) : null,
        frozenActorRuleRevisionId: frozenSource?.revisionId ?? null,
        frozenActorRuleRevisionChecksum: frozenSource?.revisionChecksum ?? null,
        frozenActorRuleSnapshotChecksum: frozenSource?.snapshotChecksum ?? null,
        initiative: initiativeSettlement,
        initiativeAdvance: initiativeAdvancePlan,
        ...(stagedInitiativeApplication
          ? {
              stagedInitiative: {
                beforePin: stagedInitiativeApplication.beforePin,
                stagedRoundState: stagedInitiativeApplication.stagedRoundState
              }
            }
          : {}),
        completedRechargePlan: null,
        resolutionCommands: [],
        proposedTerminalTransition: {
          status: nextStatus as 'ACTIVE' | 'COMPLETED',
          round: nextRound,
          currentActorId: nextCurrentActorId
        }
      }
      let terminalCoordinatorRoot: TurnRechargePendingContext['root'] = turnCoordinatorRoot
      const enteringActorId = turnBoundaries.find(
        (boundary) => boundary.stage === 'START_OF_TURN'
      )?.actorId
      if (
        enteringActorId &&
        turnCommandType === 'START' &&
        workingEncounter.automationMode !== 'MANUAL' &&
        !(
          initiativeAdvancePlan?.kind === 'ROUND_WRAP' &&
          initiativeAdvancePlan.cadence === 'EACH_ROUND'
        )
      ) {
        const actorRules = await stageLegendaryActionRefreshesAtStart(
          enteringActorId,
          turnCoordinatorRoot
        )
        const candidates = await discoverEncounterRechargeCandidates({
          actorId: enteringActorId,
          encounterActors: workingEncounter.actors,
          actorRules,
          definitions: createReusableDefinitionRepository(trx)
        })
        if (candidates.length > 0) {
          if (!options.rulesRuntime)
            throw new EncounterValidationError('Recharge execution requires the rules runtime.')
          const selectionChecksum = rechargePlanSelectionChecksum(candidates)
          const completed: TurnRechargeExecution[] = []
          let index = 0
          while (index < candidates.length) {
            const candidate = candidates[index]!
            const execution = await executeEncounterRechargeCandidate({
              candidate,
              occurrenceId,
              definitions: createReusableDefinitionRepository(trx),
              runtime: options.rulesRuntime,
              mode: workingEncounter.automationMode,
              ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
            })
            if (execution?.kind === 'PENDING') {
              const pending = rechargePendingSnapshot({
                continuation: execution.continuation,
                root: turnCoordinatorRoot,
                selectionChecksum,
                completedExecutions: completed,
                currentCandidate: rechargePendingCandidate(candidate, index),
                remainingCandidates: candidates
                  .slice(index + 1)
                  .map((remaining, ordinal) =>
                    rechargePendingCandidate(remaining, index + ordinal + 1)
                  )
              })
              const occurrence = await createRuleOccurrenceRepository(trx).createPending({
                aggregateKind: 'ENCOUNTER',
                occurrenceId,
                aggregateId: locked.id,
                campaignId: locked.campaignId,
                rootCommandId: input.commandId,
                expectedAggregateVersion: locked.version,
                pendingSnapshot: pending
              })
              const projection = await repository.requireCurrentProjection({
                encounterId: locked.id,
                expectedStreamVersion: locked.version
              })
              return {
                command: encounterCommandResultDtoSchema.parse({
                  projection:
                    lockedContext.context.role === 'OWNER'
                      ? projection.projection
                      : projectPlayerEncounterProjection(projection.projection),
                  roll: null,
                  resolution: null,
                  occurrence: {
                    occurrenceId: occurrence.id,
                    occurrenceVersion: occurrence.version,
                    status: 'PENDING',
                    outcome: null,
                    pending: rechargePendingSummary(occurrence, locked.version)
                  }
                }),
                replayed: false,
                tableEntry: null,
                ruleSnapshot: projection.ruleSnapshot
              }
            }
            if (!execution)
              throw new EncounterConflictError('Recharge execution became unavailable.')
            completed.push(rechargeCompletedExecution({ ordinal: index, result: execution }))
            index += 1
          }
          const plan = completedRechargePlan(selectionChecksum, completed)
          if (!plan)
            throw new EncounterConflictError('Recharge plan did not retain terminal evidence.')
          const staged = stageCompletedRechargePlan({
            encounter: workingEncounter,
            actorRules,
            plan,
            currentActorId: enteringActorId
          })
          workingEncounter = staged.encounter
          if (staged.actor) stagedActorUpdates.set(staged.actor.id, staged.actor)
          turnCoordinatorRoot.completedRechargePlan = plan
        }
      }
      const turnEvaluation =
        stagesOutgoingBeforeIncoming || workingEncounter.automationMode === 'ASSISTED'
          ? await evaluateEncounterTurnCharacterActiveEffects({
              trx,
              actorUserId: userId,
              encounter: workingEncounter,
              commandType: turnCommandType,
              boundaries: turnBoundaries,
              occurrenceId,
              runtime: options.rulesRuntime,
              attunementSlotOverride: lockedContext.context.attunementSlotOverride,
              getEncounterActorSnapshot: async () => ({
                rules: await currentActorRules(false),
                encounter: workingEncounter
              }),
              coordinatorRoot: turnCoordinatorRoot,
              rollD20: options.rollD20
            })
          : null
      if (turnEvaluation?.kind === 'PENDING') {
        const occurrences = createRuleOccurrenceRepository(trx)
        const occurrence = await occurrences.createPending({
          aggregateKind: 'ENCOUNTER',
          occurrenceId,
          aggregateId: locked.id,
          campaignId: locked.campaignId,
          rootCommandId: input.commandId,
          expectedAggregateVersion: locked.version,
          pendingSnapshot: turnEvaluation.pendingSnapshot
        })
        const pendingSnapshot = requireEncounterKernelPendingSnapshot(occurrence.pendingSnapshot)
        const context = pendingSnapshot.applicationContext
        if (
          context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
          !context.currentCandidate.d20Policy
        ) {
          throw new EncounterConflictError('Turn-effect occurrence did not retain its d20 policy.')
        }
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.id,
          expectedStreamVersion: locked.version
        })
        return {
          command: encounterCommandResultDtoSchema.parse({
            projection:
              lockedContext.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: occurrence.id,
              occurrenceVersion: occurrence.version,
              status: 'PENDING',
              outcome: null,
              pending: {
                kind: 'D20_EVIDENCE',
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                encounterVersion: locked.version,
                request: {
                  requestId: pendingSnapshot.request.requestId,
                  min: 1,
                  max: 20,
                  rollMode: context.currentCandidate.d20Policy.rollMode
                },
                allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
              }
            }
          }),
          replayed: false,
          tableEntry: null,
          ruleSnapshot: projection.ruleSnapshot
        }
      }
      let stagedOutgoingBatch: Parameters<typeof applyEvaluatedTurnEffectBatch>[0]['batch'] | null =
        null
      let turnEffects =
        turnEvaluation?.kind === 'READY'
          ? {
              selectionChecksum: turnEvaluation.batch.selectionChecksum,
              result: stagesOutgoingBeforeIncoming
                ? null
                : await applyEvaluatedTurnEffectBatch({
                    trx,
                    actorUserId: userId,
                    encounter: workingEncounter,
                    commandType: turnCommandType,
                    occurrenceId,
                    batch: turnEvaluation.batch
                  })
            }
          : turnEvaluation
            ? {
                result: turnEvaluation.result,
                selectionChecksum: turnEvaluation.selectionChecksum
              }
            : await executeEncounterTurnCharacterActiveEffects({
                trx,
                actorUserId: userId,
                encounter: workingEncounter,
                commandType: turnCommandType,
                boundaries: turnBoundaries,
                occurrenceId,
                runtime: options.rulesRuntime,
                attunementSlotOverride: lockedContext.context.attunementSlotOverride,
                getEncounterActorSnapshot: async () => ({
                  rules: await currentActorRules(false),
                  encounter: workingEncounter
                }),
                rollD20: options.rollD20
              })

      if (turnEvaluation?.kind === 'READY' && stagesOutgoingBeforeIncoming) {
        stagedOutgoingBatch = turnEvaluation.batch
        // The terminal writer remains deferred so an initiative/recharge pause is
        // atomic, but subsequent round work must observe the completed outgoing
        // effect state. Recompute actor rules from that pure staged projection.
        workingEncounter = projectEncounterAfterEvaluatedTurnEffectBatch(
          workingEncounter,
          stagedOutgoingBatch
        )
        actorRuleSnapshot = undefined
        const foldedSource = await prepareFrozenActorRuleSource()
        turnCoordinatorRoot.frozenActorRuleRevisionId = foldedSource.revisionId
        turnCoordinatorRoot.frozenActorRuleRevisionChecksum = foldedSource.revisionChecksum
        turnCoordinatorRoot.frozenActorRuleSnapshotChecksum = foldedSource.snapshotChecksum
      }

      if (
        initiativeAdvancePlan?.kind === 'ROUND_WRAP' &&
        initiativeAdvancePlan.cadence === 'EACH_ROUND'
      ) {
        const outgoingTurn = pendingTurnPhase({
          selectionChecksum: turnEffects.selectionChecksum,
          result: turnEffects.result,
          ...(stagedOutgoingBatch ? { executions: stagedOutgoingBatch.executions } : {})
        })
        if (locked.currentActorId && workingEncounter.automationMode !== 'MANUAL') {
          if (!options.rulesRuntime)
            throw new EncounterValidationError(
              'Legendary Action discovery requires the rules runtime.'
            )
          const legendary = await discoverEncounterLegendaryActionWindows({
            trx,
            encounter: workingEncounter,
            outgoingActorId: locked.currentActorId,
            occurrenceId,
            actorRules: await currentActorRules(false),
            runtime: options.rulesRuntime,
            attunementSlotOverride: lockedContext.context.attunementSlotOverride
          })
          const firstLegendaryWindow = legendary.windows[0]
          if (firstLegendaryWindow) {
            const occurrence = await createRuleOccurrenceRepository(trx).createPending({
              aggregateKind: 'ENCOUNTER',
              occurrenceId,
              aggregateId: locked.id,
              campaignId: locked.campaignId,
              rootCommandId: input.commandId,
              expectedAggregateVersion: locked.version,
              pendingSnapshot: createEncounterLegendaryActionChoicePendingSnapshot({
                occurrenceId,
                root: {
                  ...turnCoordinatorRoot,
                  outgoingTurn,
                  legendaryActionQueue: {
                    ownerActorIds: legendary.windows.map((window) => window.choice.ownerActorId),
                    nextOwnerIndex: 0
                  }
                },
                choice: firstLegendaryWindow.choice
              })
            })
            const projection = await repository.requireCurrentProjection({
              encounterId: locked.id,
              expectedStreamVersion: locked.version
            })
            return {
              command: encounterCommandResultDtoSchema.parse({
                projection:
                  lockedContext.context.role === 'OWNER'
                    ? projection.projection
                    : projectPlayerEncounterProjection(projection.projection),
                roll: null,
                resolution: null,
                occurrence: {
                  occurrenceId: occurrence.id,
                  occurrenceVersion: occurrence.version,
                  status: 'PENDING',
                  outcome: null,
                  pending:
                    lockedContext.context.role === 'OWNER'
                      ? legendaryActionPendingSummary(occurrence, locked.version)
                      : null
                }
              }),
              replayed: false,
              tableEntry: null,
              ruleSnapshot: projection.ruleSnapshot
            }
          }
        }
        const beforePin: InitiativeBeforePinDto = {
          kind: 'EACH_ROUND',
          round: initiativeAdvancePlan.round,
          version: locked.version,
          checksum: initiativeAdvancePlan.stateChecksum,
          actorIds: locked.actors.map((actor) => actor.id).sort()
        }
        const stagedRoundState = createStagedInitiativeRoundState({
          encounter: workingEncounter,
          round: initiativeAdvancePlan.nextRound
        })
        const initiativeRules = await currentActorRules(false)
        const initiative = await startEncounterInitiativeCommand({
          trx,
          repository,
          encounter: workingEncounter,
          round: initiativeAdvancePlan.nextRound,
          occurrenceId,
          runtime: options.rulesRuntime ?? null,
          attunementSlotOverride: lockedContext.context.attunementSlotOverride,
          getEncounterActorSnapshot: async () => ({
            rules: initiativeRules,
            encounter: workingEncounter
          }),
          legacyOrderedActorIds: initiativeAdvancePlan.orderedActorIds,
          stagedRoundState,
          allowDeclarationPending: true,
          integerSource: ({ min, max }) =>
            min === 1 && max === 20 && options.rollD20 ? options.rollD20() : randomInt(min, max + 1)
        })
        if (initiative.kind === 'PENDING') {
          if (!workingEncounter.initiativePolicySnapshotChecksum)
            throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
          const occurrences = createRuleOccurrenceRepository(trx)
          const pendingSnapshot = createEncounterInitiativePendingSnapshot({
            root: {
              rootCommandId: input.commandId,
              commandFingerprint,
              commandType: 'ADVANCE_TURN',
              initiatorUserId: userId,
              correlationId: null,
              expectedEncounterVersion: locked.version,
              round: initiativeAdvancePlan.nextRound,
              policySnapshotChecksum: workingEncounter.initiativePolicySnapshotChecksum,
              initiativeBeforePin: beforePin,
              stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
              startSystemId: null,
              initiativeAdvance: initiativeAdvancePlan,
              outgoingTurn,
              resolutionCommands: []
            },
            pending: initiative.pending
          })
          const occurrence = await occurrences.createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: requireEncounterKernelPendingSnapshot(
                    occurrence.pendingSnapshot
                  ),
                  occurrenceVersion: occurrence.version,
                  encounterVersion: locked.version
                })
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }
        if (initiative.kind === 'DECLARATION_PENDING') {
          if (!workingEncounter.initiativePolicySnapshotChecksum)
            throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
          const participant = initiative.state.participants.find(
            (candidate) => candidate.actorId === initiative.actorId
          )
          if (!participant)
            throw new EncounterConflictError('Initiative declaration is unavailable.')
          const request = createEncounterInitiativeDeclarationRequest({
            requestId: `initiative-declaration:${occurrenceId}:${initiative.actorId}`,
            encounterId: locked.id,
            round: initiativeAdvancePlan.nextRound,
            actorId: initiative.actorId,
            participantExpectedVersion: participant.version,
            controllerUserId: await initiativeDeclarationControllerUserId({
              db: trx,
              locked: lockedContext,
              source: initiative.source
            }),
            source: initiative.source
          })
          const occurrences = createRuleOccurrenceRepository(trx)
          const occurrence = await occurrences.createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot: createEncounterInitiativeDeclarationPendingSnapshot({
              occurrenceId,
              root: {
                rootCommandId: input.commandId,
                commandFingerprint,
                commandType: 'ADVANCE_TURN',
                initiatorUserId: userId,
                correlationId: null,
                expectedEncounterVersion: locked.version,
                round: initiativeAdvancePlan.nextRound,
                policySnapshotChecksum: workingEncounter.initiativePolicySnapshotChecksum,
                initiativeBeforePin: beforePin,
                stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
                startSystemId: null,
                initiativeAdvance: initiativeAdvancePlan,
                outgoingTurn,
                resolutionCommands: []
              },
              request
            })
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: projectEncounterInitiativePendingSummary({
                  pendingSnapshot: occurrence.pendingSnapshot!,
                  occurrenceVersion: occurrence.version,
                  encounterVersion: locked.version
                })
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }

        initiativeSettlement = encounterInitiativeSettlementDtoSchema.parse({
          round: initiative.state.round.round,
          cadence: initiative.state.round.cadence,
          procedure: initiative.state.round.procedure,
          policySnapshotChecksum: initiative.state.round.policySnapshotChecksum,
          orderedActorIds: initiative.orderedActorIds,
          orderedSideIds: initiative.orderedSideIds,
          evidence: initiative.evidence
        })
        stagedInitiativeApplication = {
          beforePin,
          stagedRoundState: serializeStagedInitiativeRoundState(initiative.state),
          initiativeAdvance: initiativeAdvancePlan
        }
        nextRound = initiativeSettlement.round
        nextCurrentActorId = initiativeSettlement.orderedActorIds[0] ?? null
        const incomingFrozenSource =
          workingEncounter.automationMode === 'ASSISTED'
            ? await prepareFrozenActorRuleSource()
            : null
        const incomingCoordinatorRoot: TurnRechargePendingContext['root'] = {
          rootCommandId: input.commandId,
          commandFingerprint,
          commandType: 'ADVANCE_TURN',
          initiatorUserId: userId,
          correlationId: null,
          expectedEncounterVersion: locked.version,
          startSystemId: null,
          frozenActorRuleRevisionId: incomingFrozenSource?.revisionId ?? null,
          frozenActorRuleRevisionChecksum: incomingFrozenSource?.revisionChecksum ?? null,
          frozenActorRuleSnapshotChecksum: incomingFrozenSource?.snapshotChecksum ?? null,
          initiative: initiativeSettlement,
          initiativeAdvance: initiativeAdvancePlan,
          stagedInitiative: {
            beforePin,
            stagedRoundState: serializeStagedInitiativeRoundState(initiative.state)
          },
          outgoingTurn,
          completedRechargePlan: null,
          resolutionCommands: [],
          proposedTerminalTransition: {
            status: 'ACTIVE',
            round: nextRound,
            currentActorId: nextCurrentActorId
          }
        }
        terminalCoordinatorRoot = incomingCoordinatorRoot
        if (nextCurrentActorId && workingEncounter.automationMode !== 'MANUAL') {
          const actorRules = await stageLegendaryActionRefreshesAtStart(
            nextCurrentActorId,
            incomingCoordinatorRoot
          )
          const candidates = await discoverEncounterRechargeCandidates({
            actorId: nextCurrentActorId,
            encounterActors: workingEncounter.actors,
            actorRules,
            definitions: createReusableDefinitionRepository(trx)
          })
          if (candidates.length > 0) {
            if (!options.rulesRuntime)
              throw new EncounterValidationError('Recharge execution requires the rules runtime.')
            const selectionChecksum = rechargePlanSelectionChecksum(candidates)
            const completed: TurnRechargeExecution[] = []
            for (const [ordinal, candidate] of candidates.entries()) {
              const execution = await executeEncounterRechargeCandidate({
                candidate,
                occurrenceId,
                definitions: createReusableDefinitionRepository(trx),
                runtime: options.rulesRuntime,
                mode: workingEncounter.automationMode,
                ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
              })
              if (execution?.kind === 'PENDING') {
                const pending = rechargePendingSnapshot({
                  continuation: execution.continuation,
                  root: incomingCoordinatorRoot,
                  selectionChecksum,
                  completedExecutions: completed,
                  currentCandidate: rechargePendingCandidate(candidate, ordinal),
                  remainingCandidates: candidates
                    .slice(ordinal + 1)
                    .map((remaining, remainingOrdinal) =>
                      rechargePendingCandidate(remaining, ordinal + remainingOrdinal + 1)
                    )
                })
                const occurrence = await createRuleOccurrenceRepository(trx).createPending({
                  aggregateKind: 'ENCOUNTER',
                  occurrenceId,
                  aggregateId: locked.id,
                  campaignId: locked.campaignId,
                  rootCommandId: input.commandId,
                  expectedAggregateVersion: locked.version,
                  pendingSnapshot: pending
                })
                const projection = await repository.requireCurrentProjection({
                  encounterId: locked.id,
                  expectedStreamVersion: locked.version
                })
                return {
                  command: encounterCommandResultDtoSchema.parse({
                    projection:
                      lockedContext.context.role === 'OWNER'
                        ? projection.projection
                        : projectPlayerEncounterProjection(projection.projection),
                    roll: null,
                    resolution: null,
                    occurrence: {
                      occurrenceId: occurrence.id,
                      occurrenceVersion: occurrence.version,
                      status: 'PENDING',
                      outcome: null,
                      pending: rechargePendingSummary(occurrence, locked.version)
                    }
                  }),
                  replayed: false,
                  tableEntry: null,
                  ruleSnapshot: projection.ruleSnapshot
                }
              }
              if (!execution)
                throw new EncounterConflictError('Recharge execution became unavailable.')
              completed.push(rechargeCompletedExecution({ ordinal, result: execution }))
            }
            const plan = completedRechargePlan(selectionChecksum, completed)
            if (!plan)
              throw new EncounterConflictError('Recharge plan did not retain terminal evidence.')
            const staged = stageCompletedRechargePlan({
              encounter: workingEncounter,
              actorRules,
              plan,
              currentActorId: nextCurrentActorId
            })
            workingEncounter = staged.encounter
            if (staged.actor) stagedActorUpdates.set(staged.actor.id, staged.actor)
            incomingCoordinatorRoot.completedRechargePlan = plan
          }
        }
        const incomingEvaluation =
          workingEncounter.automationMode === 'ASSISTED'
            ? await evaluateEncounterTurnCharacterActiveEffects({
                trx,
                actorUserId: userId,
                encounter: workingEncounter,
                commandType: 'ADVANCE_TURN',
                boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: nextCurrentActorId }],
                occurrenceId,
                runtime: options.rulesRuntime,
                attunementSlotOverride: lockedContext.context.attunementSlotOverride,
                getEncounterActorSnapshot: async () => ({
                  rules: await currentActorRules(false),
                  encounter: workingEncounter
                }),
                coordinatorRoot: incomingCoordinatorRoot,
                rollD20: options.rollD20
              })
            : null
        if (incomingEvaluation?.kind === 'PENDING') {
          const occurrences = createRuleOccurrenceRepository(trx)
          const occurrence = await occurrences.createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot: incomingEvaluation.pendingSnapshot
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: turnPendingSummary(occurrence, locked.version)
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }
        if (!stagedInitiativeApplication) {
          throw new EncounterConflictError('Staged each-round initiative is unavailable.')
        }
        const appliedInitiative = await applyStagedInitiativeState({
          repository,
          encounter: locked,
          beforePin: stagedInitiativeApplication.beforePin,
          stagedRoundState: stagedInitiativeApplication.stagedRoundState,
          initiativeAdvance: initiativeAdvancePlan
        })
        if (
          appliedInitiative.round.round !== nextRound ||
          appliedInitiative.participants.find((participant) => participant.status === 'ACTIVE')
            ?.actorId !== nextCurrentActorId
        ) {
          throw new EncounterConflictError(
            'Staged initiative did not settle the expected turn cursor.'
          )
        }
        stagedInitiativeApplication = null
        const restoredOutgoingResult =
          outgoingTurn.kind === 'STAGED'
            ? await applyEvaluatedTurnEffectBatch({
                trx,
                actorUserId: userId,
                encounter: workingEncounter,
                commandType: 'ADVANCE_TURN',
                occurrenceId,
                batch:
                  stagedOutgoingBatch ??
                  (() => {
                    throw new EncounterConflictError('The staged outgoing turn is unavailable.')
                  })()
              })
            : null
        const incomingTurn =
          incomingEvaluation?.kind === 'READY'
            ? {
                selectionChecksum: incomingEvaluation.batch.selectionChecksum,
                result: await applyEvaluatedTurnEffectBatch({
                  trx,
                  actorUserId: userId,
                  encounter: workingEncounter,
                  commandType: 'ADVANCE_TURN',
                  occurrenceId,
                  batch: incomingEvaluation.batch
                })
              }
            : incomingEvaluation
              ? {
                  selectionChecksum: incomingEvaluation.selectionChecksum,
                  result: incomingEvaluation.result
                }
              : await executeEncounterTurnCharacterActiveEffects({
                  trx,
                  actorUserId: userId,
                  encounter: workingEncounter,
                  commandType: 'ADVANCE_TURN',
                  boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: nextCurrentActorId }],
                  occurrenceId,
                  runtime: options.rulesRuntime,
                  attunementSlotOverride: lockedContext.context.attunementSlotOverride,
                  getEncounterActorSnapshot: async () => ({
                    rules: await currentActorRules(false),
                    encounter: workingEncounter
                  }),
                  rollD20: options.rollD20
                })
        const outgoingEvidence = completedPendingTurnPhaseEvidence({
          phase: outgoingTurn,
          restoredResult: restoredOutgoingResult
        })
        const incomingEvidence = completedTurnPhaseEvidence(incomingTurn)
        turnEffects = {
          selectionChecksum: turnLifecycleSelectionChecksum({
            outgoing: outgoingEvidence,
            incoming: incomingEvidence
          }),
          result: storedRuleExecutionResultDtoSchema.parse({
            status: 'TURN_LIFECYCLE_COMPLETE',
            schemaVersion: 1,
            occurrenceId,
            occurrenceVersion: 0,
            encounterId: locked.id,
            commandType: 'ADVANCE_TURN',
            initiativeAdvance: initiativeAdvancePlan,
            initiative: initiativeSettlement,
            rechargeExecutions: rechargeExecutionsForRoot(turnCoordinatorRoot),
            outgoingTurn: outgoingEvidence,
            incomingTurn: incomingEvidence
          })
        }
      } else if (stagesOutgoingBeforeIncoming) {
        const outgoingTurn = pendingTurnPhase({
          selectionChecksum: turnEffects.selectionChecksum,
          result: turnEffects.result,
          ...(stagedOutgoingBatch ? { executions: stagedOutgoingBatch.executions } : {})
        })
        const incomingCoordinatorRoot: TurnRechargePendingContext['root'] = {
          ...turnCoordinatorRoot,
          outgoingTurn
        }
        terminalCoordinatorRoot = incomingCoordinatorRoot
        if (locked.currentActorId && workingEncounter.automationMode !== 'MANUAL') {
          if (!options.rulesRuntime)
            throw new EncounterValidationError(
              'Legendary Action discovery requires the rules runtime.'
            )
          const legendary = await discoverEncounterLegendaryActionWindows({
            trx,
            encounter: workingEncounter,
            outgoingActorId: locked.currentActorId,
            occurrenceId,
            actorRules: await currentActorRules(false),
            runtime: options.rulesRuntime,
            attunementSlotOverride: lockedContext.context.attunementSlotOverride
          })
          const firstLegendaryWindow = legendary.windows[0]
          if (firstLegendaryWindow) {
            const occurrence = await createRuleOccurrenceRepository(trx).createPending({
              aggregateKind: 'ENCOUNTER',
              occurrenceId,
              aggregateId: locked.id,
              campaignId: locked.campaignId,
              rootCommandId: input.commandId,
              expectedAggregateVersion: locked.version,
              pendingSnapshot: createEncounterLegendaryActionChoicePendingSnapshot({
                occurrenceId,
                root: {
                  ...incomingCoordinatorRoot,
                  legendaryActionQueue: {
                    ownerActorIds: legendary.windows.map((window) => window.choice.ownerActorId),
                    nextOwnerIndex: 0
                  }
                },
                choice: firstLegendaryWindow.choice
              })
            })
            const projection = await repository.requireCurrentProjection({
              encounterId: locked.id,
              expectedStreamVersion: locked.version
            })
            return {
              command: encounterCommandResultDtoSchema.parse({
                projection:
                  lockedContext.context.role === 'OWNER'
                    ? projection.projection
                    : projectPlayerEncounterProjection(projection.projection),
                roll: null,
                resolution: null,
                occurrence: {
                  occurrenceId: occurrence.id,
                  occurrenceVersion: occurrence.version,
                  status: 'PENDING',
                  outcome: null,
                  pending:
                    lockedContext.context.role === 'OWNER'
                      ? legendaryActionPendingSummary(occurrence, locked.version)
                      : null
                }
              }),
              replayed: false,
              tableEntry: null,
              ruleSnapshot: projection.ruleSnapshot
            }
          }
        }
        if (nextCurrentActorId && workingEncounter.automationMode !== 'MANUAL') {
          const actorRules = await stageLegendaryActionRefreshesAtStart(
            nextCurrentActorId,
            incomingCoordinatorRoot
          )
          const candidates = await discoverEncounterRechargeCandidates({
            actorId: nextCurrentActorId,
            encounterActors: workingEncounter.actors,
            actorRules,
            definitions: createReusableDefinitionRepository(trx)
          })
          if (candidates.length > 0) {
            if (!options.rulesRuntime)
              throw new EncounterValidationError('Recharge execution requires the rules runtime.')
            const selectionChecksum = rechargePlanSelectionChecksum(candidates)
            const completed: TurnRechargeExecution[] = []
            for (const [ordinal, candidate] of candidates.entries()) {
              const execution = await executeEncounterRechargeCandidate({
                candidate,
                occurrenceId,
                definitions: createReusableDefinitionRepository(trx),
                runtime: options.rulesRuntime,
                mode: workingEncounter.automationMode,
                ...(options.rollD6 ? { rollD6: options.rollD6 } : {})
              })
              if (execution?.kind === 'PENDING') {
                const pending = rechargePendingSnapshot({
                  continuation: execution.continuation,
                  root: incomingCoordinatorRoot,
                  selectionChecksum,
                  completedExecutions: completed,
                  currentCandidate: rechargePendingCandidate(candidate, ordinal),
                  remainingCandidates: candidates
                    .slice(ordinal + 1)
                    .map((remaining, remainingOrdinal) =>
                      rechargePendingCandidate(remaining, ordinal + remainingOrdinal + 1)
                    )
                })
                const occurrence = await createRuleOccurrenceRepository(trx).createPending({
                  aggregateKind: 'ENCOUNTER',
                  occurrenceId,
                  aggregateId: locked.id,
                  campaignId: locked.campaignId,
                  rootCommandId: input.commandId,
                  expectedAggregateVersion: locked.version,
                  pendingSnapshot: pending
                })
                const projection = await repository.requireCurrentProjection({
                  encounterId: locked.id,
                  expectedStreamVersion: locked.version
                })
                return {
                  command: encounterCommandResultDtoSchema.parse({
                    projection:
                      lockedContext.context.role === 'OWNER'
                        ? projection.projection
                        : projectPlayerEncounterProjection(projection.projection),
                    roll: null,
                    resolution: null,
                    occurrence: {
                      occurrenceId: occurrence.id,
                      occurrenceVersion: occurrence.version,
                      status: 'PENDING',
                      outcome: null,
                      pending: rechargePendingSummary(occurrence, locked.version)
                    }
                  }),
                  replayed: false,
                  tableEntry: null,
                  ruleSnapshot: projection.ruleSnapshot
                }
              }
              if (!execution)
                throw new EncounterConflictError('Recharge execution became unavailable.')
              completed.push(rechargeCompletedExecution({ ordinal, result: execution }))
            }
            const plan = completedRechargePlan(selectionChecksum, completed)
            if (!plan)
              throw new EncounterConflictError('Recharge plan did not retain terminal evidence.')
            const staged = stageCompletedRechargePlan({
              encounter: workingEncounter,
              actorRules,
              plan,
              currentActorId: nextCurrentActorId
            })
            workingEncounter = staged.encounter
            if (staged.actor) stagedActorUpdates.set(staged.actor.id, staged.actor)
            incomingCoordinatorRoot.completedRechargePlan = plan
          }
        }
        const incomingEvaluation = await evaluateEncounterTurnCharacterActiveEffects({
          trx,
          actorUserId: userId,
          encounter: workingEncounter,
          commandType: 'ADVANCE_TURN',
          boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: nextCurrentActorId }],
          occurrenceId,
          runtime: options.rulesRuntime,
          attunementSlotOverride: lockedContext.context.attunementSlotOverride,
          getEncounterActorSnapshot: async () => ({
            rules: await currentActorRules(false),
            encounter: workingEncounter
          }),
          coordinatorRoot: incomingCoordinatorRoot,
          rollD20: options.rollD20
        })
        if (incomingEvaluation.kind === 'PENDING') {
          const occurrence = await createRuleOccurrenceRepository(trx).createPending({
            aggregateKind: 'ENCOUNTER',
            occurrenceId,
            aggregateId: locked.id,
            campaignId: locked.campaignId,
            rootCommandId: input.commandId,
            expectedAggregateVersion: locked.version,
            pendingSnapshot: incomingEvaluation.pendingSnapshot
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: locked.id,
            expectedStreamVersion: locked.version
          })
          return {
            command: encounterCommandResultDtoSchema.parse({
              projection:
                lockedContext.context.role === 'OWNER'
                  ? projection.projection
                  : projectPlayerEncounterProjection(projection.projection),
              roll: null,
              resolution: null,
              occurrence: {
                occurrenceId: occurrence.id,
                occurrenceVersion: occurrence.version,
                status: 'PENDING',
                outcome: null,
                pending: turnPendingSummary(occurrence, locked.version)
              }
            }),
            replayed: false,
            tableEntry: null,
            ruleSnapshot: projection.ruleSnapshot
          }
        }
        const restoredOutgoingResult =
          outgoingTurn.kind === 'STAGED'
            ? await applyEvaluatedTurnEffectBatch({
                trx,
                actorUserId: userId,
                encounter: workingEncounter,
                commandType: 'ADVANCE_TURN',
                occurrenceId,
                batch:
                  stagedOutgoingBatch ??
                  (() => {
                    throw new EncounterConflictError('The staged outgoing turn is unavailable.')
                  })()
              })
            : null
        const incomingTurn =
          incomingEvaluation.kind === 'READY'
            ? {
                selectionChecksum: incomingEvaluation.batch.selectionChecksum,
                result: await applyEvaluatedTurnEffectBatch({
                  trx,
                  actorUserId: userId,
                  encounter: workingEncounter,
                  commandType: 'ADVANCE_TURN',
                  occurrenceId,
                  batch: incomingEvaluation.batch
                })
              }
            : {
                selectionChecksum: incomingEvaluation.selectionChecksum,
                result: incomingEvaluation.result
              }
        const outgoingEvidence = completedPendingTurnPhaseEvidence({
          phase: outgoingTurn,
          restoredResult: restoredOutgoingResult
        })
        const incomingEvidence = completedTurnPhaseEvidence(incomingTurn)
        turnEffects = {
          selectionChecksum: turnLifecycleSelectionChecksum({
            outgoing: outgoingEvidence,
            incoming: incomingEvidence
          }),
          result: storedRuleExecutionResultDtoSchema.parse({
            status: 'TURN_LIFECYCLE_COMPLETE',
            schemaVersion: 1,
            occurrenceId,
            occurrenceVersion: 0,
            encounterId: locked.id,
            commandType: 'ADVANCE_TURN',
            initiativeAdvance: initiativeAdvancePlan,
            initiative: initiativeSettlement,
            rechargeExecutions: rechargeExecutionsForRoot(incomingCoordinatorRoot),
            outgoingTurn: outgoingEvidence,
            legendaryActions: [],
            legendaryActionRefreshes: incomingCoordinatorRoot.stagedLegendaryActionRefreshes ?? [],
            incomingTurn: incomingEvidence
          })
        }
      }
      const terminalTurnResult = turnEffects.result
        ? storedRuleExecutionResultDtoSchema.parse({
            ...turnEffects.result,
            initiative: initiativeSettlement,
            initiativeAdvance: initiativeAdvancePlan,
            rechargeExecutions: rechargeExecutionsForRoot(terminalCoordinatorRoot)
          })
        : initiativeSettlement || initiativeAdvancePlan
          ? storedRuleExecutionResultDtoSchema.parse({
              status: 'INITIATIVE_COMPLETE',
              schemaVersion: 1,
              occurrenceId,
              occurrenceVersion: 0,
              encounterId: locked.id,
              commandType: turnCommandType,
              initiative: initiativeSettlement,
              initiativeAdvance: initiativeAdvancePlan
            })
          : null
      if (stagedInitiativeApplication) {
        const appliedInitiative = await applyStagedInitiativeState({
          repository,
          encounter: locked,
          beforePin: stagedInitiativeApplication.beforePin,
          stagedRoundState: stagedInitiativeApplication.stagedRoundState,
          ...(stagedInitiativeApplication.initiativeAdvance
            ? { initiativeAdvance: stagedInitiativeApplication.initiativeAdvance }
            : {})
        })
        if (
          appliedInitiative.round.round !== nextRound ||
          appliedInitiative.participants.find((participant) => participant.status === 'ACTIVE')
            ?.actorId !== nextCurrentActorId
        ) {
          throw new EncounterConflictError(
            'Staged initiative did not settle the expected turn cursor.'
          )
        }
      }
      if (
        initiativeAdvancePlan &&
        !(
          initiativeAdvancePlan.kind === 'ROUND_WRAP' &&
          initiativeAdvancePlan.cadence === 'EACH_ROUND'
        )
      ) {
        const advanced = await applyEncounterInitiativeAdvanceCommand({
          repository,
          encounterId: locked.id,
          plan: initiativeAdvancePlan
        })
        if (advanced.round !== nextRound || advanced.currentActorId !== nextCurrentActorId)
          throw new EncounterConflictError(
            'Normalized initiative advancement did not settle exactly.'
          )
      }
      if (terminalTurnResult) {
        const occurrences = createRuleOccurrenceRepository(trx)
        await occurrences.createCompleted({
          aggregateKind: 'ENCOUNTER',
          occurrenceId,
          aggregateId: locked.id,
          campaignId: locked.campaignId,
          rootCommandId: input.commandId,
          aggregateVersion: nextVersion
        })
        await occurrences.appendReceipt({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.id,
          commandId: input.commandId,
          commandFingerprint,
          occurrenceId,
          aggregateVersion: nextVersion,
          commandMetadata: {
            schemaVersion: 1,
            transition: 'TURN_EFFECTS',
            commandType: turnCommandType,
            expectedAggregateVersion: locked.version,
            selectionChecksum: turnEffects.selectionChecksum,
            initiativeChecksum:
              initiativeSettlement === null ? null : checksumCanonicalJson(initiativeSettlement),
            initiativeAdvanceChecksum:
              initiativeAdvancePlan === null ? null : checksumCanonicalJson(initiativeAdvancePlan),
            terminalOccurrenceVersion: 0,
            resolutionCommands: []
          },
          resultPayload: terminalTurnResult,
          actorUserId: userId,
          correlationId: null,
          commandType: turnCommandType
        })
        ruleReceipt = {
          occurrenceId,
          resultChecksum: checksumCanonicalJson(terminalTurnResult)
        }
      }
    }
    if (maintenanceCleanup) {
      if (input.type !== 'REMOVE_ACTOR')
        throw new EncounterConflictError('Maintenance cleanup requires actor removal.')
      const occurrenceId = options.createRuleOccurrenceId?.() ?? randomUUID()
      const result = storedRuleExecutionResultDtoSchema.parse({
        status: 'MAINTENANCE_COMPLETE',
        schemaVersion: 1,
        occurrenceId,
        occurrenceVersion: 0,
        encounterId: locked.id,
        removedActorId: input.actorId,
        reason: 'ACTOR_REMOVED',
        ...maintenanceCleanup
      })
      const occurrences = createRuleOccurrenceRepository(trx)
      await occurrences.createCompleted({
        aggregateKind: 'ENCOUNTER',
        occurrenceId,
        aggregateId: locked.id,
        campaignId: locked.campaignId,
        rootCommandId: input.commandId,
        aggregateVersion: nextVersion
      })
      await occurrences.appendReceipt({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.id,
        commandId: input.commandId,
        commandFingerprint,
        occurrenceId,
        aggregateVersion: nextVersion,
        commandMetadata: {
          schemaVersion: 1,
          transition: 'MAINTENANCE_CLEANUP',
          commandType: 'REMOVE_ACTOR',
          expectedAggregateVersion: locked.version,
          removedActorId: input.actorId
        },
        resultPayload: result,
        actorUserId: userId,
        correlationId: null,
        commandType: 'REMOVE_ACTOR'
      })
      ruleReceipt = {
        occurrenceId,
        resultChecksum: checksumCanonicalJson(result)
      }
    }
    for (const actor of stagedLegendaryRefreshActorUpdates.values())
      await repository.updateActor(actor)
    for (const actor of stagedActorUpdates.values()) await repository.updateActor(actor)
    await repository.update({
      encounterId: locked.id,
      status: nextStatus,
      version: nextVersion,
      round: nextRound,
      currentActorId: nextCurrentActorId
    })
    const updated = await repository.find(locked.id)
    if (!updated) throw new EncounterNotFoundError()
    const refreshedSnapshot = actorRuleSnapshot
      ? refreshEncounterActorRuleSnapshot(actorRuleSnapshot, updated, actorRuleSnapshot.revisionId)
      : null
    const projectionRuleSnapshot =
      refreshedSnapshot ??
      (await evaluateActorSnapshot(
        updated,
        actorRuleSnapshot?.revisionId ?? updated.rulePackRevisionId,
        actorRuleSnapshot
      ))
    const projectionEncounter = updated
    const gmProjection = projectGm(projectionEncounter, projectionRuleSnapshot.output)
    const command = encounterCommandResultDtoSchema.parse({
      projection: gmProjection,
      roll: rolled,
      resolution
    })
    const currentProjection = compileEncounterCurrentProjection(
      gmProjection,
      projectionRuleSnapshot
    )
    await repository.publishCurrentProjection(currentProjection)
    await repository.appendEvent({
      id: randomUUID(),
      encounterId: projectionEncounter.id,
      campaignId: projectionEncounter.campaignId,
      version: nextVersion,
      commandId: input.commandId,
      commandType: input.type,
      commandFingerprint,
      commandPayload: input as unknown as Json,
      resultPayload: encounterProjectionEventSchema.parse({
        command,
        currentProjection,
        ruleReceipt,
        optionalCombatSnapshotChecksum: projectionEncounter.optionalCombatSnapshotChecksum
      }) as unknown as Json,
      actorUserId: userId,
      correlationId
    })
    return {
      command,
      replayed: false,
      tableEntry,
      ruleSnapshot:
        projectionEncounter.rulePackRevisionId === projectionRuleSnapshot.revisionId
          ? projectionRuleSnapshot
          : undefined
    }
  })
  if (tableEntry) {
    await broadcastCampaignInvalidation(db, tableEntry.campaignId, {
      scope: 'TABLE',
      entity: 'CHAT',
      entityId: tableEntry.id,
      event: 'CREATED',
      eventId: randomUUID(),
      cursor: tableEntry.createdAt
    })
  }
  options.onTiming?.({
    evaluationLane,
    actorEvaluationMs,
    actorZenEvaluationMs,
    actionEvaluationMs,
    actionZenEvaluationMs,
    totalMs: performance.now() - startedAt
  })
  return { replayed, response: command, ruleSnapshot }
}

export async function executeEncounterCommand(
  db: DBLike,
  userId: string,
  input: EncounterCommandInputDto,
  options: ExecuteEncounterCommandOptions = {}
): Promise<EncounterCommandResultDto> {
  return (await executeEncounterCommandWithRuleSnapshot(db, userId, input, options)).response
}

function turnPendingSummary(
  occurrence: Awaited<
    ReturnType<ReturnType<typeof createRuleOccurrenceRepository>['lockOccurrence']>
  >,
  encounterVersion: number
) {
  const pendingSnapshot = occurrence?.pendingSnapshot
  const context = pendingSnapshot?.applicationContext
  if (
    !occurrence ||
    !pendingSnapshot ||
    !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot) ||
    context?.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    !context.currentCandidate.d20Policy
  )
    return null
  return {
    kind: 'D20_EVIDENCE' as const,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    request: {
      requestId: pendingSnapshot.request.requestId,
      min: 1 as const,
      max: 20 as const,
      rollMode: context.currentCandidate.d20Policy.rollMode
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
  }
}

function legendaryActionPendingSummary(occurrence: RuleOccurrenceRecord, encounterVersion: number) {
  const pendingSnapshot = occurrence.pendingSnapshot
  if (
    occurrence.state !== 'PENDING' ||
    !pendingSnapshot ||
    !isServerAggregateChoicePendingSnapshot(pendingSnapshot) ||
    pendingSnapshot.applicationContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
  ) {
    return null
  }
  const choice = pendingSnapshot.applicationContext.choice
  return {
    kind: 'LEGENDARY_ACTION_CHOICE' as const,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    ownerActorId: choice.ownerActorId,
    options: choice.options.map(({ optionId, actionId, ownerFeatureId, targetActorId }) => ({
      optionId,
      actionId,
      ownerFeatureId,
      targetActorId
    })),
    allowedResponses: ['DECLINE', 'OPTION'] as const
  }
}

function legendaryActionEvidencePendingSummary(
  occurrence: RuleOccurrenceRecord,
  encounterVersion: number
) {
  const pendingSnapshot = occurrence.pendingSnapshot
  const context = pendingSnapshot?.applicationContext
  if (
    occurrence.state !== 'PENDING' ||
    !pendingSnapshot ||
    !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot) ||
    context?.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
    pendingSnapshot.request.kind !== 'INTEGER_RANGE' ||
    pendingSnapshot.request.min !== 1 ||
    pendingSnapshot.request.max !== 20
  ) {
    return null
  }
  return {
    kind: 'D20_EVIDENCE' as const,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    request: {
      requestId: pendingSnapshot.request.requestId,
      min: 1 as const,
      max: 20 as const,
      rollMode: context.d20Policy.rollMode
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
  }
}

function turnContinuationPendingSummary(
  occurrence: RuleOccurrenceRecord,
  encounterVersion: number
) {
  return (
    legendaryActionPendingSummary(occurrence, encounterVersion) ??
    legendaryActionEvidencePendingSummary(occurrence, encounterVersion) ??
    rechargePendingSummary(occurrence, encounterVersion) ??
    turnPendingSummary(occurrence, encounterVersion)
  )
}

function rechargePendingSummary(
  occurrence: Awaited<
    ReturnType<ReturnType<typeof createRuleOccurrenceRepository>['lockOccurrence']>
  >,
  encounterVersion: number
) {
  const pendingSnapshot = occurrence?.pendingSnapshot
  const context = pendingSnapshot?.applicationContext
  if (
    !occurrence ||
    !pendingSnapshot ||
    !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot) ||
    context?.kind !== 'ENCOUNTER_TURN_RECHARGE' ||
    pendingSnapshot.request.kind !== 'INTEGER_RANGE' ||
    pendingSnapshot.request.min !== 1 ||
    pendingSnapshot.request.max !== 6
  ) {
    return null
  }
  return {
    kind: 'RECHARGE_EVIDENCE' as const,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    request: {
      requestId: pendingSnapshot.request.requestId,
      min: 1 as const,
      max: 6 as const
    },
    allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL'] as const
  }
}

async function appendPendingRechargeResolutionReceipt(input: {
  occurrences: ReturnType<typeof createRuleOccurrenceRepository>
  encounterId: string
  command: RechargeResolveRuleOccurrenceCommand
  commandFingerprint: string
  actorUserId: string
  paused: RuleOccurrenceRecord
  encounterVersion: number
  root: TurnRechargePendingContext['root']
  resolutionCommand: {
    commandId: string
    commandFingerprint: string
    actorUserId: string
    correlationId: string | null
    expectedOccurrenceVersion: number
    requestId: string
    kind: 'ENTER_INTEGER' | 'SYSTEM_ROLL'
  }
}) {
  const pending = rechargePendingSummary(input.paused, input.encounterVersion)
  if (!pending) throw new EncounterConflictError('Recharge occurrence is unavailable.')
  const occurrence = {
    occurrenceId: input.paused.id,
    occurrenceVersion: input.paused.version,
    status: 'PENDING' as const,
    outcome: null,
    pending
  }
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'ENCOUNTER_OCCURRENCE_PENDING',
    schemaVersion: 1,
    occurrenceId: input.paused.id,
    occurrenceVersion: input.paused.version,
    encounterId: input.encounterId,
    encounterVersion: input.encounterVersion,
    occurrence,
    characterTransitions: []
  })
  await input.occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.encounterId,
    commandId: input.command.commandId,
    commandFingerprint: input.commandFingerprint,
    occurrenceId: input.paused.id,
    aggregateVersion: input.encounterVersion,
    commandType: input.command.type,
    actorUserId: input.actorUserId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS_PENDING',
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      rootCommandId: input.root.rootCommandId,
      rootCommandFingerprint: input.root.commandFingerprint,
      rootInitiatorUserId: input.root.initiatorUserId,
      rootCorrelationId: input.root.correlationId,
      expectedAggregateVersion: input.root.expectedEncounterVersion,
      occurrenceVersion: input.paused.version,
      resolutionCommand: input.resolutionCommand
    },
    resultPayload: result
  })
  return occurrence
}

async function appendPendingLegendaryResolutionReceipt(input: {
  occurrences: ReturnType<typeof createRuleOccurrenceRepository>
  encounterId: string
  command: MovementReactionResolveRuleOccurrenceCommand | D20ResolveRuleOccurrenceCommand
  commandFingerprint: string
  actorUserId: string
  paused: RuleOccurrenceRecord
  encounterVersion: number
  root: TurnCoordinatorRootDto
  resolutionCommand: TurnResolutionCommandDto
  characterTransitions?: Array<{
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }>
}) {
  const pending = turnContinuationPendingSummary(input.paused, input.encounterVersion)
  if (!pending) throw new EncounterConflictError('Legendary Action occurrence is unavailable.')
  const occurrence = {
    occurrenceId: input.paused.id,
    occurrenceVersion: input.paused.version,
    status: 'PENDING' as const,
    outcome: null,
    pending
  }
  await input.occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.encounterId,
    commandId: input.command.commandId,
    commandFingerprint: input.commandFingerprint,
    occurrenceId: input.paused.id,
    aggregateVersion: input.encounterVersion,
    commandType: input.command.type,
    actorUserId: input.actorUserId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS_PENDING',
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      rootCommandId: input.root.rootCommandId,
      rootCommandFingerprint: input.root.commandFingerprint,
      rootInitiatorUserId: input.root.initiatorUserId,
      rootCorrelationId: input.root.correlationId,
      expectedAggregateVersion: input.root.expectedEncounterVersion,
      occurrenceVersion: input.paused.version,
      resolutionCommand: input.resolutionCommand
    },
    resultPayload: storedRuleExecutionResultDtoSchema.parse({
      status: 'ENCOUNTER_OCCURRENCE_PENDING',
      schemaVersion: 1,
      occurrenceId: input.paused.id,
      occurrenceVersion: input.paused.version,
      encounterId: input.encounterId,
      encounterVersion: input.encounterVersion,
      occurrence,
      characterTransitions: input.characterTransitions ?? []
    })
  })
  return occurrence
}

function spatialPendingSummary(
  occurrence: RuleOccurrenceRecord,
  encounterVersion: number,
  visible: boolean
) {
  const pendingSnapshot = occurrence.pendingSnapshot
  const context = pendingSnapshot?.applicationContext
  if (
    occurrence.state !== 'PENDING' ||
    !pendingSnapshot ||
    !isServerKernelRuleExecutionPendingSnapshot(pendingSnapshot) ||
    context?.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' ||
    !context.currentCandidate.d20Policy
  )
    return null
  if (!visible) return null
  return {
    kind: 'D20_EVIDENCE' as const,
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion,
    request: {
      requestId: pendingSnapshot.request.requestId,
      min: 1 as const,
      max: 20 as const,
      rollMode: context.currentCandidate.d20Policy.rollMode
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL'] as const
  }
}

async function assertSpatialOccurrenceAuthority(input: {
  db: DBLike
  actorUserId: string
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
}): Promise<
  Extract<
    NonNullable<RuleOccurrenceRecord['pendingSnapshot']>['applicationContext'],
    { kind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
  >
> {
  const context = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  ).applicationContext
  if (context?.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT') {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (input.locked.context.role === 'OWNER') return context
  if (context.currentCandidate.target.kind !== 'CHARACTER') {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  await assertAssignedCharacterController({
    db: input.db,
    actorUserId: input.actorUserId,
    campaignId: input.locked.context.campaignId,
    assignedCharacterId: input.locked.context.assignedCharacterId,
    characterId: context.currentCandidate.target.characterId
  })
  return context
}

function currentMovementReactionTimelineOptions(
  context: Extract<
    NonNullable<RuleOccurrenceRecord['pendingSnapshot']>['applicationContext'],
    { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
  >
) {
  const entry = context.reactionTimeline[0]
  if (!entry) return []
  return entry.kind === 'AUTOMATIC_ACTION' ? [entry.option] : entry.group.options
}

function currentMovementReactionTimelineDistance(
  timeline: Extract<
    NonNullable<RuleOccurrenceRecord['pendingSnapshot']>['applicationContext'],
    { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
  >['reactionTimeline']
): number | null {
  const entry = timeline[0]
  return entry
    ? entry.kind === 'AUTOMATIC_ACTION'
      ? entry.option.candidate.pathDistance
      : entry.group.pathDistance
    : null
}

function stageMovementTokenPosition(
  scene: CampaignSceneState,
  tokenId: string,
  position: { x: number; y: number }
): CampaignSceneState {
  return {
    ...scene,
    tokens: scene.tokens.map((token) => (token.id === tokenId ? { ...token, position } : token))
  }
}

async function assertMovementReactionOccurrenceAuthority(input: {
  db: DBLike
  actorUserId: string
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
}): Promise<
  Extract<
    NonNullable<RuleOccurrenceRecord['pendingSnapshot']>['applicationContext'],
    { kind: 'ENCOUNTER_MOVEMENT_REACTION' }
  >
> {
  const context = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  ).applicationContext
  if (context?.kind !== 'ENCOUNTER_MOVEMENT_REACTION') {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (input.locked.context.role === 'OWNER') return context
  const actionEvidenceOptionId =
    context.phase.kind === 'ACTION_EVIDENCE' ? context.phase.selectedOptionId : null
  const actionEvidenceOption = actionEvidenceOptionId
    ? (currentMovementReactionTimelineOptions(context).find(
        (option) => option.optionId === actionEvidenceOptionId
      ) ?? null)
    : null
  const choiceAuthorities =
    context.phase.kind === 'CHOICE'
      ? currentMovementReactionTimelineOptions(context).map((option) => option.authority)
      : actionEvidenceOption
        ? [actionEvidenceOption.authority]
        : []
  const choiceControllerIds = [
    ...new Set(
      choiceAuthorities.flatMap((authority) =>
        authority.kind === 'CHARACTER_CONTROLLER' ? [authority.characterId] : []
      )
    )
  ]
  const characterId =
    context.phase.kind === 'CHOICE' || context.phase.kind === 'ACTION_EVIDENCE'
      ? choiceAuthorities.length > 0 &&
        choiceAuthorities.every((authority) => authority.kind === 'CHARACTER_CONTROLLER') &&
        choiceControllerIds.length === 1
        ? choiceControllerIds[0]
        : null
      : context.phase.kind === 'SPATIAL_EVIDENCE' &&
          context.phase.currentCandidate.target.kind === 'CHARACTER'
        ? context.phase.currentCandidate.target.characterId
        : null
  if (!characterId) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  await assertAssignedCharacterController({
    db: input.db,
    actorUserId: input.actorUserId,
    campaignId: input.locked.context.campaignId,
    assignedCharacterId: input.locked.context.assignedCharacterId,
    characterId
  })
  return context
}

async function assertAssignedCharacterController(input: {
  db: DBLike
  actorUserId: string
  campaignId: string
  assignedCharacterId: string | null
  characterId: string
}): Promise<void> {
  const assignment = await sql<{ user_id: string }>`
    SELECT user_id FROM public.campaign_character_assignments
    WHERE campaign_id = ${input.campaignId}
      AND character_id = ${input.characterId}
    FOR UPDATE
  `.execute(input.db)
  if (
    input.assignedCharacterId !== input.characterId ||
    assignment.rows[0]?.user_id !== input.actorUserId
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')
}

function spatialPathLength(path: readonly { x: number; y: number }[]): number {
  return path.slice(1).reduce((total, point, index) => {
    const prior = path[index]!
    return total + Math.hypot(point.x - prior.x, point.y - prior.y)
  }, 0)
}

async function appendPendingSpatialMovementResolutionReceipt(input: {
  occurrences: ReturnType<typeof createRuleOccurrenceRepository>
  encounterId: string
  command: MovementResolveRuleOccurrenceCommand
  actorUserId: string
  commandFingerprint: string
  paused: RuleOccurrenceRecord
  pendingEncounterVersion: number
  pendingSnapshot: NonNullable<RuleOccurrenceRecord['pendingSnapshot']>
  expectedSceneVersion: number
  pendingSceneVersion: number
  changedAggregates: MovementChangedAggregate[]
  viewer: {
    membershipRole: 'OWNER' | 'PLAYER'
    assignedCharacterId: string | null
  }
}): Promise<EncounterRuleOccurrenceSummaryDto> {
  const occurrenceSummary = projectEncounterSpatialOccurrenceSummary(
    input.paused,
    input.pendingEncounterVersion,
    input.viewer
  )
  const pendingResult = storedRuleExecutionResultDtoSchema.parse({
    status: 'ENCOUNTER_OCCURRENCE_PENDING',
    schemaVersion: 1,
    occurrenceId: input.paused.id,
    occurrenceVersion: input.paused.version,
    encounterId: input.encounterId,
    encounterVersion: input.pendingEncounterVersion,
    occurrence: occurrenceSummary,
    characterTransitions: input.changedAggregates
      .filter((aggregate) => aggregate.aggregateKind === 'CHARACTER')
      .map((aggregate) => ({
        characterId: aggregate.aggregateId,
        beforeStreamVersion: aggregate.beforeVersion,
        afterStreamVersion: aggregate.version
      }))
  })
  const receiptContext = input.pendingSnapshot.applicationContext
  if (
    receiptContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
    receiptContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  await input.occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.encounterId,
    commandId: input.command.commandId,
    commandFingerprint: input.commandFingerprint,
    occurrenceId: input.paused.id,
    aggregateVersion: input.pendingEncounterVersion,
    commandType: input.command.type,
    actorUserId: input.actorUserId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'SPATIAL_MOVEMENT',
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      rootCommandId: receiptContext.root.commandId,
      rootCommandFingerprint: receiptContext.root.commandFingerprint,
      rootInitiatorUserId: receiptContext.root.initiatorUserId,
      rootCorrelationId: receiptContext.root.correlationId,
      encounterId: receiptContext.root.encounterId,
      sceneId: receiptContext.root.sceneId,
      tokenId: receiptContext.root.tokenId,
      movementKind: receiptContext.root.movementKind,
      expectedEncounterVersion: input.command.expectedVersion,
      expectedSceneVersion: input.expectedSceneVersion,
      rootExpectedEncounterVersion: receiptContext.root.expectedEncounterVersion,
      rootExpectedSceneVersion: receiptContext.root.expectedSceneVersion,
      encounterVersionTransition:
        input.pendingEncounterVersion === input.command.expectedVersion ? 'UNCHANGED' : 'ADVANCED',
      sceneVersionTransition:
        input.pendingSceneVersion === input.expectedSceneVersion ? 'UNCHANGED' : 'ADVANCED',
      currentnessChecksum:
        receiptContext.kind === 'ENCOUNTER_MOVEMENT_REACTION'
          ? receiptContext.spatialCurrentnessChecksum
          : null,
      selectionChecksum:
        receiptContext.kind === 'ENCOUNTER_MOVEMENT_REACTION'
          ? receiptContext.spatialSelectionChecksum
          : receiptContext.selectionChecksum,
      occurrenceVersion: input.paused.version,
      changedAggregates: input.changedAggregates,
      resolutionCommands: [...receiptContext.root.resolutionCommands]
    },
    resultPayload: pendingResult
  })
  return occurrenceSummary
}

async function resolveEncounterSpatialMovementRuleOccurrence(input: {
  db: DBLike
  runtime?: RulesRuntimeService
  userId: string
  command: MovementResolveRuleOccurrenceCommand
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
  commandReceipt: RuleOccurrenceReceipt | null
  rollD20?: () => number
  sceneVisionContext?: LiveSessionSceneVisionContextDto
}): Promise<{
  response: EncounterCommandResultDto
  replayed: boolean
  spatialChangedAggregates: LiveSessionAggregateVersionDto[]
  spatialSceneState?: CampaignSceneState
  spatialTerminalBatch?: Extract<
    StoredRuleExecutionResultDto,
    { status: 'BATCH_COMPLETE'; batchKind: 'ENCOUNTER_SPATIAL_MOVEMENT' }
  >
}> {
  const repository = createEncounterRepository(input.db)
  const occurrences = createRuleOccurrenceRepository(input.db)
  const commandFingerprint = fingerprint(input.command)
  if (input.commandReceipt) {
    const receipt = input.commandReceipt
    if (
      receipt.occurrenceId !== input.occurrence.id ||
      receipt.commandMetadata.transition !== 'SPATIAL_MOVEMENT' ||
      receipt.commandMetadata.commandType !== 'RESOLVE_RULE_OCCURRENCE' ||
      receipt.commandId !== input.command.commandId ||
      receipt.commandFingerprint !== commandFingerprint ||
      receipt.actorUserId !== input.userId ||
      receipt.correlationId !== input.command.correlationId
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    if (receipt.resultPayload.status === 'ENCOUNTER_OCCURRENCE_PENDING') {
      const projection = await repository.requireCurrentProjection({
        encounterId: input.locked.encounter.id,
        expectedStreamVersion: input.locked.encounter.version
      })
      const priorSceneEvent = await createVttSceneRepository(input.db).findEventByCommand(
        input.locked.encounter.id,
        input.command.commandId
      )
      const receiptMetadata = receipt.commandMetadata
      const expectedSceneVersion =
        receiptMetadata.expectedSceneVersion +
        (receiptMetadata.sceneVersionTransition === 'ADVANCED' ? 1 : 0)
      const expectsSceneEvent = receiptMetadata.sceneVersionTransition === 'ADVANCED'
      if (
        (priorSceneEvent !== null) !== expectsSceneEvent ||
        (priorSceneEvent !== null &&
          (priorSceneEvent.commandFingerprint !== commandFingerprint ||
            priorSceneEvent.commandType !== input.command.type ||
            priorSceneEvent.event.actorUserId !== input.userId ||
            priorSceneEvent.event.commandId !== input.command.commandId ||
            priorSceneEvent.event.sceneId !== receiptMetadata.sceneId ||
            priorSceneEvent.event.version !== expectedSceneVersion))
      )
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      return {
        replayed: true,
        spatialChangedAggregates: receiptMetadata.changedAggregates,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            input.locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: projectEncounterSpatialOccurrenceSummary(
            input.occurrence,
            input.locked.encounter.version,
            {
              membershipRole: input.locked.context.role,
              assignedCharacterId: input.locked.context.assignedCharacterId
            }
          )
        })
      }
    }
    const event = await repository.findEventByCommand(
      input.locked.encounter.id,
      input.command.commandId
    )
    if (
      !event ||
      event.commandType !== input.command.type ||
      event.commandFingerprint !== commandFingerprint ||
      event.actorUserId !== input.userId ||
      event.correlationId !== input.command.correlationId ||
      event.version !== receipt.aggregateVersion
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const storedEvent = parseEncounterProjectionEvent(event.resultPayload)
    if (
      storedEvent.ruleReceipt?.occurrenceId !== input.occurrence.id ||
      storedEvent.ruleReceipt.resultChecksum !== checksumCanonicalJson(receipt.resultPayload)
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const storedResponse = encounterCommandResultDtoSchema.parse(storedEvent.command)
    const terminalResult = isEncounterMovementTerminalResult(receipt.resultPayload)
      ? receipt.resultPayload
      : null
    return {
      replayed: true,
      spatialChangedAggregates: terminalResult ? receipt.commandMetadata.changedAggregates : [],
      ...(receipt.resultPayload.status === 'BATCH_COMPLETE' &&
      receipt.resultPayload.batchKind === 'ENCOUNTER_SPATIAL_MOVEMENT'
        ? { spatialTerminalBatch: receipt.resultPayload }
        : {}),
      response: encounterCommandResultDtoSchema.parse({
        ...storedResponse,
        projection:
          input.locked.context.role === 'OWNER'
            ? storedEvent.currentProjection.projection
            : projectPlayerEncounterProjection(storedEvent.currentProjection.projection)
      })
    }
  }
  if (input.occurrence.state === 'COMPLETED')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  const currentPendingSnapshot = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  )
  const pendingContext = currentPendingSnapshot.applicationContext
  if (
    pendingContext?.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
    pendingContext?.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  const sceneRepository = createVttSceneRepository(input.db)
  const sceneBinding = await sceneRepository.findEncounterBinding(input.locked.encounter.id)
  const scene =
    sceneBinding?.sceneId === pendingContext.root.sceneId
      ? await sceneRepository.lockLiveScene(sceneBinding.sceneId)
      : null
  if (!scene) throw new EncounterConflictError('Scene changed before rule resolution.')
  const actorIdByTokenId = new Map(
    (await sceneRepository.listActorTokenBindings(input.locked.encounter.id)).map((binding) => [
      binding.tokenId,
      binding.actorId
    ])
  )
  if (!actorIdByTokenId.has(pendingContext.root.tokenId)) {
    throw new EncounterConflictError('Movement token is no longer bound to an Encounter actor.')
  }
  const movedToken = scene.state.tokens.find((token) => token.id === pendingContext.root.tokenId)
  if (!movedToken) throw new EncounterValidationError('Movement token is unavailable.')
  const context = pendingContext
  const existing = context.root.resolutionCommands.find(
    (entry) => entry.commandId === input.command.commandId
  )
  if (existing) {
    throw new EncounterConflictError('Rule occurrence receipt is unavailable.')
  }
  if (context.kind === 'ENCOUNTER_MOVEMENT_REACTION') {
    await assertMovementReactionOccurrenceAuthority({
      db: input.db,
      actorUserId: input.userId,
      locked: input.locked,
      occurrence: input.occurrence
    })
  } else {
    await assertSpatialOccurrenceAuthority({
      db: input.db,
      actorUserId: input.userId,
      locked: input.locked,
      occurrence: input.occurrence
    })
  }
  if (
    (context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
      (context.phase.kind === 'CHOICE' || context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE') &&
      !isMovementReactionResolveRuleOccurrenceCommand(input.command)) ||
    ((context.kind === 'ENCOUNTER_SPATIAL_MOVEMENT' ||
      (context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
        (context.phase.kind === 'SPATIAL_EVIDENCE' || context.phase.kind === 'ACTION_EVIDENCE'))) &&
      !isD20ResolveRuleOccurrenceCommand(input.command))
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (
    input.locked.encounter.version !== input.command.expectedVersion ||
    input.occurrence.version !== input.command.expectedOccurrenceVersion ||
    input.occurrence.expectedAggregateVersion !== input.locked.encounter.version
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  if (
    isD20ResolveRuleOccurrenceCommand(input.command) &&
    input.command.resolution.requestId !== currentPendingSnapshot.request.requestId
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  let lockedTargets = await lockEncounterActiveEffectTargets({
    trx: input.db,
    encounter: input.locked.encounter,
    actors: input.locked.encounter.actors,
    attunementSlotOverride: input.locked.context.attunementSlotOverride,
    getEncounterActorSnapshot: async () => {
      const snapshot = await evaluateEncounterActorRuleSnapshot({
        db: input.db,
        encounter: input.locked.encounter
      })
      return { rules: snapshot.snapshot.output, encounter: snapshot.reconciledEncounter }
    }
  })
  const spatialScope = await createSpatialRuleEffectRepository(input.db).lockScope({
    encounterId: input.locked.encounter.id,
    sceneId: scene.state.id
  })
  if (!spatialScope) throw new EncounterConflictError('Spatial rule scope is unavailable.')
  const movementRoot = {
    commandId: context.root.commandId,
    commandFingerprint: context.root.commandFingerprint,
    initiatorUserId: context.root.initiatorUserId,
    correlationId: context.root.correlationId,
    encounterId: context.root.encounterId,
    sceneId: context.root.sceneId,
    tokenId: context.root.tokenId,
    expectedEncounterVersion: context.root.expectedEncounterVersion,
    expectedSceneVersion: context.root.expectedSceneVersion,
    movementKind: context.root.movementKind,
    originalPath: context.root.originalPath
  }
  let evaluationEncounter = input.locked.encounter
  const refreshMovementTargets = async () => {
    const currentEncounter = await repository.find(input.locked.encounter.id)
    if (!currentEncounter) throw new EncounterNotFoundError()
    evaluationEncounter = currentEncounter
    lockedTargets = await refreshLockedEncounterActiveEffectTargets({
      trx: input.db,
      encounter: evaluationEncounter,
      targets: lockedTargets,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      getEncounterActorSnapshot: async () => {
        const snapshot = await evaluateEncounterActorRuleSnapshot({
          db: input.db,
          encounter: evaluationEncounter
        })
        return { rules: snapshot.snapshot.output, encounter: snapshot.reconciledEncounter }
      }
    })
  }
  let completedReactionRemainder: FrozenMovementReactionRemainder | null = null

  if (
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    context.phase.kind === 'LEGENDARY_RESISTANCE_CHOICE'
  ) {
    const legendaryPhase = context.phase
    if (!input.runtime || !isMovementReactionResolveRuleOccurrenceCommand(input.command)) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const selectedOption =
      currentMovementReactionTimelineOptions(context).find(
        (option) => option.optionId === legendaryPhase.selectedOptionId
      ) ?? null
    if (!selectedOption) throw new EncounterConflictError('Rule occurrence is unavailable.')
    if (
      input.command.resolution.kind === 'OPTION' &&
      input.command.resolution.optionId !== legendaryPhase.resistance.useOptionId
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const resolutionCommands = appendEncounterMovementReactionResolutionCommand({
      history: context.root.resolutionCommands,
      command:
        input.command.resolution.kind === 'OPTION'
          ? {
              commandId: input.command.commandId,
              commandFingerprint,
              actorUserId: input.userId,
              correlationId: input.command.correlationId,
              expectedOccurrenceVersion: input.occurrence.version,
              kind: 'OPTION',
              optionId: input.command.resolution.optionId
            }
          : {
              commandId: input.command.commandId,
              commandFingerprint,
              actorUserId: input.userId,
              correlationId: input.command.correlationId,
              expectedOccurrenceVersion: input.occurrence.version,
              kind: 'DECLINE'
            },
      selection: input.command.resolution,
      actorUserId: input.userId,
      proposedOccurrenceVersion: input.occurrence.version + 1
    })
    const prepared = await prepareCurrentEncounterMovementReactionAction({
      trx: input.db,
      actorUserId: input.userId,
      encounter: input.locked.encounter,
      scene: scene.state,
      actorIdByTokenId,
      movingTokenId: context.root.tokenId,
      movementKind: context.root.movementKind,
      occurrenceId: input.occurrence.id,
      option: selectedOption,
      runtime: input.runtime,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      spatialScope
    })
    if (checksumRuleDocument(prepared.action.target) !== legendaryPhase.targetStateChecksum) {
      throw new EncounterConflictError('Legendary Resistance target state is stale.')
    }
    const actorRules = prepared.targets.encounterActorRules
    if (!actorRules) {
      throw new EncounterConflictError('Legendary Resistance actor policy is unavailable.')
    }
    const candidate = await discoverEncounterLegendaryResistanceCandidate({
      encounter: input.locked.encounter,
      targetActor: prepared.targetActor,
      actorRules,
      definitions: createReusableDefinitionRepository(input.db)
    })
    const resistance = legendaryPhase.resistance
    if (
      !candidate ||
      candidate.targetActorId !== resistance.targetActorId ||
      candidate.ownerFeatureId !== resistance.ownerFeatureId ||
      candidate.chargeId !== resistance.chargeId ||
      candidate.featureCost !== resistance.featureCost ||
      candidate.poolBefore !== resistance.poolBefore ||
      candidate.poolRemaining !== resistance.poolRemaining ||
      candidate.lifecycle.definitionId !== resistance.definitionId ||
      candidate.lifecycle.definitionVersion !== resistance.definitionVersion ||
      candidate.lifecycle.definitionChecksum !== resistance.definitionChecksum ||
      candidate.lifecycle.choiceGraphDefinitionId !== resistance.choiceGraphDefinitionId ||
      candidate.lifecycle.choiceGraphDefinitionVersion !==
        resistance.choiceGraphDefinitionVersion ||
      candidate.lifecycle.choiceGraphDefinitionChecksum !==
        resistance.choiceGraphDefinitionChecksum ||
      candidate.lifecycle.useOutput !== resistance.useOutput
    ) {
      throw new EncounterConflictError('Legendary Resistance source is stale.')
    }
    const {
      applicationContext: _applicationContext,
      snapshotKind: _snapshotKind,
      ...continuation
    } = currentPendingSnapshot
    const selection = input.command.resolution.kind === 'OPTION' ? 'USE' : 'DECLINE'
    const choice = await resumeEncounterLegendaryResistanceChoice({
      runtime: input.runtime,
      continuation,
      candidate,
      selection
    })
    const interpretationInput = {
      execution: legendaryPhase.originalExecution,
      occurrenceId: input.occurrence.id,
      published: prepared.action.published,
      targetActorId: prepared.action.target.actorId,
      currentHitPoints: prepared.action.target.currentHitPoints,
      temporaryHitPoints: prepared.action.target.temporaryHitPoints,
      maximumHitPoints: prepared.action.target.maximumHitPoints,
      defenses: prepared.action.target.defenses,
      conditionImmunityIds: prepared.action.target.conditionImmunityIds
    }
    const applications = choice.use
      ? prepared.action.adapter.interpretSaveSuccessReplacement?.({
          ...interpretationInput,
          replacement: { lifecycle: candidate.lifecycle }
        })
      : prepared.action.adapter.interpret(interpretationInput)
    if (!applications) {
      throw new EncounterConflictError('Legendary Resistance replacement is unavailable.')
    }
    const resource = findEncounterFeatureResource(
      actorRules,
      prepared.targetActor.id,
      candidate.ownerFeatureId
    )
    if (
      choice.use &&
      (!resource ||
        resource.used + candidate.featureCost > (resource.maximum ?? -1) ||
        resource.remaining !== candidate.poolBefore)
    ) {
      throw new EncounterConflictError('Legendary Resistance charge is stale.')
    }
    const settlementPrepared = choice.use
      ? {
          ...prepared,
          ...withTargetEncounterFeatureResourceConsumption({
            prepared,
            consumption: {
              ownerFeatureId: candidate.ownerFeatureId,
              chargeId: candidate.chargeId,
              cost: candidate.featureCost,
              beforeUsed: resource!.used,
              afterUsed: resource!.used + candidate.featureCost,
              beforeRemaining: candidate.poolBefore,
              afterRemaining: candidate.poolRemaining
            }
          })
        }
      : prepared
    const settled = await settleEncounterMovementReactionAction({
      db: input.db,
      actorUserId: input.userId,
      encounterId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      commandId: input.command.commandId,
      ordinal: context.completedReactionExecutions.length,
      prepared: settlementPrepared,
      execution: {
        kind: 'COMPLETE',
        execution: legendaryPhase.originalExecution,
        d20: legendaryPhase.originalD20,
        applications
      },
      legendaryResistance: {
        selectedIndex: choice.selectedIndex,
        use: choice.use,
        lifecycle: choice.lifecycle,
        execution: choice.execution,
        originalD20: legendaryPhase.originalD20
      }
    })
    completedReactionRemainder = movementReactionRemainderAfterCompletedAction({
      context,
      selectedOptionId: selectedOption.optionId,
      resolutionCommands,
      execution: settled.reactionExecution
    })
    const currentEncounter = await repository.find(input.locked.encounter.id)
    if (!currentEncounter) throw new EncounterNotFoundError()
    evaluationEncounter = currentEncounter
  }

  if (
    context.kind === 'ENCOUNTER_MOVEMENT_REACTION' &&
    (context.phase.kind === 'CHOICE' || context.phase.kind === 'ACTION_EVIDENCE')
  ) {
    if (!input.runtime) {
      throw new EncounterValidationError('Movement reaction resolution requires the rules runtime.')
    }
    let selectedOption
    let actionContext = context
    let resolutionCommands = context.root.resolutionCommands
    let actionContinuation
    let actionResolution

    if (context.phase.kind === 'CHOICE') {
      if (!isMovementReactionResolveRuleOccurrenceCommand(input.command)) {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      if (input.command.resolution.kind === 'DECLINE') {
        selectedOption = null
      } else {
        resolutionCommands = appendEncounterMovementReactionResolutionCommand({
          history: context.root.resolutionCommands,
          command: {
            commandId: input.command.commandId,
            commandFingerprint,
            actorUserId: input.userId,
            correlationId: input.command.correlationId,
            expectedOccurrenceVersion: input.occurrence.version,
            kind: 'OPTION',
            optionId: input.command.resolution.optionId
          },
          selection: input.command.resolution,
          actorUserId: input.userId,
          proposedOccurrenceVersion: input.occurrence.version + 1
        })
        const selected = await resolveEncounterMovementReactionChoice({
          runtime: input.runtime,
          pendingSnapshot: currentPendingSnapshot,
          selection: input.command.resolution
        })
        if (selected.kind !== 'SELECTED') {
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        }
        selectedOption = selected.option
        actionContext = {
          ...selected.context,
          root: {
            ...selected.context.root,
            resolutionCommands
          }
        }
      }
    } else {
      if (!isD20ResolveRuleOccurrenceCommand(input.command)) {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      const selectedOptionId = context.phase.selectedOptionId
      selectedOption =
        currentMovementReactionTimelineOptions(context).find(
          (option) => option.optionId === selectedOptionId
        ) ?? null
      if (!selectedOption) {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      const resolutionCommand = {
        commandId: input.command.commandId,
        commandFingerprint,
        actorUserId: input.userId,
        correlationId: input.command.correlationId,
        expectedOccurrenceVersion: input.occurrence.version,
        requestId: input.command.resolution.requestId,
        kind: input.command.resolution.kind
      }
      resolutionCommands = appendEncounterMovementReactionActionEvidenceCommand({
        history: context.root.resolutionCommands,
        command: resolutionCommand,
        actorUserId: input.userId,
        proposedOccurrenceVersion: input.occurrence.version + 1
      })
      actionContext = {
        ...context,
        root: {
          ...context.root,
          resolutionCommands
        }
      }
      const {
        applicationContext: _applicationContext,
        snapshotKind: _snapshotKind,
        ...continuation
      } = currentPendingSnapshot
      actionContinuation = continuation
      actionResolution =
        input.command.resolution.kind === 'ENTER_DICE'
          ? {
              kind: 'ENTER_DICE' as const,
              requestId: input.command.resolution.requestId,
              rawFaces: input.command.resolution.rawFaces
            }
          : {
              kind: 'SYSTEM_ROLL' as const,
              requestId: input.command.resolution.requestId
            }
    }

    if (selectedOption) {
      const prepared = await prepareCurrentEncounterMovementReactionAction({
        trx: input.db,
        actorUserId: input.userId,
        encounter: input.locked.encounter,
        scene: scene.state,
        actorIdByTokenId,
        movingTokenId: context.root.tokenId,
        movementKind: context.root.movementKind,
        occurrenceId: input.occurrence.id,
        option: selectedOption,
        runtime: input.runtime,
        attunementSlotOverride: input.locked.context.attunementSlotOverride,
        spatialScope
      })
      const actionExecution = await executeEncounterMovementReactionAction({
        runtime: input.runtime,
        occurrenceId: input.occurrence.id,
        automationMode:
          input.locked.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
        prepared: prepared.action,
        ...(actionContinuation ? { continuation: actionContinuation } : {}),
        ...(context.phase.kind === 'ACTION_EVIDENCE'
          ? { expectedD20Policy: context.phase.d20Policy }
          : {}),
        ...(actionResolution ? { resolution: actionResolution } : {}),
        ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
      })
      if (actionExecution.kind === 'PENDING') {
        const pendingSnapshot = retainEncounterMovementReactionActionEvidence({
          continuation: actionExecution.continuation,
          context: actionContext,
          selectedOptionId: selectedOption.optionId,
          d20Policy: actionExecution.d20Policy
        })
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: input.locked.encounter.id,
          occurrenceId: input.occurrence.id,
          expectedOccurrenceVersion: input.occurrence.version,
          expectedAggregateVersion: input.locked.encounter.version,
          nextAggregateVersion: input.locked.encounter.version,
          pendingSnapshot
        })
        const projection = await repository.requireCurrentProjection({
          encounterId: input.locked.encounter.id,
          expectedStreamVersion: input.locked.encounter.version
        })
        const occurrenceSummary = await appendPendingSpatialMovementResolutionReceipt({
          occurrences,
          encounterId: input.locked.encounter.id,
          command: input.command,
          actorUserId: input.userId,
          commandFingerprint,
          paused,
          pendingEncounterVersion: input.locked.encounter.version,
          pendingSnapshot,
          expectedSceneVersion: context.root.currentSceneVersion,
          pendingSceneVersion: context.root.currentSceneVersion,
          changedAggregates: [],
          viewer: {
            membershipRole: input.locked.context.role,
            assignedCharacterId: input.locked.context.assignedCharacterId
          }
        })
        return {
          replayed: false,
          spatialChangedAggregates: [],
          response: encounterCommandResultDtoSchema.parse({
            projection:
              input.locked.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: occurrenceSummary
          })
        }
      }
      let legendaryResistanceCandidate = null
      if (
        actionExecution.execution.outputs.resultPath === 'ON_SAVE_FAIL' &&
        actionExecution.d20 !== null &&
        prepared.targetActor.kind === 'CREATURE'
      ) {
        const actorRules = prepared.targets.encounterActorRules
        if (!actorRules) {
          throw new EncounterConflictError('Legendary Resistance actor policy is unavailable.')
        }
        legendaryResistanceCandidate = await discoverEncounterLegendaryResistanceCandidate({
          encounter: input.locked.encounter,
          targetActor: prepared.targetActor,
          actorRules,
          definitions: createReusableDefinitionRepository(input.db)
        })
      }
      if (legendaryResistanceCandidate) {
        const completedD20 = actionExecution.d20
        if (!completedD20) {
          throw new EncounterConflictError('Legendary Resistance requires completed save evidence.')
        }
        const continuation = await startEncounterLegendaryResistanceChoice({
          runtime: input.runtime,
          occurrenceId: input.occurrence.id,
          candidate: legendaryResistanceCandidate
        })
        const pendingSnapshot = retainEncounterLegendaryResistanceChoice({
          continuation,
          context: actionContext,
          selectedOptionId: selectedOption.optionId,
          execution: actionExecution.execution,
          d20: completedD20,
          candidate: legendaryResistanceCandidate,
          targetStateChecksum: checksumRuleDocument(prepared.action.target)
        })
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: input.locked.encounter.id,
          occurrenceId: input.occurrence.id,
          expectedOccurrenceVersion: input.occurrence.version,
          expectedAggregateVersion: input.locked.encounter.version,
          nextAggregateVersion: input.locked.encounter.version,
          pendingSnapshot
        })
        const projection = await repository.requireCurrentProjection({
          encounterId: input.locked.encounter.id,
          expectedStreamVersion: input.locked.encounter.version
        })
        const occurrenceSummary = await appendPendingSpatialMovementResolutionReceipt({
          occurrences,
          encounterId: input.locked.encounter.id,
          command: input.command,
          actorUserId: input.userId,
          commandFingerprint,
          paused,
          pendingEncounterVersion: input.locked.encounter.version,
          pendingSnapshot,
          expectedSceneVersion: context.root.currentSceneVersion,
          pendingSceneVersion: context.root.currentSceneVersion,
          changedAggregates: [],
          viewer: {
            membershipRole: input.locked.context.role,
            assignedCharacterId: input.locked.context.assignedCharacterId
          }
        })
        return {
          replayed: false,
          spatialChangedAggregates: [],
          response: encounterCommandResultDtoSchema.parse({
            projection:
              input.locked.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: occurrenceSummary
          })
        }
      }
      const settled = await settleEncounterMovementReactionAction({
        db: input.db,
        actorUserId: input.userId,
        encounterId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        commandId: input.command.commandId,
        ordinal: context.completedReactionExecutions.length,
        prepared,
        execution: actionExecution
      })
      completedReactionRemainder = movementReactionRemainderAfterCompletedAction({
        context: actionContext,
        selectedOptionId: selectedOption.optionId,
        resolutionCommands,
        execution: settled.reactionExecution
      })
      const currentEncounter = await repository.find(input.locked.encounter.id)
      if (!currentEncounter) throw new EncounterNotFoundError()
      evaluationEncounter = currentEncounter
      await refreshMovementTargets()
    }
  }

  const getEncounterActorSnapshot = async () => {
    const snapshot = await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: evaluationEncounter
    })
    return {
      rules: snapshot.snapshot.output,
      encounter: snapshot.reconciledEncounter
    }
  }
  const sharedEvaluationInput = {
    trx: input.db,
    actorUserId: input.userId,
    encounter: evaluationEncounter,
    sceneId: scene.state.id,
    sceneVersion: scene.state.version,
    sceneTokens: scene.state.tokens,
    actorIdByTokenId,
    spatialScope,
    root: movementRoot,
    currentPosition: movedToken.position,
    occurrenceId: input.occurrence.id,
    executionCommandId: input.command.commandId,
    occurrenceVersion: input.occurrence.version + 1,
    runtime: input.runtime,
    attunementSlotOverride: input.locked.context.attunementSlotOverride,
    lockedTargets,
    ...(input.rollD20 ? { rollD20: input.rollD20 } : {}),
    getEncounterActorSnapshot
  }
  let continuingReactionTimeline = completedReactionRemainder
    ? completedReactionRemainder.reactionTimeline
    : context.kind === 'ENCOUNTER_MOVEMENT_REACTION'
      ? context.phase.kind === 'CHOICE'
        ? context.reactionTimeline.slice(1)
        : context.reactionTimeline
      : []
  const commandTransitions: MovementCommandTransition[] = [
    ...(
      completedReactionRemainder?.completedReactionExecutions ??
      (context.kind === 'ENCOUNTER_MOVEMENT_REACTION' ? context.completedReactionExecutions : [])
    )
      .filter((execution) => execution.sourceCommandId === input.command.commandId)
      .map((execution) => ({ kind: 'REACTION' as const, execution }))
  ]
  let evaluation = completedReactionRemainder
    ? await evaluateEncounterSpatialMovementRuleBatch({
        ...sharedEvaluationInput,
        frozenReactionRemainder: completedReactionRemainder,
        ...(currentMovementReactionTimelineDistance(completedReactionRemainder.reactionTimeline) !==
        null
          ? {
              interruptAfterPathDistance: currentMovementReactionTimelineDistance(
                completedReactionRemainder.reactionTimeline
              )!
            }
          : {})
      })
    : context.kind === 'ENCOUNTER_MOVEMENT_REACTION' && context.phase.kind === 'CHOICE'
      ? await (async () => {
          if (!isMovementReactionResolveRuleOccurrenceCommand(input.command)) {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          if (input.command.resolution.kind === 'OPTION')
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          if (!input.runtime) {
            throw new EncounterValidationError(
              'Movement reaction resolution requires the rules runtime.'
            )
          }
          const selection: MovementReactionChoiceSelectionDto = input.command.resolution
          const resolutionCommands = appendEncounterMovementReactionResolutionCommand({
            history: context.root.resolutionCommands,
            command: {
              commandId: input.command.commandId,
              commandFingerprint,
              actorUserId: input.userId,
              correlationId: input.command.correlationId,
              expectedOccurrenceVersion: input.occurrence.version,
              kind: selection.kind
            },
            selection,
            actorUserId: input.userId,
            proposedOccurrenceVersion: input.occurrence.version + 1
          })
          const settledChoice = await resolveEncounterMovementReactionChoice({
            runtime: input.runtime,
            pendingSnapshot: requireEncounterKernelPendingSnapshot(
              input.occurrence.pendingSnapshot
            ),
            selection
          })
          if (settledChoice.kind !== 'DECLINED') {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          const remainder = movementReactionRemainderAfterCurrentChoice({
            context: settledChoice.context,
            resolutionCommands
          })
          return evaluateEncounterSpatialMovementRuleBatch({
            ...sharedEvaluationInput,
            frozenReactionRemainder: remainder,
            ...(currentMovementReactionTimelineDistance(remainder.reactionTimeline) !== null
              ? {
                  interruptAfterPathDistance: currentMovementReactionTimelineDistance(
                    remainder.reactionTimeline
                  )!
                }
              : {})
          })
        })()
      : await (async () => {
          if (!isD20ResolveRuleOccurrenceCommand(input.command)) {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          const resolutionCommand = {
            commandId: input.command.commandId,
            commandFingerprint,
            actorUserId: input.userId,
            correlationId: input.command.correlationId,
            expectedOccurrenceVersion: input.occurrence.version,
            requestId: input.command.resolution.requestId,
            kind: input.command.resolution.kind
          }
          return evaluateEncounterSpatialMovementRuleBatch({
            ...sharedEvaluationInput,
            pendingSnapshot: requireEncounterKernelPendingSnapshot(
              input.occurrence.pendingSnapshot
            ),
            resolution: input.command.resolution as SpatialMovementRuleResolution,
            resolutionCommand,
            ...(currentMovementReactionTimelineDistance(continuingReactionTimeline) !== null
              ? {
                  interruptAfterPathDistance: currentMovementReactionTimelineDistance(
                    continuingReactionTimeline
                  )!
                }
              : {})
          })
        })()
  let stagedReactionScene = scene.state
  while (
    evaluation.kind === 'REACTION_BOUNDARY' &&
    continuingReactionTimeline[0]?.kind === 'AUTOMATIC_ACTION'
  ) {
    if (!input.runtime) {
      throw new EncounterValidationError('Automatic movement reactions require the rules runtime.')
    }
    const automaticEntry = continuingReactionTimeline[0]
    stagedReactionScene = stageMovementTokenPosition(
      stagedReactionScene,
      context.root.tokenId,
      evaluation.boundaryPosition
    )
    const automatic = await executeAutomaticEncounterMovementReaction({
      db: input.db,
      actorUserId: input.userId,
      encounter: evaluationEncounter,
      scene: stagedReactionScene,
      actorIdByTokenId,
      movingTokenId: context.root.tokenId,
      movementKind: context.root.movementKind,
      occurrenceId: input.occurrence.id,
      commandId: input.command.commandId,
      ordinal: evaluation.completedReactionExecutions.length,
      option: automaticEntry.option,
      runtime: input.runtime,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      spatialScope,
      lockedTargets,
      ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
    })
    if (automatic.kind === 'PENDING') {
      evaluation = {
        kind: 'PENDING',
        movementIntent: { tokenId: context.root.tokenId, position: evaluation.boundaryPosition },
        pendingSnapshot: startEncounterAutomaticMovementReactionEvidenceAtBoundary({
          continuation: automatic.continuation.continuation,
          root: movementRoot,
          currentSceneVersion: scene.state.version,
          boundary: evaluation,
          reactionTimeline: continuingReactionTimeline,
          selectedOptionId: automaticEntry.option.optionId,
          d20Policy: automatic.continuation.d20Policy
        })
      }
      break
    }
    commandTransitions.push({ kind: 'REACTION', execution: automatic.settled.reactionExecution })
    await refreshMovementTargets()
    sharedEvaluationInput.lockedTargets = lockedTargets
    if (automatic.settled.reactionExecution.execution.movementInterruption?.kind === 'STOP') {
      const terminalPosition = stagedReactionScene.tokens.find(
        (token) => token.id === context.root.tokenId
      )!.position
      const result = storedRuleExecutionResultDtoSchema.parse({
        status: 'MOVEMENT_COMPLETE',
        schemaVersion: 1,
        occurrenceId: input.occurrence.id,
        occurrenceVersion: input.occurrence.version + 1,
        encounterId: input.locked.encounter.id,
        encounterVersion: evaluationEncounter.version + 1,
        sceneId: scene.state.id,
        sceneVersion: scene.state.version + 1,
        tokenId: context.root.tokenId,
        movementKind: context.root.movementKind,
        reactionExecutions: [
          ...evaluation.completedReactionExecutions,
          automatic.settled.reactionExecution
        ],
        terminalPosition
      })
      if (result.status !== 'MOVEMENT_COMPLETE') {
        throw new EncounterConflictError('Stopped movement result is unavailable.')
      }
      evaluation = {
        kind: 'TERMINAL',
        result,
        movementIntent: { tokenId: context.root.tokenId, position: terminalPosition },
        resolutionCommands: evaluation.resolutionCommands,
        selectionChecksum: evaluation.selectionChecksum,
        currentnessChecksum: evaluation.currentnessChecksum
      }
      break
    }
    const updatedEncounter = await repository.find(input.locked.encounter.id)
    if (!updatedEncounter) throw new EncounterNotFoundError()
    evaluationEncounter = updatedEncounter
    continuingReactionTimeline = continuingReactionTimeline.slice(1)
    const remainder: FrozenMovementReactionRemainder = {
      root: {
        ...movementRoot,
        currentSceneVersion: scene.state.version,
        pathChecksum: checksumRuleDocument(movementRoot.originalPath),
        pathStartDistance: evaluation.boundaryDistance,
        currentPosition: evaluation.boundaryPosition,
        resolutionCommands: [...evaluation.resolutionCommands]
      },
      spatialSelectionChecksum: evaluation.selectionChecksum,
      spatialCurrentnessChecksum: evaluation.currentnessChecksum,
      completedSpatialExecutions: [...evaluation.completedExecutions],
      appliedSpatialPrefix: evaluation.appliedPrefix,
      completedReactionExecutions: [
        ...evaluation.completedReactionExecutions,
        automatic.settled.reactionExecution
      ],
      currentSpatialCandidate: null,
      remainingSpatialCandidates: [...evaluation.remainingCandidates],
      reactionTimeline: continuingReactionTimeline
    }
    evaluation = await evaluateEncounterSpatialMovementRuleBatch({
      ...sharedEvaluationInput,
      encounter: evaluationEncounter,
      sceneTokens: stagedReactionScene.tokens,
      currentPosition: evaluation.boundaryPosition,
      frozenReactionRemainder: remainder,
      ...(currentMovementReactionTimelineDistance(continuingReactionTimeline) === null
        ? {}
        : {
            interruptAfterPathDistance: currentMovementReactionTimelineDistance(
              continuingReactionTimeline
            )!
          })
    })
  }
  if (
    evaluation.kind !== 'PENDING' &&
    evaluation.kind !== 'TERMINAL' &&
    evaluation.kind !== 'REACTION_BOUNDARY'
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  const pendingEvaluationContext =
    evaluation.kind === 'PENDING'
      ? (() => {
          const applicationContext = evaluation.pendingSnapshot.applicationContext
          if (
            applicationContext.kind !== 'ENCOUNTER_SPATIAL_MOVEMENT' &&
            applicationContext.kind !== 'ENCOUNTER_MOVEMENT_REACTION'
          ) {
            throw new EncounterConflictError('Rule occurrence is unavailable.')
          }
          return applicationContext
        })()
      : null
  const startDistance = context.root.pathStartDistance
  const endDistance = pendingEvaluationContext
    ? pendingEvaluationContext.root.pathStartDistance
    : evaluation.kind === 'REACTION_BOUNDARY'
      ? evaluation.boundaryDistance
      : spatialPathLength(context.root.originalPath)
  const committed = await commitSpatialSceneMovement({
    repository: sceneRepository,
    scene,
    encounterId: input.locked.encounter.id,
    actorUserId: input.userId,
    commandId: input.command.commandId,
    commandType: input.command.type,
    commandFingerprint,
    tokenId: context.root.tokenId,
    path: context.root.originalPath,
    startDistance,
    endDistance,
    endPosition: evaluation.movementIntent?.position ?? movedToken.position,
    sceneVisionContext: input.sceneVisionContext
  })
  const pendingSnapshot =
    evaluation.kind === 'REACTION_BOUNDARY'
      ? await (async () => {
          const nextEntry = continuingReactionTimeline[0]
          if (!nextEntry || nextEntry.kind !== 'CONTROLLER_CHOICE' || !input.runtime) {
            throw new EncounterConflictError('The next movement reaction choice is unavailable.')
          }
          const choiceDefinitionId = nextEntry.group.options[0]!.policy.choiceDefinitionId
          if (!choiceDefinitionId)
            throw new EncounterConflictError('The next movement reaction choice is unavailable.')
          return startEncounterMovementReactionAtBoundary({
            runtime: input.runtime,
            occurrenceId: input.occurrence.id,
            gameSystemId: input.locked.encounter.gameSystemId,
            publishedChoice: createMovementReactionChoiceDefinition({
              definitionId: choiceDefinitionId,
              gameSystemId: input.locked.encounter.gameSystemId
            }),
            root: movementRoot,
            currentSceneVersion: committed.version,
            boundary: evaluation,
            reactionTimeline: continuingReactionTimeline
          })
        })()
      : evaluation.kind === 'PENDING'
        ? serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
            ...evaluation.pendingSnapshot,
            applicationContext: {
              ...pendingEvaluationContext!,
              root: {
                ...pendingEvaluationContext!.root,
                currentSceneVersion: committed.version
              }
            }
          })
        : null
  if (pendingSnapshot) {
    const mechanicsAppliedBeforePause = commandTransitions.length > 0
    const pendingCharacterAggregates = movementCommandCharacterAggregateVersions(commandTransitions)
    let pendingEncounterVersion = input.locked.encounter.version
    if (mechanicsAppliedBeforePause) {
      pendingEncounterVersion = await input.locked.context.advanceVersion(
        input.locked.encounter.version
      )
      const currentEncounter = await repository.find(input.locked.encounter.id)
      if (!currentEncounter) throw new EncounterNotFoundError()
      const currentSnapshot = await evaluateEncounterActorRuleSnapshot({
        db: input.db,
        encounter: currentEncounter
      })
      for (const actor of currentSnapshot.actorUpdates) await repository.updateActor(actor)
      const gmProjection = projectGm(
        currentSnapshot.reconciledEncounter,
        currentSnapshot.snapshot.output
      )
      await repository.publishCurrentProjection(
        compileEncounterCurrentProjection(gmProjection, currentSnapshot.snapshot)
      )
    }
    const paused = await occurrences.advancePending({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      expectedOccurrenceVersion: input.occurrence.version,
      expectedAggregateVersion: input.locked.encounter.version,
      nextAggregateVersion: pendingEncounterVersion,
      pendingSnapshot
    })
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: pendingEncounterVersion
    })
    const spatialChangedAggregates: MovementChangedAggregate[] = [
      ...pendingCharacterAggregates,
      ...(mechanicsAppliedBeforePause
        ? [
            {
              aggregateId: input.locked.encounter.id,
              aggregateKind: 'ENCOUNTER' as const,
              beforeVersion: input.command.expectedVersion,
              version: pendingEncounterVersion
            }
          ]
        : []),
      ...(committed.delta === null
        ? []
        : [
            {
              aggregateId: committed.state.id,
              aggregateKind: 'SCENE' as const,
              beforeVersion: context.root.currentSceneVersion,
              version: committed.version
            }
          ])
    ].sort((left, right) =>
      `${left.aggregateKind}:${left.aggregateId}`.localeCompare(
        `${right.aggregateKind}:${right.aggregateId}`
      )
    )
    const occurrenceSummary = await appendPendingSpatialMovementResolutionReceipt({
      occurrences,
      encounterId: input.locked.encounter.id,
      command: input.command,
      actorUserId: input.userId,
      commandFingerprint,
      paused,
      pendingEncounterVersion,
      pendingSnapshot,
      expectedSceneVersion: context.root.currentSceneVersion,
      pendingSceneVersion: committed.version,
      changedAggregates: spatialChangedAggregates,
      viewer: {
        membershipRole: input.locked.context.role,
        assignedCharacterId: input.locked.context.assignedCharacterId
      }
    })
    return {
      replayed: false,
      spatialChangedAggregates,
      ...(committed.delta === null && !mechanicsAppliedBeforePause
        ? {}
        : { spatialSceneState: committed.state }),
      response: encounterCommandResultDtoSchema.parse({
        projection:
          input.locked.context.role === 'OWNER'
            ? projection.projection
            : projectPlayerEncounterProjection(projection.projection),
        roll: null,
        resolution: null,
        occurrence: occurrenceSummary
      })
    }
  }
  if (evaluation.kind !== 'TERMINAL')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  const nextVersion = await input.locked.context.advanceVersion(input.locked.encounter.version)
  const updatedEncounter = await repository.find(input.locked.encounter.id)
  if (!updatedEncounter) throw new EncounterNotFoundError()
  const snapshot = await evaluateEncounterActorRuleSnapshot({
    db: input.db,
    encounter: updatedEncounter
  })
  for (const actor of snapshot.actorUpdates) await repository.updateActor(actor)
  const gmProjection = projectGm(snapshot.reconciledEncounter, snapshot.snapshot.output)
  const currentProjection = compileEncounterCurrentProjection(gmProjection, snapshot.snapshot)
  await repository.publishCurrentProjection(currentProjection)
  const result = storedRuleExecutionResultDtoSchema.parse({
    ...evaluation.result,
    encounterVersion: nextVersion,
    sceneVersion: committed.version
  })
  if (!isEncounterMovementTerminalResult(result)) {
    throw new EncounterConflictError('Spatial movement result is unavailable.')
  }
  const terminalChangedAggregates = terminalMovementChangedAggregates({
    encounter: updatedEncounter,
    result,
    expectedEncounterVersion: input.command.expectedVersion,
    expectedSceneVersion: context.root.currentSceneVersion,
    sourceCommandId: input.command.commandId
  })
  const completed = await occurrences.complete({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    occurrenceId: input.occurrence.id,
    expectedOccurrenceVersion: input.occurrence.version,
    expectedAggregateVersion: input.locked.encounter.version,
    nextAggregateVersion: nextVersion
  })
  await occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    commandId: input.command.commandId,
    commandFingerprint,
    occurrenceId: completed.id,
    aggregateVersion: nextVersion,
    commandType: input.command.type,
    actorUserId: input.userId,
    correlationId: input.command.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'SPATIAL_MOVEMENT',
      commandType: 'RESOLVE_RULE_OCCURRENCE',
      rootCommandId: context.root.commandId,
      rootCommandFingerprint: context.root.commandFingerprint,
      rootInitiatorUserId: context.root.initiatorUserId,
      rootCorrelationId: context.root.correlationId,
      encounterId: context.root.encounterId,
      sceneId: context.root.sceneId,
      tokenId: context.root.tokenId,
      movementKind: context.root.movementKind,
      expectedEncounterVersion: input.command.expectedVersion,
      expectedSceneVersion: context.root.currentSceneVersion,
      rootExpectedEncounterVersion: context.root.expectedEncounterVersion,
      rootExpectedSceneVersion: context.root.expectedSceneVersion,
      encounterVersionTransition: 'ADVANCED',
      sceneVersionTransition:
        committed.version === context.root.currentSceneVersion ? 'UNCHANGED' : 'ADVANCED',
      currentnessChecksum: evaluation.currentnessChecksum,
      selectionChecksum: evaluation.selectionChecksum,
      occurrenceVersion: completed.version,
      changedAggregates: terminalChangedAggregates,
      resolutionCommands: [...evaluation.resolutionCommands]
    },
    resultPayload: result
  })
  const response = encounterCommandResultDtoSchema.parse({
    projection: gmProjection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId: completed.id,
      occurrenceVersion: completed.version,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  await repository.appendEvent({
    id: randomUUID(),
    encounterId: input.locked.encounter.id,
    campaignId: input.locked.encounter.campaignId,
    version: nextVersion,
    commandId: input.command.commandId,
    commandType: input.command.type,
    commandFingerprint,
    commandPayload: input.command as unknown as Json,
    resultPayload: encounterProjectionEventSchema.parse({
      command: response,
      currentProjection,
      ruleReceipt: {
        occurrenceId: completed.id,
        resultChecksum: checksumCanonicalJson(result)
      }
    }) as unknown as Json,
    actorUserId: input.userId,
    correlationId: input.command.correlationId
  })
  return {
    replayed: false,
    spatialChangedAggregates: terminalChangedAggregates,
    spatialSceneState: committed.state,
    ...(result.status === 'BATCH_COMPLETE' ? { spatialTerminalBatch: result } : {}),
    response:
      input.locked.context.role === 'OWNER'
        ? response
        : encounterCommandResultDtoSchema.parse({
            ...response,
            projection: projectPlayerEncounterProjection(gmProjection)
          })
  }
}

async function resolveEncounterInitiativeRuleOccurrence(input: {
  db: DBLike
  runtime?: RulesRuntimeService
  userId: string
  command: InitiativeResolveRuleOccurrenceCommand
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
  rollD20?: () => number
  rollD6?: () => number
}): Promise<{ response: EncounterCommandResultDto; replayed: boolean }> {
  if (!input.locked) throw new EncounterConflictError('Rule occurrence is unavailable.')
  const repository = createEncounterRepository(input.db)
  const occurrences = createRuleOccurrenceRepository(input.db)
  const commandFingerprint = fingerprint(input.command)
  const historyKind = initiativeHistoryKind(input.command.resolution)

  if (input.occurrence.state === 'COMPLETED') {
    const receipt = await occurrences.findTerminalReceiptByOccurrence(
      'ENCOUNTER',
      input.locked.encounter.id,
      input.occurrence.id
    )
    const resolutionCommand =
      receipt?.commandMetadata.transition === 'TURN_EFFECTS'
        ? receipt.commandMetadata.resolutionCommands.find(
            (entry) => entry.commandId === input.command.commandId
          )
        : null
    if (
      !receipt ||
      !resolutionCommand ||
      resolutionCommand.kind !== historyKind ||
      resolutionCommand.commandFingerprint !== commandFingerprint ||
      (input.locked.context.role !== 'OWNER' && resolutionCommand.actorUserId !== input.userId)
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    if (historyKind === 'INITIATIVE_DECLARATION') {
      if (
        !('initiativeActorId' in resolutionCommand) ||
        typeof resolutionCommand.initiativeActorId !== 'string'
      )
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      await assertCurrentInitiativeDeclarationAuthority({
        db: input.db,
        userId: input.userId,
        locked: input.locked,
        actorId: resolutionCommand.initiativeActorId
      })
    }
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: true,
      response: encounterCommandResultDtoSchema.parse({
        projection:
          input.locked.context.role === 'OWNER'
            ? projection.projection
            : projectPlayerEncounterProjection(projection.projection),
        roll: null,
        resolution: null,
        occurrence: {
          occurrenceId: input.occurrence.id,
          occurrenceVersion:
            'occurrenceVersion' in receipt.resultPayload
              ? receipt.resultPayload.occurrenceVersion
              : input.occurrence.version,
          status: 'COMPLETE',
          outcome: null,
          pending: null
        }
      })
    }
  }

  const kernelSnapshot =
    input.occurrence.pendingSnapshot &&
    isServerKernelRuleExecutionPendingSnapshot(input.occurrence.pendingSnapshot)
      ? input.occurrence.pendingSnapshot
      : null
  const declarationSnapshot =
    input.occurrence.pendingSnapshot &&
    isServerAggregateChoicePendingSnapshot(input.occurrence.pendingSnapshot)
      ? input.occurrence.pendingSnapshot
      : null
  const context = kernelSnapshot ? assertInitiativeOccurrenceAuthority(input) : null
  const declarationContext =
    declarationSnapshot?.applicationContext.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
      ? declarationSnapshot.applicationContext
      : null
  if (
    (context === null && declarationContext === null) ||
    (context !== null && declarationContext !== null)
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  const root = context?.root ?? declarationContext!.root
  if (
    input.locked.encounter.version !== input.command.expectedVersion ||
    input.occurrence.version !== input.command.expectedOccurrenceVersion ||
    input.occurrence.expectedAggregateVersion !== input.locked.encounter.version ||
    root.expectedEncounterVersion !== input.locked.encounter.version
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')

  const existing = root.resolutionCommands.find(
    (entry) => entry.commandId === input.command.commandId
  )
  if (existing) {
    if (
      existing.commandFingerprint !== commandFingerprint ||
      existing.kind !== historyKind ||
      (input.locked.context.role !== 'OWNER' && existing.actorUserId !== input.userId)
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: true,
      response: encounterCommandResultDtoSchema.parse({
        projection:
          input.locked.context.role === 'OWNER'
            ? projection.projection
            : projectPlayerEncounterProjection(projection.projection),
        roll: null,
        resolution: null,
        occurrence: {
          occurrenceId: input.occurrence.id,
          occurrenceVersion: input.occurrence.version,
          status: 'PENDING',
          outcome: null,
          pending: projectEncounterInitiativePendingSummary({
            pendingSnapshot: input.occurrence.pendingSnapshot!,
            occurrenceVersion: input.occurrence.version,
            encounterVersion: input.locked.encounter.version
          })
        }
      })
    }
  }
  let actorEvaluation: Awaited<ReturnType<typeof evaluateEncounterActorRuleSnapshot>> | null = null
  const getActorEvaluation = async () => {
    actorEvaluation ??= await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: input.locked.encounter,
      revisionId: input.locked.encounter.rulePackRevisionId
    })
    return actorEvaluation
  }
  const history = [
    ...root.resolutionCommands,
    {
      commandId: input.command.commandId,
      commandFingerprint,
      actorUserId: input.userId,
      correlationId: input.command.correlationId,
      expectedOccurrenceVersion: input.occurrence.version,
      requestId: input.command.resolution.requestId,
      kind: historyKind,
      ...(declarationContext ? { initiativeActorId: declarationContext.request.actorId } : {})
    }
  ]
  const getEncounterActorSnapshot = async () => {
    const evaluated = await getActorEvaluation()
    return { rules: evaluated.snapshot.output, encounter: evaluated.reconciledEncounter }
  }
  let initiative: Awaited<ReturnType<typeof resumeEncounterInitiativeDeclarationCommand>>
  if (declarationContext) {
    if (input.command.resolution.kind !== 'INITIATIVE_DECLARATION')
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const request = declarationContext.request
    await assertCurrentInitiativeDeclarationAuthority({
      db: input.db,
      userId: input.userId,
      locked: input.locked,
      actorId: request.actorId
    })
    if (
      input.command.resolution.requestId !== request.requestId ||
      request.encounterId !== input.locked.encounter.id ||
      request.round !== root.round ||
      (input.locked.context.role !== 'OWNER' && request.controllerUserId !== input.userId)
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    initiative = await resumeEncounterInitiativeDeclarationCommand({
      trx: input.db,
      repository,
      encounter: input.locked.encounter,
      round: root.round,
      occurrenceId: input.occurrence.id,
      runtime: input.runtime ?? null,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      getEncounterActorSnapshot,
      legacyOrderedActorIds: stableActors(input.locked.encounter).map((actor) => actor.id),
      actorId: request.actorId,
      expectedParticipantVersion: request.participantExpectedVersion,
      primary: input.command.resolution.primary,
      bonus: input.command.resolution.bonus,
      request,
      stagedRoundState: root.stagedInitiativeRoundState,
      integerSource: ({ min, max }) => randomInt(min, max + 1)
    })
    if (initiative.kind === 'DECLARATION_PENDING') {
      const declaration = initiative
      const participant = declaration.state.participants.find(
        (candidate) => candidate.actorId === declaration.actorId
      )
      if (!participant) throw new EncounterConflictError('Initiative declaration is unavailable.')
      const nextRequest = createEncounterInitiativeDeclarationRequest({
        requestId: `initiative-declaration:${input.occurrence.id}:${declaration.actorId}`,
        encounterId: input.locked.encounter.id,
        round: root.round,
        actorId: declaration.actorId,
        participantExpectedVersion: participant.version,
        controllerUserId: await initiativeDeclarationControllerUserId({
          db: input.db,
          locked: input.locked,
          source: declaration.source
        }),
        source: declaration.source
      })
      const paused = await occurrences.advancePending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        expectedOccurrenceVersion: input.occurrence.version,
        expectedAggregateVersion: input.locked.encounter.version,
        nextAggregateVersion: input.locked.encounter.version,
        pendingSnapshot: createEncounterInitiativeDeclarationPendingSnapshot({
          occurrenceId: input.occurrence.id,
          root: {
            ...root,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(declaration.state),
            resolutionCommands: history
          },
          request: nextRequest
        })
      })
      const projection = await repository.requireCurrentProjection({
        encounterId: input.locked.encounter.id,
        expectedStreamVersion: input.locked.encounter.version
      })
      return {
        replayed: false,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            input.locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: paused.id,
            occurrenceVersion: paused.version,
            status: 'PENDING',
            outcome: null,
            pending: projectEncounterInitiativePendingSummary({
              pendingSnapshot: paused.pendingSnapshot!,
              occurrenceVersion: paused.version,
              encounterVersion: input.locked.encounter.version
            })
          }
        })
      }
    }
  } else {
    if (!input.runtime)
      throw new EncounterValidationError('Rule occurrence resolution requires the rules runtime.')
    const pendingSnapshot = kernelSnapshot!
    if (input.command.resolution.kind === 'INITIATIVE_DECLARATION')
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    if (input.command.resolution.requestId !== pendingSnapshot.request.requestId)
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const scorePhase =
      context!.phase.kind === 'PRIMARY_SCORE' || context!.phase.kind === 'TIE_RESOLUTION'
    if (
      (scorePhase && input.command.resolution.kind === 'INITIATIVE_ENTITY') ||
      (!scorePhase && input.command.resolution.kind !== 'INITIATIVE_ENTITY')
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const request = pendingSnapshot.request
    if (request.kind !== 'INTEGER_RANGE')
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const value =
      input.command.resolution.kind === 'INITIATIVE_ENTITY'
        ? { selectedEntityId: input.command.resolution.entityId }
        : input.command.resolution.kind === 'ENTER_INTEGER'
          ? input.command.resolution.value
          : request.min === 1 && request.max === 20 && input.rollD20
            ? input.rollD20()
            : randomInt(request.min, request.max + 1)
    initiative = await resumeEncounterInitiativeCommand({
      trx: input.db,
      repository,
      encounter: input.locked.encounter,
      round: root.round,
      runtime: input.runtime,
      pendingSnapshot,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      getEncounterActorSnapshot,
      requestId: input.command.resolution.requestId,
      value,
      integerSource: ({ min, max }) => randomInt(min, max + 1),
      stagedRoundState: root.stagedInitiativeRoundState
    })
  }
  if (initiative.kind === 'PENDING') {
    const paused = await occurrences.advancePending({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      expectedOccurrenceVersion: input.occurrence.version,
      expectedAggregateVersion: input.locked.encounter.version,
      nextAggregateVersion: input.locked.encounter.version,
      pendingSnapshot: createEncounterInitiativePendingSnapshot({
        root: {
          ...root,
          stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
          resolutionCommands: history
        },
        pending: initiative.pending
      })
    })
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: false,
      response: encounterCommandResultDtoSchema.parse({
        projection:
          input.locked.context.role === 'OWNER'
            ? projection.projection
            : projectPlayerEncounterProjection(projection.projection),
        roll: null,
        resolution: null,
        occurrence: {
          occurrenceId: paused.id,
          occurrenceVersion: paused.version,
          status: 'PENDING',
          outcome: null,
          pending: projectEncounterInitiativePendingSummary({
            pendingSnapshot: requireEncounterKernelPendingSnapshot(paused.pendingSnapshot),
            occurrenceVersion: paused.version,
            encounterVersion: input.locked.encounter.version
          })
        }
      })
    }
  }
  if (!input.runtime)
    throw new EncounterValidationError('Rule occurrence resolution requires the rules runtime.')
  const runtime = input.runtime
  const terminalInitiative = requireEncounterInitiativeTerminalSettlement({
    root,
    result: initiative
  })

  // Both a resumed kernel evidence request and the final sealed Speed Factor
  // declaration reach this one terminal path. Keep all cursor/effect/receipt
  // mutation together under the already-held Encounter + occurrence locks.
  const settleEncounterInitiativeTerminal = async (): Promise<{
    response: EncounterCommandResultDto
    replayed: boolean
  }> => {
    const settlement = encounterInitiativeSettlementDtoSchema.parse({
      round: terminalInitiative.state.round.round,
      cadence: terminalInitiative.state.round.cadence,
      procedure: terminalInitiative.state.round.procedure,
      policySnapshotChecksum: terminalInitiative.state.round.policySnapshotChecksum,
      orderedActorIds: terminalInitiative.orderedActorIds,
      orderedSideIds: terminalInitiative.orderedSideIds,
      evidence: terminalInitiative.evidence
    })
    const active = await resolveActiveRulePackForSystems(
      input.db,
      encounterSystemIds(input.locked.encounter)
    )
    const revision = await requireImmutableEncounterActorRuleRevision({
      db: input.db,
      revisionId: active.revision.id,
      expectedChecksum: active.revision.checksum
    })
    let evaluated = await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: input.locked.encounter,
      revisionId: revision.id
    })
    actorEvaluation = evaluated
    const occurrenceVersion = input.occurrence.version + 1
    const firstActorId = terminalInitiative.orderedActorIds[0] ?? null
    const frozenSource = {
      revisionId: revision.id,
      revisionChecksum: revision.checksum,
      snapshotChecksum: checksumEncounterActorRuleSnapshot(evaluated.snapshot)
    }
    let coordinatorRoot: TurnCoordinatorRootDto = {
      rootCommandId: root.rootCommandId,
      commandFingerprint: root.commandFingerprint,
      commandType: root.commandType,
      initiatorUserId: root.initiatorUserId,
      correlationId: root.correlationId,
      expectedEncounterVersion: root.expectedEncounterVersion,
      startSystemId: root.startSystemId,
      frozenActorRuleRevisionId: frozenSource.revisionId,
      frozenActorRuleRevisionChecksum: frozenSource.revisionChecksum,
      frozenActorRuleSnapshotChecksum: frozenSource.snapshotChecksum,
      initiative: settlement,
      initiativeAdvance: root.initiativeAdvance ?? null,
      stagedInitiative: {
        beforePin: root.initiativeBeforePin,
        stagedRoundState: serializeStagedInitiativeRoundState(terminalInitiative.state)
      },
      ...(root.outgoingTurn ? { outgoingTurn: root.outgoingTurn } : {}),
      ...(root.completedLegendaryActions?.length
        ? { completedLegendaryActions: root.completedLegendaryActions }
        : {}),
      ...(root.stagedLegendaryActionRefreshes?.length
        ? { stagedLegendaryActionRefreshes: root.stagedLegendaryActionRefreshes }
        : {}),
      resolutionCommands: history,
      proposedTerminalTransition: {
        status: 'ACTIVE' as const,
        round: root.round,
        currentActorId: firstActorId
      }
    }
    let stagedLegendaryRefreshActors: readonly EncounterActorRecord[] = []
    if (root.stagedLegendaryActionRefreshes?.length) {
      stagedLegendaryRefreshActors = await applyStagedLegendaryActionRefreshes({
        encounter: evaluated.reconciledEncounter,
        definitions: createReusableDefinitionRepository(input.db),
        refreshes: root.stagedLegendaryActionRefreshes
      })
      const refreshedEncounter = {
        ...evaluated.reconciledEncounter,
        actors: evaluated.reconciledEncounter.actors.map(
          (actor) =>
            stagedLegendaryRefreshActors.find((candidate) => candidate.id === actor.id) ?? actor
        )
      }
      evaluated = await evaluateEncounterActorRuleSnapshot({
        db: input.db,
        encounter: refreshedEncounter,
        revisionId: revision.id
      })
      actorEvaluation = evaluated
    }
    if (
      firstActorId &&
      input.locked.encounter.automationMode !== 'MANUAL' &&
      !coordinatorRoot.stagedLegendaryActionRefreshes?.some(
        (refresh) => refresh.actorId === firstActorId
      )
    ) {
      const staged = await stageEncounterLegendaryActionRefreshes({
        actorId: firstActorId,
        encounter: evaluated.reconciledEncounter,
        actorRules: evaluated.snapshot.output,
        definitions: createReusableDefinitionRepository(input.db)
      })
      if (staged.refreshes.length > 0 && staged.refreshedActor) {
        const ordinal = coordinatorRoot.stagedLegendaryActionRefreshes?.length ?? 0
        coordinatorRoot = {
          ...coordinatorRoot,
          stagedLegendaryActionRefreshes: [
            ...(coordinatorRoot.stagedLegendaryActionRefreshes ?? []),
            ...staged.refreshes.map((refresh, index) => ({ ...refresh, ordinal: ordinal + index }))
          ]
        }
        stagedLegendaryRefreshActors = [...stagedLegendaryRefreshActors, staged.refreshedActor]
        const refreshedEncounter = {
          ...evaluated.reconciledEncounter,
          actors: evaluated.reconciledEncounter.actors.map((actor) =>
            actor.id === staged.refreshedActor!.id ? staged.refreshedActor! : actor
          )
        }
        evaluated = await evaluateEncounterActorRuleSnapshot({
          db: input.db,
          encounter: refreshedEncounter,
          revisionId: revision.id
        })
        actorEvaluation = evaluated
      }
    }
    const restoredOutgoingBatch =
      root.outgoingTurn?.kind === 'STAGED'
        ? await restoreEvaluatedEncounterTurnEffectBatch({
            trx: input.db,
            actorUserId: input.userId,
            encounter: evaluated.reconciledEncounter,
            commandType: root.commandType,
            boundaries: boundariesForStagedTurnPlan(root.outgoingTurn.plan),
            occurrenceId: input.occurrence.id,
            runtime,
            attunementSlotOverride: input.locked.context.attunementSlotOverride,
            coordinatorRoot,
            stagedPlan: root.outgoingTurn.plan,
            getEncounterActorSnapshot: async () => ({
              rules: evaluated.snapshot.output,
              encounter: evaluated.reconciledEncounter
            }),
            rollD20: input.rollD20
          })
        : null
    let stagedRechargeActor: EncounterActorRecord | null = null
    if (firstActorId && input.locked.encounter.automationMode !== 'MANUAL') {
      const candidates = await discoverEncounterRechargeCandidates({
        actorId: firstActorId,
        encounterActors: evaluated.reconciledEncounter.actors,
        actorRules: evaluated.snapshot.output,
        definitions: createReusableDefinitionRepository(input.db)
      })
      if (candidates.length > 0) {
        const selectionChecksum = rechargePlanSelectionChecksum(candidates)
        const completed: TurnRechargeExecution[] = []
        for (const [ordinal, candidate] of candidates.entries()) {
          const recharge = await executeEncounterRechargeCandidate({
            candidate,
            occurrenceId: input.occurrence.id,
            definitions: createReusableDefinitionRepository(input.db),
            runtime,
            mode: input.locked.encounter.automationMode,
            ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
          })
          if (recharge?.kind === 'PENDING') {
            const paused = await occurrences.advancePending({
              aggregateKind: 'ENCOUNTER',
              aggregateId: input.locked.encounter.id,
              occurrenceId: input.occurrence.id,
              expectedOccurrenceVersion: input.occurrence.version,
              expectedAggregateVersion: input.locked.encounter.version,
              nextAggregateVersion: input.locked.encounter.version,
              pendingSnapshot: rechargePendingSnapshot({
                continuation: recharge.continuation,
                root: {
                  ...coordinatorRoot,
                  completedRechargePlan: completedRechargePlan(selectionChecksum, completed)
                },
                selectionChecksum,
                completedExecutions: completed,
                currentCandidate: rechargePendingCandidate(candidate, ordinal),
                remainingCandidates: candidates
                  .slice(ordinal + 1)
                  .map((remaining, remainingOrdinal) =>
                    rechargePendingCandidate(remaining, ordinal + remainingOrdinal + 1)
                  )
              })
            })
            const projection = await repository.requireCurrentProjection({
              encounterId: input.locked.encounter.id,
              expectedStreamVersion: input.locked.encounter.version
            })
            return {
              replayed: false,
              response: encounterCommandResultDtoSchema.parse({
                projection:
                  input.locked.context.role === 'OWNER'
                    ? projection.projection
                    : projectPlayerEncounterProjection(projection.projection),
                roll: null,
                resolution: null,
                occurrence: {
                  occurrenceId: paused.id,
                  occurrenceVersion: paused.version,
                  status: 'PENDING',
                  outcome: null,
                  pending: rechargePendingSummary(paused, input.locked.encounter.version)
                }
              })
            }
          }
          if (!recharge) throw new EncounterConflictError('Recharge execution became unavailable.')
          completed.push(rechargeCompletedExecution({ ordinal, result: recharge }))
        }
        const plan = completedRechargePlan(selectionChecksum, completed)
        if (!plan) throw new EncounterConflictError('Recharge plan lacks terminal evidence.')
        const staged = stageCompletedRechargePlan({
          encounter: evaluated.reconciledEncounter,
          actorRules: evaluated.snapshot.output,
          plan,
          currentActorId: firstActorId
        })
        evaluated = { ...evaluated, reconciledEncounter: staged.encounter }
        stagedRechargeActor = staged.actor
        coordinatorRoot = { ...coordinatorRoot, completedRechargePlan: plan }
      }
    }
    const turnEvaluation = await evaluateEncounterTurnCharacterActiveEffects({
      trx: input.db,
      actorUserId: input.userId,
      encounter: evaluated.reconciledEncounter,
      commandType: root.commandType,
      boundaries: [
        {
          ordinal: root.outgoingTurn ? 1 : 0,
          stage: 'START_OF_TURN',
          actorId: firstActorId
        }
      ],
      occurrenceId: input.occurrence.id,
      runtime,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      coordinatorRoot,
      getEncounterActorSnapshot: async () => ({
        rules: evaluated.snapshot.output,
        encounter: evaluated.reconciledEncounter
      }),
      rollD20: input.rollD20
    })
    if (turnEvaluation.kind === 'PENDING') {
      const paused = await occurrences.advancePending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        expectedOccurrenceVersion: input.occurrence.version,
        expectedAggregateVersion: input.locked.encounter.version,
        nextAggregateVersion: input.locked.encounter.version,
        pendingSnapshot: turnEvaluation.pendingSnapshot
      })
      const projection = await repository.requireCurrentProjection({
        encounterId: input.locked.encounter.id,
        expectedStreamVersion: input.locked.encounter.version
      })
      return {
        replayed: false,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            input.locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: paused.id,
            occurrenceVersion: paused.version,
            status: 'PENDING',
            outcome: null,
            pending: turnPendingSummary(paused, input.locked.encounter.version)
          }
        })
      }
    }

    const appliedInitiative = await applyStagedInitiativeState({
      repository,
      encounter: input.locked.encounter,
      beforePin: root.initiativeBeforePin,
      stagedRoundState: serializeStagedInitiativeRoundState(terminalInitiative.state),
      ...(root.initiativeAdvance?.kind === 'ROUND_WRAP' &&
      root.initiativeAdvance.cadence === 'EACH_ROUND'
        ? { initiativeAdvance: root.initiativeAdvance }
        : {})
    })
    if (
      appliedInitiative.round.round !== root.round ||
      appliedInitiative.participants.find((participant) => participant.status === 'ACTIVE')
        ?.actorId !== firstActorId
    ) {
      throw new EncounterConflictError('Staged initiative did not settle the expected turn cursor.')
    }

    for (const actor of stagedLegendaryRefreshActors) await repository.updateActor(actor)
    for (const actor of evaluated.actorUpdates) await repository.updateActor(actor)
    if (stagedRechargeActor) await repository.updateActor(stagedRechargeActor)
    const selectionChecksum =
      turnEvaluation.kind === 'READY'
        ? turnEvaluation.batch.selectionChecksum
        : turnEvaluation.selectionChecksum
    const restoredOutgoingResult =
      restoredOutgoingBatch === null
        ? null
        : await applyEvaluatedTurnEffectBatch({
            trx: input.db,
            actorUserId: input.userId,
            encounter: evaluated.reconciledEncounter,
            commandType: root.commandType,
            occurrenceId: input.occurrence.id,
            occurrenceVersion,
            batch: restoredOutgoingBatch
          })
    const turnResult =
      turnEvaluation.kind === 'READY'
        ? await applyEvaluatedTurnEffectBatch({
            trx: input.db,
            actorUserId: input.userId,
            encounter: evaluated.reconciledEncounter,
            commandType: root.commandType,
            occurrenceId: input.occurrence.id,
            occurrenceVersion,
            batch: turnEvaluation.batch
          })
        : turnEvaluation.result
    let selectionChecksumForReceipt = selectionChecksum
    const result = root.outgoingTurn
      ? (() => {
          if (
            root.commandType !== 'ADVANCE_TURN' ||
            root.initiativeAdvance?.kind !== 'ROUND_WRAP' ||
            root.initiativeAdvance.cadence !== 'EACH_ROUND'
          )
            throw new EncounterConflictError(
              'Each-round initiative lacks its outgoing turn transition.'
            )
          const outgoingEvidence = completedPendingTurnPhaseEvidence({
            phase: root.outgoingTurn,
            restoredResult: restoredOutgoingResult
          })
          const incomingEvidence = completedTurnPhaseEvidence({
            selectionChecksum,
            result: turnResult
          })
          selectionChecksumForReceipt = turnLifecycleSelectionChecksum({
            outgoing: outgoingEvidence,
            incoming: incomingEvidence,
            ...(root.completedLegendaryActions?.length
              ? { legendaryActions: root.completedLegendaryActions }
              : {}),
            ...(coordinatorRoot.stagedLegendaryActionRefreshes?.length
              ? { legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes }
              : {})
          })
          return storedRuleExecutionResultDtoSchema.parse({
            status: 'TURN_LIFECYCLE_COMPLETE',
            schemaVersion: 1,
            occurrenceId: input.occurrence.id,
            occurrenceVersion,
            encounterId: input.locked.encounter.id,
            commandType: 'ADVANCE_TURN',
            initiativeAdvance: root.initiativeAdvance,
            initiative: settlement,
            rechargeExecutions: rechargeExecutionsForRoot(coordinatorRoot),
            outgoingTurn: outgoingEvidence,
            legendaryActions: root.completedLegendaryActions ?? [],
            legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes ?? [],
            incomingTurn: incomingEvidence
          })
        })()
      : turnResult
        ? storedRuleExecutionResultDtoSchema.parse({
            ...turnResult,
            occurrenceVersion,
            initiative: settlement,
            initiativeAdvance: null
          })
        : storedRuleExecutionResultDtoSchema.parse({
            status: 'INITIATIVE_COMPLETE',
            schemaVersion: 1,
            occurrenceId: input.occurrence.id,
            occurrenceVersion,
            encounterId: input.locked.encounter.id,
            commandType: root.commandType,
            initiative: settlement,
            initiativeAdvance: null
          })
    const nextVersion = input.locked.encounter.version + 1
    await repository.update({
      encounterId: input.locked.encounter.id,
      status: 'ACTIVE',
      version: nextVersion,
      round: root.round,
      currentActorId: firstActorId
    })
    const updated = await repository.find(input.locked.encounter.id)
    if (!updated) throw new EncounterNotFoundError()
    const snapshot = await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: updated,
      revisionId: revision.id
    })
    for (const actor of snapshot.actorUpdates) await repository.updateActor(actor)
    const gmProjection = projectGm(snapshot.reconciledEncounter, snapshot.snapshot.output)
    const currentProjection = compileEncounterCurrentProjection(gmProjection, snapshot.snapshot)
    await repository.publishCurrentProjection(currentProjection)
    await occurrences.complete({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      expectedOccurrenceVersion: input.occurrence.version,
      expectedAggregateVersion: input.locked.encounter.version,
      nextAggregateVersion: nextVersion
    })
    await occurrences.appendReceipt({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      commandId: root.rootCommandId,
      commandFingerprint: root.commandFingerprint,
      occurrenceId: input.occurrence.id,
      aggregateVersion: nextVersion,
      commandType: root.commandType,
      actorUserId: root.initiatorUserId,
      correlationId: root.correlationId,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: root.commandType,
        expectedAggregateVersion: root.expectedEncounterVersion,
        selectionChecksum: selectionChecksumForReceipt,
        initiativeChecksum: checksumCanonicalJson(settlement),
        initiativeAdvanceChecksum:
          root.initiativeAdvance === undefined
            ? null
            : checksumCanonicalJson(root.initiativeAdvance),
        terminalOccurrenceVersion: occurrenceVersion,
        resolutionCommands: history
      },
      resultPayload: result
    })
    const response = encounterCommandResultDtoSchema.parse({
      projection: gmProjection,
      roll: null,
      resolution: null,
      occurrence: {
        occurrenceId: input.occurrence.id,
        occurrenceVersion,
        status: 'COMPLETE',
        outcome: null,
        pending: null
      }
    })
    const rootPayload =
      root.commandType === 'START'
        ? {
            type: 'START',
            encounterId: input.locked.encounter.id,
            commandId: root.rootCommandId,
            expectedVersion: root.expectedEncounterVersion,
            ...(root.startSystemId ? { systemId: root.startSystemId } : {})
          }
        : {
            type: 'ADVANCE_TURN',
            encounterId: input.locked.encounter.id,
            commandId: root.rootCommandId,
            expectedVersion: root.expectedEncounterVersion
          }
    await repository.appendEvent({
      id: randomUUID(),
      encounterId: input.locked.encounter.id,
      campaignId: input.locked.encounter.campaignId,
      version: nextVersion,
      commandId: root.rootCommandId,
      commandType: root.commandType,
      commandFingerprint: root.commandFingerprint,
      commandPayload: rootPayload as Json,
      resultPayload: encounterProjectionEventSchema.parse({
        command: response,
        currentProjection,
        ruleReceipt: {
          occurrenceId: input.occurrence.id,
          resultChecksum: checksumCanonicalJson(result)
        }
      }) as unknown as Json,
      actorUserId: root.initiatorUserId,
      correlationId: root.correlationId
    })
    return {
      replayed: false,
      response:
        input.locked.context.role === 'OWNER'
          ? response
          : encounterCommandResultDtoSchema.parse({
              ...response,
              projection: projectPlayerEncounterProjection(gmProjection)
            })
    }
  }
  return settleEncounterInitiativeTerminal()
}

function initiativeHistoryKind(
  resolution: InitiativeResolveRuleOccurrenceCommand['resolution']
): 'ENTER_INTEGER' | 'INITIATIVE_SYSTEM_ROLL' | 'INITIATIVE_ENTITY' | 'INITIATIVE_DECLARATION' {
  return resolution.kind === 'SYSTEM_ROLL' ? 'INITIATIVE_SYSTEM_ROLL' : resolution.kind
}

function actorIsControlledByAssignedCharacter(input: {
  encounter: EncounterRecord
  actorId: string
  assignedCharacterId: string | null
}): boolean {
  if (!input.assignedCharacterId) return false
  const actor = input.encounter.actors.find((candidate) => candidate.id === input.actorId)
  return actor?.kind === 'CHARACTER' && actor.sourceId === input.assignedCharacterId
}

/**
 * Resolves declaration control from the locked assignment row, rather than
 * from the user who happened to open the root command. Owners remain a
 * separate authorization path and never become the stored controller.
 */
async function initiativeDeclarationControllerUserId(input: {
  db: DBLike
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  source: LockedEncounterInitiativeActorSource
}): Promise<string | null> {
  if (input.source.kind !== 'CHARACTER') return null
  const assignment = await sql<{ user_id: string }>`
    SELECT user_id FROM public.campaign_character_assignments
    WHERE campaign_id = ${input.locked.context.campaignId}
      AND character_id = ${input.source.characterId}
    FOR UPDATE
  `.execute(input.db)
  return assignment.rows[0]?.user_id ?? null
}

async function assertCurrentInitiativeDeclarationAuthority(input: {
  db: DBLike
  userId: string
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  actorId: string
}): Promise<void> {
  if (input.locked.context.role === 'OWNER') return
  const actor = input.locked.encounter.actors.find((candidate) => candidate.id === input.actorId)
  if (actor?.kind !== 'CHARACTER' || !actor.sourceId) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  const assignment = await sql<{ user_id: string }>`
    SELECT user_id FROM public.campaign_character_assignments
    WHERE campaign_id = ${input.locked.context.campaignId}
      AND character_id = ${actor.sourceId}
    FOR UPDATE
  `.execute(input.db)
  if (
    assignment.rows[0]?.user_id !== input.userId ||
    input.locked.context.assignedCharacterId !== actor.sourceId
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
}

function assertInitiativeOccurrenceAuthority(input: {
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
  command: InitiativeResolveRuleOccurrenceCommand
}) {
  const context = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  ).applicationContext
  if (context?.kind !== 'ENCOUNTER_INITIATIVE')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  if (input.locked.context.role === 'OWNER') return context

  const controlsActor = (actorId: string) =>
    actorIsControlledByAssignedCharacter({
      encounter: input.locked.encounter,
      actorId,
      assignedCharacterId: input.locked.context.assignedCharacterId
    })
  if (context.phase.kind === 'SIDE_ACTOR_ORDER') {
    if (
      input.command.resolution.kind !== 'INITIATIVE_ENTITY' ||
      !controlsActor(input.command.resolution.entityId)
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    return context
  }
  if (context.phase.kind === 'ENTITY_ORDER') {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  if (context.phase.kind === 'INITIATIVE_DECLARATION')
    throw new EncounterConflictError(
      'Initiative declaration requires its aggregate choice context.'
    )
  const current =
    context.phase.kind === 'PRIMARY_SCORE'
      ? context.phase.scoreBatch.current
      : context.phase.scoreBatch.current
  const authorized =
    current.kind === 'ACTOR'
      ? controlsActor(current.id)
      : context.root.stagedInitiativeRoundState.participants.some(
          (participant) => participant.sideId === current.id && controlsActor(participant.actorId)
        )
  if (!authorized) throw new EncounterConflictError('Rule occurrence is unavailable.')
  return context
}

async function assertTurnOccurrenceAuthority(input: {
  db: DBLike
  actorUserId: string
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: NonNullable<
    Awaited<ReturnType<ReturnType<typeof createRuleOccurrenceRepository>['lockOccurrence']>>
  >
}) {
  const context = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  ).applicationContext
  if (context?.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  if (input.locked.context.role === 'OWNER') return context
  if (context.currentCandidate.owner.kind !== 'CHARACTER')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  const assignment = await sql<{ user_id: string }>`
    SELECT user_id FROM public.campaign_character_assignments
    WHERE campaign_id = ${input.locked.context.campaignId}
      AND character_id = ${context.currentCandidate.owner.characterId}
    FOR UPDATE
  `.execute(input.db)
  if (
    input.locked.context.assignedCharacterId !== context.currentCandidate.owner.characterId ||
    assignment.rows[0]?.user_id !== input.actorUserId
  )
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  return context
}

async function resolveEncounterLegendaryActionRuleOccurrence(input: {
  db: DBLike
  runtime?: RulesRuntimeService
  userId: string
  command: MovementReactionResolveRuleOccurrenceCommand | D20ResolveRuleOccurrenceCommand
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
  commandReceipt?: RuleOccurrenceReceipt | null
  rollD20?: () => number
  rollD6?: () => number
}): Promise<{ response: EncounterCommandResultDto; replayed: boolean }> {
  const repository = createEncounterRepository(input.db)
  const occurrences = createRuleOccurrenceRepository(input.db)
  const commandFingerprint = fingerprint(input.command)
  if (input.commandReceipt?.commandMetadata.transition === 'TURN_EFFECTS_PENDING') {
    if (
      input.commandReceipt.commandFingerprint !== commandFingerprint ||
      input.commandReceipt.actorUserId !== input.userId ||
      input.commandReceipt.resultPayload.status !== 'ENCOUNTER_OCCURRENCE_PENDING'
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: true,
      response: encounterCommandResultDtoSchema.parse({
        projection: projection.projection,
        roll: null,
        resolution: null,
        occurrence: input.commandReceipt.resultPayload.occurrence
      })
    }
  }
  if (input.occurrence.state === 'COMPLETED') {
    const receipt = await occurrences.findTerminalReceiptByOccurrence(
      'ENCOUNTER',
      input.locked.encounter.id,
      input.occurrence.id
    )
    if (
      !receipt ||
      receipt.commandMetadata.transition !== 'TURN_EFFECTS' ||
      !receipt.commandMetadata.resolutionCommands.some(
        (entry) =>
          entry.commandId === input.command.commandId &&
          entry.commandFingerprint === commandFingerprint &&
          entry.actorUserId === input.userId
      )
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: true,
      response: encounterCommandResultDtoSchema.parse({
        projection: projection.projection,
        roll: null,
        resolution: null,
        occurrence: {
          occurrenceId: input.occurrence.id,
          occurrenceVersion: input.occurrence.version,
          status: 'COMPLETE',
          outcome: null,
          pending: null
        }
      })
    }
  }
  if (
    input.locked.context.role !== 'OWNER' ||
    input.locked.encounter.version !== input.command.expectedVersion ||
    input.occurrence.version !== input.command.expectedOccurrenceVersion ||
    input.occurrence.expectedAggregateVersion !== input.locked.encounter.version ||
    !input.runtime
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  const frozenSource = async (root: TurnCoordinatorRootDto) => {
    const revisionId = root.frozenActorRuleRevisionId
    const revisionChecksum = root.frozenActorRuleRevisionChecksum
    const snapshotChecksum = root.frozenActorRuleSnapshotChecksum
    if (!revisionId || !revisionChecksum || !snapshotChecksum) {
      throw new EncounterConflictError('The frozen Legendary Action source is unavailable.')
    }
    const revision = await requireImmutableEncounterActorRuleRevision({
      db: input.db,
      revisionId,
      expectedChecksum: revisionChecksum
    })
    const evaluated = await evaluateEncounterActorRuleSnapshot({
      db: input.db,
      encounter: input.locked.encounter,
      revisionId: revision.id
    })
    if (checksumEncounterActorRuleSnapshot(evaluated.snapshot) !== snapshotChecksum) {
      throw new EncounterConflictError('The frozen Legendary Action source is stale.')
    }
    return evaluated
  }
  const prepareSelected = async (inputChoice: {
    root: TurnCoordinatorRootDto
    choice: Parameters<typeof prepareEncounterLegendaryAction>[0]['choice']
    optionId: string
  }) => {
    const outgoingActorId = input.locked.encounter.currentActorId
    if (!outgoingActorId) {
      throw new EncounterConflictError('The Legendary Action turn owner is unavailable.')
    }
    const evaluated = await frozenSource(inputChoice.root)
    const queue = inputChoice.root.legendaryActionQueue
    if (!queue || queue.ownerActorIds[queue.nextOwnerIndex] !== inputChoice.choice.ownerActorId) {
      throw new EncounterConflictError('The Legendary Action owner queue is stale.')
    }
    const window = await discoverEncounterLegendaryActionWindow({
      trx: input.db,
      encounter: evaluated.reconciledEncounter,
      outgoingActorId,
      occurrenceId: input.occurrence.id,
      actorRules: evaluated.snapshot.output,
      runtime: input.runtime!,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      ownerActorId: inputChoice.choice.ownerActorId
    })
    if (!window) throw new EncounterConflictError('The Legendary Action choice is stale.')
    const prepared = await prepareEncounterLegendaryAction({
      trx: input.db,
      actorUserId: input.userId,
      automationMode:
        input.locked.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
      encounter: evaluated.reconciledEncounter,
      choice: inputChoice.choice,
      optionId: inputChoice.optionId,
      window
    })
    return { evaluated, prepared }
  }

  const pendingSnapshot = input.occurrence.pendingSnapshot
  if (pendingSnapshot && isServerAggregateChoicePendingSnapshot(pendingSnapshot)) {
    const context = pendingSnapshot.applicationContext
    if (
      context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
      !isMovementReactionResolveRuleOccurrenceCommand(input.command)
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    const resolutionCommand: TurnResolutionCommandDto =
      input.command.resolution.kind === 'DECLINE'
        ? {
            kind: 'LEGENDARY_DECLINE',
            commandId: input.command.commandId,
            commandFingerprint,
            actorUserId: input.userId,
            correlationId: input.command.correlationId,
            expectedOccurrenceVersion: input.occurrence.version,
            selectionChecksum: context.selectionChecksum
          }
        : {
            kind: 'LEGENDARY_OPTION',
            commandId: input.command.commandId,
            commandFingerprint,
            actorUserId: input.userId,
            correlationId: input.command.correlationId,
            expectedOccurrenceVersion: input.occurrence.version,
            selectionChecksum: context.selectionChecksum,
            optionId: input.command.resolution.optionId
          }
    if (input.command.resolution.kind === 'DECLINE') {
      return continueEncounterTurnAfterLegendaryAction({
        trx: input.db,
        runtime: input.runtime,
        userId: input.userId,
        command: input.command,
        commandFingerprint,
        locked: input.locked,
        occurrence: input.occurrence,
        root: context.root,
        legendaryAction: declinedEncounterLegendaryAction(context.choice),
        resolutionCommand,
        ...(input.rollD20 ? { rollD20: input.rollD20 } : {}),
        ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
      })
    }
    const { prepared } = await prepareSelected({
      root: context.root,
      choice: context.choice,
      optionId: input.command.resolution.optionId
    })
    const execution = await executeEncounterLegendaryAction({
      runtime: input.runtime,
      occurrenceId: input.occurrence.id,
      automationMode:
        input.locked.encounter.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
      prepared,
      ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
    })
    if (execution.kind === 'PENDING') {
      const paused = await occurrences.advancePending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        expectedOccurrenceVersion: input.occurrence.version,
        expectedAggregateVersion: input.locked.encounter.version,
        nextAggregateVersion: input.locked.encounter.version,
        pendingSnapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...execution.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE',
            schemaVersion: 1,
            root: {
              ...context.root,
              resolutionCommands: [...context.root.resolutionCommands, resolutionCommand]
            },
            choiceSelectionChecksum: context.selectionChecksum,
            choice: context.choice,
            selectionChecksum: checksumRuleDocument(prepared.option),
            selectedOption: prepared.option,
            d20Policy: execution.d20Policy
          }
        })
      })
      const occurrence = await appendPendingLegendaryResolutionReceipt({
        occurrences,
        encounterId: input.locked.encounter.id,
        command: input.command,
        commandFingerprint,
        actorUserId: input.userId,
        paused,
        encounterVersion: input.locked.encounter.version,
        root: context.root,
        resolutionCommand
      })
      const projection = await repository.requireCurrentProjection({
        encounterId: input.locked.encounter.id,
        expectedStreamVersion: input.locked.encounter.version
      })
      return {
        replayed: false,
        response: encounterCommandResultDtoSchema.parse({
          projection: projection.projection,
          roll: null,
          resolution: null,
          occurrence
        })
      }
    }
    const settled = await settleEncounterLegendaryAction({
      db: input.db,
      actorUserId: input.userId,
      encounterId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      commandId: input.command.commandId,
      prepared,
      execution
    })
    return continueEncounterTurnAfterLegendaryAction({
      trx: input.db,
      runtime: input.runtime,
      userId: input.userId,
      command: input.command,
      commandFingerprint,
      locked: input.locked,
      occurrence: input.occurrence,
      root: context.root,
      legendaryAction: settled.evidence,
      resolutionCommand,
      characterTransitions:
        settled.evidence.resolution.kind === 'EXECUTED'
          ? settled.evidence.resolution.characterTransitions
          : [],
      ...(input.rollD20 ? { rollD20: input.rollD20 } : {}),
      ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
    })
  }

  const kernelSnapshot = requireEncounterKernelPendingSnapshot(pendingSnapshot)
  const context = kernelSnapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
    !isD20ResolveRuleOccurrenceCommand(input.command) ||
    input.command.resolution.requestId !== kernelSnapshot.request.requestId
  ) {
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  }
  const { prepared } = await prepareSelected({
    root: context.root,
    choice: context.choice,
    optionId: context.selectedOption.optionId
  })
  const execution = await executeEncounterLegendaryAction({
    runtime: input.runtime,
    occurrenceId: input.occurrence.id,
    automationMode: 'ASSISTED',
    prepared,
    continuation: kernelSnapshot,
    expectedD20Policy: context.d20Policy,
    resolution: input.command.resolution,
    ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
  })
  if (execution.kind !== 'COMPLETE') {
    throw new EncounterConflictError('Legendary Action evidence did not settle.')
  }
  const resolutionCommand: TurnResolutionCommandDto = {
    kind:
      input.command.resolution.kind === 'ENTER_DICE'
        ? 'LEGENDARY_ENTER_DICE'
        : 'LEGENDARY_SYSTEM_ROLL',
    commandId: input.command.commandId,
    commandFingerprint,
    actorUserId: input.userId,
    correlationId: input.command.correlationId,
    expectedOccurrenceVersion: input.occurrence.version,
    requestId: input.command.resolution.requestId
  }
  const settled = await settleEncounterLegendaryAction({
    db: input.db,
    actorUserId: input.userId,
    encounterId: input.locked.encounter.id,
    occurrenceId: input.occurrence.id,
    commandId: input.command.commandId,
    prepared,
    execution
  })
  return continueEncounterTurnAfterLegendaryAction({
    trx: input.db,
    runtime: input.runtime,
    userId: input.userId,
    command: input.command,
    commandFingerprint,
    locked: input.locked,
    occurrence: input.occurrence,
    root: context.root,
    legendaryAction: settled.evidence,
    resolutionCommand,
    characterTransitions:
      settled.evidence.resolution.kind === 'EXECUTED'
        ? settled.evidence.resolution.characterTransitions
        : [],
    ...(input.rollD20 ? { rollD20: input.rollD20 } : {}),
    ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
  })
}

async function continueEncounterTurnAfterLegendaryAction(input: {
  trx: DBLike
  runtime: RulesRuntimeService
  userId: string
  command: MovementReactionResolveRuleOccurrenceCommand | D20ResolveRuleOccurrenceCommand
  commandFingerprint: string
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
  root: TurnCoordinatorRootDto
  legendaryAction: EncounterLegendaryActionEvidence
  resolutionCommand: TurnResolutionCommandDto
  rollD20?: () => number
  rollD6?: () => number
  characterTransitions?: Array<{
    characterId: string
    beforeStreamVersion: number
    afterStreamVersion: number
  }>
}): Promise<{ response: EncounterCommandResultDto; replayed: boolean }> {
  const repository = createEncounterRepository(input.trx)
  const occurrences = createRuleOccurrenceRepository(input.trx)
  const frozenRevisionId = input.root.frozenActorRuleRevisionId
  const frozenRevisionChecksum = input.root.frozenActorRuleRevisionChecksum
  if (!frozenRevisionId || !frozenRevisionChecksum || !input.root.outgoingTurn) {
    throw new EncounterConflictError('The frozen Legendary Action turn source is unavailable.')
  }
  const frozenRevision = await requireImmutableEncounterActorRuleRevision({
    db: input.trx,
    revisionId: frozenRevisionId,
    expectedChecksum: frozenRevisionChecksum
  })
  const initialEncounter = input.root.stagedLegendaryActionRefreshes?.length
    ? await repository.find(input.locked.encounter.id)
    : input.locked.encounter
  if (!initialEncounter) throw new EncounterNotFoundError()
  let currentEncounter: EncounterRecord = initialEncounter
  let actorEvaluation = await evaluateEncounterActorRuleSnapshot({
    db: input.trx,
    encounter: currentEncounter,
    revisionId: frozenRevision.id
  })
  currentEncounter = actorEvaluation.reconciledEncounter
  const history = [...input.root.resolutionCommands, input.resolutionCommand]
  const queue = input.root.legendaryActionQueue
  if (
    !queue ||
    queue.ownerActorIds[queue.nextOwnerIndex] !== input.legendaryAction.choice.ownerActorId
  ) {
    throw new EncounterConflictError('The Legendary Action owner queue is stale.')
  }
  let root: TurnCoordinatorRootDto = {
    ...input.root,
    completedLegendaryActions: [
      ...(input.root.completedLegendaryActions ?? []),
      input.legendaryAction
    ],
    resolutionCommands: history
  }
  let stagedLegendaryRefreshActors: readonly EncounterActorRecord[] = []
  if (root.stagedLegendaryActionRefreshes?.length) {
    stagedLegendaryRefreshActors = await applyStagedLegendaryActionRefreshes({
      encounter: currentEncounter,
      definitions: createReusableDefinitionRepository(input.trx),
      refreshes: root.stagedLegendaryActionRefreshes
    })
    currentEncounter = {
      ...currentEncounter,
      actors: currentEncounter.actors.map(
        (actor) =>
          stagedLegendaryRefreshActors.find((candidate) => candidate.id === actor.id) ?? actor
      )
    }
    actorEvaluation = await evaluateEncounterActorRuleSnapshot({
      db: input.trx,
      encounter: currentEncounter,
      revisionId: frozenRevision.id,
      previousSnapshot: actorEvaluation.snapshot
    })
    currentEncounter = actorEvaluation.reconciledEncounter
  }
  const outgoingActorId = input.locked.encounter.currentActorId
  if (!outgoingActorId) {
    throw new EncounterConflictError('The Legendary Action turn owner is unavailable.')
  }
  for (
    let nextOwnerIndex = queue.nextOwnerIndex + 1;
    nextOwnerIndex < queue.ownerActorIds.length;
    nextOwnerIndex += 1
  ) {
    const ownerActorId = queue.ownerActorIds[nextOwnerIndex]!
    const nextWindow = await discoverEncounterLegendaryActionWindow({
      trx: input.trx,
      encounter: currentEncounter,
      outgoingActorId,
      occurrenceId: input.occurrence.id,
      actorRules: actorEvaluation.snapshot.output,
      runtime: input.runtime,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      ownerActorId
    })
    // A frozen owner that is no longer eligible receives no opportunity and consumes nothing.
    if (!nextWindow) continue
    root = {
      ...root,
      legendaryActionQueue: { ownerActorIds: queue.ownerActorIds, nextOwnerIndex }
    }
    const paused = await occurrences.advancePending({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      expectedOccurrenceVersion: input.occurrence.version,
      expectedAggregateVersion: input.locked.encounter.version,
      nextAggregateVersion: input.locked.encounter.version,
      pendingSnapshot: createEncounterLegendaryActionChoicePendingSnapshot({
        occurrenceId: input.occurrence.id,
        root,
        choice: nextWindow.choice
      })
    })
    const occurrence = await appendPendingLegendaryResolutionReceipt({
      occurrences,
      encounterId: input.locked.encounter.id,
      command: input.command,
      commandFingerprint: input.commandFingerprint,
      actorUserId: input.userId,
      paused,
      encounterVersion: input.locked.encounter.version,
      root,
      resolutionCommand: input.resolutionCommand,
      characterTransitions: input.characterTransitions
    })
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: false,
      response: encounterCommandResultDtoSchema.parse({
        projection: projection.projection,
        roll: null,
        resolution: null,
        occurrence
      })
    }
  }
  root = { ...root, legendaryActionQueue: undefined }
  let terminalInitiative = root.initiative
  let terminalTransition = root.proposedTerminalTransition
  const initiativeAdvance = root.initiativeAdvance
  if (!initiativeAdvance) {
    throw new EncounterConflictError('The Legendary Action turn advance is unavailable.')
  }
  if (initiativeAdvance?.kind === 'ROUND_WRAP' && initiativeAdvance.cadence === 'EACH_ROUND') {
    const beforePin: InitiativeBeforePinDto = {
      kind: 'EACH_ROUND',
      round: initiativeAdvance.round,
      version: input.locked.encounter.version,
      checksum: initiativeAdvance.stateChecksum,
      actorIds: input.locked.encounter.actors.map((actor) => actor.id).sort()
    }
    const stagedRoundState = createStagedInitiativeRoundState({
      encounter: currentEncounter,
      round: initiativeAdvance.nextRound
    })
    const initiative = await startEncounterInitiativeCommand({
      trx: input.trx,
      repository,
      encounter: currentEncounter,
      round: initiativeAdvance.nextRound,
      occurrenceId: input.occurrence.id,
      runtime: input.runtime,
      attunementSlotOverride: input.locked.context.attunementSlotOverride,
      getEncounterActorSnapshot: async () => ({
        rules: actorEvaluation.snapshot.output,
        encounter: currentEncounter
      }),
      legacyOrderedActorIds: initiativeAdvance.orderedActorIds,
      stagedRoundState,
      integerSource: ({ min, max }) =>
        min === 1 && max === 20 && input.rollD20 ? input.rollD20() : randomInt(min, max + 1)
    })
    if (initiative.kind === 'PENDING') {
      const policySnapshotChecksum = currentEncounter.initiativePolicySnapshotChecksum
      if (!policySnapshotChecksum)
        throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
      const paused = await occurrences.advancePending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: input.locked.encounter.id,
        occurrenceId: input.occurrence.id,
        expectedOccurrenceVersion: input.occurrence.version,
        expectedAggregateVersion: input.locked.encounter.version,
        nextAggregateVersion: input.locked.encounter.version,
        pendingSnapshot: createEncounterInitiativePendingSnapshot({
          root: {
            rootCommandId: root.rootCommandId,
            commandFingerprint: root.commandFingerprint,
            commandType: 'ADVANCE_TURN',
            initiatorUserId: root.initiatorUserId,
            correlationId: root.correlationId,
            expectedEncounterVersion: root.expectedEncounterVersion,
            round: initiativeAdvance.nextRound,
            policySnapshotChecksum,
            initiativeBeforePin: beforePin,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
            startSystemId: null,
            initiativeAdvance,
            outgoingTurn: root.outgoingTurn,
            completedLegendaryActions: root.completedLegendaryActions,
            stagedLegendaryActionRefreshes: root.stagedLegendaryActionRefreshes,
            completedRechargePlan: root.completedRechargePlan,
            resolutionCommands: history
          },
          pending: initiative.pending
        })
      })
      const occurrence = await appendPendingLegendaryResolutionReceipt({
        occurrences,
        encounterId: input.locked.encounter.id,
        command: input.command,
        commandFingerprint: input.commandFingerprint,
        actorUserId: input.userId,
        paused,
        encounterVersion: input.locked.encounter.version,
        root,
        resolutionCommand: input.resolutionCommand,
        characterTransitions: input.characterTransitions
      })
      const projection = await repository.requireCurrentProjection({
        encounterId: input.locked.encounter.id,
        expectedStreamVersion: input.locked.encounter.version
      })
      return {
        replayed: false,
        response: encounterCommandResultDtoSchema.parse({
          projection: projection.projection,
          roll: null,
          resolution: null,
          occurrence
        })
      }
    }
    terminalInitiative = encounterInitiativeSettlementDtoSchema.parse({
      round: initiative.state.round.round,
      cadence: initiative.state.round.cadence,
      procedure: initiative.state.round.procedure,
      policySnapshotChecksum: initiative.state.round.policySnapshotChecksum,
      orderedActorIds: initiative.orderedActorIds,
      orderedSideIds: initiative.orderedSideIds,
      evidence: initiative.evidence
    })
    terminalTransition = {
      status: 'ACTIVE',
      round: terminalInitiative.round,
      currentActorId: terminalInitiative.orderedActorIds[0] ?? null
    }
    root = {
      ...root,
      initiative: terminalInitiative,
      stagedInitiative: {
        beforePin,
        stagedRoundState: serializeStagedInitiativeRoundState(initiative.state)
      },
      proposedTerminalTransition: terminalTransition
    }
  }

  let stagedRechargeActor: EncounterActorRecord | null = null
  const enteringActorId = terminalTransition.currentActorId
  if (enteringActorId) {
    const candidates = await discoverEncounterRechargeCandidates({
      actorId: enteringActorId,
      encounterActors: currentEncounter.actors,
      actorRules: actorEvaluation.snapshot.output,
      definitions: createReusableDefinitionRepository(input.trx)
    })
    if (candidates.length > 0) {
      const selectionChecksum = rechargePlanSelectionChecksum(candidates)
      const completed: TurnRechargeExecution[] = []
      for (const [ordinal, candidate] of candidates.entries()) {
        const recharge = await executeEncounterRechargeCandidate({
          candidate,
          occurrenceId: input.occurrence.id,
          definitions: createReusableDefinitionRepository(input.trx),
          runtime: input.runtime,
          mode: input.locked.encounter.automationMode,
          ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
        })
        if (recharge?.kind === 'PENDING') {
          const paused = await occurrences.advancePending({
            aggregateKind: 'ENCOUNTER',
            aggregateId: input.locked.encounter.id,
            occurrenceId: input.occurrence.id,
            expectedOccurrenceVersion: input.occurrence.version,
            expectedAggregateVersion: input.locked.encounter.version,
            nextAggregateVersion: input.locked.encounter.version,
            pendingSnapshot: rechargePendingSnapshot({
              continuation: recharge.continuation,
              root,
              selectionChecksum,
              completedExecutions: completed,
              currentCandidate: rechargePendingCandidate(candidate, ordinal),
              remainingCandidates: candidates
                .slice(ordinal + 1)
                .map((remaining, remainingOrdinal) =>
                  rechargePendingCandidate(remaining, ordinal + remainingOrdinal + 1)
                )
            })
          })
          const occurrence = await appendPendingLegendaryResolutionReceipt({
            occurrences,
            encounterId: input.locked.encounter.id,
            command: input.command,
            commandFingerprint: input.commandFingerprint,
            actorUserId: input.userId,
            paused,
            encounterVersion: input.locked.encounter.version,
            root,
            resolutionCommand: input.resolutionCommand,
            characterTransitions: input.characterTransitions
          })
          const projection = await repository.requireCurrentProjection({
            encounterId: input.locked.encounter.id,
            expectedStreamVersion: input.locked.encounter.version
          })
          return {
            replayed: false,
            response: encounterCommandResultDtoSchema.parse({
              projection: projection.projection,
              roll: null,
              resolution: null,
              occurrence
            })
          }
        }
        if (!recharge) throw new EncounterConflictError('Recharge execution became unavailable.')
        completed.push(rechargeCompletedExecution({ ordinal, result: recharge }))
      }
      const plan = completedRechargePlan(selectionChecksum, completed)
      if (!plan) throw new EncounterConflictError('Recharge plan lacks terminal evidence.')
      const staged = stageCompletedRechargePlan({
        encounter: currentEncounter,
        actorRules: actorEvaluation.snapshot.output,
        plan,
        currentActorId: enteringActorId
      })
      currentEncounter = staged.encounter
      stagedRechargeActor = staged.actor
      root = { ...root, completedRechargePlan: plan }
    }
  }

  const incomingEvaluation = await evaluateEncounterTurnCharacterActiveEffects({
    trx: input.trx,
    actorUserId: input.userId,
    encounter: currentEncounter,
    commandType: 'ADVANCE_TURN',
    boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: enteringActorId }],
    occurrenceId: input.occurrence.id,
    runtime: input.runtime,
    attunementSlotOverride: input.locked.context.attunementSlotOverride,
    coordinatorRoot: root,
    getEncounterActorSnapshot: async () => ({
      rules: actorEvaluation.snapshot.output,
      encounter: currentEncounter
    }),
    rollD20: input.rollD20
  })
  if (incomingEvaluation.kind === 'PENDING') {
    const paused = await occurrences.advancePending({
      aggregateKind: 'ENCOUNTER',
      aggregateId: input.locked.encounter.id,
      occurrenceId: input.occurrence.id,
      expectedOccurrenceVersion: input.occurrence.version,
      expectedAggregateVersion: input.locked.encounter.version,
      nextAggregateVersion: input.locked.encounter.version,
      pendingSnapshot: incomingEvaluation.pendingSnapshot
    })
    const occurrence = await appendPendingLegendaryResolutionReceipt({
      occurrences,
      encounterId: input.locked.encounter.id,
      command: input.command,
      commandFingerprint: input.commandFingerprint,
      actorUserId: input.userId,
      paused,
      encounterVersion: input.locked.encounter.version,
      root,
      resolutionCommand: input.resolutionCommand,
      characterTransitions: input.characterTransitions
    })
    const projection = await repository.requireCurrentProjection({
      encounterId: input.locked.encounter.id,
      expectedStreamVersion: input.locked.encounter.version
    })
    return {
      replayed: false,
      response: encounterCommandResultDtoSchema.parse({
        projection: projection.projection,
        roll: null,
        resolution: null,
        occurrence
      })
    }
  }

  const terminalOccurrenceVersion = input.occurrence.version + 1
  if (root.stagedInitiative) {
    const applied = await applyStagedInitiativeState({
      repository,
      encounter: input.locked.encounter,
      beforePin: root.stagedInitiative.beforePin,
      stagedRoundState: root.stagedInitiative.stagedRoundState,
      ...(initiativeAdvance?.kind === 'ROUND_WRAP' && initiativeAdvance.cadence === 'EACH_ROUND'
        ? { initiativeAdvance }
        : {})
    })
    if (
      applied.round.round !== terminalTransition.round ||
      applied.participants.find((participant) => participant.status === 'ACTIVE')?.actorId !==
        terminalTransition.currentActorId
    ) {
      throw new EncounterConflictError('Staged initiative did not settle the expected turn cursor.')
    }
  } else if (initiativeAdvance) {
    const advanced = await applyEncounterInitiativeAdvanceCommand({
      repository,
      encounterId: input.locked.encounter.id,
      plan: initiativeAdvance
    })
    if (
      advanced.round !== terminalTransition.round ||
      advanced.currentActorId !== terminalTransition.currentActorId
    ) {
      throw new EncounterConflictError('Normalized initiative advancement did not settle exactly.')
    }
  }
  for (const actor of stagedLegendaryRefreshActors) await repository.updateActor(actor)
  for (const actor of actorEvaluation.actorUpdates) await repository.updateActor(actor)
  if (stagedRechargeActor) await repository.updateActor(stagedRechargeActor)
  const outgoingTurn = root.outgoingTurn
  if (!outgoingTurn) {
    throw new EncounterConflictError('The Legendary Action outgoing turn is unavailable.')
  }
  const restoredOutgoingBatch =
    outgoingTurn.kind === 'STAGED'
      ? await restoreEvaluatedEncounterTurnEffectBatch({
          trx: input.trx,
          actorUserId: input.userId,
          encounter: currentEncounter,
          commandType: 'ADVANCE_TURN',
          boundaries: boundariesForStagedTurnPlan(outgoingTurn.plan),
          occurrenceId: input.occurrence.id,
          runtime: input.runtime,
          attunementSlotOverride: input.locked.context.attunementSlotOverride,
          coordinatorRoot: root,
          stagedPlan: outgoingTurn.plan,
          getEncounterActorSnapshot: async () => ({
            rules: actorEvaluation.snapshot.output,
            encounter: currentEncounter
          }),
          rollD20: input.rollD20
        })
      : null
  const outgoingResult =
    restoredOutgoingBatch === null
      ? null
      : await applyEvaluatedTurnEffectBatch({
          trx: input.trx,
          actorUserId: input.userId,
          encounter: currentEncounter,
          commandType: 'ADVANCE_TURN',
          occurrenceId: input.occurrence.id,
          occurrenceVersion: terminalOccurrenceVersion,
          batch: restoredOutgoingBatch
        })
  const incomingResult =
    incomingEvaluation.kind === 'READY'
      ? await applyEvaluatedTurnEffectBatch({
          trx: input.trx,
          actorUserId: input.userId,
          encounter: currentEncounter,
          commandType: 'ADVANCE_TURN',
          occurrenceId: input.occurrence.id,
          occurrenceVersion: terminalOccurrenceVersion,
          batch: incomingEvaluation.batch
        })
      : incomingEvaluation.result
  const outgoingEvidence = completedPendingTurnPhaseEvidence({
    phase: outgoingTurn,
    restoredResult: outgoingResult
  })
  const incomingEvidence = completedTurnPhaseEvidence({
    selectionChecksum:
      incomingEvaluation.kind === 'READY'
        ? incomingEvaluation.batch.selectionChecksum
        : incomingEvaluation.selectionChecksum,
    result: incomingResult
  })
  const selectionChecksum = turnLifecycleSelectionChecksum({
    outgoing: outgoingEvidence,
    incoming: incomingEvidence,
    legendaryActions: root.completedLegendaryActions ?? [],
    legendaryActionRefreshes: root.stagedLegendaryActionRefreshes ?? []
  })
  const result = storedRuleExecutionResultDtoSchema.parse({
    status: 'TURN_LIFECYCLE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.occurrence.id,
    occurrenceVersion: terminalOccurrenceVersion,
    encounterId: input.locked.encounter.id,
    commandType: 'ADVANCE_TURN',
    initiativeAdvance,
    initiative: terminalInitiative,
    rechargeExecutions: rechargeExecutionsForRoot(root),
    outgoingTurn: outgoingEvidence,
    legendaryActions: root.completedLegendaryActions ?? [],
    legendaryActionRefreshes: root.stagedLegendaryActionRefreshes ?? [],
    incomingTurn: incomingEvidence
  })
  const nextVersion = input.locked.encounter.version + 1
  await repository.update({
    encounterId: input.locked.encounter.id,
    status: terminalTransition.status,
    version: nextVersion,
    round: terminalTransition.round,
    currentActorId: terminalTransition.currentActorId
  })
  const updated = await repository.find(input.locked.encounter.id)
  if (!updated) throw new EncounterNotFoundError()
  actorEvaluation = await evaluateEncounterActorRuleSnapshot({
    db: input.trx,
    encounter: updated,
    revisionId: frozenRevision.id
  })
  for (const actor of actorEvaluation.actorUpdates) await repository.updateActor(actor)
  const gmProjection = projectGm(
    actorEvaluation.reconciledEncounter,
    actorEvaluation.snapshot.output
  )
  const currentProjection = compileEncounterCurrentProjection(
    gmProjection,
    actorEvaluation.snapshot
  )
  await repository.publishCurrentProjection(currentProjection)
  await occurrences.complete({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    occurrenceId: input.occurrence.id,
    expectedOccurrenceVersion: input.occurrence.version,
    expectedAggregateVersion: input.locked.encounter.version,
    nextAggregateVersion: nextVersion
  })
  await occurrences.appendReceipt({
    aggregateKind: 'ENCOUNTER',
    aggregateId: input.locked.encounter.id,
    commandId: root.rootCommandId,
    commandFingerprint: root.commandFingerprint,
    occurrenceId: input.occurrence.id,
    aggregateVersion: nextVersion,
    commandType: root.commandType,
    actorUserId: root.initiatorUserId,
    correlationId: root.correlationId,
    commandMetadata: {
      schemaVersion: 1,
      transition: 'TURN_EFFECTS',
      commandType: root.commandType,
      expectedAggregateVersion: root.expectedEncounterVersion,
      selectionChecksum,
      initiativeChecksum:
        terminalInitiative === null ? null : checksumCanonicalJson(terminalInitiative),
      initiativeAdvanceChecksum:
        initiativeAdvance === null ? null : checksumCanonicalJson(initiativeAdvance),
      terminalOccurrenceVersion,
      resolutionCommands: history
    },
    resultPayload: result
  })
  const response = encounterCommandResultDtoSchema.parse({
    projection: gmProjection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId: input.occurrence.id,
      occurrenceVersion: terminalOccurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  const rootPayload =
    root.commandType === 'START'
      ? {
          type: 'START',
          encounterId: input.locked.encounter.id,
          commandId: root.rootCommandId,
          expectedVersion: root.expectedEncounterVersion,
          ...(root.startSystemId ? { systemId: root.startSystemId } : {})
        }
      : {
          type: 'ADVANCE_TURN',
          encounterId: input.locked.encounter.id,
          commandId: root.rootCommandId,
          expectedVersion: root.expectedEncounterVersion
        }
  await repository.appendEvent({
    id: randomUUID(),
    encounterId: input.locked.encounter.id,
    campaignId: input.locked.encounter.campaignId,
    version: nextVersion,
    commandId: root.rootCommandId,
    commandType: root.commandType,
    commandFingerprint: root.commandFingerprint,
    commandPayload: rootPayload as Json,
    resultPayload: encounterProjectionEventSchema.parse({
      command: response,
      currentProjection,
      ruleReceipt: {
        occurrenceId: input.occurrence.id,
        resultChecksum: checksumCanonicalJson(result)
      }
    }) as unknown as Json,
    actorUserId: root.initiatorUserId,
    correlationId: root.correlationId
  })
  return {
    replayed: false,
    response
  }
}

function assertRechargeOccurrenceAuthority(input: {
  locked: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence: RuleOccurrenceRecord
}) {
  const context = requireEncounterKernelPendingSnapshot(
    input.occurrence.pendingSnapshot
  ).applicationContext
  if (context?.kind !== 'ENCOUNTER_TURN_RECHARGE' || input.locked.context.role !== 'OWNER')
    throw new EncounterConflictError('Rule occurrence is unavailable.')
  return context
}

async function resolveEncounterTurnRuleOccurrence(input: {
  db: DBLike
  runtime?: RulesRuntimeService
  userId: string
  command: D20ResolveRuleOccurrenceCommand | RechargeResolveRuleOccurrenceCommand
  liveSessionAuthority?: LiveSessionCommandAuthority
  rollD20?: () => number
  rollD6?: () => number
  locked?: Awaited<ReturnType<typeof lockEncounterRuleExecutionCommandContext>>
  occurrence?: RuleOccurrenceRecord
  commandReceipt?: RuleOccurrenceReceipt | null
}): Promise<{ response: EncounterCommandResultDto; replayed: boolean }> {
  return withTransaction(input.db, async (trx) => {
    const locked =
      input.locked ??
      (await lockEncounterRuleExecutionCommandContext(trx, {
        actorUserId: input.userId,
        authority: 'ACTIVE_MEMBER',
        encounterId: input.command.encounterId,
        ...(input.liveSessionAuthority ? { liveSessionAuthority: input.liveSessionAuthority } : {})
      }))
    const repository = createEncounterRepository(trx)
    const occurrences = createRuleOccurrenceRepository(trx)
    const occurrence =
      input.occurrence ??
      (await occurrences.lockOccurrence(
        'ENCOUNTER',
        locked.encounter.id,
        input.command.occurrenceId
      ))
    if (!occurrence) throw new EncounterConflictError('Rule occurrence is unavailable.')
    const commandFingerprint = fingerprint(input.command)
    const pendingContext = occurrence.pendingSnapshot?.applicationContext
    const currentTurnRoot =
      pendingContext?.kind === 'ENCOUNTER_TURN_RECHARGE' ||
      pendingContext?.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
        ? pendingContext.root
        : null
    const commandReceipt =
      input.commandReceipt ??
      (await occurrences.findReceipt('ENCOUNTER', locked.encounter.id, input.command.commandId))
    if (commandReceipt?.commandMetadata.transition === 'TURN_EFFECTS_PENDING') {
      const metadata = commandReceipt.commandMetadata
      if (
        commandReceipt.occurrenceId !== occurrence.id ||
        commandReceipt.aggregateId !== locked.encounter.id ||
        commandReceipt.commandId !== input.command.commandId ||
        commandReceipt.commandFingerprint !== commandFingerprint ||
        commandReceipt.actorUserId !== input.userId ||
        commandReceipt.correlationId !== input.command.correlationId ||
        !currentTurnRoot ||
        metadata.rootCommandId !== currentTurnRoot.rootCommandId ||
        metadata.rootCommandFingerprint !== currentTurnRoot.commandFingerprint ||
        metadata.rootInitiatorUserId !== currentTurnRoot.initiatorUserId ||
        metadata.rootCorrelationId !== currentTurnRoot.correlationId ||
        metadata.resolutionCommand.commandId !== input.command.commandId ||
        metadata.resolutionCommand.commandFingerprint !== commandFingerprint ||
        metadata.resolutionCommand.actorUserId !== input.userId ||
        metadata.resolutionCommand.correlationId !== input.command.correlationId ||
        commandReceipt.resultPayload.status !== 'ENCOUNTER_OCCURRENCE_PENDING'
      ) {
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      }
      const projection = await repository.requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: locked.encounter.version
      })
      return {
        replayed: true,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: commandReceipt.resultPayload.occurrence
        })
      }
    }
    if (occurrence.state === 'COMPLETED') {
      const receipt = await occurrences.findTerminalReceiptByOccurrence(
        'ENCOUNTER',
        locked.encounter.id,
        occurrence.id
      )
      if (
        !receipt ||
        receipt.commandMetadata.transition !== 'TURN_EFFECTS' ||
        !receipt.commandMetadata.resolutionCommands.some(
          (entry) =>
            entry.commandId === input.command.commandId &&
            entry.commandFingerprint === commandFingerprint &&
            (locked.context.role === 'OWNER' || entry.actorUserId === input.userId)
        )
      )
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const projection = await repository.requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: locked.encounter.version
      })
      return {
        replayed: true,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: occurrence.id,
            occurrenceVersion:
              receipt.resultPayload.status === 'BATCH_COMPLETE'
                ? receipt.resultPayload.occurrenceVersion
                : occurrence.version,
            status: 'COMPLETE',
            outcome: null,
            pending: null
          }
        })
      }
    }
    const pendingSnapshot = requireEncounterKernelPendingSnapshot(occurrence.pendingSnapshot)
    const context =
      pendingSnapshot.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE'
        ? assertRechargeOccurrenceAuthority({ locked, occurrence })
        : await assertTurnOccurrenceAuthority({
            db: trx,
            actorUserId: input.userId,
            locked,
            occurrence
          })
    if (
      locked.encounter.version !== input.command.expectedVersion ||
      occurrence.version !== input.command.expectedOccurrenceVersion ||
      occurrence.expectedAggregateVersion !== locked.encounter.version
    ) {
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    }
    if (pendingSnapshot.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE') {
      if (!isRechargeResolveRuleOccurrenceCommand(input.command) || !input.runtime)
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const rechargeResolutionKind = input.command.resolution.kind
      if (rechargeResolutionKind !== 'ENTER_INTEGER' && rechargeResolutionKind !== 'SYSTEM_ROLL')
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const rechargeContext = assertRechargeOccurrenceAuthority({ locked, occurrence })
      if (input.command.resolution.requestId !== pendingSnapshot.request.requestId)
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const commandHistory = rechargeContext.root.resolutionCommands.find(
        (entry) => entry.commandId === input.command.commandId
      )
      if (commandHistory) {
        if (commandHistory.commandFingerprint !== commandFingerprint)
          throw new EncounterConflictError('Rule occurrence is unavailable.')
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: true,
          response: encounterCommandResultDtoSchema.parse({
            projection: projection.projection,
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: occurrence.id,
              occurrenceVersion: occurrence.version,
              status: 'PENDING',
              outcome: null,
              pending: rechargePendingSummary(occurrence, locked.encounter.version)
            }
          })
        }
      }
      const rawDie =
        input.command.resolution.kind === 'ENTER_INTEGER'
          ? input.command.resolution.value
          : (input.rollD6 ?? (() => randomInt(1, 7)))()
      if (!Number.isInteger(rawDie) || rawDie < 1 || rawDie > 6)
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const frozenRevisionId = rechargeContext.root.frozenActorRuleRevisionId
      const frozenRevisionChecksum = rechargeContext.root.frozenActorRuleRevisionChecksum
      const frozenSnapshotChecksum = rechargeContext.root.frozenActorRuleSnapshotChecksum
      if (!frozenRevisionId || !frozenRevisionChecksum || !frozenSnapshotChecksum)
        throw new EncounterConflictError('The frozen Encounter actor-rule source is unavailable.')
      const frozenRevision = await requireImmutableEncounterActorRuleRevision({
        db: trx,
        revisionId: frozenRevisionId,
        expectedChecksum: frozenRevisionChecksum
      })
      const actorEvaluation = await evaluateEncounterActorRuleSnapshot({
        db: trx,
        encounter: locked.encounter,
        revisionId: frozenRevision.id
      })
      if (checksumEncounterActorRuleSnapshot(actorEvaluation.snapshot) !== frozenSnapshotChecksum)
        throw new EncounterConflictError('The frozen Encounter actor-rule source is stale.')
      assertRechargeCandidateCurrent({
        encounter: actorEvaluation.reconciledEncounter,
        actorRules: actorEvaluation.snapshot.output,
        candidate: rechargeContext.currentCandidate,
        currentActorId: rechargeContext.root.proposedTerminalTransition.currentActorId
      })
      const completed = await executeEncounterRechargeCandidate({
        candidate: rechargeContext.currentCandidate,
        occurrenceId: occurrence.id,
        definitions: createReusableDefinitionRepository(trx),
        runtime: input.runtime,
        mode: locked.encounter.automationMode,
        continuation: pendingSnapshot,
        rawDie
      })
      if (!completed || completed.kind !== 'COMPLETE')
        throw new EncounterConflictError('Recharge occurrence did not settle.')
      const rechargeResolutionCommand = {
        commandId: input.command.commandId,
        commandFingerprint,
        actorUserId: input.userId,
        correlationId: input.command.correlationId,
        expectedOccurrenceVersion: occurrence.version,
        requestId: input.command.resolution.requestId,
        kind: input.command.resolution.kind
      } as const
      const history = [...rechargeContext.root.resolutionCommands, rechargeResolutionCommand]
      const executions = [
        ...rechargeContext.completedExecutions,
        rechargeCompletedExecution({
          ordinal: rechargeContext.currentCandidate.ordinal,
          result: completed
        })
      ]
      const next = rechargeContext.remainingCandidates[0]
      if (next) {
        assertRechargeCandidateCurrent({
          encounter: actorEvaluation.reconciledEncounter,
          actorRules: actorEvaluation.snapshot.output,
          candidate: next,
          currentActorId: rechargeContext.root.proposedTerminalTransition.currentActorId
        })
        const started = await executeEncounterRechargeCandidate({
          candidate: next,
          occurrenceId: occurrence.id,
          definitions: createReusableDefinitionRepository(trx),
          runtime: input.runtime,
          mode: locked.encounter.automationMode,
          ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
        })
        if (!started || started.kind !== 'PENDING')
          throw new EncounterConflictError(
            'Recharge plan did not retain its next evidence boundary.'
          )
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.encounter.id,
          occurrenceId: occurrence.id,
          expectedOccurrenceVersion: occurrence.version,
          expectedAggregateVersion: locked.encounter.version,
          nextAggregateVersion: locked.encounter.version,
          pendingSnapshot: rechargePendingSnapshot({
            continuation: started.continuation,
            root: { ...rechargeContext.root, resolutionCommands: history },
            selectionChecksum: rechargeContext.selectionChecksum,
            completedExecutions: executions,
            currentCandidate: next,
            remainingCandidates: rechargeContext.remainingCandidates.slice(1)
          })
        })
        const pending = await appendPendingRechargeResolutionReceipt({
          occurrences,
          encounterId: locked.encounter.id,
          command: input.command,
          commandFingerprint,
          actorUserId: input.userId,
          paused,
          encounterVersion: locked.encounter.version,
          root: { ...rechargeContext.root, resolutionCommands: history },
          resolutionCommand: rechargeResolutionCommand
        })
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: false,
          response: encounterCommandResultDtoSchema.parse({
            projection: projection.projection,
            roll: null,
            resolution: null,
            occurrence: pending
          })
        }
      }
      const plan = completedRechargePlan(rechargeContext.selectionChecksum, executions)
      if (!plan) throw new EncounterConflictError('Recharge plan did not retain terminal evidence.')
      const root = {
        ...rechargeContext.root,
        completedRechargePlan: plan,
        resolutionCommands: history
      }
      const stagedRecharge = stageCompletedRechargePlan({
        encounter: actorEvaluation.reconciledEncounter,
        actorRules: actorEvaluation.snapshot.output,
        plan,
        currentActorId: root.proposedTerminalTransition.currentActorId
      })
      const restoredOutgoingBatch =
        root.outgoingTurn?.kind === 'STAGED'
          ? await restoreEvaluatedEncounterTurnEffectBatch({
              trx,
              actorUserId: input.userId,
              encounter: stagedRecharge.encounter,
              commandType: root.commandType,
              boundaries: boundariesForStagedTurnPlan(root.outgoingTurn.plan),
              occurrenceId: occurrence.id,
              runtime: input.runtime,
              attunementSlotOverride: locked.context.attunementSlotOverride,
              coordinatorRoot: root,
              stagedPlan: root.outgoingTurn.plan,
              getEncounterActorSnapshot: async () => ({
                rules: actorEvaluation.snapshot.output,
                encounter: stagedRecharge.encounter
              }),
              rollD20: input.rollD20
            })
          : null
      const effectResult = await evaluateEncounterTurnCharacterActiveEffects({
        trx,
        actorUserId: input.userId,
        encounter: stagedRecharge.encounter,
        commandType: root.commandType,
        boundaries: root.outgoingTurn
          ? [
              {
                ordinal: 1,
                stage: 'START_OF_TURN',
                actorId: root.proposedTerminalTransition.currentActorId
              }
            ]
          : root.commandType === 'START'
            ? [
                {
                  ordinal: 0,
                  stage: 'START_OF_TURN',
                  actorId: root.proposedTerminalTransition.currentActorId
                }
              ]
            : [
                { ordinal: 0, stage: 'END_OF_TURN', actorId: locked.encounter.currentActorId },
                {
                  ordinal: 1,
                  stage: 'START_OF_TURN',
                  actorId: root.proposedTerminalTransition.currentActorId
                }
              ],
        occurrenceId: occurrence.id,
        runtime: input.runtime,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        coordinatorRoot: root,
        getEncounterActorSnapshot: async () => ({
          rules: actorEvaluation.snapshot.output,
          encounter: stagedRecharge.encounter
        }),
        rollD20: input.rollD20
      })
      if (effectResult.kind === 'PENDING') {
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.encounter.id,
          occurrenceId: occurrence.id,
          expectedOccurrenceVersion: occurrence.version,
          expectedAggregateVersion: locked.encounter.version,
          nextAggregateVersion: locked.encounter.version,
          pendingSnapshot: effectResult.pendingSnapshot
        })
        const pending = await appendPendingRechargeResolutionReceipt({
          occurrences,
          encounterId: locked.encounter.id,
          command: input.command,
          commandFingerprint,
          actorUserId: input.userId,
          paused,
          encounterVersion: locked.encounter.version,
          root,
          resolutionCommand: rechargeResolutionCommand
        })
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: false,
          response: encounterCommandResultDtoSchema.parse({
            projection: projection.projection,
            roll: null,
            resolution: null,
            occurrence: pending
          })
        }
      }
      const nextVersion = locked.encounter.version + 1
      const terminalOccurrenceVersion = occurrence.version + 1
      if (root.stagedInitiative) {
        const appliedInitiative = await applyStagedInitiativeState({
          repository,
          encounter: locked.encounter,
          beforePin: root.stagedInitiative.beforePin,
          stagedRoundState: root.stagedInitiative.stagedRoundState,
          ...(root.initiativeAdvance?.kind === 'ROUND_WRAP' &&
          root.initiativeAdvance.cadence === 'EACH_ROUND'
            ? { initiativeAdvance: root.initiativeAdvance }
            : {})
        })
        if (
          appliedInitiative.round.round !== root.proposedTerminalTransition.round ||
          appliedInitiative.participants.find((participant) => participant.status === 'ACTIVE')
            ?.actorId !== root.proposedTerminalTransition.currentActorId
        ) {
          throw new EncounterConflictError(
            'Staged initiative did not settle the expected turn cursor.'
          )
        }
      }
      if (stagedRecharge.actor) await repository.updateActor(stagedRecharge.actor)
      const restoredOutgoingResult =
        restoredOutgoingBatch === null
          ? null
          : await applyEvaluatedTurnEffectBatch({
              trx,
              actorUserId: input.userId,
              encounter: stagedRecharge.encounter,
              commandType: root.commandType,
              occurrenceId: occurrence.id,
              occurrenceVersion: terminalOccurrenceVersion,
              batch: restoredOutgoingBatch
            })
      const appliedTurnResult =
        effectResult.kind === 'READY'
          ? await applyEvaluatedTurnEffectBatch({
              trx,
              actorUserId: input.userId,
              encounter: stagedRecharge.encounter,
              commandType: root.commandType,
              occurrenceId: occurrence.id,
              occurrenceVersion: terminalOccurrenceVersion,
              batch: effectResult.batch
            })
          : effectResult.result
      const effectSelectionChecksum =
        effectResult.kind === 'READY'
          ? effectResult.batch.selectionChecksum
          : effectResult.selectionChecksum
      if (
        root.initiativeAdvance &&
        !(
          root.initiativeAdvance.kind === 'ROUND_WRAP' &&
          root.initiativeAdvance.cadence === 'EACH_ROUND'
        )
      ) {
        const advanced = await applyEncounterInitiativeAdvanceCommand({
          repository,
          encounterId: locked.encounter.id,
          plan: root.initiativeAdvance
        })
        if (
          advanced.round !== root.proposedTerminalTransition.round ||
          advanced.currentActorId !== root.proposedTerminalTransition.currentActorId
        )
          throw new EncounterConflictError(
            'Normalized initiative advancement did not settle exactly.'
          )
      }
      await repository.update({
        encounterId: locked.encounter.id,
        status: root.proposedTerminalTransition.status,
        version: nextVersion,
        round: root.proposedTerminalTransition.round,
        currentActorId: root.proposedTerminalTransition.currentActorId
      })
      const updated = await repository.find(locked.encounter.id)
      if (!updated) throw new EncounterNotFoundError()
      const projectionSnapshot = await evaluateEncounterActorRuleSnapshot({
        db: trx,
        encounter: updated,
        revisionId: frozenRevision.id
      })
      for (const actor of projectionSnapshot.actorUpdates) await repository.updateActor(actor)
      const gmProjection = projectGm(
        projectionSnapshot.reconciledEncounter,
        projectionSnapshot.snapshot.output
      )
      const currentProjection = compileEncounterCurrentProjection(
        gmProjection,
        projectionSnapshot.snapshot
      )
      await repository.publishCurrentProjection(currentProjection)
      let receiptSelectionChecksum = effectSelectionChecksum
      const result = storedRuleExecutionResultDtoSchema.parse(
        root.outgoingTurn
          ? (() => {
              const outgoingEvidence = completedPendingTurnPhaseEvidence({
                phase: root.outgoingTurn,
                restoredResult: restoredOutgoingResult
              })
              const incomingEvidence = completedTurnPhaseEvidence({
                selectionChecksum: effectSelectionChecksum,
                result: appliedTurnResult
              })
              receiptSelectionChecksum = turnLifecycleSelectionChecksum({
                outgoing: outgoingEvidence,
                incoming: incomingEvidence,
                ...(root.completedLegendaryActions?.length
                  ? { legendaryActions: root.completedLegendaryActions }
                  : {}),
                ...(root.stagedLegendaryActionRefreshes?.length
                  ? { legendaryActionRefreshes: root.stagedLegendaryActionRefreshes }
                  : {})
              })
              return {
                status: 'TURN_LIFECYCLE_COMPLETE' as const,
                schemaVersion: 1 as const,
                occurrenceId: occurrence.id,
                occurrenceVersion: terminalOccurrenceVersion,
                encounterId: locked.encounter.id,
                commandType: 'ADVANCE_TURN' as const,
                initiativeAdvance: root.initiativeAdvance,
                initiative: root.initiative,
                rechargeExecutions: rechargeExecutionsForRoot(root),
                outgoingTurn: outgoingEvidence,
                legendaryActions: root.completedLegendaryActions ?? [],
                legendaryActionRefreshes: root.stagedLegendaryActionRefreshes ?? [],
                incomingTurn: incomingEvidence
              }
            })()
          : appliedTurnResult
            ? {
                ...appliedTurnResult,
                initiative: root.initiative,
                initiativeAdvance: root.initiativeAdvance,
                rechargeExecutions: rechargeExecutionsForRoot(root)
              }
            : {
                status: 'INITIATIVE_COMPLETE',
                schemaVersion: 1,
                occurrenceId: occurrence.id,
                occurrenceVersion: terminalOccurrenceVersion,
                encounterId: locked.encounter.id,
                commandType: root.commandType,
                initiative: root.initiative,
                initiativeAdvance: root.initiativeAdvance
              }
      )
      await occurrences.complete({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.encounter.id,
        occurrenceId: occurrence.id,
        expectedOccurrenceVersion: occurrence.version,
        expectedAggregateVersion: locked.encounter.version,
        nextAggregateVersion: nextVersion
      })
      await occurrences.appendReceipt({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.encounter.id,
        commandId: root.rootCommandId,
        commandFingerprint: root.commandFingerprint,
        occurrenceId: occurrence.id,
        aggregateVersion: nextVersion,
        commandType: root.commandType,
        actorUserId: root.initiatorUserId,
        correlationId: root.correlationId,
        commandMetadata: {
          schemaVersion: 1,
          transition: 'TURN_EFFECTS',
          commandType: root.commandType,
          expectedAggregateVersion: root.expectedEncounterVersion,
          selectionChecksum: receiptSelectionChecksum,
          initiativeChecksum:
            root.initiative === null ? null : checksumCanonicalJson(root.initiative),
          initiativeAdvanceChecksum:
            root.initiativeAdvance === null ? null : checksumCanonicalJson(root.initiativeAdvance),
          terminalOccurrenceVersion,
          resolutionCommands: history
        },
        resultPayload: result
      })
      const response = encounterCommandResultDtoSchema.parse({
        projection: gmProjection,
        roll: null,
        resolution: null,
        occurrence: {
          occurrenceId: occurrence.id,
          occurrenceVersion: terminalOccurrenceVersion,
          status: 'COMPLETE',
          outcome: null,
          pending: null
        }
      })
      const rootPayload =
        root.commandType === 'START'
          ? {
              type: 'START',
              encounterId: locked.encounter.id,
              commandId: root.rootCommandId,
              expectedVersion: root.expectedEncounterVersion,
              ...(root.startSystemId ? { systemId: root.startSystemId } : {})
            }
          : {
              type: 'ADVANCE_TURN',
              encounterId: locked.encounter.id,
              commandId: root.rootCommandId,
              expectedVersion: root.expectedEncounterVersion
            }
      await repository.appendEvent({
        id: randomUUID(),
        encounterId: locked.encounter.id,
        campaignId: locked.encounter.campaignId,
        version: nextVersion,
        commandId: root.rootCommandId,
        commandType: root.commandType,
        commandFingerprint: root.commandFingerprint,
        commandPayload: rootPayload as Json,
        resultPayload: encounterProjectionEventSchema.parse({
          command: response,
          currentProjection,
          ruleReceipt: {
            occurrenceId: occurrence.id,
            resultChecksum: checksumCanonicalJson(result)
          }
        }) as unknown as Json,
        actorUserId: root.initiatorUserId,
        correlationId: root.correlationId
      })
      return {
        replayed: false,
        response:
          locked.context.role === 'OWNER'
            ? response
            : encounterCommandResultDtoSchema.parse({
                ...response,
                projection: projectPlayerEncounterProjection(gmProjection)
              })
      }
    }
    const existing = context.root.resolutionCommands.find(
      (entry) => entry.commandId === input.command.commandId
    )
    if (existing) {
      if (existing.commandFingerprint !== commandFingerprint)
        throw new EncounterConflictError('Rule occurrence is unavailable.')
      const projection = await repository.requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: locked.encounter.version
      })
      const pending = turnPendingSummary(occurrence, locked.encounter.version)
      if (!pending) throw new EncounterConflictError('Rule occurrence is unavailable.')
      return {
        replayed: true,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: occurrence.id,
            occurrenceVersion: occurrence.version,
            status: 'PENDING',
            outcome: null,
            pending
          }
        })
      }
    }
    const activeEffectContext = pendingSnapshot.applicationContext
    if (activeEffectContext?.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const policy = activeEffectContext.currentCandidate.d20Policy
    if (!input.runtime)
      throw new EncounterValidationError('Rule occurrence resolution requires the rules runtime.')
    if (!policy || input.command.resolution.requestId !== pendingSnapshot.request.requestId)
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const count = policy.rollMode === 'NORMAL' ? 1 : 2
    const rawFaces =
      input.command.resolution.kind === 'ENTER_DICE'
        ? [...input.command.resolution.rawFaces]
        : Array.from({ length: count }, () => (input.rollD20 ?? (() => randomInt(1, 21)))())
    if (
      rawFaces.length !== count ||
      rawFaces.some((face) => !Number.isInteger(face) || face < 1 || face > 20)
    )
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const history = [
      ...context.root.resolutionCommands,
      {
        commandId: input.command.commandId,
        commandFingerprint,
        actorUserId: input.userId,
        correlationId: input.command.correlationId,
        expectedOccurrenceVersion: occurrence.version,
        requestId: input.command.resolution.requestId,
        kind: input.command.resolution.kind
      }
    ]
    const frozenRevisionId = context.root.frozenActorRuleRevisionId
    const frozenRevisionChecksum = context.root.frozenActorRuleRevisionChecksum
    const frozenSnapshotChecksum = context.root.frozenActorRuleSnapshotChecksum
    if (!frozenRevisionId || !frozenRevisionChecksum || !frozenSnapshotChecksum) {
      throw new EncounterConflictError('The frozen Encounter actor-rule source is unavailable.')
    }
    const frozenRevision = await requireImmutableEncounterActorRuleRevision({
      db: trx,
      revisionId: frozenRevisionId,
      expectedChecksum: frozenRevisionChecksum
    })
    let resumedActorEvaluation = await evaluateEncounterActorRuleSnapshot({
      db: trx,
      encounter: locked.encounter,
      revisionId: frozenRevision.id
    })
    if (
      checksumEncounterActorRuleSnapshot(resumedActorEvaluation.snapshot) !== frozenSnapshotChecksum
    ) {
      throw new EncounterConflictError('The frozen Encounter actor-rule source is stale.')
    }
    let coordinatorRoot: TurnCoordinatorRootDto = {
      ...context.root,
      resolutionCommands: history
    }
    let reconciledEncounter = resumedActorEvaluation.reconciledEncounter
    let stagedRechargeActor: EncounterActorRecord | null = null
    let stagedLegendaryRefreshActors: readonly EncounterActorRecord[] = []
    if (coordinatorRoot.stagedLegendaryActionRefreshes?.length) {
      stagedLegendaryRefreshActors = await applyStagedLegendaryActionRefreshes({
        encounter: reconciledEncounter,
        definitions: createReusableDefinitionRepository(trx),
        refreshes: coordinatorRoot.stagedLegendaryActionRefreshes
      })
      reconciledEncounter = {
        ...reconciledEncounter,
        actors: reconciledEncounter.actors.map(
          (actor) =>
            stagedLegendaryRefreshActors.find((candidate) => candidate.id === actor.id) ?? actor
        )
      }
      resumedActorEvaluation = await evaluateEncounterActorRuleSnapshot({
        db: trx,
        encounter: reconciledEncounter,
        revisionId: frozenRevision.id,
        previousSnapshot: resumedActorEvaluation.snapshot
      })
      reconciledEncounter = resumedActorEvaluation.reconciledEncounter
    }
    if (coordinatorRoot.completedRechargePlan) {
      const staged = stageCompletedRechargePlan({
        encounter: reconciledEncounter,
        actorRules: resumedActorEvaluation.snapshot.output,
        plan: coordinatorRoot.completedRechargePlan,
        currentActorId: coordinatorRoot.proposedTerminalTransition.currentActorId
      })
      reconciledEncounter = staged.encounter
      stagedRechargeActor = staged.actor
    }
    const evaluation = await evaluateEncounterTurnCharacterActiveEffects({
      trx,
      actorUserId: input.userId,
      encounter: reconciledEncounter,
      commandType: coordinatorRoot.commandType,
      boundaries: coordinatorRoot.outgoingTurn
        ? [
            {
              ordinal: 1,
              stage: 'START_OF_TURN',
              actorId: coordinatorRoot.proposedTerminalTransition.currentActorId
            }
          ]
        : coordinatorRoot.commandType === 'START'
          ? [
              {
                ordinal: 0,
                stage: 'START_OF_TURN',
                actorId: coordinatorRoot.proposedTerminalTransition.currentActorId
              }
            ]
          : [
              {
                ordinal: 0,
                stage: 'END_OF_TURN',
                actorId: locked.encounter.currentActorId
              }
            ],
      occurrenceId: occurrence.id,
      runtime: input.runtime,
      attunementSlotOverride: locked.context.attunementSlotOverride,
      coordinatorRoot,
      resume: {
        pendingSnapshot,
        resolution: { requestId: input.command.resolution.requestId, rawFaces }
      },
      getEncounterActorSnapshot: async () => ({
        rules: resumedActorEvaluation.snapshot.output,
        encounter: reconciledEncounter
      })
    })
    if (evaluation.kind === 'PENDING') {
      const paused = await occurrences.advancePending({
        aggregateKind: 'ENCOUNTER',
        aggregateId: locked.encounter.id,
        occurrenceId: occurrence.id,
        expectedOccurrenceVersion: occurrence.version,
        expectedAggregateVersion: locked.encounter.version,
        nextAggregateVersion: locked.encounter.version,
        pendingSnapshot: evaluation.pendingSnapshot
      })
      const projection = await repository.requireCurrentProjection({
        encounterId: locked.encounter.id,
        expectedStreamVersion: locked.encounter.version
      })
      let pending = turnPendingSummary(paused, locked.encounter.version)
      try {
        await assertTurnOccurrenceAuthority({
          db: trx,
          actorUserId: input.userId,
          locked,
          occurrence: paused
        })
      } catch (error) {
        if (!(error instanceof EncounterConflictError)) throw error
        pending = null
      }
      return {
        replayed: false,
        response: encounterCommandResultDtoSchema.parse({
          projection:
            locked.context.role === 'OWNER'
              ? projection.projection
              : projectPlayerEncounterProjection(projection.projection),
          roll: null,
          resolution: null,
          occurrence: {
            occurrenceId: paused.id,
            occurrenceVersion: paused.version,
            status: 'PENDING',
            outcome: null,
            pending
          }
        })
      }
    }
    if (evaluation.kind !== 'READY')
      throw new EncounterConflictError('Rule occurrence is unavailable.')
    const outgoingBeforeIncoming =
      coordinatorRoot.outgoingTurn === undefined && coordinatorRoot.commandType === 'ADVANCE_TURN'
    const outgoingEachRound =
      outgoingBeforeIncoming &&
      coordinatorRoot.initiativeAdvance?.kind === 'ROUND_WRAP' &&
      coordinatorRoot.initiativeAdvance.cadence === 'EACH_ROUND'
    if (outgoingBeforeIncoming) {
      reconciledEncounter = projectEncounterAfterEvaluatedTurnEffectBatch(
        reconciledEncounter,
        evaluation.batch
      )
      resumedActorEvaluation = await evaluateEncounterActorRuleSnapshot({
        db: trx,
        encounter: reconciledEncounter,
        revisionId: frozenRevision.id,
        previousSnapshot: resumedActorEvaluation.snapshot
      })
      reconciledEncounter = resumedActorEvaluation.reconciledEncounter
    }
    const nextVersion = locked.encounter.version + 1
    const terminalOccurrenceVersion = occurrence.version + 1
    let appliedTurnResult: StoredRuleExecutionResultDto | null = null
    let restoredOutgoingResult: StoredRuleExecutionResultDto | null = null
    if (!outgoingBeforeIncoming) {
      for (const actor of resumedActorEvaluation.actorUpdates) await repository.updateActor(actor)
      for (const actor of stagedLegendaryRefreshActors) await repository.updateActor(actor)
      if (stagedRechargeActor) await repository.updateActor(stagedRechargeActor)
      if (coordinatorRoot.outgoingTurn?.kind === 'STAGED') {
        const restoredOutgoingBatch = await restoreEvaluatedEncounterTurnEffectBatch({
          trx,
          actorUserId: input.userId,
          encounter: reconciledEncounter,
          commandType: coordinatorRoot.commandType,
          boundaries: boundariesForStagedTurnPlan(coordinatorRoot.outgoingTurn.plan),
          occurrenceId: occurrence.id,
          runtime: input.runtime,
          attunementSlotOverride: locked.context.attunementSlotOverride,
          coordinatorRoot,
          stagedPlan: coordinatorRoot.outgoingTurn.plan,
          getEncounterActorSnapshot: async () => ({
            rules: resumedActorEvaluation.snapshot.output,
            encounter: reconciledEncounter
          }),
          rollD20: input.rollD20
        })
        restoredOutgoingResult = await applyEvaluatedTurnEffectBatch({
          trx,
          actorUserId: input.userId,
          encounter: reconciledEncounter,
          commandType: coordinatorRoot.commandType,
          occurrenceId: occurrence.id,
          occurrenceVersion: terminalOccurrenceVersion,
          batch: restoredOutgoingBatch
        })
      }
      appliedTurnResult = await applyEvaluatedTurnEffectBatch({
        trx,
        actorUserId: input.userId,
        encounter: reconciledEncounter,
        commandType: coordinatorRoot.commandType,
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        batch: evaluation.batch
      })
    }
    let terminalSelectionChecksum = context.selectionChecksum
    let terminalInitiative = coordinatorRoot.initiative
    let terminalTransition = coordinatorRoot.proposedTerminalTransition
    let result: StoredRuleExecutionResultDto
    if (outgoingEachRound) {
      const initiativeAdvance = coordinatorRoot.initiativeAdvance
      if (
        !initiativeAdvance ||
        initiativeAdvance.kind !== 'ROUND_WRAP' ||
        initiativeAdvance.cadence !== 'EACH_ROUND'
      )
        throw new EncounterConflictError('Outgoing each-round turn transition is unavailable.')
      const outgoingTurn = pendingTurnPhase({
        selectionChecksum: evaluation.batch.selectionChecksum,
        result: null,
        executions: evaluation.batch.executions
      })
      const beforePin: InitiativeBeforePinDto = {
        kind: 'EACH_ROUND',
        round: initiativeAdvance.round,
        version: locked.encounter.version,
        checksum: initiativeAdvance.stateChecksum,
        actorIds: locked.encounter.actors.map((actor) => actor.id).sort()
      }
      const stagedRoundState = createStagedInitiativeRoundState({
        encounter: reconciledEncounter,
        round: initiativeAdvance.nextRound
      })
      const initiative = await startEncounterInitiativeCommand({
        trx,
        repository,
        encounter: reconciledEncounter,
        round: initiativeAdvance.nextRound,
        occurrenceId: occurrence.id,
        runtime: input.runtime,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        getEncounterActorSnapshot: async () => ({
          rules: resumedActorEvaluation.snapshot.output,
          encounter: reconciledEncounter
        }),
        legacyOrderedActorIds: initiativeAdvance.orderedActorIds,
        stagedRoundState,
        integerSource: ({ min, max }) =>
          min === 1 && max === 20 && input.rollD20 ? input.rollD20() : randomInt(min, max + 1)
      })
      if (initiative.kind === 'PENDING') {
        const policySnapshotChecksum = reconciledEncounter.initiativePolicySnapshotChecksum
        if (!policySnapshotChecksum)
          throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
        const pendingSnapshot = createEncounterInitiativePendingSnapshot({
          root: {
            rootCommandId: coordinatorRoot.rootCommandId,
            commandFingerprint: coordinatorRoot.commandFingerprint,
            commandType: 'ADVANCE_TURN',
            initiatorUserId: coordinatorRoot.initiatorUserId,
            correlationId: coordinatorRoot.correlationId,
            expectedEncounterVersion: coordinatorRoot.expectedEncounterVersion,
            round: initiativeAdvance.nextRound,
            policySnapshotChecksum,
            initiativeBeforePin: beforePin,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(initiative.state),
            startSystemId: null,
            initiativeAdvance,
            outgoingTurn,
            completedLegendaryActions: coordinatorRoot.completedLegendaryActions,
            stagedLegendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes,
            completedRechargePlan: coordinatorRoot.completedRechargePlan,
            resolutionCommands: history
          },
          pending: initiative.pending
        })
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.encounter.id,
          occurrenceId: occurrence.id,
          expectedOccurrenceVersion: occurrence.version,
          expectedAggregateVersion: locked.encounter.version,
          nextAggregateVersion: locked.encounter.version,
          pendingSnapshot
        })
        const committedProjection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: false,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? committedProjection.projection
                : projectPlayerEncounterProjection(committedProjection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: paused.id,
              occurrenceVersion: paused.version,
              status: 'PENDING',
              outcome: null,
              pending: projectEncounterInitiativePendingSummary({
                pendingSnapshot: requireEncounterKernelPendingSnapshot(paused.pendingSnapshot),
                occurrenceVersion: paused.version,
                encounterVersion: locked.encounter.version
              })
            }
          })
        }
      }
      terminalInitiative = encounterInitiativeSettlementDtoSchema.parse({
        round: initiative.state.round.round,
        cadence: initiative.state.round.cadence,
        procedure: initiative.state.round.procedure,
        policySnapshotChecksum: initiative.state.round.policySnapshotChecksum,
        orderedActorIds: initiative.orderedActorIds,
        orderedSideIds: initiative.orderedSideIds,
        evidence: initiative.evidence
      })
      const firstActorId = terminalInitiative.orderedActorIds[0] ?? null
      terminalTransition = {
        status: 'ACTIVE',
        round: terminalInitiative.round,
        currentActorId: firstActorId
      }
      if (
        firstActorId &&
        locked.encounter.automationMode !== 'MANUAL' &&
        !coordinatorRoot.stagedLegendaryActionRefreshes?.some(
          (refresh) => refresh.actorId === firstActorId
        )
      ) {
        const staged = await stageEncounterLegendaryActionRefreshes({
          actorId: firstActorId,
          encounter: reconciledEncounter,
          actorRules: resumedActorEvaluation.snapshot.output,
          definitions: createReusableDefinitionRepository(trx)
        })
        if (staged.refreshedActor && staged.refreshes.length > 0) {
          const ordinal = coordinatorRoot.stagedLegendaryActionRefreshes?.length ?? 0
          coordinatorRoot = {
            ...coordinatorRoot,
            stagedLegendaryActionRefreshes: [
              ...(coordinatorRoot.stagedLegendaryActionRefreshes ?? []),
              ...staged.refreshes.map((refresh, index) => ({
                ...refresh,
                ordinal: ordinal + index
              }))
            ]
          }
          stagedLegendaryRefreshActors = [...stagedLegendaryRefreshActors, staged.refreshedActor]
          reconciledEncounter = {
            ...reconciledEncounter,
            actors: reconciledEncounter.actors.map((actor) =>
              actor.id === staged.refreshedActor!.id ? staged.refreshedActor! : actor
            )
          }
          resumedActorEvaluation = await evaluateEncounterActorRuleSnapshot({
            db: trx,
            encounter: reconciledEncounter,
            revisionId: frozenRevision.id,
            previousSnapshot: resumedActorEvaluation.snapshot
          })
          reconciledEncounter = resumedActorEvaluation.reconciledEncounter
        }
      }
      const incomingEvaluation = await evaluateEncounterTurnCharacterActiveEffects({
        trx,
        actorUserId: input.userId,
        encounter: reconciledEncounter,
        commandType: 'ADVANCE_TURN',
        boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: firstActorId }],
        occurrenceId: occurrence.id,
        runtime: input.runtime,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        coordinatorRoot: {
          ...coordinatorRoot,
          startSystemId: null,
          frozenActorRuleRevisionId: frozenRevision.id,
          frozenActorRuleRevisionChecksum: frozenRevision.checksum,
          frozenActorRuleSnapshotChecksum: coordinatorRoot.frozenActorRuleSnapshotChecksum,
          initiative: terminalInitiative,
          initiativeAdvance,
          stagedInitiative: {
            beforePin,
            stagedRoundState: serializeStagedInitiativeRoundState(initiative.state)
          },
          outgoingTurn,
          resolutionCommands: history,
          proposedTerminalTransition: terminalTransition
        },
        getEncounterActorSnapshot: async () => ({
          rules: resumedActorEvaluation.snapshot.output,
          encounter: reconciledEncounter
        }),
        rollD20: input.rollD20
      })
      if (incomingEvaluation.kind === 'PENDING') {
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.encounter.id,
          occurrenceId: occurrence.id,
          expectedOccurrenceVersion: occurrence.version,
          expectedAggregateVersion: locked.encounter.version,
          nextAggregateVersion: locked.encounter.version,
          pendingSnapshot: incomingEvaluation.pendingSnapshot
        })
        const committedProjection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: false,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? committedProjection.projection
                : projectPlayerEncounterProjection(committedProjection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: paused.id,
              occurrenceVersion: paused.version,
              status: 'PENDING',
              outcome: null,
              pending: turnPendingSummary(paused, locked.encounter.version)
            }
          })
        }
      }
      for (const actor of resumedActorEvaluation.actorUpdates) await repository.updateActor(actor)
      for (const actor of stagedLegendaryRefreshActors) await repository.updateActor(actor)
      if (stagedRechargeActor) await repository.updateActor(stagedRechargeActor)
      appliedTurnResult = await applyEvaluatedTurnEffectBatch({
        trx,
        actorUserId: input.userId,
        encounter: reconciledEncounter,
        commandType: coordinatorRoot.commandType,
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        batch: evaluation.batch
      })
      const incomingTurnResult =
        incomingEvaluation.kind === 'READY'
          ? await applyEvaluatedTurnEffectBatch({
              trx,
              actorUserId: input.userId,
              encounter: reconciledEncounter,
              commandType: 'ADVANCE_TURN',
              occurrenceId: occurrence.id,
              occurrenceVersion: terminalOccurrenceVersion,
              batch: incomingEvaluation.batch
            })
          : incomingEvaluation.result
      const outgoingEvidence = completedPendingTurnPhaseEvidence({
        phase: outgoingTurn,
        restoredResult: appliedTurnResult
      })
      const incomingEvidence = completedTurnPhaseEvidence({
        selectionChecksum:
          incomingEvaluation.kind === 'READY'
            ? incomingEvaluation.batch.selectionChecksum
            : incomingEvaluation.selectionChecksum,
        result: incomingTurnResult
      })
      terminalSelectionChecksum = turnLifecycleSelectionChecksum({
        outgoing: outgoingEvidence,
        incoming: incomingEvidence,
        ...(coordinatorRoot.completedLegendaryActions?.length
          ? { legendaryActions: coordinatorRoot.completedLegendaryActions }
          : {}),
        ...(coordinatorRoot.stagedLegendaryActionRefreshes?.length
          ? { legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes }
          : {})
      })
      result = storedRuleExecutionResultDtoSchema.parse({
        status: 'TURN_LIFECYCLE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        encounterId: locked.encounter.id,
        commandType: 'ADVANCE_TURN',
        initiativeAdvance,
        initiative: terminalInitiative,
        rechargeExecutions: rechargeExecutionsForRoot(coordinatorRoot),
        outgoingTurn: outgoingEvidence,
        legendaryActions: coordinatorRoot.completedLegendaryActions ?? [],
        legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes ?? [],
        incomingTurn: incomingEvidence
      })
    } else if (outgoingBeforeIncoming) {
      const outgoingTurn = pendingTurnPhase({
        selectionChecksum: evaluation.batch.selectionChecksum,
        result: null,
        executions: evaluation.batch.executions
      })
      const incomingRoot: TurnRechargePendingContext['root'] = {
        ...coordinatorRoot,
        outgoingTurn,
        resolutionCommands: history
      }
      const enteringActorId = coordinatorRoot.proposedTerminalTransition.currentActorId
      if (enteringActorId && locked.encounter.automationMode !== 'MANUAL') {
        const candidates = await discoverEncounterRechargeCandidates({
          actorId: enteringActorId,
          encounterActors: reconciledEncounter.actors,
          actorRules: resumedActorEvaluation.snapshot.output,
          definitions: createReusableDefinitionRepository(trx)
        })
        if (candidates.length > 0) {
          const selectionChecksum = rechargePlanSelectionChecksum(candidates)
          const completed: TurnRechargeExecution[] = []
          for (const [ordinal, candidate] of candidates.entries()) {
            const recharge = await executeEncounterRechargeCandidate({
              candidate,
              occurrenceId: occurrence.id,
              definitions: createReusableDefinitionRepository(trx),
              runtime: input.runtime,
              mode: locked.encounter.automationMode,
              ...(input.rollD6 ? { rollD6: input.rollD6 } : {})
            })
            if (recharge?.kind === 'PENDING') {
              const paused = await occurrences.advancePending({
                aggregateKind: 'ENCOUNTER',
                aggregateId: locked.encounter.id,
                occurrenceId: occurrence.id,
                expectedOccurrenceVersion: occurrence.version,
                expectedAggregateVersion: locked.encounter.version,
                nextAggregateVersion: locked.encounter.version,
                pendingSnapshot: rechargePendingSnapshot({
                  continuation: recharge.continuation,
                  root: incomingRoot,
                  selectionChecksum,
                  completedExecutions: completed,
                  currentCandidate: rechargePendingCandidate(candidate, ordinal),
                  remainingCandidates: candidates
                    .slice(ordinal + 1)
                    .map((remaining, remainingOrdinal) =>
                      rechargePendingCandidate(remaining, ordinal + remainingOrdinal + 1)
                    )
                })
              })
              const projection = await repository.requireCurrentProjection({
                encounterId: locked.encounter.id,
                expectedStreamVersion: locked.encounter.version
              })
              return {
                replayed: false,
                response: encounterCommandResultDtoSchema.parse({
                  projection:
                    locked.context.role === 'OWNER'
                      ? projection.projection
                      : projectPlayerEncounterProjection(projection.projection),
                  roll: null,
                  resolution: null,
                  occurrence: {
                    occurrenceId: paused.id,
                    occurrenceVersion: paused.version,
                    status: 'PENDING',
                    outcome: null,
                    pending: rechargePendingSummary(paused, locked.encounter.version)
                  }
                })
              }
            }
            if (!recharge)
              throw new EncounterConflictError('Recharge execution became unavailable.')
            completed.push(rechargeCompletedExecution({ ordinal, result: recharge }))
          }
          const plan = completedRechargePlan(selectionChecksum, completed)
          if (!plan)
            throw new EncounterConflictError('Recharge plan did not retain terminal evidence.')
          const staged = stageCompletedRechargePlan({
            encounter: reconciledEncounter,
            actorRules: resumedActorEvaluation.snapshot.output,
            plan,
            currentActorId: enteringActorId
          })
          reconciledEncounter = staged.encounter
          stagedRechargeActor = staged.actor
          incomingRoot.completedRechargePlan = plan
        }
      }
      const incomingEvaluation = await evaluateEncounterTurnCharacterActiveEffects({
        trx,
        actorUserId: input.userId,
        encounter: reconciledEncounter,
        commandType: 'ADVANCE_TURN',
        boundaries: [{ ordinal: 1, stage: 'START_OF_TURN', actorId: enteringActorId }],
        occurrenceId: occurrence.id,
        runtime: input.runtime,
        attunementSlotOverride: locked.context.attunementSlotOverride,
        coordinatorRoot: incomingRoot,
        getEncounterActorSnapshot: async () => ({
          rules: resumedActorEvaluation.snapshot.output,
          encounter: reconciledEncounter
        }),
        rollD20: input.rollD20
      })
      if (incomingEvaluation.kind === 'PENDING') {
        const paused = await occurrences.advancePending({
          aggregateKind: 'ENCOUNTER',
          aggregateId: locked.encounter.id,
          occurrenceId: occurrence.id,
          expectedOccurrenceVersion: occurrence.version,
          expectedAggregateVersion: locked.encounter.version,
          nextAggregateVersion: locked.encounter.version,
          pendingSnapshot: incomingEvaluation.pendingSnapshot
        })
        const projection = await repository.requireCurrentProjection({
          encounterId: locked.encounter.id,
          expectedStreamVersion: locked.encounter.version
        })
        return {
          replayed: false,
          response: encounterCommandResultDtoSchema.parse({
            projection:
              locked.context.role === 'OWNER'
                ? projection.projection
                : projectPlayerEncounterProjection(projection.projection),
            roll: null,
            resolution: null,
            occurrence: {
              occurrenceId: paused.id,
              occurrenceVersion: paused.version,
              status: 'PENDING',
              outcome: null,
              pending: turnPendingSummary(paused, locked.encounter.version)
            }
          })
        }
      }
      for (const actor of resumedActorEvaluation.actorUpdates) await repository.updateActor(actor)
      for (const actor of stagedLegendaryRefreshActors) await repository.updateActor(actor)
      if (stagedRechargeActor) await repository.updateActor(stagedRechargeActor)
      appliedTurnResult = await applyEvaluatedTurnEffectBatch({
        trx,
        actorUserId: input.userId,
        encounter: reconciledEncounter,
        commandType: 'ADVANCE_TURN',
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        batch: evaluation.batch
      })
      const incomingTurnResult =
        incomingEvaluation.kind === 'READY'
          ? await applyEvaluatedTurnEffectBatch({
              trx,
              actorUserId: input.userId,
              encounter: reconciledEncounter,
              commandType: 'ADVANCE_TURN',
              occurrenceId: occurrence.id,
              occurrenceVersion: terminalOccurrenceVersion,
              batch: incomingEvaluation.batch
            })
          : incomingEvaluation.result
      const outgoingEvidence = completedPendingTurnPhaseEvidence({
        phase: outgoingTurn,
        restoredResult: appliedTurnResult
      })
      const incomingEvidence = completedTurnPhaseEvidence({
        selectionChecksum:
          incomingEvaluation.kind === 'READY'
            ? incomingEvaluation.batch.selectionChecksum
            : incomingEvaluation.selectionChecksum,
        result: incomingTurnResult
      })
      terminalSelectionChecksum = turnLifecycleSelectionChecksum({
        outgoing: outgoingEvidence,
        incoming: incomingEvidence,
        ...(incomingRoot.completedLegendaryActions?.length
          ? { legendaryActions: incomingRoot.completedLegendaryActions }
          : {}),
        ...(incomingRoot.stagedLegendaryActionRefreshes?.length
          ? { legendaryActionRefreshes: incomingRoot.stagedLegendaryActionRefreshes }
          : {})
      })
      result = storedRuleExecutionResultDtoSchema.parse({
        status: 'TURN_LIFECYCLE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        encounterId: locked.encounter.id,
        commandType: 'ADVANCE_TURN',
        initiativeAdvance: coordinatorRoot.initiativeAdvance,
        initiative: null,
        rechargeExecutions: rechargeExecutionsForRoot(incomingRoot),
        outgoingTurn: outgoingEvidence,
        legendaryActions: incomingRoot.completedLegendaryActions ?? [],
        legendaryActionRefreshes: incomingRoot.stagedLegendaryActionRefreshes ?? [],
        incomingTurn: incomingEvidence
      })
    } else if (coordinatorRoot.outgoingTurn) {
      const outgoingEvidence = completedPendingTurnPhaseEvidence({
        phase: coordinatorRoot.outgoingTurn,
        restoredResult: restoredOutgoingResult
      })
      const incomingEvidence = completedTurnPhaseEvidence({
        selectionChecksum: context.selectionChecksum,
        result: appliedTurnResult
      })
      terminalSelectionChecksum = turnLifecycleSelectionChecksum({
        outgoing: outgoingEvidence,
        incoming: incomingEvidence,
        ...(coordinatorRoot.completedLegendaryActions?.length
          ? { legendaryActions: coordinatorRoot.completedLegendaryActions }
          : {}),
        ...(coordinatorRoot.stagedLegendaryActionRefreshes?.length
          ? { legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes }
          : {})
      })
      result = storedRuleExecutionResultDtoSchema.parse({
        status: 'TURN_LIFECYCLE_COMPLETE',
        schemaVersion: 1,
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        encounterId: locked.encounter.id,
        commandType: 'ADVANCE_TURN',
        initiativeAdvance: coordinatorRoot.initiativeAdvance,
        initiative: coordinatorRoot.initiative,
        rechargeExecutions: rechargeExecutionsForRoot(coordinatorRoot),
        outgoingTurn: outgoingEvidence,
        legendaryActions: coordinatorRoot.completedLegendaryActions ?? [],
        legendaryActionRefreshes: coordinatorRoot.stagedLegendaryActionRefreshes ?? [],
        incomingTurn: incomingEvidence
      })
    } else {
      result = storedRuleExecutionResultDtoSchema.parse({
        ...appliedTurnResult,
        initiative: coordinatorRoot.initiative,
        initiativeAdvance: coordinatorRoot.initiativeAdvance,
        rechargeExecutions: rechargeExecutionsForRoot(coordinatorRoot)
      })
    }
    if (coordinatorRoot.stagedInitiative) {
      const appliedInitiative = await applyStagedInitiativeState({
        repository,
        encounter: locked.encounter,
        beforePin: coordinatorRoot.stagedInitiative.beforePin,
        stagedRoundState: coordinatorRoot.stagedInitiative.stagedRoundState,
        ...(coordinatorRoot.initiativeAdvance?.kind === 'ROUND_WRAP' &&
        coordinatorRoot.initiativeAdvance.cadence === 'EACH_ROUND'
          ? { initiativeAdvance: coordinatorRoot.initiativeAdvance }
          : {})
      })
      if (
        appliedInitiative.round.round !== terminalTransition.round ||
        appliedInitiative.participants.find((participant) => participant.status === 'ACTIVE')
          ?.actorId !== terminalTransition.currentActorId
      ) {
        throw new EncounterConflictError(
          'Staged initiative did not settle the expected turn cursor.'
        )
      }
    } else if (coordinatorRoot.initiativeAdvance) {
      const advanced = await applyEncounterInitiativeAdvanceCommand({
        repository,
        encounterId: locked.encounter.id,
        plan: coordinatorRoot.initiativeAdvance
      })
      if (
        advanced.round !== coordinatorRoot.proposedTerminalTransition.round ||
        advanced.currentActorId !== coordinatorRoot.proposedTerminalTransition.currentActorId
      )
        throw new EncounterConflictError(
          'Normalized initiative advancement did not settle exactly.'
        )
    }
    await repository.update({
      encounterId: locked.encounter.id,
      status: terminalTransition.status,
      version: nextVersion,
      round: terminalTransition.round,
      currentActorId: terminalTransition.currentActorId
    })
    const updated = await repository.find(locked.encounter.id)
    if (!updated) throw new EncounterNotFoundError()
    const snapshot = await evaluateEncounterActorRuleSnapshot({
      db: trx,
      encounter: updated,
      revisionId: frozenRevision.id
    })
    for (const actor of snapshot.actorUpdates) await repository.updateActor(actor)
    const projectionEncounter = snapshot.reconciledEncounter
    const gmProjection = projectGm(projectionEncounter, snapshot.snapshot.output)
    const currentProjection = compileEncounterCurrentProjection(gmProjection, snapshot.snapshot)
    await repository.publishCurrentProjection(currentProjection)
    await occurrences.complete({
      aggregateKind: 'ENCOUNTER',
      aggregateId: locked.encounter.id,
      occurrenceId: occurrence.id,
      expectedOccurrenceVersion: occurrence.version,
      expectedAggregateVersion: locked.encounter.version,
      nextAggregateVersion: nextVersion
    })
    await occurrences.appendReceipt({
      aggregateKind: 'ENCOUNTER',
      aggregateId: locked.encounter.id,
      commandId: coordinatorRoot.rootCommandId,
      commandFingerprint: coordinatorRoot.commandFingerprint,
      occurrenceId: occurrence.id,
      aggregateVersion: nextVersion,
      commandType: coordinatorRoot.commandType,
      actorUserId: coordinatorRoot.initiatorUserId,
      correlationId: coordinatorRoot.correlationId,
      commandMetadata: {
        schemaVersion: 1,
        transition: 'TURN_EFFECTS',
        commandType: coordinatorRoot.commandType,
        expectedAggregateVersion: coordinatorRoot.expectedEncounterVersion,
        selectionChecksum: terminalSelectionChecksum,
        initiativeChecksum:
          terminalInitiative === null ? null : checksumCanonicalJson(terminalInitiative),
        initiativeAdvanceChecksum:
          coordinatorRoot.initiativeAdvance === null
            ? null
            : checksumCanonicalJson(coordinatorRoot.initiativeAdvance),
        terminalOccurrenceVersion,
        resolutionCommands: history
      },
      resultPayload: result
    })
    const rootPayload =
      coordinatorRoot.commandType === 'START'
        ? {
            type: 'START',
            encounterId: locked.encounter.id,
            commandId: coordinatorRoot.rootCommandId,
            expectedVersion: coordinatorRoot.expectedEncounterVersion,
            ...(coordinatorRoot.startSystemId ? { systemId: coordinatorRoot.startSystemId } : {})
          }
        : {
            type: 'ADVANCE_TURN',
            encounterId: locked.encounter.id,
            commandId: coordinatorRoot.rootCommandId,
            expectedVersion: coordinatorRoot.expectedEncounterVersion
          }
    const response = encounterCommandResultDtoSchema.parse({
      projection: gmProjection,
      roll: null,
      resolution: null,
      occurrence: {
        occurrenceId: occurrence.id,
        occurrenceVersion: terminalOccurrenceVersion,
        status: 'COMPLETE',
        outcome: null,
        pending: null
      }
    })
    await repository.appendEvent({
      id: randomUUID(),
      encounterId: locked.encounter.id,
      campaignId: locked.encounter.campaignId,
      version: nextVersion,
      commandId: coordinatorRoot.rootCommandId,
      commandType: coordinatorRoot.commandType,
      commandFingerprint: coordinatorRoot.commandFingerprint,
      commandPayload: rootPayload as Json,
      resultPayload: encounterProjectionEventSchema.parse({
        command: response,
        currentProjection,
        ruleReceipt: {
          occurrenceId: occurrence.id,
          resultChecksum: checksumCanonicalJson(result)
        }
      }) as unknown as Json,
      actorUserId: coordinatorRoot.initiatorUserId,
      correlationId: coordinatorRoot.correlationId
    })
    return {
      replayed: false,
      response:
        locked.context.role === 'OWNER'
          ? response
          : encounterCommandResultDtoSchema.parse({
              ...response,
              projection: projectPlayerEncounterProjection(gmProjection)
            })
    }
  })
}

export async function getEncounterProjection(
  db: DBLike,
  userId: string,
  encounterId: string
): Promise<EncounterGmProjectionDto | EncounterPlayerProjectionDto> {
  const repository = createEncounterRepository(db)
  const encounter = await repository.findVersionMetadata(encounterId)
  if (!encounter) throw new EncounterNotFoundError()
  const authority = await resolveCampaignAuthority(db, encounter.campaignId, userId)
  assertActiveCampaignMember(authority)
  const current = await repository.requireCurrentProjection({
    encounterId: encounter.id,
    expectedStreamVersion: encounter.version
  })
  return authority.membership.role === 'OWNER'
    ? current.projection
    : projectPlayerEncounterProjection(current.projection)
}

export async function getPendingEncounterRuleOccurrence(
  db: DBLike,
  userId: string,
  encounterId: string
) {
  const pending = await withTransaction(db, async (trx) => {
    const locked = await lockEncounterRuleExecutionCommandContext(trx, {
      actorUserId: userId,
      authority: 'ACTIVE_MEMBER',
      encounterId
    })
    const occurrence = await createRuleOccurrenceRepository(trx).lockPendingEncounter(encounterId)
    if (
      occurrence?.pendingSnapshot &&
      isServerAggregateChoicePendingSnapshot(occurrence.pendingSnapshot) &&
      occurrence.pendingSnapshot.applicationContext.kind ===
        'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE'
    ) {
      return locked.context.role === 'OWNER'
        ? legendaryActionPendingSummary(occurrence, locked.encounter.version)
        : null
    }
    if (
      occurrence?.pendingSnapshot?.applicationContext.kind ===
      'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
    ) {
      return locked.context.role === 'OWNER'
        ? legendaryActionEvidencePendingSummary(occurrence, locked.encounter.version)
        : null
    }
    if (occurrence?.pendingSnapshot?.applicationContext.kind === 'ENCOUNTER_SPATIAL_MOVEMENT') {
      try {
        await assertSpatialOccurrenceAuthority({
          db: trx,
          actorUserId: userId,
          locked,
          occurrence
        })
      } catch (error) {
        if (error instanceof EncounterConflictError) return null
        throw error
      }
      return spatialPendingSummary(occurrence, locked.encounter.version, true)
    }
    if (occurrence?.pendingSnapshot?.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE') {
      try {
        assertRechargeOccurrenceAuthority({ locked, occurrence })
      } catch (error) {
        if (error instanceof EncounterConflictError) return null
        throw error
      }
      return rechargePendingSummary(occurrence, locked.encounter.version)
    }
    if (
      occurrence?.pendingSnapshot?.applicationContext.kind === 'ENCOUNTER_CHARACTER_RULE_ACTION' ||
      occurrence?.pendingSnapshot?.applicationContext.kind === 'ENCOUNTER_ACTOR_RULE_ACTION'
    ) {
      try {
        return actionOccurrenceSummary({
          occurrence,
          encounterVersion: locked.encounter.version,
          role: locked.context.role,
          assignedCharacterId: locked.context.assignedCharacterId
        }).pending
      } catch (error) {
        if (error instanceof EncounterConflictError) return null
        throw error
      }
    }
    if (occurrence?.pendingSnapshot?.applicationContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS')
      return null
    try {
      await assertTurnOccurrenceAuthority({
        db: trx,
        actorUserId: userId,
        locked,
        occurrence
      })
    } catch (error) {
      if (error instanceof EncounterConflictError) return null
      throw error
    }
    return turnPendingSummary(occurrence, locked.encounter.version)
  })
  if (pending) return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(pending)
  return getPendingEncounterConcentrationRuleOccurrence({
    db,
    actorUserId: userId,
    encounterId
  })
}

export async function getActiveEncounterProjection(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<EncounterGmProjectionDto | EncounterPlayerProjectionDto | null> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const repository = createEncounterRepository(db)
  const encounter = await repository.findActiveVersionMetadataForCampaign(campaignId)
  if (!encounter) return null
  const current = await repository.requireCurrentProjection({
    encounterId: encounter.id,
    expectedStreamVersion: encounter.version
  })
  return authority.membership.role === 'OWNER'
    ? current.projection
    : projectPlayerEncounterProjection(current.projection)
}

export async function listCampaignEncounterProjections(
  db: DBLike,
  userId: string,
  campaignId: string
): Promise<Array<EncounterGmProjectionDto | EncounterPlayerProjectionDto>> {
  const authority = await resolveCampaignAuthority(db, campaignId, userId)
  assertActiveCampaignMember(authority)
  const repository = createEncounterRepository(db)
  const encounters = await repository.listVersionMetadataForCampaign(campaignId)
  const visible =
    authority.membership.role === 'OWNER'
      ? encounters
      : encounters.filter((encounter) => encounter.status === 'ACTIVE')
  return Promise.all(
    visible.map(async (encounter) => {
      const current = await repository.requireCurrentProjection({
        encounterId: encounter.id,
        expectedStreamVersion: encounter.version
      })
      return authority.membership.role === 'OWNER'
        ? current.projection
        : projectPlayerEncounterProjection(current.projection)
    })
  )
}
