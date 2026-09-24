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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'

export function matchesNativeTurnResponse(
  history: TurnResolutionCommandDto,
  resolution: ResolveRuleOccurrenceInputDto['resolution']
) {
  switch (resolution.kind) {
    case 'DECLINE':
      return history.kind === 'LEGENDARY_DECLINE'
    case 'OPTION':
      return history.kind === 'LEGENDARY_OPTION' && history.optionId === resolution.optionId
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
  occurrence: {
    id: string
    rootCommandId: string
    version: number
    expectedEncounterVersion: number
  }
  encounterVersion: number
}):
  | { kind: 'REPLAY' }
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
    context.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
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
    if (
      (history.kind !== 'INITIATIVE_DECLARATION' && userId !== ownerUserId) ||
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
    throw new Error('Rule occurrence is unavailable.')
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
  if (userId !== ownerUserId) throw new Error('Rule occurrence is unavailable.')
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
      (resolution.kind !== 'DECLINE' && resolution.kind !== 'OPTION')
    )
      throw new Error('Legendary Action choice is required.')
    entry =
      resolution.kind === 'DECLINE'
        ? { ...base, kind: 'LEGENDARY_DECLINE', selectionChecksum: context.selectionChecksum }
        : {
            ...base,
            kind: 'LEGENDARY_OPTION',
            selectionChecksum: context.selectionChecksum,
            optionId: resolution.optionId
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
    } else if (context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS') {
      if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
        throw new Error('Turn-effect d20 evidence is required.')
      entry = { ...base, kind: resolution.kind, requestId: resolution.requestId }
    } else {
      if (resolution.kind !== 'ENTER_DICE' && resolution.kind !== 'SYSTEM_ROLL')
        throw new Error('Legendary Action d20 evidence is required.')
      entry = {
        ...base,
        kind: resolution.kind === 'ENTER_DICE' ? 'LEGENDARY_ENTER_DICE' : 'LEGENDARY_SYSTEM_ROLL',
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
