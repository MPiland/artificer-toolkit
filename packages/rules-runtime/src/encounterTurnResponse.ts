import type { ResolveRuleOccurrenceInputDto } from '@artificer-toolkit/schema/api/encounters'
import {
  serverRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import {
  turnResolutionCommandDtoSchema,
  type TurnResolutionCommandDto
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnCommands'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { EncounterInitiativeOccurrenceRoot } from './encounterInitiativeOccurrence.js'
import { awaitsSpatialDamageDice } from './encounterSpatialPendingRoller.js'
import { turnPendingActorId } from './encounterTurnPending.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export function matchesNativeTurnResponse(
  history: TurnResolutionCommandDto,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  switch (resolution.kind) {
    case 'DECLINE':
      return history.kind === 'LEGENDARY_DECLINE'
    case 'LEGENDARY_OPTION':
      return (
        history.kind === 'LEGENDARY_OPTION' &&
        history.optionId === resolution.optionId &&
        history.targetActorId === resolution.targetActorId
      )
    case 'ENTER_DICE':
      return (
        (history.kind === 'ENTER_DICE' || history.kind === 'LEGENDARY_ENTER_DICE') &&
        history.requestId === resolution.requestId
      )
    case 'SYSTEM_ROLL':
      return (
        (history.kind === 'SYSTEM_ROLL' ||
          history.kind === 'INITIATIVE_SYSTEM_ROLL' ||
          history.kind === 'LEGENDARY_SYSTEM_ROLL') &&
        history.requestId === resolution.requestId
      )
    case 'ENTER_INTEGER':
    case 'INITIATIVE_ENTITY':
    case 'INITIATIVE_DECLARATION':
      return history.kind === resolution.kind && history.requestId === resolution.requestId
    default:
      return false
  }
}

/** Validates a retained turn response and extends its closed command history without I/O. */
export function prepareEncounterTurnResponse(input: {
  pending: ServerRuleExecutionPendingSnapshotDto
  command: ResolveRuleOccurrenceInputDto
  userId: string
  ownerUserId: string
  /** Actors the responder controls; a turn step's dice are answered by its actor's controllers. */
  responderControlledActorIds: ReadonlySet<string>
  occurrence: {
    id: string
    rootCommandId: string
    version: number
    expectedEncounterVersion: number
  }
  encounterVersion: number
}):
  | { kind: 'REPLAY' }
  /** The responder's expected Run or occurrence version is behind; the caller refuses it as retryable. */
  | { kind: 'STALE' }
  | {
      kind: 'INITIATIVE'
      root: EncounterInitiativeOccurrenceRoot
      pending: ServerRuleExecutionPendingSnapshotDto
    }
  | {
      kind: 'READY'
      root: TurnCoordinatorRootDto
      pending: ServerRuleExecutionPendingSnapshotDto
    } {
  const { pending, command, userId, ownerUserId, occurrence, encounterVersion } = input
  const context = pending.applicationContext
  if (
    context.kind !== 'ENCOUNTER_INITIATIVE' &&
    context.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
    context.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
    context.kind !== 'ENCOUNTER_TURN_DEATH_SAVE' &&
    context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
    context.kind !== 'ENCOUNTER_TURN_ZONE_EFFECTS' &&
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
  )
    throw new Error('Encounter turn response is unavailable.')
  const root = context.root
  if (
    root.initiatorUserId !== ownerUserId ||
    root.rootCommandId !== occurrence.rootCommandId ||
    root.expectedEncounterVersion !== encounterVersion ||
    occurrence.expectedEncounterVersion !== encounterVersion ||
    pending.occurrenceId !== occurrence.id
  )
    throw new Error('Rule occurrence is unavailable.')
  const fingerprint = checksumCanonicalJson(command)
  const history = root.resolutionCommands.find((entry) => entry.commandId === command.commandId)
  if (history) {
    // A retained response replays only to the user who gave it.
    if (
      !matchesNativeTurnResponse(history, command.resolution) ||
      history.commandFingerprint !== fingerprint ||
      history.actorUserId !== userId ||
      history.correlationId !== command.correlationId ||
      history.expectedOccurrenceVersion !== command.expectedOccurrenceVersion
    )
      throw new Error('Rule occurrence is unavailable.')
    return { kind: 'REPLAY' }
  }
  if (
    command.expectedVersion !== encounterVersion ||
    command.expectedOccurrenceVersion !== occurrence.version
  )
    return { kind: 'STALE' }
  const base = {
    commandId: command.commandId,
    commandFingerprint: fingerprint,
    actorUserId: userId,
    correlationId: command.correlationId,
    expectedOccurrenceVersion: command.expectedOccurrenceVersion
  }
  const resolution = command.resolution

  if (context.kind === 'ENCOUNTER_INITIATIVE_DECLARATION') {
    if (
      pending.snapshotKind !== 'AGGREGATE_CHOICE' ||
      resolution.kind !== 'INITIATIVE_DECLARATION' ||
      resolution.requestId !== context.request.requestId ||
      (userId !== ownerUserId && userId !== context.request.controllerUserId)
    )
      throw new Error('Initiative declaration is unavailable.')
    const nextRoot: EncounterInitiativeOccurrenceRoot = {
      ...context.root,
      resolutionCommands: [
        ...root.resolutionCommands,
        turnResolutionCommandDtoSchema.parse({
          ...base,
          kind: 'INITIATIVE_DECLARATION',
          requestId: resolution.requestId,
          initiativeActorId: context.request.actorId
        })
      ]
    }
    return {
      kind: 'INITIATIVE',
      root: nextRoot,
      pending: serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...pending,
        applicationContext: { ...context, root: nextRoot }
      })
    }
  }
  // A turn step goes to its actor's controllers; initiative scoring and order are the GM's.
  const actorId = turnPendingActorId(pending)
  if (
    userId !== ownerUserId &&
    (actorId === null || !input.responderControlledActorIds.has(actorId))
  )
    throw new Error('Rule occurrence is unavailable.')
  if (context.kind === 'ENCOUNTER_INITIATIVE') {
    const scorePhase =
      context.phase.kind === 'PRIMARY_SCORE' || context.phase.kind === 'TIE_RESOLUTION'
    if (
      pending.snapshotKind !== 'KERNEL_EVIDENCE' ||
      pending.request.kind !== 'INTEGER_RANGE' ||
      (resolution.kind !== 'ENTER_INTEGER' &&
        resolution.kind !== 'SYSTEM_ROLL' &&
        resolution.kind !== 'INITIATIVE_ENTITY') ||
      resolution.requestId !== pending.request.requestId ||
      (scorePhase
        ? resolution.kind === 'INITIATIVE_ENTITY'
        : resolution.kind !== 'INITIATIVE_ENTITY')
    )
      throw new Error('Initiative evidence is unavailable.')
    const nextRoot: EncounterInitiativeOccurrenceRoot = {
      ...context.root,
      resolutionCommands: [
        ...root.resolutionCommands,
        turnResolutionCommandDtoSchema.parse({
          ...base,
          kind: resolution.kind === 'SYSTEM_ROLL' ? 'INITIATIVE_SYSTEM_ROLL' : resolution.kind,
          requestId: resolution.requestId
        })
      ]
    }
    return {
      kind: 'INITIATIVE',
      root: nextRoot,
      pending: serverRuleExecutionPendingSnapshotDtoSchema.parse({
        ...pending,
        applicationContext: { ...context, root: nextRoot }
      })
    }
  }
  let entry: TurnResolutionCommandDto
  if (context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE') {
    if (
      pending.snapshotKind !== 'AGGREGATE_CHOICE' ||
      (resolution.kind !== 'DECLINE' && resolution.kind !== 'LEGENDARY_OPTION')
    )
      throw new Error('Legendary Action choice is required.')
    entry =
      resolution.kind === 'DECLINE'
        ? { ...base, kind: 'LEGENDARY_DECLINE', selectionChecksum: context.selectionChecksum }
        : {
            ...base,
            kind: 'LEGENDARY_OPTION',
            selectionChecksum: context.selectionChecksum,
            optionId: resolution.optionId,
            targetActorId: resolution.targetActorId
          }
  } else {
    if (
      pending.snapshotKind !== 'KERNEL_EVIDENCE' ||
      (resolution.kind !== 'ENTER_INTEGER' &&
        resolution.kind !== 'ENTER_DICE' &&
        resolution.kind !== 'SYSTEM_ROLL') ||
      resolution.requestId !== pending.request.requestId
    )
      throw new Error('Encounter turn evidence is required.')
    if (context.kind === 'ENCOUNTER_TURN_RECHARGE') {
      if (resolution.kind !== 'ENTER_INTEGER' && resolution.kind !== 'SYSTEM_ROLL')
        throw new Error('Recharge integer evidence is required.')
      entry = { ...base, kind: resolution.kind, requestId: resolution.requestId }
    } else if (context.kind === 'ENCOUNTER_TURN_DEATH_SAVE') {
      if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
        throw new Error('Turn d20 evidence is required.')
      entry = { ...base, kind: resolution.kind, requestId: resolution.requestId }
    } else if (
      context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
      context.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS'
    ) {
      // An effect pauses on its target's d20, then on one of its source's damage dice.
      if (
        resolution.kind ===
        (awaitsSpatialDamageDice(context.currentCandidate) ? 'ENTER_DICE' : 'ENTER_INTEGER')
      )
        throw new Error('Turn effect evidence of this kind is required.')
      entry = { ...base, kind: resolution.kind, requestId: resolution.requestId }
    } else {
      // A Legendary Action pauses on its d20 or on one of its damage dice.
      if (resolution.kind === (context.d20Policy ? 'ENTER_INTEGER' : 'ENTER_DICE'))
        throw new Error('Legendary Action evidence of this kind is required.')
      entry = {
        ...base,
        kind:
          resolution.kind === 'ENTER_DICE'
            ? 'LEGENDARY_ENTER_DICE'
            : resolution.kind === 'ENTER_INTEGER'
              ? 'ENTER_INTEGER'
              : 'LEGENDARY_SYSTEM_ROLL',
        requestId: resolution.requestId
      }
    }
  }
  const nextRoot: TurnCoordinatorRootDto = {
    ...context.root,
    resolutionCommands: [...root.resolutionCommands, turnResolutionCommandDtoSchema.parse(entry)]
  }
  return {
    kind: 'READY',
    root: nextRoot,
    pending: serverRuleExecutionPendingSnapshotDtoSchema.parse({
      ...pending,
      applicationContext: { ...context, root: nextRoot }
    })
  }
}
