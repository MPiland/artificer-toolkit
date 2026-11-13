import {
  escapeRelationshipInputDtoSchema,
  resolveEncounterActionInputDtoSchema,
  type EscapeRelationshipInputDto,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import { d20WindowReactorActorId } from '@artificer-toolkit/schema/shared/ruleExecutionD20WindowOffer'
import type { ServerRuleExecutionPendingApplicationContextDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingApplication'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { isDamageRollWindow } from '@artificer-toolkit/schema/shared/ruleExecutionDamageRollWindow'
import type { PendingEncounterRuleOccurrenceSummaryDto } from '@artificer-toolkit/schema/api/encounterData'
import type { LiveSessionReactionChild } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import { encounterStoredRuleOccurrenceSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  contestDefenderPicksCheck,
  contestDefenderPolicy
} from '@artificer-toolkit/rules-runtime/encounterOptionalContestActionExecution'
import { readEncounterActorControl } from './actorController.js'
import {
  encounterAutoFailRequest,
  noEncounterRollModeReasons,
  type EncounterRollModeReasons
} from '@artificer-toolkit/rules-runtime/encounterRollModeReasons'
import { reactedUnderAwaitedChild } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { rollModeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { readRunActor, readRunState } from './documents.js'
import { readPendingSnapshot } from './pendingSnapshots.js'
import {
  awaitsReactionChild,
  heldRootVersionAccounted,
  reactionChildrenKept
} from './reactionChildren.js'
import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { EncounterReadTransaction } from './ports.js'

/**
 * A paused single-target action: its sealed snapshot and context, the root command, and the
 * continuation the resume replays. Named so the readers built on it stay within declaration emit.
 */
export type NativeActionPending = {
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
  context: Extract<ServerRuleExecutionPendingApplicationContextDto, { kind: 'ENCOUNTER_ACTION' }>
  command: EscapeRelationshipInputDto | ResolveEncounterActionInputDto
  continuation: Omit<
    ServerKernelRuleExecutionPendingSnapshotDto,
    'snapshotKind' | 'applicationContext' | 'optionalCombatSnapshotChecksum' | 'phaseReceipts'
  >
}

/** Reads the sealed action root without exposing executable facts to recipients. */
export async function readNativeActionPending(
  ctx: EncounterReadContext,
  occurrence: EncounterDocument<'encounterRuleOccurrences'>
): Promise<NativeActionPending> {
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
    !(await heldRootVersionAccounted(ctx, {
      occurrence,
      rootExpectedVersion: command.expectedVersion,
      recorded: context.reactionChildren ?? []
    })) ||
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

type PendingCounter = { reaction: { reactorActorId: string } }

type CastPendingContext = {
  rollerActorId?: string
  pause?:
    | {
        kind: 'CAST_REACTION'
        payload: {
          declinedReactorActorIds: readonly string[]
          /** The attack d20 an offer made after the roll keeps (D219). */
          rolled?: object
        }
      }
    /** The gate whose roll the action's source owes; the pause is held on that roll. */
    | { kind: 'INCOMING_GATE'; payload: PendingGate }
    /** The failed ward save whose attacker is offered another creature to turn the action on. */
    | { kind: 'ATTACK_RETARGET'; payload: { gate: PendingGate } }
    | {
        kind: 'ROLL_WINDOW' | 'LEGENDARY_RESISTANCE' | 'REACTION' | 'ON_HIT' | 'FORCED_MOVEMENT'
        payload: unknown
      }
  usedReactions?: readonly PendingCounter[]
  reactionChildren?: readonly { commandId: string; rollMode?: string | null }[]
  /** The gate the action's source already passed. */
  passedIncomingGate?: PendingGate
}

/** A gate as a pending context names it: a ward's save or a reaction trigger's check, by its origin. */
type PendingGate = { origin: { kind: string } }

/** Whether two gates are the same one, or both absent. */
export const sameGate = (
  left: PendingGate | null | undefined,
  right: PendingGate | null | undefined
) => checksumCanonicalJson(left?.origin ?? null) === checksumCanonicalJson(right?.origin ?? null)

/**
 * The gate an action has passed once its pending is answered and it goes on: the one that pause
 * waited on, whose roll the answer is, or the one an earlier pause passed.
 */
export const passedGateAfter = (context: CastPendingContext) =>
  incomingGateOf(context) ?? context.passedIncomingGate

const castReactionOf = ({ pause }: CastPendingContext) =>
  pause?.kind === 'CAST_REACTION' ? pause.payload : null

const incomingGateOf = ({ pause }: CastPendingContext) =>
  pause?.kind === 'INCOMING_GATE' ? pause.payload : null

const attackRetargetOf = ({ pause }: CastPendingContext) =>
  pause?.kind === 'ATTACK_RETARGET' ? pause.payload : null

const usedReactorIds = ({ usedReactions = [] }: CastPendingContext) =>
  usedReactions.map(({ reaction }) => reaction.reactorActorId)

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

/** How a cast's pause is answered: a decline or a reaction chosen (an OPTION). Anything else does not answer it. */
function castAnswer(
  response: { resolution: { kind: string } } | null | undefined
): 'DECLINE' | 'SPEND' | null {
  const kind = response?.resolution.kind
  return kind === 'DECLINE' ? 'DECLINE' : kind === 'OPTION' ? 'SPEND' : null
}

/**
 * How a cast's pending may continue (D127, D219). A held cast leaves its pause by a decline or by
 * choosing a reaction. A chosen reaction always runs as its holder's own action, recorded as a child:
 * the same offer stays held until the room resumes it, which moves the cast on as the reactor's
 * decline would. Either way the creature heard from joins the offer's declines and is not asked
 * again, and no pause adds a used reaction.
 *
 * An offer made after the action's attack roll keeps the rolled d20: it is left by a decline, to the
 * next reactor's offer of the same roll or to the roll's own settlement, or by choosing a reaction.
 */
export function castPendingContinues(
  previous: CastPendingContext,
  response: { resolution: { kind: string } } | null | undefined,
  next: CastPendingContext
): boolean {
  const castReaction = castReactionOf(previous)
  const previousGate = incomingGateOf(previous)
  const nextCastReaction = castReactionOf(next)
  const nextRetarget = attackRetargetOf(next)
  const usedPrevious = usedReactorIds(previous)
  const usedNext = usedReactorIds(next)
  // A ward the attacker failed offers a retarget: from the roll that failed it, or from a retargeted
  // action's own ward. Nothing else is carried.
  if (nextRetarget)
    return (
      next.passedIncomingGate === undefined &&
      usedNext.length === 0 &&
      (previousGate
        ? sameGate(previousGate, nextRetarget.gate)
        : attackRetargetOf(previous) != null && response?.resolution.kind === 'OPTION')
    )
  // A retargeted action begins afresh against its new creature: only the answer that chose it may follow.
  if (attackRetargetOf(previous))
    return (
      response?.resolution.kind === 'OPTION' &&
      usedNext.length === 0 &&
      (nextCastReaction?.declinedReactorActorIds.length ?? 0) === 0 &&
      !(incomingGateOf(next) && next.passedIncomingGate !== undefined)
    )
  // A passed gate stays passed for the rest of the action, and only the gate's own answer passes it.
  if (incomingGateOf(next) || !sameGate(next.passedIncomingGate, passedGateAfter(previous)))
    return false
  if (!castReaction) return sameMembers(usedNext, usedPrevious)
  // An action whose chosen reaction ran as a child takes no answer: the room's resume moves it on as
  // the reactor's decline would, since the child, not this action, spent the reaction (D219).
  const answer = awaitsReactionChild(previous)
    ? response
      ? null
      : 'DECLINE'
    : castAnswer(response)
  const roller = previous.rollerActorId
  if (!answer || roller === undefined) return false
  const spends = answer === 'SPEND'
  const declinedPrevious = castReaction.declinedReactorActorIds
  // Once an offer holds the action's rolled d20, every offer that follows it holds the same roll.
  if (
    castReaction.rolled &&
    nextCastReaction &&
    checksumCanonicalJson(nextCastReaction.rolled ?? null) !==
      checksumCanonicalJson(castReaction.rolled)
  )
    return false
  const recordsChild =
    (next.reactionChildren?.length ?? 0) > (previous.reactionChildren?.length ?? 0)
  if (!sameMembers(usedNext, usedPrevious)) return false
  // The chosen reaction runs as a child action: the same offer stays held until the room resumes it.
  if (spends || recordsChild)
    return (
      spends &&
      recordsChild &&
      nextCastReaction != null &&
      next.rollerActorId === roller &&
      sameMembers(nextCastReaction.declinedReactorActorIds, declinedPrevious) &&
      awaitsReactionChild(next)
    )
  return (
    !nextCastReaction ||
    sameMembers(nextCastReaction.declinedReactorActorIds, [...declinedPrevious, roller])
  )
}

type HeldActionContext = CastPendingContext &
  Parameters<typeof reactionChildrenKept>[0] & { currentnessChecksum: string }

/**
 * Whether a held action's next pause continues the pending action it resumes: the same occurrence,
 * about creatures that stand as they did when it was held, moved on as its pause allows
 * (`castPendingContinues`), with the reaction children it recorded kept. An action that resumes
 * nothing records no child. `endpointActorIds` are the creatures the action's currentness covers:
 * its source and every creature it names.
 */
export function heldActionContinues(input: {
  resume: {
    occurrence: { id: string }
    pending: { context: HeldActionContext }
    reactionChildren: readonly Pick<
      LiveSessionReactionChild,
      'commandId' | 'reactorActorId' | 'descendantReactorActorIds'
    >[]
  } | null
  response: { resolution: { kind: string } } | null | undefined
  occurrenceId: string
  next: HeldActionContext
  endpointActorIds: readonly string[]
}): boolean {
  const { resume, next } = input
  if (!resume) return next.reactionChildren === undefined
  const previous = resume.pending.context
  return (
    input.occurrenceId === resume.occurrence.id &&
    (next.currentnessChecksum === previous.currentnessChecksum ||
      // A retarget answer turns the action on another creature, so its facts are the new creature's.
      previous.pause?.kind === 'ATTACK_RETARGET' ||
      reactedUnderAwaitedChild(
        previous.reactionChildren,
        resume.reactionChildren,
        input.endpointActorIds
      )) &&
    castPendingContinues(previous, input.response, next) &&
    reactionChildrenKept(previous, next)
  )
}

/**
 * Whether a cast lost to the reaction child it resumes from (D219) carries exactly the used reactions
 * it held: the child spent its own counter, so the cast's commit spends no other.
 */
export function castCancelledByChildCarriesUsedReactions(
  previous: CastPendingContext,
  next: CastPendingContext
): boolean {
  const castReaction = castReactionOf(previous)
  return (
    castReaction != null &&
    awaitsReactionChild(previous) &&
    sameMembers(usedReactorIds(next), usedReactorIds(previous))
  )
}

/** The use options a paused action offers its decider: a Legendary Resistance, every on-hit rider, or every reaction (innermost first). */
export function offeredDecisionOptionIds(context: {
  pause?:
    | { kind: 'LEGENDARY_RESISTANCE'; payload: { resistance: { useOptionId: string } } }
    | {
        kind: 'REACTION' | 'CAST_REACTION'
        payload: { reactions: readonly { useOptionId: string }[] }
      }
    | {
        kind: 'ON_HIT' | 'ATTACK_RETARGET'
        payload: { options: readonly { useOptionId: string }[] }
      }
    | { kind: 'INCOMING_GATE' | 'FORCED_MOVEMENT' | 'ROLL_WINDOW'; payload: unknown }
    | null
}): string[] {
  const { pause } = context
  switch (pause?.kind) {
    case 'LEGENDARY_RESISTANCE':
      return [pause.payload.resistance.useOptionId]
    case 'ATTACK_RETARGET':
    case 'ON_HIT':
      return pause.payload.options.map((option) => option.useOptionId)
    case 'REACTION':
    case 'CAST_REACTION':
      return pause.payload.reactions.map((reaction) => reaction.useOptionId)
    default:
      return []
  }
}

/**
 * The pending summary one viewer reads. The campaign owner sees the d20's true mode and reasons;
 * everyone else sees what the roller's own facts imply, and a held die with its player caption
 * (ATTACK-10.1). Nothing a player reads carries a GM reason.
 */
export function projectNativeActionPending(
  occurrence: EncounterDocument<'encounterRuleOccurrences'>,
  { snapshot, context, command }: Pick<NativeActionPending, 'snapshot' | 'context' | 'command'>,
  isOwner: boolean,
  reasons: EncounterRollModeReasons = noEncounterRollModeReasons
): PendingEncounterRuleOccurrenceSummaryDto {
  const { pause } = context
  switch (pause?.kind) {
    case 'LEGENDARY_RESISTANCE':
      return {
        kind: 'LEGENDARY_RESISTANCE_CHOICE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        targetActorId: context.rollerActorId,
        options: [{ optionId: pause.payload.resistance.useOptionId }],
        allowedResponses: ['DECLINE', 'OPTION']
      }
    case 'REACTION':
    case 'CAST_REACTION':
      return {
        kind: 'REACTION_CHOICE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        targetActorId: context.rollerActorId,
        options: pause.payload.reactions.map(({ useOptionId, actionId }) => ({
          optionId: useOptionId,
          actionId
        })),
        // A reactor asked after the attack roll decides on the roll as it stands.
        ...(pause.kind === 'CAST_REACTION' &&
          pause.payload.rolled && {
            attackRoll: {
              attackerActorId: command.actorId,
              selectedNatural: pause.payload.rolled.test.d20.selectedNatural,
              total: pause.payload.rolled.test.d20.total
            }
          }),
        allowedResponses: ['DECLINE', 'OPTION']
      }
    case 'ON_HIT':
      return {
        kind: 'ON_HIT_CHOICE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        attackerActorId: context.rollerActorId,
        options: pause.payload.options.map(({ useOptionId, ...option }) => ({
          optionId: useOptionId,
          ...option
        })),
        allowedResponses: ['DECLINE', 'OPTION']
      }
    case 'ATTACK_RETARGET':
      return {
        kind: 'ATTACK_RETARGET_CHOICE',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        attackerActorId: context.rollerActorId,
        options: pause.payload.options.map(({ useOptionId, targetActorId }) => ({
          optionId: useOptionId,
          targetActorId
        })),
        allowedResponses: ['DECLINE', 'OPTION']
      }
    case 'ROLL_WINDOW': {
      if (isDamageRollWindow(pause.payload))
        return {
          kind: 'DAMAGE_ROLL_WINDOW',
          occurrenceId: occurrence.id,
          occurrenceVersion: occurrence.version,
          encounterVersion: occurrence.expectedEncounterVersion,
          rollerActorId: context.rollerActorId,
          requestId: snapshot.request.requestId,
          dice: pause.payload.damage.dice,
          options: pause.payload.offer.options.map(({ optionId, label, cost, maxDice }) => ({
            optionId,
            label,
            cost,
            maxDice
          })),
          allowedResponses: ['ROLL_WINDOW_DECLINE', 'ROLL_WINDOW_USE']
        }
      const { rolled, offer } = pause.payload
      return {
        kind: 'ROLL_WINDOW',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        rollerActorId: context.rollerActorId,
        ...(d20WindowReactorActorId(pause.payload) ? { attackerActorId: command.actorId } : {}),
        requestId: snapshot.request.requestId,
        d20: { selectedNatural: rolled.d20.selectedNatural, total: rolled.d20.total },
        options: offer.options.map(({ optionId, label, count, faces, sign }) => ({
          optionId,
          label,
          count,
          faces,
          sign
        })),
        allowedResponses: ['ROLL_WINDOW_DECLINE', 'ROLL_WINDOW_USE']
      }
    }
    case 'FORCED_MOVEMENT':
      return {
        kind: 'FORCED_MOVEMENT_DESTINATION',
        occurrenceId: occurrence.id,
        occurrenceVersion: occurrence.version,
        encounterVersion: occurrence.expectedEncounterVersion,
        sourceActorId: context.rollerActorId,
        targetActorId: pause.payload.targetActorId,
        requestId: snapshot.request.requestId,
        positions: pause.payload.positions,
        allowedResponses: ['FORCED_MOVEMENT']
      }
  }
  const common = {
    occurrenceId: occurrence.id,
    occurrenceVersion: occurrence.version,
    encounterVersion: occurrence.expectedEncounterVersion,
    rollerActorId: context.rollerActorId
  }
  const { contest } = context
  // A basic action or escape contest's defender picks one of its sealed checks and rolls it (D152).
  const rollModes = rollModeCapabilityRegistry.offeredRollModes(snapshot.graph.source.gameSystemId)
  if (contest && snapshot.request.nodeId === 'target_d20' && contestDefenderPicksCheck(contest)) {
    if (contest.origin.kind === 'OPTIONAL_COMBAT')
      throw new Error('Stored contest check origin is invalid.')
    return {
      ...common,
      kind: 'CONTEST_CHECK',
      rollModes,
      rollerActorId: contest.defender.actorId,
      actionLabel: contest.origin.actionLabel,
      requestId: snapshot.request.requestId,
      checks: contest.defender.checks.map(
        ({ checkDefinitionId, label, rollMode, keep, contributors }) => ({
          checkDefinitionId,
          label,
          rollMode,
          keep,
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
    : (context.d20Policy ??
      (pause?.kind === 'INCOMING_GATE' ? pause.payload.d20 : undefined) ??
      null)
  // A won contest's outcome asks its initiator for dice, outside the contest's d20 nodes (D173).
  if (d20Policy && context.contest && (snapshot.request.min !== 1 || snapshot.request.max !== 20))
    throw new Error('Stored Disarm evidence request is invalid.')
  // The roller rolls the test's added dice with the d20 that settles it (D156); contest checks
  // carry none yet.
  const testAddedDice = context.contest ? undefined : context.d20Policy?.addedDice
  const addedDice = testAddedDice?.length ? { addedDice: testAddedDice } : {}
  if (d20Policy && context.heldD20)
    return {
      ...common,
      kind: 'D20_EVIDENCE',
      request: {
        requestId: snapshot.request.requestId,
        min: 1,
        max: 20,
        rollMode: 'NORMAL',
        keep: rollModeCapabilityRegistry.rollModeKeep({
          gameSystemId: snapshot.graph.source.gameSystemId,
          rollMode: 'NORMAL'
        }),
        rollModes,
        derivedRollModeReasons: [],
        heldD20: {
          faces: context.heldD20.faces,
          caption: isOwner ? context.heldD20.gmReason : context.heldD20.playerCaption
        },
        ...addedDice
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
          keep: shown.keep,
          rollModes,
          derivedRollModeReasons: reasons({
            rollMode: shown.rollMode,
            contributors: shown.contributors
          }),
          ...(d20Policy && 'autoFailConditionIds' in d20Policy
            ? encounterAutoFailRequest(reasons, d20Policy, context.rollerActorId)
            : {}),
          ...addedDice
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
