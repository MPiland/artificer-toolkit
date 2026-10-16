import { resolveEncounterActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { readEncounterActorControl } from './actorController.js'
import {
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { readRunActor, readRunState } from './documents.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/** Reads the sealed action root without exposing executable facts to recipients. */
export async function readNativeActionPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
) {
  const { _id, _creationTime, ...stored } = occurrence
  encounterStoredRuleOccurrenceSchema.parse(stored)
  const snapshot =
    occurrence.state === 'PENDING' ? await readPendingSnapshot(ctx, occurrence) : null
  if (!snapshot) throw new Error('Stored Encounter action is not pending.')
  if (
    snapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
    snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION' ||
    snapshot.occurrenceId !== occurrence.id
  )
    throw new Error('Stored Encounter action pending snapshot mismatch.')
  const context = snapshot.applicationContext
  const command = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.commandId !== occurrence.rootCommandId ||
    command.encounterId !== occurrence.encounterId ||
    command.expectedVersion !== occurrence.expectedEncounterVersion ||
    checksumCanonicalJson(command) !== context.commandFingerprint
  )
    throw new Error('Stored Encounter action root mismatch.')
  const {
    snapshotKind: _snapshotKind,
    applicationContext: _applicationContext,
    optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
    phaseReceipts: _phaseReceipts,
    ...continuation
  } = snapshot
  return { snapshot, context, command, continuation }
}

/**
 * Paused action evidence belongs to the controllers of the actor whose roll it is, and the GM may
 * answer any of it. The initiator therefore answers only rolls of actors they control.
 */
export async function canAnswerNativeActionEvidence(
  ctx: EncounterReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    occurrence: EncounterDocument<'encounterRuleOccurrences'>
  }
): Promise<boolean> {
  if (input.membership.role === 'OWNER') return true
  const { context } = await readNativeActionPending(ctx, input.occurrence)
  return canControlEvidenceRoller(ctx, { ...input, rollerActorId: context.rollerActorId })
}

/** Whether the member controls the actor whose roll a pending request waits on. */
export async function canControlEvidenceRoller(
  ctx: EncounterReadTransaction,
  input: {
    run: EncounterDocument<'encounterRuns'>
    campaign: EncounterDocument<'campaigns'>
    membership: EncounterDocument<'campaignMemberships'>
    rollerActorId: string
  }
): Promise<boolean> {
  if (input.membership.role === 'OWNER') return true
  const actor = await readRunActor(ctx, readRunState(input.run), input.rollerActorId)
  return (await readEncounterActorControl(ctx, { ...input, actor })) !== null
}

type NativeActionPending = Awaited<ReturnType<typeof readNativeActionPending>>

type CastPendingContext = {
  rollerActorId?: string
  castReaction?: { declinedReactorActorIds: readonly string[]; check?: unknown } | null
  failedCounters?: readonly { reaction: { reactorActorId: string } }[]
}

const failedReactorIds = ({ failedCounters = [] }: CastPendingContext) =>
  failedCounters.map(({ reaction }) => reaction.reactorActorId)

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index])

/**
 * How a cast's pending may continue (D127). A held cast leaves its pause by a decline, or by choosing a
 * counter that owes a check, which pauses on that roll; a failed roll then leaves it like a decline.
 * A choice whose check the app rolls inside the answer leaves the cast the same way a failed roll does.
 * Using a counter that owes no check, and passing the check, commit a countered cast instead.
 * When another reactor is offered next, the declined list is exactly the earlier declines plus the
 * answerer, and the failed counters carried to any next pause or terminal commit are exactly the
 * earlier ones plus the answerer's failed check.
 */
export function castPendingContinues(
  previous: CastPendingContext,
  response: { resolution: { kind: string } } | null | undefined,
  next: CastPendingContext
): boolean {
  const { castReaction } = previous
  const failed = failedReactorIds(previous)
  if (!castReaction) return sameIds(failedReactorIds(next), failed)
  const answered = response?.resolution.kind
  const roller = previous.rollerActorId ? [previous.rollerActorId] : []
  const declinedMatches = (expected: readonly string[]) => {
    if (!next.castReaction) return true
    const declined = next.castReaction.declinedReactorActorIds
    const expectedSet = new Set(expected)
    return declined.length === expectedSet.size && declined.every((id) => expectedSet.has(id))
  }
  if (answered === 'OPTION') {
    if (castReaction.check) return false
    // The counter owes a check: the cast stays held for the same reactor, now on that roll.
    if (next.castReaction?.check !== undefined)
      return (
        next.rollerActorId === previous.rollerActorId &&
        sameIds(failedReactorIds(next), failed) &&
        declinedMatches(castReaction.declinedReactorActorIds)
      )
    // The reactor's player has the app roll, so the check failed inside the choice: it leaves the cast
    // like a failed roll.
    return (
      sameIds(failedReactorIds(next), [...failed, ...roller]) &&
      declinedMatches([...castReaction.declinedReactorActorIds, ...roller])
    )
  }
  const declined = answered === 'DECLINE' && !castReaction.check
  const failedCheck = answered !== undefined && answered !== 'DECLINE' && !!castReaction.check
  return (
    (declined || failedCheck) &&
    sameIds(failedReactorIds(next), failedCheck ? [...failed, ...roller] : failed) &&
    declinedMatches([...castReaction.declinedReactorActorIds, ...roller])
  )
}

/** Whether a cast countered at its pause carries exactly the failed counters that pause held (D127). */
export function castCounteredCarriesFailedCounters(
  previous: CastPendingContext,
  next: CastPendingContext
): boolean {
  return sameIds(failedReactorIds(next), failedReactorIds(previous))
}

/** The use options a paused action offers its decider: a Legendary Resistance, every on-hit rider, or every reaction (innermost first). */
export function offeredDecisionOptionIds(context: {
  legendaryResistance?: { resistance: { useOptionId: string } } | null
  reactionChoice?: { reactions: readonly { useOptionId: string }[] } | null
  castReaction?: { reactions: readonly { useOptionId: string }[]; check?: unknown } | null
  onHitChoice?: { options: readonly { useOptionId: string }[] } | null
}): string[] {
  if (context.legendaryResistance) return [context.legendaryResistance.resistance.useOptionId]
  if (context.onHitChoice) return context.onHitChoice.options.map((option) => option.useOptionId)
  if (context.castReaction?.check) return []
  return (
    (context.reactionChoice ?? context.castReaction)?.reactions.map(
      (reaction) => reaction.useOptionId
    ) ?? []
  )
}

/**
 * The pending summary one viewer reads. The campaign owner sees the d20's true mode and reasons;
 * everyone else sees what the roller's own facts imply, and a held die with its player caption
 * (ATTACK-10.1). Nothing a player reads carries a GM reason.
 */
export function projectNativeActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  { snapshot, context }: Pick<NativeActionPending, 'snapshot' | 'context'>,
  isOwner: boolean,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto {
  if (context.legendaryResistance)
    return {
      kind: 'LEGENDARY_RESISTANCE_CHOICE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: occurrence.expectedEncounterVersion,
      targetActorId: context.rollerActorId,
      options: [{ optionId: context.legendaryResistance.resistance.useOptionId }],
      allowedResponses: ['DECLINE', 'OPTION']
    }
  const castCheck = context.castReaction?.check
  const reactionOffer = context.reactionChoice ?? (castCheck ? undefined : context.castReaction)
  if (reactionOffer)
    return {
      kind: 'REACTION_CHOICE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: occurrence.expectedEncounterVersion,
      targetActorId: context.rollerActorId,
      options: reactionOffer.reactions.map(({ useOptionId, actionId }) => ({
        optionId: useOptionId,
        actionId
      })),
      allowedResponses: ['DECLINE', 'OPTION']
    }
  if (context.onHitChoice)
    return {
      kind: 'ON_HIT_CHOICE',
      occurrenceId: occurrence.id,
      occurrenceVersion: occurrence.version,
      encounterVersion: occurrence.expectedEncounterVersion,
      attackerActorId: context.rollerActorId,
      options: context.onHitChoice.options.map(({ useOptionId, riderId, slotLevel }) => ({
        optionId: useOptionId,
        riderId,
        slotLevel
      })),
      allowedResponses: ['DECLINE', 'OPTION']
    }
  const common = {
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.rollerActorId
  }
  const d20Policy = context.contest
    ? snapshot.request.nodeId === 'initiator_d20'
      ? context.contest.initiator
      : snapshot.request.nodeId === 'target_d20'
        ? context.contest.defender
        : null
    : (context.d20Policy ?? castCheck?.d20 ?? null)
  if (context.contest && (!d20Policy || snapshot.request.min !== 1 || snapshot.request.max !== 20))
    throw new Error('Stored Disarm evidence request is invalid.')
  if (d20Policy && context.heldD20)
    return {
      ...common,
      kind: 'D20_EVIDENCE',
      request: {
        requestId: snapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: 'NORMAL',
        derivedRollModeReasons: [],
        heldD20: {
          faces: context.heldD20.faces,
          caption: isOwner ? context.heldD20.gmReason : context.heldD20.playerCaption
        }
      },
      allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
    }
  const shown = d20Policy && !isOwner && context.d20Belief ? context.d20Belief : d20Policy
  return shown
    ? {
        ...common,
        kind: 'D20_EVIDENCE',
        request: {
          requestId: snapshot.request.requestId,
          min: 1,
          max: 20,
          rollMode: shown.rollMode,
          derivedRollModeReasons: reasons({
            rollMode: shown.rollMode,
            contributors: shown.contributors
          })
        },
        allowedResponses: ['ENTER_DICE', 'SYSTEM_ROLL']
      }
    : {
        ...common,
        kind: 'ACTION_OUTCOME_EVIDENCE',
        request: {
          requestId: snapshot.request.requestId,
          min: snapshot.request.min,
          max: snapshot.request.max
        },
        allowedResponses: ['ENTER_INTEGER', 'SYSTEM_ROLL']
      }
}
