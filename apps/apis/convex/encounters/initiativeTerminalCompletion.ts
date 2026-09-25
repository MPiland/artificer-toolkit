import {
  encounterCommandResultDtoSchema,
  type EncounterCommandInputDto,
  type EncounterCommandResultDto,
  type EncounterGmProjectionDto
} from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  encounterStoredRuleOccurrenceSchema,
  encounterStoredRuleReceiptSchema,
  encounterStoredRunCommandSchema
} from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import {
  type EncounterInitiativeAdvancePlanDto,
  type EncounterInitiativeSettlementDto
} from '@artificer-toolkit/schema/shared/ruleExecutionInitiative'
import { serverRuleExecutionReceiptCommandMetadataDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionReceiptCommandMetadata'
import {
  storedRuleExecutionResultDtoSchema,
  type PendingCompletedTurnPhaseDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { TurnResolutionCommandDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnCommands'
import type { CompletedTurnRechargePlanDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResources'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { insertRunCommand } from './timelineEntries'

type InitiativeRootCommand = Extract<EncounterCommandInputDto, { type: 'START' | 'ADVANCE_TURN' }>

/**
 * Commits a settled initiative occurrence and its root command evidence.
 * Initiative rows must already be persisted before this is called.
 */
export async function completeNativeInitiativeOccurrence(input: {
  ctx: MutationCtx
  encounter: Doc<'encounterRuns'>
  occurrence: Doc<'encounterRuleOccurrences'>
  state: EncounterRunState
  nextState: EncounterRunState
  nextProjection: EncounterGmProjectionDto
  rootCommand: InitiativeRootCommand
  rootCommandId: string
  rootCommandFingerprint: string
  rootInitiatorUserId: string
  rootRequestedByUserId: string
  rootCorrelationId: string | null
  rootExpectedEncounterVersion: number
  initiative: EncounterInitiativeSettlementDto | null
  initiativeAdvance: EncounterInitiativeAdvancePlanDto | null
  rechargePlan?: CompletedTurnRechargePlanDto | null
  legendaryActions?: TurnCoordinatorRootDto['completedLegendaryActions']
  legendaryActionRefreshes?: TurnCoordinatorRootDto['stagedLegendaryActionRefreshes']
  actionEconomyRefreshes?: TurnCoordinatorRootDto['stagedActionEconomyRefreshes']
  outgoingEffects?: {
    phase: PendingCompletedTurnPhaseDto
    result: StoredRuleExecutionResultDto | null
  }
  incomingEffects?: {
    phase: PendingCompletedTurnPhaseDto
    result: StoredRuleExecutionResultDto | null
  }
  includeOccurrence?: boolean
  resolutionCommands: readonly TurnResolutionCommandDto[]
  occurrenceVersion: number
  encounterVersion: number
  updatedAt: string
}): Promise<EncounterCommandResultDto> {
  const commandType = input.rootCommand.type
  const result = encounterCommandResultDtoSchema.parse({
    projection: input.nextProjection,
    roll: null,
    resolution: null,
    occurrence:
      input.includeOccurrence === false
        ? null
        : {
            occurrenceId: input.occurrence.id,
            occurrenceVersion: input.occurrenceVersion,
            status: 'COMPLETE',
            outcome: null,
            pending: null
          }
  })
  const initiativeResult = {
    status: 'INITIATIVE_COMPLETE',
    schemaVersion: 1,
    occurrenceId: input.occurrence.id,
    occurrenceVersion: input.occurrenceVersion,
    encounterId: input.encounter.id,
    commandType,
    initiative: input.initiative,
    initiativeAdvance: input.initiativeAdvance,
    ...(input.rechargePlan ? { rechargeExecutions: input.rechargePlan.executions } : {}),
    ...(input.legendaryActions?.length ? { legendaryActions: input.legendaryActions } : {}),
    ...(input.legendaryActionRefreshes?.length
      ? { legendaryActionRefreshes: input.legendaryActionRefreshes }
      : {}),
    ...(input.actionEconomyRefreshes?.length
      ? { actionEconomyRefreshes: input.actionEconomyRefreshes }
      : {})
  }
  const hasEffects = [input.outgoingEffects, input.incomingEffects].some(
    (value) => value !== undefined && value.phase.kind !== 'NONE'
  )
  const terminatedMaintainedStates = [input.outgoingEffects, input.incomingEffects]
    .flatMap((value) =>
      value?.result?.status === 'BATCH_COMPLETE' &&
      value.result.batchKind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
        ? (value.result.terminatedMaintainedStates ?? [])
        : []
    )
    .sort((left, right) =>
      `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
    )
  const phaseEvidence = (value: typeof input.outgoingEffects) => {
    if (!value || value.phase.kind === 'NONE')
      return { kind: 'NONE' as const, selectionChecksum: null }
    if (value.phase.kind === 'MANUAL') {
      if (value.phase.result.status !== 'MANUAL')
        throw new Error('Manual turn evidence is invalid.')
      return {
        kind: 'MANUAL' as const,
        selectionChecksum: value.phase.selectionChecksum,
        reminder: value.phase.result.reminder
      }
    }
    if (
      value.result?.status !== 'BATCH_COMPLETE' ||
      value.result.batchKind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS'
    )
      throw new Error('Turn effect terminal evidence is unavailable.')
    return {
      kind: 'EXECUTED' as const,
      selectionChecksum: value.phase.plan.selectionChecksum,
      executions: value.result.executions,
      characterTransitions: value.result.characterTransitions,
      encounterActorTransitions: value.result.encounterActorTransitions
    }
  }
  let ruleResult: StoredRuleExecutionResultDto
  if (hasEffects && commandType === 'ADVANCE_TURN') {
    ruleResult = storedRuleExecutionResultDtoSchema.parse({
      ...initiativeResult,
      status: 'TURN_LIFECYCLE_COMPLETE',
      ...(terminatedMaintainedStates.length ? { terminatedMaintainedStates } : {}),
      outgoingTurn: phaseEvidence(input.outgoingEffects),
      incomingTurn: phaseEvidence(input.incomingEffects)
    })
  } else if (input.incomingEffects?.phase.kind === 'STAGED') {
    const phase = phaseEvidence(input.incomingEffects)
    if (phase.kind !== 'EXECUTED') throw new Error('Incoming turn effect evidence is unavailable.')
    ruleResult = storedRuleExecutionResultDtoSchema.parse({
      ...initiativeResult,
      status: 'BATCH_COMPLETE',
      batchKind: 'ENCOUNTER_TURN_ACTIVE_EFFECTS',
      ...(terminatedMaintainedStates.length ? { terminatedMaintainedStates } : {}),
      executions: phase.executions,
      characterTransitions: phase.characterTransitions,
      encounterActorTransitions: phase.encounterActorTransitions
    })
  } else if (input.incomingEffects?.phase.kind === 'MANUAL') {
    ruleResult = storedRuleExecutionResultDtoSchema.parse({
      ...input.incomingEffects.phase.result,
      occurrenceVersion: input.occurrenceVersion,
      initiative: input.initiative,
      initiativeAdvance: input.initiativeAdvance,
      ...(input.actionEconomyRefreshes?.length
        ? { actionEconomyRefreshes: input.actionEconomyRefreshes }
        : {})
    })
  } else ruleResult = storedRuleExecutionResultDtoSchema.parse(initiativeResult)
  const resultChecksum = checksumCanonicalJson(ruleResult)
  const commandMetadata = serverRuleExecutionReceiptCommandMetadataDtoSchema.parse({
    schemaVersion: 1,
    transition: 'TURN_EFFECTS',
    commandType,
    expectedAggregateVersion: input.rootExpectedEncounterVersion,
    selectionChecksum: null,
    initiativeChecksum: input.initiative === null ? null : checksumCanonicalJson(input.initiative),
    initiativeAdvanceChecksum:
      input.initiativeAdvance === null ? null : checksumCanonicalJson(input.initiativeAdvance),
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    terminalOccurrenceVersion: input.occurrenceVersion,
    resolutionCommands: input.resolutionCommands
  })
  const completedOccurrence = encounterStoredRuleOccurrenceSchema.parse({
    id: input.occurrence.id,
    campaignId: input.occurrence.campaignId,
    encounterId: input.occurrence.encounterId,
    rootCommandId: input.occurrence.rootCommandId,
    state: 'COMPLETED',
    version: input.occurrenceVersion,
    expectedEncounterVersion: input.encounterVersion,
    pendingSnapshotJson: null,
    pendingSnapshotChecksum: null,
    completedAt: input.updatedAt,
    createdAt: input.occurrence.createdAt,
    updatedAt: input.updatedAt
  })
  await input.ctx.db.patch(input.encounter._id, {
    status: 'ACTIVE',
    version: input.encounterVersion,
    updatedAt: input.updatedAt,
    stateJson: JSON.stringify(input.nextState),
    stateChecksum: checksumCanonicalJson(input.nextState),
    projectionJson: JSON.stringify(input.nextProjection),
    projectionChecksum: checksumCanonicalJson(input.nextProjection)
  })
  await input.ctx.db.patch(input.occurrence._id, {
    state: completedOccurrence.state,
    version: completedOccurrence.version,
    expectedEncounterVersion: completedOccurrence.expectedEncounterVersion,
    pendingSnapshotJson: completedOccurrence.pendingSnapshotJson,
    pendingSnapshotChecksum: completedOccurrence.pendingSnapshotChecksum,
    completedAt: completedOccurrence.completedAt,
    updatedAt: completedOccurrence.updatedAt
  })
  await input.ctx.db.insert(
    'encounterRuleReceipts',
    encounterStoredRuleReceiptSchema.parse({
      id: crypto.randomUUID(),
      campaignId: input.encounter.campaignId,
      encounterId: input.encounter.id,
      occurrenceId: input.occurrence.id,
      commandId: input.rootCommandId,
      commandType,
      commandFingerprint: input.rootCommandFingerprint,
      encounterVersion: input.encounterVersion,
      commandMetadataJson: JSON.stringify(commandMetadata),
      resultJson: JSON.stringify(ruleResult),
      resultChecksum,
      actorUserId: input.rootRequestedByUserId,
      correlationId: input.rootCorrelationId,
      createdAt: input.updatedAt
    })
  )
  await insertRunCommand(
    input.ctx,
    encounterStoredRunCommandSchema.parse({
      id: crypto.randomUUID(),
      campaignId: input.encounter.campaignId,
      encounterId: input.encounter.id,
      commandId: input.rootCommandId,
      commandType,
      ruleOccurrenceId: input.occurrence.id,
      ruleResultChecksum: resultChecksum,
      optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
      commandFingerprint: input.rootCommandFingerprint,
      actorUserId: input.rootRequestedByUserId,
      version: input.encounterVersion,
      commandJson: JSON.stringify(input.rootCommand),
      resultJson: JSON.stringify(result),
      resultChecksum: checksumCanonicalJson(result),
      createdAt: input.updatedAt
    })
  )
  return result
}
