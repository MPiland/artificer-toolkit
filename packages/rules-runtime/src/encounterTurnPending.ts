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
  const { snapshot } = requireRechargePending(input.snapshot)
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
    request: {
      requestId: input.snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: context.d20Policy.rollMode
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
}

export function projectNativeTurnPending(
  input: Parameters<typeof projectNativeRechargePending>[0]
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
      request: {
        requestId: input.snapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: context.currentCandidate.d20Policy.rollMode
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
