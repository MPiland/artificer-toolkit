import {
  escapeRelationshipInputDtoSchema,
  resolveEncounterActionInputDtoSchema
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  contestDefenderPicksCheck,
  contestDefenderPolicy
} from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
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
  // A contested escape's root is the escape itself (D152).
  const command = (
    context.contest?.origin.kind === 'ESCAPE'
      ? escapeRelationshipInputDtoSchema
      : resolveEncounterActionInputDtoSchema
  ).parse(JSON.parse(context.commandJson))
  if (
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

type PendingCounter = { reaction: { reactorActorId: string } }

type CastPendingContext = {
  rollerActorId?: string
  castReaction?: {
    declinedReactorActorIds: readonly string[]
    check?: unknown
    chain?: {
      counters: readonly PendingCounter[]
      castDeclinedReactorActorIds: readonly string[]
    }
  } | null
  failedCounters?: readonly PendingCounter[]
}

const counterReactorIds = (counters: readonly PendingCounter[] = []) =>
  counters.map(({ reaction }) => reaction.reactorActorId)

const failedReactorIds = ({ failedCounters }: CastPendingContext) =>
  counterReactorIds(failedCounters)

const chainReactorIds = ({ castReaction }: CastPendingContext) =>
  counterReactorIds(castReaction?.chain?.counters)

const sameIds = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((id, index) => id === right[index])

/** The same unique ids in any order. */
const sameMembers = (left: readonly string[], right: readonly string[]) => {
  const members = new Set(left)
  return (
    members.size === left.length &&
    new Set(right).size === right.length &&
    right.length === left.length &&
    right.every((id) => members.has(id))
  )
}

/**
 * How a cast's pause is answered: a decline, a counter chosen (an OPTION), or, while the pause waits on
 * the check a chosen counter owes, the roll of that check. Anything else does not answer it.
 */
function castAnswer(
  previous: CastPendingContext,
  response: { resolution: { kind: string } } | null | undefined
): 'DECLINE' | 'SPEND' | null {
  const kind = response?.resolution.kind
  if (kind === undefined) return null
  if (previous.castReaction?.check) return kind === 'DECLINE' || kind === 'OPTION' ? null : 'SPEND'
  return kind === 'DECLINE' ? 'DECLINE' : kind === 'OPTION' ? 'SPEND' : null
}

/**
 * How a cast's pending may continue (D127). A held cast leaves its pause by a decline, or by choosing a
 * counter that owes a check, which pauses on that roll. Every counter the answer uses is carried to the
 * cast's terminal commit, which spends it: the answerer is stood as the next counter in the chain (a
 * counter is itself a cast the next holders may counter, opening a fresh level of offers that keeps the
 * outer level's declines), or, when its check failed, recorded as failed and declined at its level. A
 * chain with nobody left to ask resolves: an even chain is spent and the cast is offered again at its
 * own level with that level's declines restored; an odd chain counters the cast, which commits instead.
 */
export function castPendingContinues(
  previous: CastPendingContext,
  response: { resolution: { kind: string } } | null | undefined,
  next: CastPendingContext
): boolean {
  const { castReaction } = previous
  const failedPrevious = failedReactorIds(previous)
  const failedNext = failedReactorIds(next)
  if (!castReaction) return sameMembers(failedNext, failedPrevious)
  const answer = castAnswer(previous, response)
  const roller = previous.rollerActorId
  if (!answer || roller === undefined) return false
  const spends = answer === 'SPEND'
  const declinedPrevious = castReaction.declinedReactorActorIds
  const castDeclinedPrevious = castReaction.chain?.castDeclinedReactorActorIds ?? []
  const chainPrevious = chainReactorIds(previous)
  const chainNext = chainReactorIds(next)
  // The counter owes a check: the cast stays held for the same reactor, now on that roll.
  if (spends && !castReaction.check && next.castReaction?.check !== undefined)
    return (
      next.rollerActorId === roller &&
      sameMembers(failedNext, failedPrevious) &&
      sameMembers(next.castReaction.declinedReactorActorIds, declinedPrevious) &&
      sameIds(chainNext, chainPrevious) &&
      sameMembers(next.castReaction.chain?.castDeclinedReactorActorIds ?? [], castDeclinedPrevious)
    )
  const pushed = spends && sameIds(chainNext, [...chainPrevious, roller])
  const unchanged = sameIds(chainNext, chainPrevious)
  const resolved =
    chainNext.length === 0 && chainPrevious.length > 0 && (chainPrevious.length % 2 === 0 || spends)
  if (!pushed && !unchanged && !resolved) return false
  if (
    !sameMembers(
      [...failedNext, ...chainNext],
      [...failedPrevious, ...chainPrevious, ...(spends ? [roller] : [])]
    )
  )
    return false
  const offered = next.castReaction
  if (!offered) return true
  if (pushed)
    return (
      offered.declinedReactorActorIds.length === 0 &&
      sameMembers(
        offered.chain?.castDeclinedReactorActorIds ?? [],
        chainPrevious.length === 0 ? declinedPrevious : castDeclinedPrevious
      )
    )
  if (resolved) return sameMembers(offered.declinedReactorActorIds, castDeclinedPrevious)
  return (
    sameMembers(offered.declinedReactorActorIds, [...declinedPrevious, roller]) &&
    sameMembers(offered.chain?.castDeclinedReactorActorIds ?? [], castDeclinedPrevious)
  )
}

/**
 * Whether a cast countered at its pause carries exactly the failed counters its chain left (D127). The
 * counters standing with the answer's own use of one are the chain; the first of them counters the cast
 * (an odd chain leaves it standing) and every other counter used is spent with it.
 */
export function castCounteredCarriesFailedCounters(
  previous: CastPendingContext,
  response: { resolution: { kind: string } } | null | undefined,
  counterReactorActorId: string,
  next: CastPendingContext
): boolean {
  if (!previous.castReaction) return false
  const answer = castAnswer(previous, response)
  const roller = previous.rollerActorId
  if (!answer || (answer === 'SPEND' && roller === undefined)) return false
  const spends = answer === 'SPEND' && roller !== undefined
  const chainPrevious = chainReactorIds(previous)
  const chain =
    spends && chainPrevious.length % 2 === 0 ? [...chainPrevious, roller] : chainPrevious
  const failedNext = failedReactorIds(next)
  return (
    chain.length % 2 === 1 &&
    chain[0] === counterReactorActorId &&
    !failedNext.includes(counterReactorActorId) &&
    sameMembers(
      [...failedNext, counterReactorActorId],
      [...failedReactorIds(previous), ...chainPrevious, ...(spends ? [roller] : [])]
    )
  )
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
  const { contest } = context
  // A basic action or escape contest's defender picks one of its sealed checks and rolls it (D152).
  if (contest && snapshot.request.nodeId === 'target_d20' && contestDefenderPicksCheck(contest)) {
    if (contest.origin.kind === 'OPTIONAL_COMBAT')
      throw new Error('Stored contest check origin is invalid.')
    return {
      ...common,
      kind: 'CONTEST_CHECK',
      rollerActorId: contest.defender.actorId,
      actionLabel: contest.origin.actionLabel,
      requestId: snapshot.request.requestId,
      checks: contest.defender.checks.map(
        ({ checkDefinitionId, label, rollMode, contributors }) => ({
          checkDefinitionId,
          label,
          rollMode,
          derivedRollModeReasons: reasons({ rollMode, contributors })
        })
      ),
      allowedResponses: ['CONTEST_CHECK']
    }
  }
  const d20Policy = context.contest
    ? snapshot.request.nodeId === 'initiator_d20'
      ? context.contest.initiator
      : snapshot.request.nodeId === 'target_d20'
        ? contestDefenderPolicy(context.contest.defender, null)
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
