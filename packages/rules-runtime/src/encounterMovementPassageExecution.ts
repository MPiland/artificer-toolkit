import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type {
  ServerKernelRuleExecutionPendingSnapshotDto,
  ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/rulesExecution'
import {
  isServerAggregateChoicePendingSnapshot,
  isServerKernelRuleExecutionPendingSnapshot,
  serverKernelRuleExecutionPendingSnapshotDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { movementRuleResolutionCommandDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionSpatial'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEncounterMovementPassageChoice } from './encounterMovementPassageChoice.js'
import { executeEncounterMovementPassageContest } from './encounterMovementPassageContest.js'
import type { prepareEncounterMovementPassageContest } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'

type PassageChoice = Extract<
  ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }
>
type PassagePending = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' }
>
type PassageContestReceipt = NonNullable<
  Extract<
    NonNullable<PassagePending['movementContinuation']>['root']['resolutionCommands'][number],
    { kind: 'PASSAGE_OPTION' }
  >['passageContest']
>
type ResolutionCommand = ReturnType<typeof movementRuleResolutionCommandDtoSchema.parse>
type PassageMovement =
  | PassageChoice['movement']
  | NonNullable<PassagePending['movementContinuation']>
type CompletedContestExecution = Extract<
  Awaited<ReturnType<typeof executeEncounterMovementPassageContest>>,
  { kind: 'COMPLETE' }
>
type PassageContestResult =
  | { kind: 'DECLINED'; movement: PassageMovement }
  | {
      kind: 'PENDING'
      movement: PassageMovement
      pending: PassagePending
      snapshot: ServerKernelRuleExecutionPendingSnapshotDto
    }
  | {
      kind: 'COMPLETE'
      movement: PassageMovement
      receipt: PassageContestReceipt
      pending: PassagePending
      execution: CompletedContestExecution
    }

function same(left: unknown, right: unknown) {
  return checksumRuleDocument(left) === checksumRuleDocument(right)
}

function withoutEvidence(pending: PassagePending) {
  return { ...pending, rollEvidence: { initiator: null, defender: null } }
}

function appendedMovement<
  T extends PassageChoice['movement'] | NonNullable<PassagePending['movementContinuation']>
>(movement: T, command: ResolutionCommand) {
  return {
    ...movement,
    root: { ...movement.root, resolutionCommands: [...movement.root.resolutionCommands, command] }
  }
}

function receipt(input: {
  execution: CompletedContestExecution
  pending: PassagePending
}): PassageContestReceipt {
  const economy = input.pending.actionEconomy
  const movement = input.pending.movementContinuation
  if (!economy || !movement) throw new Error('Movement passage allowance is unavailable.')
  const participant = (
    policy: PassagePending['initiator'],
    rawFaces: readonly number[],
    total: number
  ) => ({
    rollMode: policy.rollMode,
    rawFaces: [...rawFaces],
    selectedNatural:
      policy.rollMode === 'ADVANTAGE'
        ? Math.max(...rawFaces)
        : policy.rollMode === 'DISADVANTAGE'
          ? Math.min(...rawFaces)
          : rawFaces[0]!,
    modifier: policy.modifier,
    total
  })
  const terminalPassageStop =
    input.execution.outcome === 'SUCCESS' ? (movement.nextPassageStop ?? null) : null
  return {
    actionKind: input.pending.actionKind as 'OVERRUN' | 'TUMBLE',
    optionId: input.pending.optionId,
    outcome: input.execution.outcome,
    initiator: participant(
      input.pending.initiator,
      input.execution.evidence.initiatorRawFaces,
      input.execution.evidence.initiatorTotal
    ),
    defender: participant(
      input.pending.defender,
      input.execution.evidence.defenderRawFaces,
      input.execution.evidence.defenderTotal
    ),
    actionEconomy: { ...economy, afterUsed: economy.beforeUsed + 1 },
    audit: {
      optionalCombat: {
        definitionId: input.pending.optionalCombat.definitionId,
        definitionVersion: input.pending.optionalCombat.definitionVersion,
        definitionChecksum: input.pending.optionalCombat.definitionChecksum,
        moduleKey: input.pending.optionalCombat.moduleKey,
        moduleContractVersion: input.pending.optionalCombat.moduleContractVersion
      },
      sourceActorId: input.pending.sourceActorId,
      sourceTokenId: movement.root.tokenId,
      blockerActorId: movement.blockerActorId,
      blockerTokenId: movement.blockerTokenId,
      contact: movement.contact,
      contactPathDistance: movement.contactPathDistance,
      blockerCurrentnessChecksum: movement.blockerCurrentnessChecksum,
      selectionContractChecksum: input.pending.selectionContractChecksum,
      resolvedSelectionChecksum: input.pending.resolvedSelectionChecksum,
      spatialSelectionChecksum: movement.spatialSelectionChecksum,
      spatialCurrentnessChecksum: movement.spatialCurrentnessChecksum,
      originalPath: [...movement.root.originalPath],
      pathChecksum: movement.root.pathChecksum,
      ...(terminalPassageStop
        ? {
            terminalPassageStop: {
              blockerActorId: terminalPassageStop.blockerActorId,
              blockerTokenId: terminalPassageStop.blockerTokenId,
              contact: terminalPassageStop.contact,
              contactPathDistance: terminalPassageStop.pathDistance,
              blockerCurrentnessChecksum: terminalPassageStop.blockerCurrentnessChecksum
            },
            terminalPosition: terminalPassageStop.contact
          }
        : {})
    }
  }
}

/** Evaluates sealed passage choice/evidence only; Scene publication owns all writes and economy use. */
export async function evaluateEncounterMovementPassageContest<
  TCharacterFacts extends CharacterMovementFacts
>(
  input: {
    state: EncounterRunState
    snapshot: ServerRuleExecutionPendingSnapshotDto
    resolution: ResolveRuleOccurrenceInputDto['resolution']
    responseCommand: ResolutionCommand
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    retained?: {
      snapshot?: ServerKernelRuleExecutionPendingSnapshotDto
      receipt?: PassageContestReceipt
    }
  },
  callbacks: {
    prepareContest: (
      input: Parameters<typeof prepareEncounterMovementPassageContest<TCharacterFacts>>[1]
    ) => ReturnType<typeof prepareEncounterMovementPassageContest<TCharacterFacts>>
    runtime: () => Promise<RulesRuntimeService>
    rollD20: () => number
  }
): Promise<PassageContestResult> {
  const responseCommand = movementRuleResolutionCommandDtoSchema.parse(input.responseCommand)
  if (isServerAggregateChoicePendingSnapshot(input.snapshot)) {
    const choice = input.snapshot.applicationContext
    if (choice.kind !== 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE')
      throw new Error('Movement passage choice is unavailable.')
    if (
      (input.resolution.kind !== 'PASSAGE_DECLINE' && input.resolution.kind !== 'PASSAGE_OPTION') ||
      (responseCommand.kind !== 'PASSAGE_DECLINE' && responseCommand.kind !== 'PASSAGE_OPTION') ||
      input.snapshot.optionalCombatSnapshotChecksum !==
        input.state.optionalCombatSnapshotChecksum ||
      (input.resolution.kind === 'PASSAGE_DECLINE' && responseCommand.kind !== 'PASSAGE_DECLINE') ||
      (input.resolution.kind === 'PASSAGE_OPTION' &&
        (responseCommand.kind !== 'PASSAGE_OPTION' ||
          responseCommand.optionId !== input.resolution.optionId))
    )
      throw new Error('Movement passage choice is stale.')
    const movement = appendedMovement(choice.movement, responseCommand)
    const selected = resolveEncounterMovementPassageChoice({
      context: choice,
      selection:
        input.resolution.kind === 'PASSAGE_DECLINE'
          ? { kind: 'DECLINE' }
          : { kind: 'OPTION', optionId: input.resolution.optionId }
    })
    if (selected.kind === 'DECLINED') {
      if (input.retained) throw new Error('Retained movement passage evidence is stale.')
      return { kind: 'DECLINED' as const, movement }
    }
    const pending = await callbacks.prepareContest({
      state: input.state,
      choice: { ...choice, movement },
      optionId: selected.option.optionId,
      targets: input.targets
    })
    const retainedFaces = input.retained?.receipt
      ? [...input.retained.receipt.initiator.rawFaces, ...input.retained.receipt.defender.rawFaces]
      : []
    const rollD20 = () => {
      if (!input.retained) return callbacks.rollD20()
      const face = retainedFaces.shift()
      if (face === undefined)
        throw new Error('Retained movement passage evidence is missing a d20 face.')
      return face
    }
    const execution = await executeEncounterMovementPassageContest({
      automationMode: input.state.automationMode === 'AUTOMATIC' ? 'AUTOMATIC' : 'ASSISTED',
      occurrenceId: input.snapshot.occurrenceId,
      pending,
      rollD20,
      runtime: await callbacks.runtime()
    })
    if (retainedFaces.length)
      throw new Error('Retained movement passage evidence contains unused d20 faces.')
    if (execution.kind === 'PENDING') {
      if (input.retained?.receipt)
        throw new Error('Retained movement passage completion evidence is stale.')
      const nextPending: PassagePending = {
        ...pending,
        rollEvidence: {
          ...pending.rollEvidence,
          ...(execution.submittedEvidence
            ? {
                [execution.submittedEvidence.participant === 'INITIATOR'
                  ? 'initiator'
                  : 'defender']: {
                  requestId: execution.submittedEvidence.requestId,
                  rawFaces: [...execution.submittedEvidence.rawFaces]
                }
              }
            : {})
        }
      }
      const nextSnapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...execution.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        optionalCombatSnapshotChecksum: pending.optionalCombat.snapshotChecksum,
        applicationContext: nextPending
      })
      if (input.retained?.snapshot && !same(nextSnapshot, input.retained.snapshot))
        throw new Error('Retained movement passage pending evidence is stale.')
      return {
        kind: 'PENDING' as const,
        movement,
        pending: nextPending,
        snapshot: nextSnapshot
      }
    }
    const completedReceipt = receipt({ execution, pending })
    if (input.retained?.snapshot)
      throw new Error('Retained movement passage pending evidence is stale.')
    if (input.retained?.receipt && !same(completedReceipt, input.retained.receipt))
      throw new Error('Retained movement passage completion evidence is stale.')
    const completedMovement = {
      ...movement,
      root: {
        ...movement.root,
        terminalPassageStop:
          execution.outcome === 'SUCCESS' ? (movement.nextPassageStop ?? null) : null,
        resolutionCommands: [
          ...choice.movement.root.resolutionCommands,
          movementRuleResolutionCommandDtoSchema.parse({
            ...responseCommand,
            passageContest: completedReceipt
          })
        ]
      }
    }
    return {
      kind: 'COMPLETE' as const,
      movement: completedMovement,
      receipt: completedReceipt,
      pending,
      execution
    }
  }
  if (!isServerKernelRuleExecutionPendingSnapshot(input.snapshot))
    throw new Error('Movement passage evidence is unavailable.')
  const sealed = input.snapshot.applicationContext
  if (
    sealed.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST' ||
    (sealed.actionKind !== 'OVERRUN' && sealed.actionKind !== 'TUMBLE') ||
    (sealed.selection.kind !== 'OVERRUN' && sealed.selection.kind !== 'TUMBLE') ||
    !sealed.movementContinuation ||
    (input.resolution.kind !== 'ENTER_DICE' && input.resolution.kind !== 'SYSTEM_ROLL') ||
    (responseCommand.kind !== 'ENTER_DICE' && responseCommand.kind !== 'SYSTEM_ROLL') ||
    responseCommand.requestId !== input.resolution.requestId
  )
    throw new Error('Movement passage evidence is unavailable.')
  const movement = appendedMovement(sealed.movementContinuation, responseCommand)
  const choice: PassageChoice = {
    kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE',
    schemaVersion: 1,
    movement: sealed.movementContinuation,
    sourceActorId: sealed.sourceActorId,
    sourceTokenId: sealed.movementContinuation.root.tokenId,
    sourceControllerCharacterId: sealed.initiatorControllerCharacterId,
    options: [
      {
        optionId: sealed.optionId,
        ruleKind: sealed.actionKind,
        economy: sealed.selection.economy,
        definitionId: sealed.optionalCombat.definitionId,
        definitionVersion: sealed.optionalCombat.definitionVersion,
        definitionChecksum: sealed.optionalCombat.definitionChecksum,
        moduleKey: sealed.optionalCombat.moduleKey,
        moduleContractVersion: sealed.optionalCombat.moduleContractVersion
      }
    ],
    optionsChecksum: ''
  }
  choice.optionsChecksum = checksumRuleDocument(choice.options)
  const current = await callbacks.prepareContest({
    state: input.state,
    choice,
    optionId: sealed.optionId,
    targets: input.targets
  })
  const sealedPending: PassagePending = {
    ...sealed,
    movementContinuation: sealed.movementContinuation,
    rollEvidence: { ...sealed.rollEvidence }
  }
  if (!same(withoutEvidence(current), withoutEvidence(sealedPending)))
    throw new Error('Movement passage contest facts changed.')
  const pending: PassagePending = {
    ...sealedPending,
    movementContinuation: movement,
    positionalDependencyChecksum: checksumRuleDocument(movement)
  }
  const {
    applicationContext: _applicationContext,
    snapshotKind: _snapshotKind,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = input.snapshot
  const participant =
    input.snapshot.request.nodeId === pending.initiator.requestNodeId
      ? 'initiator'
      : input.snapshot.request.nodeId === pending.defender.requestNodeId
        ? 'defender'
        : null
  if (!participant) throw new Error('Movement passage request is unavailable.')
  const retainedFaces =
    input.retained && input.resolution.kind === 'SYSTEM_ROLL'
      ? input.retained.receipt
        ? [...input.retained.receipt[participant].rawFaces]
        : input.retained.snapshot?.applicationContext.kind === 'ENCOUNTER_OPTIONAL_COMBAT_CONTEST'
          ? [
              ...(input.retained.snapshot.applicationContext.rollEvidence[participant]?.rawFaces ??
                [])
            ]
          : []
      : []
  const rollD20 = () => {
    if (!input.retained) return callbacks.rollD20()
    const face = retainedFaces.shift()
    if (face === undefined)
      throw new Error('Retained movement passage evidence is missing a d20 face.')
    return face
  }
  const execution = await executeEncounterMovementPassageContest({
    automationMode: 'ASSISTED',
    continuation,
    occurrenceId: input.snapshot.occurrenceId,
    pending,
    resolution: input.resolution,
    rollD20,
    runtime: await callbacks.runtime()
  })
  if (retainedFaces.length)
    throw new Error('Retained movement passage evidence contains unused d20 faces.')
  if (execution.kind === 'PENDING') {
    if (input.retained?.receipt)
      throw new Error('Retained movement passage completion evidence is stale.')
    if (!execution.submittedEvidence) throw new Error('Movement passage evidence is unavailable.')
    const nextPending: PassagePending = {
      ...pending,
      rollEvidence: {
        ...pending.rollEvidence,
        [execution.submittedEvidence.participant === 'INITIATOR' ? 'initiator' : 'defender']: {
          requestId: execution.submittedEvidence.requestId,
          rawFaces: [...execution.submittedEvidence.rawFaces]
        }
      }
    }
    const nextSnapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...execution.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: nextPending.optionalCombat.snapshotChecksum,
      applicationContext: nextPending
    })
    if (input.retained?.snapshot && !same(nextSnapshot, input.retained.snapshot))
      throw new Error('Retained movement passage pending evidence is stale.')
    return { kind: 'PENDING' as const, movement, pending: nextPending, snapshot: nextSnapshot }
  }
  const completedReceipt = receipt({ execution, pending })
  if (input.retained?.snapshot)
    throw new Error('Retained movement passage pending evidence is stale.')
  if (input.retained?.receipt && !same(completedReceipt, input.retained.receipt))
    throw new Error('Retained movement passage completion evidence is stale.')
  const completedMovement = {
    ...movement,
    root: {
      ...movement.root,
      terminalPassageStop:
        execution.outcome === 'SUCCESS' ? (movement.nextPassageStop ?? null) : null,
      resolutionCommands: [
        ...sealed.movementContinuation.root.resolutionCommands,
        movementRuleResolutionCommandDtoSchema.parse({
          ...responseCommand,
          passageContest: completedReceipt
        })
      ]
    }
  }
  return {
    kind: 'COMPLETE' as const,
    movement: completedMovement,
    receipt: completedReceipt,
    pending,
    execution
  }
}
