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
import { rollModeKeptFace } from '@artificer-toolkit/schema/shared/systemCoreCode'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { resolveEncounterMovementPassageChoice } from './encounterMovementPassageChoice.js'
import { executeEncounterMovementPassageContest } from './encounterMovementPassageContest.js'
import { contestDefenderPolicy } from './encounterOptionalContestActionExecution.js'
import type { prepareEncounterMovementPassageContest } from './encounterMovementPassagePreparation.js'
import type { CharacterMovementFacts, MovementTarget } from './encounterMovementTargets.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'

type PassageChoice = Extract<
  ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE' }
>
type ContestCheck = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_CONTEST_CHECK' }
>
type PassageOrigin = Extract<ContestCheck['origin'], { kind: 'OPTIONAL_COMBAT' }>
type PassagePending = ContestCheck & { origin: PassageOrigin }
type PassageContestReceipt = NonNullable<
  Extract<
    NonNullable<PassageOrigin['movementContinuation']>['root']['resolutionCommands'][number],
    { kind: 'PASSAGE_OPTION' }
  >['passageContest']
>
type ResolutionCommand = ReturnType<typeof movementRuleResolutionCommandDtoSchema.parse>
type PassageMovement =
  | PassageChoice['movement']
  | NonNullable<PassageOrigin['movementContinuation']>
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

/** A passage contest always has the optional-combat origin that carries its movement. */
function passagePending(context: ContestCheck): PassagePending {
  const { origin } = context
  if (origin.kind !== 'OPTIONAL_COMBAT')
    throw new Error('Movement passage contest origin is unavailable.')
  return { ...context, origin }
}

function withoutEvidence(pending: PassagePending) {
  return { ...pending, rollEvidence: { initiator: null, defender: null } }
}

/** The pending contest with one participant's submitted d20 recorded; a defender rolls its one sealed check. */
function withSubmittedEvidence(
  pending: PassagePending,
  submitted: {
    participant: 'INITIATOR' | 'DEFENDER'
    requestId: string
    rawFaces: readonly number[]
  }
): PassagePending {
  const evidence = { requestId: submitted.requestId, rawFaces: [...submitted.rawFaces] }
  return {
    ...pending,
    rollEvidence:
      submitted.participant === 'INITIATOR'
        ? { ...pending.rollEvidence, initiator: evidence }
        : {
            ...pending.rollEvidence,
            defender: {
              ...evidence,
              checkDefinitionId: contestDefenderPolicy(pending.defender, null).checkDefinitionId
            }
          }
  }
}

function appendedMovement<
  T extends PassageChoice['movement'] | NonNullable<PassageOrigin['movementContinuation']>
>(movement: T, command: ResolutionCommand) {
  return {
    ...movement,
    root: { ...movement.root, resolutionCommands: [...movement.root.resolutionCommands, command] }
  }
}

/** A won contest passes through the blocker only when its rule's policy sealed that. */
export function passesThrough(
  pending: PassagePending,
  execution: { readonly outcome: 'SUCCESS' | 'TIE_OR_FAILURE' }
): boolean {
  const selection = pending.origin.selection
  return (
    execution.outcome === 'SUCCESS' &&
    'successMovement' in selection &&
    selection.successMovement === 'PASS_THROUGH'
  )
}
type Footprint = { width: number; height: number }
export type PassageFootprints = {
  mover: Footprint
  blocker: Footprint & { position: { x: number; y: number } }
}

/**
 * Where a mover stepping in from the contact point comes to rest inside the blocker's space: the
 * contact pulled just far enough that the mover's whole footprint lies within the blocker's.
 */
export function enteredBlockerPosition(
  contact: { x: number; y: number },
  footprints: PassageFootprints
) {
  const { mover, blocker } = footprints
  const clamp = (value: number, center: number, slack: number) =>
    Math.min(Math.max(value, center - slack), center + slack)
  return {
    x: clamp(contact.x, blocker.position.x, Math.max((blocker.width - mover.width) / 2, 0)),
    y: clamp(contact.y, blocker.position.y, Math.max((blocker.height - mover.height) / 2, 0))
  }
}

function receipt(input: {
  execution: CompletedContestExecution
  pending: PassagePending
  footprints: PassageFootprints
}): PassageContestReceipt {
  const economy = input.pending.actionEconomy
  const movement = input.pending.origin.movementContinuation
  if (!economy || !movement) throw new Error('Movement passage allowance is unavailable.')
  const participant = (
    policy: {
      rollMode: PassagePending['initiator']['rollMode']
      keep: PassagePending['initiator']['keep']
      modifier: number
    },
    rawFaces: readonly number[],
    total: number
  ) => ({
    rollMode: policy.rollMode,
    keep: policy.keep,
    rawFaces: [...rawFaces],
    selectedNatural: rollModeKeptFace(policy.keep, rawFaces),
    modifier: policy.modifier,
    total
  })
  const terminalPassageStop = passesThrough(input.pending, input.execution)
    ? (movement.nextPassageStop ?? null)
    : null
  const selection = input.pending.origin.selection
  if (!('successMovement' in selection)) throw new Error('Movement passage selection is stale.')
  return {
    actionKind: selection.kind,
    optionId: input.pending.origin.optionId,
    outcome: input.execution.outcome,
    initiator: participant(
      input.pending.initiator,
      input.execution.evidence.initiatorRawFaces,
      input.execution.evidence.initiatorTotal
    ),
    defender: participant(
      contestDefenderPolicy(input.pending.defender, null),
      input.execution.evidence.defenderRawFaces,
      input.execution.evidence.defenderTotal
    ),
    actionEconomy: { ...economy, afterUsed: economy.beforeUsed + 1 },
    audit: {
      optionalCombat: {
        definitionId: input.pending.origin.pin.definitionId,
        definitionVersion: input.pending.origin.pin.definitionVersion,
        definitionChecksum: input.pending.origin.pin.definitionChecksum,
        moduleKey: input.pending.origin.pin.moduleKey,
        moduleContractVersion: input.pending.origin.pin.moduleContractVersion
      },
      sourceActorId: input.pending.sourceActorId,
      sourceTokenId: movement.root.tokenId,
      blockerActorId: movement.blockerActorId,
      blockerTokenId: movement.blockerTokenId,
      contact: movement.contact,
      contactPathDistance: movement.contactPathDistance,
      blockerCurrentnessChecksum: movement.blockerCurrentnessChecksum,
      selectionContractChecksum: input.pending.origin.selectionContractChecksum,
      resolvedSelectionChecksum: input.pending.origin.resolvedSelectionChecksum,
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
        : {}),
      ...(input.execution.outcome === 'SUCCESS' &&
      selection.successMovement === 'ENTER_BLOCKER_SPACE'
        ? { enteredPosition: enteredBlockerPosition(movement.contact, input.footprints) }
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
    /** The roller's auto-roll preference; the responding user rolls in this slice. */
    autoRoll: EncounterAutoRollByActorId
    snapshot: ServerRuleExecutionPendingSnapshotDto
    resolution: EncounterResponseAnswer
    responseCommand: ResolutionCommand
    targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
    /** The mover's and the verified-current blocker's footprints a won contest may place against. */
    footprints: PassageFootprints
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
    const pending = passagePending(
      await callbacks.prepareContest({
        state: input.state,
        choice: { ...choice, movement },
        optionId: selected.option.optionId,
        targets: input.targets
      })
    )
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
      gameSystemId: input.state.gameSystemId,
      autoRoll: input.autoRoll,
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
      const nextPending = execution.submittedEvidence
        ? withSubmittedEvidence(pending, execution.submittedEvidence)
        : pending
      const nextSnapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
        ...execution.continuation,
        snapshotKind: 'KERNEL_EVIDENCE',
        optionalCombatSnapshotChecksum: pending.origin.pin.snapshotChecksum,
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
    const completedReceipt = receipt({ execution, pending, footprints: input.footprints })
    if (input.retained?.snapshot)
      throw new Error('Retained movement passage pending evidence is stale.')
    if (input.retained?.receipt && !same(completedReceipt, input.retained.receipt))
      throw new Error('Retained movement passage completion evidence is stale.')
    const completedMovement = {
      ...movement,
      root: {
        ...movement.root,
        terminalPassageStop: passesThrough(pending, execution)
          ? (movement.nextPassageStop ?? null)
          : null,
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
    sealed.kind !== 'ENCOUNTER_CONTEST_CHECK' ||
    sealed.origin.kind !== 'OPTIONAL_COMBAT' ||
    !('successMovement' in sealed.origin.selection) ||
    sealed.origin.actionKind !== sealed.origin.selection.kind ||
    !sealed.origin.movementContinuation ||
    (input.resolution.kind !== 'ENTER_DICE' && input.resolution.kind !== 'SYSTEM_ROLL') ||
    (responseCommand.kind !== 'ENTER_DICE' && responseCommand.kind !== 'SYSTEM_ROLL') ||
    responseCommand.requestId !== input.resolution.requestId
  )
    throw new Error('Movement passage evidence is unavailable.')
  const movement = appendedMovement(sealed.origin.movementContinuation, responseCommand)
  const choice: PassageChoice = {
    kind: 'ENCOUNTER_MOVEMENT_PASSAGE_CHOICE',
    schemaVersion: 1,
    movement: sealed.origin.movementContinuation,
    sourceActorId: sealed.sourceActorId,
    sourceTokenId: sealed.origin.movementContinuation.root.tokenId,
    sourceControllerCharacterId: sealed.initiatorControllerCharacterId,
    options: [
      {
        optionId: sealed.origin.optionId,
        ruleKind: sealed.origin.selection.kind,
        economy: sealed.origin.selection.economy,
        initiatorCheckDefinitionId: sealed.origin.selection.initiatorCheckDefinitionId,
        initiatorCheckLabel: sealed.origin.selection.initiatorCheckLabel,
        definitionId: sealed.origin.pin.definitionId,
        definitionVersion: sealed.origin.pin.definitionVersion,
        definitionChecksum: sealed.origin.pin.definitionChecksum,
        moduleKey: sealed.origin.pin.moduleKey,
        moduleContractVersion: sealed.origin.pin.moduleContractVersion
      }
    ],
    optionsChecksum: ''
  }
  choice.optionsChecksum = checksumRuleDocument(choice.options)
  const current = passagePending(
    await callbacks.prepareContest({
      state: input.state,
      choice,
      optionId: sealed.origin.optionId,
      targets: input.targets
    })
  )
  const sealedPending: PassagePending = {
    ...sealed,
    origin: { ...sealed.origin, movementContinuation: sealed.origin.movementContinuation },
    rollEvidence: { ...sealed.rollEvidence }
  }
  if (!same(withoutEvidence(current), withoutEvidence(sealedPending)))
    throw new Error('Movement passage contest facts changed.')
  const pending: PassagePending = {
    ...sealedPending,
    origin: { ...sealedPending.origin, movementContinuation: movement },
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
  // Entered dice and app rolls carry their faces, so a response never rolls here.
  const rollD20 = () => {
    throw new Error('A movement passage response carries its own d20 faces.')
  }
  const execution = await executeEncounterMovementPassageContest({
    gameSystemId: input.state.gameSystemId,
    autoRoll: {},
    continuation,
    occurrenceId: input.snapshot.occurrenceId,
    pending,
    resolution: input.resolution,
    rollD20,
    runtime: await callbacks.runtime()
  })
  if (execution.kind === 'PENDING') {
    if (input.retained?.receipt)
      throw new Error('Retained movement passage completion evidence is stale.')
    if (!execution.submittedEvidence) throw new Error('Movement passage evidence is unavailable.')
    const nextPending = withSubmittedEvidence(pending, execution.submittedEvidence)
    const nextSnapshot = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...execution.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: nextPending.origin.pin.snapshotChecksum,
      applicationContext: nextPending
    })
    if (input.retained?.snapshot && !same(nextSnapshot, input.retained.snapshot))
      throw new Error('Retained movement passage pending evidence is stale.')
    return { kind: 'PENDING' as const, movement, pending: nextPending, snapshot: nextSnapshot }
  }
  const completedReceipt = receipt({ execution, pending, footprints: input.footprints })
  if (input.retained?.snapshot)
    throw new Error('Retained movement passage pending evidence is stale.')
  if (input.retained?.receipt && !same(completedReceipt, input.retained.receipt))
    throw new Error('Retained movement passage completion evidence is stale.')
  const completedMovement = {
    ...movement,
    root: {
      ...movement.root,
      terminalPassageStop: passesThrough(pending, execution)
        ? (movement.nextPassageStop ?? null)
        : null,
      resolutionCommands: [
        ...sealed.origin.movementContinuation.root.resolutionCommands,
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
