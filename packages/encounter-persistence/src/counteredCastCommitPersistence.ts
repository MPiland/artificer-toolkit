import type { LiveSessionEncounterCounteredCastCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  admitActionCommit,
  requireActionCommitFence,
  requireRuleOutputScope
} from './actionCommitFences.js'
import { completeActionOccurrence, recordActionCommit } from './actionCommitRecords.js'
import { castCancelledByChildCarriesUsedReactions } from './actionPending.js'
import { applyUsedReactionSpends, usedReactionSpends } from './usedReactionSpend.js'
import {
  applyActionSpendMechanics,
  combineSpendMutations,
  requireSourceSpendReceipt,
  settleActionSourceSpend,
  sourceSpendMutation
} from './actionSourceSpend.js'
import { endEffects } from './consumedGrantPersistence.js'
import { readRunActors } from './documents.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'

/**
 * Commits a cast that another creature countered: the root with the caster's one spend and nothing of
 * the spell. The counter ran as its holder's own action (D219), which spent it: the room's resume from
 * that committed child commits the cast it cancelled.
 */
export async function persistEncounterCounteredCastCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterCounteredCastCommitInput,
  callbacks: {
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
  }
): Promise<EncounterCommandResultDto> {
  const admission = await admitActionCommit(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const userId = input.expectedUserId
  const { state, resume } = admission
  const command = admission.input
  const rootExecution = input.execution
  const { response } = input
  if (
    command.type !== 'RESOLVE_ACTION' ||
    command.optionalCombatIntent != null ||
    // The cast is always lost at the pause that offered the counter.
    !resume ||
    rootExecution.status !== 'AGGREGATE_CHOICE_COMPLETE' ||
    rootExecution.applicationOutputs.kind !== 'ENCOUNTER_COUNTERED_CAST' ||
    rootExecution.occurrenceVersion !== resume.occurrence.version + 1 ||
    rootExecution.occurrenceId !== resume.occurrence.id
  )
    throw new Error('Live Session terminal action is not an ordinary countered cast.')
  const root = rootExecution.applicationOutputs
  const { pause } = resume.pending.context
  const offered = pause?.kind === 'CAST_REACTION' ? pause.payload : null
  const resumedChild = resume.pending.context.reactionChildren?.find(
    ({ rollMode }) => rollMode === undefined
  )
  if (
    // The room resumes the cast from the counter's committed child, and the cast is lost because
    // that child cancelled it.
    response ||
    offered?.kind !== 'COUNTER' ||
    !resume.reactionChildren.some(
      (child) => child.commandId === resumedChild?.commandId && child.cancelsTriggeringEvent
    ) ||
    !castCancelledByChildCarriesUsedReactions(resume.pending.context, {
      usedReactions: input.usedReactions.map(({ receipt }) => receipt)
    }) ||
    input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code))
  )
    throw new Error('Live Session countered cast offer mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  if (
    !source ||
    source.kind !== 'CHARACTER' ||
    root.sourceActorId !== source.id ||
    root.sourceCharacterId !== source.sourceId
  )
    throw new Error('Live Session countered cast actor scope mismatch.')
  requireRuleOutputScope(actors, input.rules, 'countered cast')
  await requireActionCommitFence(ctx, {
    state,
    characterIds: actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : [])),
    revisions: input.revisions,
    occurrenceIds: [root.occurrenceId],
    pendingOccurrence: resume.occurrence,
    validateReadFence: callbacks.validateReadFence
  })

  const { spends, mutation: sourceMutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: root
  })
  const reactionSpends = usedReactionSpends({
    usedReactions: input.usedReactions,
    actors,
    source
  })
  // A reaction of the caster's own spends its slot in the caster's one mechanics call, after the
  // cast's, so the Character advances once.
  const sourceUsed = reactionSpends.find(({ reactor: other }) => other.id === source.id)
  // Each batch also carries the conditions its Character's cast ended effects released.
  const spend = {
    state,
    occurrenceId: root.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    applyMechanics: callbacks.applyMechanics,
    currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
  }
  const sourceMechanics =
    spends || root.sourceApplications.length
      ? await applyActionSpendMechanics(ctx, {
          ...spend,
          actor: source,
          applications: root.sourceApplications,
          mutation: combineSpendMutations(sourceMutation, sourceUsed?.mutation ?? {})
        })
      : null
  requireSourceSpendReceipt(sourceMechanics, root, sourceUsed)

  const castSettledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: sourceMechanics?.updatedActor ?? source,
    spend: root,
    economyOverridden: overridesActionEconomy(input.ruleOverrides)
  })
  const settledSource = sourceUsed
    ? await settleActionSourceSpend(ctx, {
        encounterId: state.id,
        source: castSettledSource,
        spend: {
          featureResourceConsumption: null,
          actionEconomyTransition: sourceUsed.used.receipt.actionEconomyTransition,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    : castSettledSource
  const settledReactors = await applyUsedReactionSpends(ctx, {
    state,
    occurrenceId: root.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    spends: reactionSpends,
    exceptActorIds: [source.id],
    applyMechanics: callbacks.applyMechanics,
    currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
  })
  const endedMaintainedStates = await endEffects(ctx, input.consumedGrants)
  const nextActors = actors.map((actor) =>
    actor.id === source.id ? settledSource : (settledReactors.get(actor.id) ?? actor)
  )
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: root.occurrenceId,
    rootCommandId: command.commandId,
    version: rootExecution.occurrenceVersion,
    resume: { occurrence: resume.occurrence },
    occurredAt: input.occurredAt
  })
  const projection = await projectNativeGm(ctx, nextState, nextActors, input.rules)
  return recordActionCommit(ctx, {
    admission,
    command,
    nextState,
    projection,
    completedOccurrence,
    execution: rootExecution,
    definitionId: input.initialDefinitionId,
    // No graph ran: the receipt names the facts the held cast was prepared against.
    factsChecksum: resume.pending.context.currentnessChecksum,
    // The room's resume from a reaction child answers no request, so it leaves no evidence receipt.
    response,
    userId,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: input.consumedGrants,
      endedMaintainedStates,
      addedConcentrationCasterId: null,
      speedBonusTurn: null,
      teleportAllowanceTurn: null,
      turnUses: null,
      usedReactions: input.usedReactions.map(({ receipt }) => receipt)
    },
    occurredAt: input.occurredAt
  })
}
