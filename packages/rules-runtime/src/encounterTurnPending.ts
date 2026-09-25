import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from './encounterRollModeReasons.js'
import {
  pendingEncounterRuleOccurrenceSummaryDtoSchema,
  type PendingEncounterRuleOccurrenceSummaryDto
} from '@artificer-toolkit/schema/shared/encounterRuleOccurrence'
import {
  requireServerKernelRuleExecutionPendingSnapshot,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

type RechargePendingContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_RECHARGE' }
>

/**
 * The actor a pending turn step belongs to: a turn-effect save's target, the recharging Creature, or
 * the Creature choosing and rolling a Legendary Action. Its controllers and the GM answer it (ADR 0034
 * decision 3; D24, D30), so a Creature the GM granted to a player acts and rolls with that player.
 * Null for the GM's own turn steps (initiative scoring and order).
 */
export function turnPendingActorId(pending: ServerRuleExecutionPendingSnapshotDto) {
  const context = pending.applicationContext
  if (context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
    return pending.snapshotKind === 'AGGREGATE_CHOICE' ? context.choice.ownerActorId : null
  if (pending.snapshotKind !== 'KERNEL_EVIDENCE') return null
  switch (context.kind) {
    case 'ENCOUNTER_TURN_ACTIVE_EFFECTS':
      return context.currentCandidate.targetActorId
    case 'ENCOUNTER_TURN_RECHARGE':
      return context.currentCandidate.actorId
    case 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE':
      return context.choice.ownerActorId
    default:
      return null
  }
}

export function requireRechargePending(snapshot: ServerRuleExecutionPendingSnapshotDto): {
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  context: RechargePendingContext
} {
  const kernel = requireServerKernelRuleExecutionPendingSnapshot(snapshot)
  if (kernel.applicationContext.kind !== 'ENCOUNTER_TURN_RECHARGE')
    throw new Error('The pending occurrence is not Recharge evidence.')
  return { snapshot: kernel, context: kernel.applicationContext }
}

function projectNativeRechargePending(input: {
  snapshot: ServerRuleExecutionPendingSnapshotDto
  occurrenceId: string
  occurrenceVersion: number
  encounterVersion: number
}): PendingEncounterRuleOccurrenceSummaryDto {
  const { snapshot, context } = requireRechargePending(input.snapshot)
  if (
    snapshot.occurrenceId !== input.occurrenceId ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 6
  )
    throw new Error('Recharge evidence is stale.')
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'RECHARGE_EVIDENCE',
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    encounterVersion: input.encounterVersion,
    rollerActorId: context.currentCandidate.actorId,
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 6
    },
    allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
  })
}

export function projectNativeLegendaryPending(input: {
  snapshot: ServerRuleExecutionPendingSnapshotDto
  occurrenceId: string
  occurrenceVersion: number
  encounterVersion: number
  reasons?: EncounterRollModeReasons
}) {
  const context = input.snapshot.applicationContext
  const identity = {
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    encounterVersion: input.encounterVersion
  }
  if (input.snapshot.occurrenceId !== input.occurrenceId)
    throw new Error('Legendary Action occurrence is stale.')
  if (context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
      ...identity,
      kind: 'LEGENDARY_ACTION_CHOICE',
      ownerActorId: context.choice.ownerActorId,
      options: context.choice.options.map(
        ({ optionId, actionId, ownerFeatureId, targetActorId }) => ({
          optionId,
          actionId,
          ownerFeatureId,
          targetActorId
        })
      ),
      allowedResponses: ['DECLINE', 'OPTION']
    })
  if (
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
    input.snapshot.snapshotKind !== 'KERNEL_EVIDENCE'
  )
    throw new Error('Legendary Action pending evidence is unavailable.')
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    ...identity,
    kind: 'D20_EVIDENCE',
    rollerActorId: context.choice.ownerActorId,
    request: {
      requestId: input.snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: context.d20Policy.rollMode,
      derivedRollModeReasons: (input.reasons ?? noEncounterRollModeReasons)({
        rollMode: context.d20Policy.rollMode,
        contributors: context.d20Policy.contributors
      })
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}

export function projectNativeTurnPending(
  input: Parameters<typeof projectNativeLegendaryPending>[0]
) {
  const context = input.snapshot.applicationContext
  if (context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS') {
    if (
      input.snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      input.snapshot.occurrenceId !== input.occurrenceId ||
      !context.currentCandidate.d20Policy
    )
      throw new Error('Turn-effect evidence is unavailable.')
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
      kind: 'D20_EVIDENCE',
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterVersion: input.encounterVersion,
      rollerActorId: context.currentCandidate.targetActorId,
      request: {
        requestId: input.snapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: context.currentCandidate.d20Policy.rollMode,
        derivedRollModeReasons: (input.reasons ?? noEncounterRollModeReasons)({
          rollMode: context.currentCandidate.d20Policy.rollMode,
          contributors: context.currentCandidate.d20Policy.contributors
        })
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    })
  }
  return (
    input.snapshot.applicationContext.kind === 'ENCOUNTER_TURN_RECHARGE'
      ? projectNativeRechargePending
      : projectNativeLegendaryPending
  )(input)
}
