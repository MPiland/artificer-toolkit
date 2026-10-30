import {
  encounterAutoFailRequest,
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from './encounterRollModeReasons.js'
import { spatialPendingRollerActorId } from './encounterSpatialPendingRoller.js'
import { rollModeCapabilityRegistry } from './platformPolicyModules.js'
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

type DeathSavePendingContext = Extract<
  ServerKernelRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_DEATH_SAVE' }
>

/**
 * The actor a pending turn step belongs to: a turn-effect save's target, the recharging Creature, the
 * dying Character making its death save, or
 * the Creature choosing and rolling a Legendary Action, or that action's target rolling its save. Its
 * controllers and the GM answer it (ADR 0034 decision 3; D24, D30), so a Creature the GM granted to a
 * player acts and rolls with that player.
 * Null for the GM's own turn steps (initiative scoring and order).
 */
export function turnPendingActorId(pending: ServerRuleExecutionPendingSnapshotDto) {
  const context = pending.applicationContext
  if (context.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE')
    return pending.snapshotKind === 'AGGREGATE_CHOICE' ? context.choice.ownerActorId : null
  if (pending.snapshotKind !== 'KERNEL_EVIDENCE') return null
  switch (context.kind) {
    case 'ENCOUNTER_TURN_ACTIVE_EFFECTS':
      return spatialPendingRollerActorId({
        candidate: context.currentCandidate,
        d20Policy: context.currentCandidate.d20Policy,
        diceStage: context.currentCandidate.diceStage
      })
    case 'ENCOUNTER_TURN_ZONE_EFFECTS':
      return spatialPendingRollerActorId(context.currentCandidate)
    case 'ENCOUNTER_TURN_RECHARGE':
      return context.currentCandidate.actorId
    case 'ENCOUNTER_TURN_DEATH_SAVE':
      return context.candidate.actorId
    case 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE':
      return context.rollerActorId
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

export function requireDeathSavePending(snapshot: ServerRuleExecutionPendingSnapshotDto): {
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  context: DeathSavePendingContext
} {
  const kernel = requireServerKernelRuleExecutionPendingSnapshot(snapshot)
  if (kernel.applicationContext.kind !== 'ENCOUNTER_TURN_DEATH_SAVE')
    throw new Error('The pending occurrence is not death save evidence.')
  return { snapshot: kernel, context: kernel.applicationContext }
}

function projectNativeDeathSavePending(input: {
  gameSystemId: string
  snapshot: ServerRuleExecutionPendingSnapshotDto
  occurrenceId: string
  occurrenceVersion: number
  encounterVersion: number
}): PendingEncounterRuleOccurrenceSummaryDto {
  const { snapshot, context } = requireDeathSavePending(input.snapshot)
  if (
    snapshot.occurrenceId !== input.occurrenceId ||
    snapshot.request.kind !== 'INTEGER_RANGE' ||
    snapshot.request.min !== 1 ||
    snapshot.request.max !== 20
  )
    throw new Error('Death save evidence is stale.')
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse({
    kind: 'D20_EVIDENCE',
    occurrenceId: input.occurrenceId,
    occurrenceVersion: input.occurrenceVersion,
    encounterVersion: input.encounterVersion,
    rollerActorId: context.candidate.actorId,
    trigger: {
      kind: 'DEATH_SAVE',
      successes: context.candidate.deathSaves.successes,
      failures: context.candidate.deathSaves.failures
    },
    request: {
      requestId: snapshot.request.requestId,
      min: 1,
      max: 20,
      rollMode: 'NORMAL',
      keep: rollModeCapabilityRegistry.rollModeKeep({
        gameSystemId: input.gameSystemId,
        rollMode: 'NORMAL'
      }),
      rollModes: rollModeCapabilityRegistry.offeredRollModes(input.gameSystemId),
      derivedRollModeReasons: [],
      ...(context.candidate.addedDice.length ? { addedDice: context.candidate.addedDice } : {})
    },
    allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
  })
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
  gameSystemId: string
  snapshot: ServerRuleExecutionPendingSnapshotDto
  occurrenceId: string
  occurrenceVersion: number
  encounterVersion: number
  reasons?: EncounterRollModeReasons
  /** The actors this viewer may target; null for the GM, who may target any. */
  visibleActorIds?: ReadonlySet<string> | null
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
        ({ optionId, actionId, ownerFeatureId, label, featureCost, targetActorIds, area }) => ({
          optionId,
          actionId,
          ownerFeatureId,
          label,
          featureCost,
          targetActorIds: targetActorIds.filter(
            (actorId) => !input.visibleActorIds || input.visibleActorIds.has(actorId)
          ),
          ...(area ? { area } : {})
        })
      ),
      allowedResponses: ['DECLINE', 'LEGENDARY_OPTION']
    })
  if (
    context.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE' ||
    input.snapshot.snapshotKind !== 'KERNEL_EVIDENCE'
  )
    throw new Error('Legendary Action pending evidence is unavailable.')
  const { request } = input.snapshot
  const { d20Policy, rollerActorId } = context
  return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(
    d20Policy
      ? {
          ...identity,
          kind: 'D20_EVIDENCE',
          rollerActorId,
          request: {
            requestId: request.requestId,
            min: 1,
            max: 20,
            rollMode: d20Policy.rollMode,
            keep: d20Policy.keep,
            rollModes: rollModeCapabilityRegistry.offeredRollModes(input.gameSystemId),
            derivedRollModeReasons: (input.reasons ?? noEncounterRollModeReasons)({
              rollMode: d20Policy.rollMode,
              contributors: d20Policy.contributors
            }),
            ...encounterAutoFailRequest(
              input.reasons ?? noEncounterRollModeReasons,
              d20Policy,
              rollerActorId
            ),
            ...(d20Policy.addedDice?.length ? { addedDice: d20Policy.addedDice } : {})
          },
          allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
        }
      : {
          ...identity,
          kind: 'ACTION_OUTCOME_EVIDENCE',
          rollerActorId,
          request: { requestId: request.requestId, min: request.min, max: request.max },
          allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
        }
  )
}

export function projectNativeTurnPending(
  input: Parameters<typeof projectNativeLegendaryPending>[0]
) {
  const context = input.snapshot.applicationContext
  if (context.kind === 'ENCOUNTER_TURN_DEATH_SAVE') return projectNativeDeathSavePending(input)
  // An effect pauses on its target's save, then on its source's damage dice.
  if (
    context.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
    context.kind === 'ENCOUNTER_TURN_ZONE_EFFECTS'
  ) {
    const candidate = context.currentCandidate
    if (
      input.snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
      input.snapshot.occurrenceId !== input.occurrenceId
    )
      throw new Error('Turn effect evidence is unavailable.')
    const identity = {
      occurrenceId: input.occurrenceId,
      occurrenceVersion: input.occurrenceVersion,
      encounterVersion: input.encounterVersion,
      rollerActorId: turnPendingActorId(input.snapshot)
    }
    const { request } = input.snapshot
    return pendingEncounterRuleOccurrenceSummaryDtoSchema.parse(
      !candidate.d20Policy || candidate.diceStage
        ? {
            ...identity,
            kind: 'ACTION_OUTCOME_EVIDENCE',
            request: { requestId: request.requestId, min: request.min, max: request.max },
            allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
          }
        : {
            ...identity,
            kind: 'D20_EVIDENCE',
            request: {
              requestId: request.requestId,
              min: 1,
              max: 20,
              rollMode: candidate.d20Policy.rollMode,
              keep: candidate.d20Policy.keep,
              rollModes: rollModeCapabilityRegistry.offeredRollModes(input.gameSystemId),
              derivedRollModeReasons: (input.reasons ?? noEncounterRollModeReasons)({
                rollMode: candidate.d20Policy.rollMode,
                contributors: candidate.d20Policy.contributors
              }),
              ...encounterAutoFailRequest(
                input.reasons ?? noEncounterRollModeReasons,
                candidate.d20Policy,
                identity.rollerActorId
              ),
              ...(candidate.d20Policy.addedDice?.length
                ? { addedDice: candidate.d20Policy.addedDice }
                : {})
            },
            allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
          }
    )
  }
  return (
    context.kind === 'ENCOUNTER_TURN_RECHARGE'
      ? projectNativeRechargePending
      : projectNativeLegendaryPending
  )(input)
}
