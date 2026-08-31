import {
  createSystemVocabularySnapshotRepository,
  type DBLike,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import {
  serverAggregateChoicePendingSnapshotDtoSchema,
  type ServerAggregateChoicePendingSnapshotDto,
  type ServerCompletedRuleExecutionDto,
  type ServerRuleExecutionApplicationOutputsDto,
  type StoredRuleExecutionResultDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { characterRuleActionSystemAdapterRegistry } from '../rules/characterRuleActionSystemAdapterRegistry.js'
import { discoverEncounterFeatureActionCapabilities } from '../rules/encounterFeatureActionCapabilityDiscoveryRegistry.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { createReusableDefinitionRepository } from '@artificer-toolkit/db'
import {
  prepareEncounterActionSettlementCore,
  settleEncounterActionSettlementCore,
  type PreparedEncounterActionSettlementCore
} from './encounterActionSettlementCore.js'
import {
  lockEncounterActiveEffectTargets,
  type LockedEncounterActiveEffectTargets
} from './encounterActiveEffectTargetState.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import {
  discoverEncounterLegendaryActionCandidates,
  type EncounterLegendaryActionCandidate
} from './encounterLegendaryActionDiscovery.js'
import {
  executeEncounterMovementReactionAction,
  type EncounterMovementReactionActionExecution,
  type MovementReactionActionResolution
} from './encounterMovementReactionActionExecution.js'

type EncounterLegendaryActionChoiceContext = Extract<
  ServerAggregateChoicePendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' }
>

export type EncounterLegendaryActionChoice = EncounterLegendaryActionChoiceContext['choice']
export type EncounterLegendaryActionOption = EncounterLegendaryActionChoice['options'][number]
export type EncounterLegendaryActionEvidence = NonNullable<
  Extract<
    StoredRuleExecutionResultDto,
    { status: 'TURN_LIFECYCLE_COMPLETE' }
  >['legendaryActions'][number]
>

export interface EncounterLegendaryActionWindow {
  choice: EncounterLegendaryActionChoice
  candidatesByOptionId: ReadonlyMap<string, EncounterLegendaryActionCandidate>
  targets: LockedEncounterActiveEffectTargets
}

export interface EncounterLegendaryActionWindows {
  windows: EncounterLegendaryActionWindow[]
}

function optionForCandidate(
  candidate: EncounterLegendaryActionCandidate
): EncounterLegendaryActionOption {
  const resource = candidate.action.featureResourceUse
  const adapter = characterRuleActionSystemAdapterRegistry.get(candidate.gameSystemId)
  if (!resource || !adapter) {
    throw new EncounterValidationError('The Legendary Action source cannot be executed.')
  }
  const published = adapter.compile({ action: candidate.action })
  const optionWithoutId = {
    ownerActorId: candidate.ownerActorId,
    ownerFeatureId: candidate.ownerFeatureId,
    actionId: candidate.actionId,
    targetActorId: candidate.ownerActorId,
    actionSourceChecksum: published.checksum,
    chargeId: resource.chargeId,
    featureCost: candidate.featureCost,
    poolBefore: candidate.poolBefore,
    poolRemaining: candidate.poolRemaining,
    lifecycle: {
      definitionId: candidate.lifecycle.definitionId,
      definitionVersion: candidate.lifecycle.definitionVersion,
      definitionChecksum: candidate.lifecycle.definitionChecksum,
      eligibilityGraphDefinitionId: candidate.lifecycle.eligibilityGraphDefinitionId,
      eligibilityGraphDefinitionVersion: candidate.lifecycle.eligibilityGraphDefinitionVersion,
      eligibilityGraphDefinitionChecksum: candidate.lifecycle.eligibilityGraphDefinitionChecksum,
      eligibleOutput: candidate.lifecycle.eligibleOutput
    },
    eligibilityEvidenceChecksum: checksumRuleDocument(candidate.eligibilityEvidence)
  }
  return { ...optionWithoutId, optionId: checksumRuleDocument(optionWithoutId) }
}

/** Locks exact action/target facts and freezes canonical choices for every eligible Legendary owner. */
export async function discoverEncounterLegendaryActionWindows(input: {
  trx: DBLike
  encounter: EncounterRecord
  outgoingActorId: string
  occurrenceId: string
  actorRules: EncounterActorRuleOutput
  runtime: RulesRuntimeService
  attunementSlotOverride: number | null
}): Promise<EncounterLegendaryActionWindows> {
  const targets = await lockEncounterActiveEffectTargets({
    trx: input.trx,
    encounter: input.encounter,
    actors: input.encounter.actors,
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: async () => ({
      rules: input.actorRules,
      encounter: input.encounter
    })
  })
  const vocabulary = await createSystemVocabularySnapshotRepository(input.trx).findActive(
    input.encounter.gameSystemId
  )
  if (!vocabulary) {
    throw new EncounterValidationError('Encounter System vocabulary is unavailable.')
  }
  const conditionDefinitionIds = vocabulary.document.conditionTypes.map(({ id }) => id)
  const abilityDefinitions =
    'schemaVersion' in vocabulary.document && vocabulary.document.schemaVersion === 2
      ? vocabulary.document.abilities.map(({ id, code }) => ({ id, code }))
      : []
  const capabilities = input.encounter.actors.flatMap((actor) =>
    discoverEncounterFeatureActionCapabilities({
      actor,
      conditionDefinitionIds,
      abilityDefinitions
    })
  )
  const candidates = await discoverEncounterLegendaryActionCandidates({
    encounter: input.encounter,
    outgoingActorId: input.outgoingActorId,
    occurrenceId: input.occurrenceId,
    actorRules: input.actorRules,
    encounterFeatureCapabilities: capabilities,
    lockedCharacters: targets.lockedCharacters,
    definitions: createReusableDefinitionRepository(input.trx),
    runtime: input.runtime
  })
  const ownerActorIds = [...new Set(candidates.map((candidate) => candidate.ownerActorId))]
  const windows = ownerActorIds.map((ownerActorId) => {
    const ownerCandidates = candidates.filter(
      (candidate) => candidate.ownerActorId === ownerActorId
    )
    const candidatesByOptionId = new Map<string, EncounterLegendaryActionCandidate>()
    const options = ownerCandidates.map((candidate) => {
      const option = optionForCandidate(candidate)
      if (candidatesByOptionId.has(option.optionId)) {
        throw new EncounterConflictError('Legendary Action choice identity is ambiguous.')
      }
      candidatesByOptionId.set(option.optionId, candidate)
      return option
    })
    return {
      choice: { ownerActorId, options },
      candidatesByOptionId,
      targets
    }
  })
  return { windows }
}

/** Returns one exact owner window, revalidated against current locked facts. */
export async function discoverEncounterLegendaryActionWindow(input: {
  trx: DBLike
  encounter: EncounterRecord
  outgoingActorId: string
  occurrenceId: string
  actorRules: EncounterActorRuleOutput
  runtime: RulesRuntimeService
  attunementSlotOverride: number | null
  ownerActorId?: string
}): Promise<EncounterLegendaryActionWindow | null> {
  const discovered = await discoverEncounterLegendaryActionWindows(input)
  if (input.ownerActorId) {
    return (
      discovered.windows.find((window) => window.choice.ownerActorId === input.ownerActorId) ?? null
    )
  }
  return discovered.windows[0] ?? null
}

export function createEncounterLegendaryActionChoicePendingSnapshot(input: {
  occurrenceId: string
  root: EncounterLegendaryActionChoiceContext['root']
  choice: EncounterLegendaryActionChoice
}): ServerAggregateChoicePendingSnapshotDto {
  return serverAggregateChoicePendingSnapshotDtoSchema.parse({
    snapshotKind: 'AGGREGATE_CHOICE',
    schemaVersion: 1,
    occurrenceId: input.occurrenceId,
    applicationContext: {
      kind: 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE',
      schemaVersion: 1,
      root: input.root,
      selectionChecksum: checksumRuleDocument(input.choice),
      choice: input.choice
    }
  })
}

export interface PreparedEncounterLegendaryAction extends PreparedEncounterActionSettlementCore {
  choice: EncounterLegendaryActionChoice
  option: EncounterLegendaryActionOption
}

export async function prepareEncounterLegendaryAction(input: {
  trx: DBLike
  actorUserId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  encounter: EncounterRecord
  choice: EncounterLegendaryActionChoice
  optionId: string
  window: EncounterLegendaryActionWindow
}): Promise<PreparedEncounterLegendaryAction> {
  if (checksumRuleDocument(input.window.choice) !== checksumRuleDocument(input.choice)) {
    throw new EncounterConflictError('The Legendary Action choice is stale.')
  }
  const option = input.choice.options.find((candidate) => candidate.optionId === input.optionId)
  const candidate = input.window.candidatesByOptionId.get(input.optionId)
  if (
    !option ||
    !candidate ||
    checksumRuleDocument(optionForCandidate(candidate)) !== checksumRuleDocument(option)
  ) {
    throw new EncounterConflictError('The selected Legendary Action is stale.')
  }
  const prepared = await prepareEncounterActionSettlementCore({
    db: input.trx,
    actorUserId: input.actorUserId,
    automationMode: input.automationMode,
    encounter: input.encounter,
    actionSource: {
      kind: 'ENCOUNTER_FEATURE',
      actorId: candidate.ownerActorId,
      capability: candidate.action
    },
    targetActorId: option.targetActorId,
    targets: input.window.targets
  })
  if (prepared.action.published.checksum !== option.actionSourceChecksum) {
    throw new EncounterConflictError('The selected Legendary Action source is stale.')
  }
  return { ...prepared, choice: input.choice, option }
}

export async function executeEncounterLegendaryAction(input: {
  runtime: RulesRuntimeService
  occurrenceId: string
  automationMode: 'AUTOMATIC' | 'ASSISTED'
  prepared: PreparedEncounterLegendaryAction
  continuation?: Parameters<typeof executeEncounterMovementReactionAction>[0]['continuation']
  expectedD20Policy?: Parameters<
    typeof executeEncounterMovementReactionAction
  >[0]['expectedD20Policy']
  resolution?: MovementReactionActionResolution
  rollD20?: () => number
}): Promise<EncounterMovementReactionActionExecution> {
  return executeEncounterMovementReactionAction({
    runtime: input.runtime,
    occurrenceId: input.occurrenceId,
    automationMode: input.automationMode,
    prepared: input.prepared.action,
    ...(input.continuation ? { continuation: input.continuation } : {}),
    ...(input.expectedD20Policy ? { expectedD20Policy: input.expectedD20Policy } : {}),
    ...(input.resolution ? { resolution: input.resolution } : {}),
    ...(input.rollD20 ? { rollD20: input.rollD20 } : {})
  })
}

export async function settleEncounterLegendaryAction(input: {
  db: DBLike
  actorUserId: string
  encounterId: string
  occurrenceId: string
  commandId: string
  prepared: PreparedEncounterLegendaryAction
  execution: Extract<EncounterMovementReactionActionExecution, { kind: 'COMPLETE' }>
}): Promise<{
  application: ServerRuleExecutionApplicationOutputsDto
  sourceActorId: string
  evidence: EncounterLegendaryActionEvidence
}> {
  const settled = await settleEncounterActionSettlementCore({
    db: input.db,
    actorUserId: input.actorUserId,
    encounterId: input.encounterId,
    occurrenceId: input.occurrenceId,
    commandId: input.commandId,
    ordinal: 0,
    eventPhases: {
      resource: 'LEGENDARY_ACTION_RESOURCE',
      outcome: 'LEGENDARY_ACTION_OUTCOME'
    },
    prepared: input.prepared,
    execution: input.execution
  })
  const evidence: EncounterLegendaryActionEvidence = {
    choice: input.prepared.choice,
    selectionChecksum: checksumRuleDocument(input.prepared.choice),
    resolution: {
      kind: 'EXECUTED',
      selectedOptionId: input.prepared.option.optionId,
      execution: input.execution.execution as ServerCompletedRuleExecutionDto,
      application: settled.application,
      characterTransitions: settled.characterTransitions.sort((left, right) =>
        left.characterId.localeCompare(right.characterId)
      )
    }
  }
  return { application: settled.application, sourceActorId: settled.sourceActor.id, evidence }
}

export function declinedEncounterLegendaryAction(
  choice: EncounterLegendaryActionChoice
): EncounterLegendaryActionEvidence {
  return {
    choice,
    selectionChecksum: checksumRuleDocument(choice),
    resolution: { kind: 'DECLINED' }
  }
}
