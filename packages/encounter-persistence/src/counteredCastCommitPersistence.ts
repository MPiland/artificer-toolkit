import type { LiveSessionEncounterCounteredCastCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import { encounterRunStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  admitActionCommit,
  requireActionCommitFence,
  requireRuleOutputScope
} from './actionCommitFences.js'
import { completeActionOccurrence, recordActionCommit } from './actionCommitRecords.js'
import {
  castCancelledByChildCarriesUsedReactions,
  castCounteredCarriesUsedReactions
} from './actionPending.js'
import { recordCounterCheckRollCards } from './actionRollCards.js'
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
 * Commits a cast that another creature countered, in the transaction of the answer that used the
 * counter: the root with the caster's one spend and the reactor's own (its slot and its reaction),
 * and nothing of the spell. The sealed offer the answer resumed must be the one the counter used.
 *
 * A counter that ran as its holder's own action (D219) spent itself there: the room's resume from
 * that committed child commits the cast it cancelled with the caster's spend alone.
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
  const { state, campaign, resume, initiatorUserId } = admission
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
  const { counter } = root
  const { pause } = resume.pending.context
  const offered = pause?.kind === 'CAST_REACTION' ? pause.payload : null
  const standing = offered?.chain?.counters[0]
  const sameCounter = (left: unknown, right: unknown) =>
    checksumCanonicalJson(left) === checksumCanonicalJson(right)
  const carried = { usedReactions: input.usedReactions.map(({ receipt }) => receipt) }
  const resumedChild = resume.pending.context.reactionChildren?.find(
    ({ rollMode }) => rollMode === undefined
  )
  if (
    !offered ||
    (counter
      ? // The counter is the answer to the pause that offered it. The first counter of a chain
        // stands: it was chosen at an earlier pause and nobody countered it. Otherwise the counter
        // was chosen at this offer, or its check was rolled at the pause that chose it.
        !response ||
        (standing
          ? !sameCounter(standing.reaction, counter.reaction) ||
            !sameCounter(standing.choiceExecution, counter.choiceExecution) ||
            !sameCounter(standing.check, counter.check) ||
            standing.triggerLevel !== counter.triggerLevel
          : (offered.check
              ? (response.resolution.kind !== 'ENTER_DICE' &&
                  response.resolution.kind !== 'SYSTEM_ROLL') ||
                counter.check === null ||
                !sameCounter(offered.check.choiceExecution, counter.choiceExecution)
              : response.resolution.kind !== 'OPTION' ||
                response.resolution.optionId !== counter.reaction.useOptionId) ||
            !offered.reactions.some((pin) => sameCounter(pin, counter.reaction))) ||
        !castCounteredCarriesUsedReactions(
          resume.pending.context,
          response,
          counter.reaction.reactorActorId,
          carried
        )
      : // The counter ran as its holder's own action, which spent it (D219): the room resumes the
        // cast from that committed child, and the cast is lost because the child cancelled it.
        response ||
        offered.kind !== 'COUNTER' ||
        input.reactionSpellConsumption !== null ||
        !resume.reactionChildren.some(
          (child) => child.commandId === resumedChild?.commandId && child.cancelsTriggeringEvent
        ) ||
        !castCancelledByChildCarriesUsedReactions(resume.pending.context, carried)) ||
    input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code))
  )
    throw new Error('Live Session countered cast offer mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const counterReactor = counter
    ? actors.find((actor) => actor.id === counter.reaction.reactorActorId)
    : null
  if (
    !source ||
    source.kind !== 'CHARACTER' ||
    root.sourceActorId !== source.id ||
    root.sourceCharacterId !== source.sourceId ||
    (counter &&
      (counterReactor?.kind !== 'CHARACTER' ||
        counterReactor.id === source.id ||
        counterReactor.sourceId !== counter.reaction.characterId))
  )
    throw new Error('Live Session countered cast actor scope mismatch.')
  /** The counter this commit spends with its reactor; none when the counter ran as its own action. */
  const countering =
    counter && counterReactor?.kind === 'CHARACTER' ? { counter, reactor: counterReactor } : null
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
  const reactorSpend =
    countering &&
    sourceSpendMutation({
      source: countering.reactor,
      command: { acceptedWieldConflict: null },
      resource: null,
      item: null,
      spell: input.reactionSpellConsumption,
      receipts: {
        resourceConsumption: null,
        sourceItemConsumption: null,
        spellCastConsumption: countering.counter.spellCastConsumption
      }
    })
  const reactionSpends = usedReactionSpends({
    usedReactions: input.usedReactions,
    actors,
    source
  })
  if (reactionSpends.some(({ reactor: other }) => other.id === countering?.reactor.id))
    throw new Error('Live Session used reaction reactor countered the cast.')
  // The caster's counter to a counter cast against its cast spends its slot in the caster's one
  // mechanics call, after the cast's, so the Character advances once.
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
  const reactorMechanics =
    countering && reactorSpend && (reactorSpend.spends || countering.counter.applications.length)
      ? await applyActionSpendMechanics(ctx, {
          ...spend,
          actor: countering.reactor,
          applications: countering.counter.applications,
          mutation: reactorSpend.mutation
        })
      : null
  if (
    countering &&
    ((reactorMechanics?.characterStreamVersion ?? null) !==
      countering.counter.characterStreamVersion ||
      checksumCanonicalJson(reactorMechanics?.receiptApplications ?? []) !==
        checksumCanonicalJson(countering.counter.applications))
  )
    throw new Error('Live Session reactor Character receipt mismatch.')

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
  const settledCounterReactor = countering && {
    id: countering.reactor.id,
    actor: await settleActionSourceSpend(ctx, {
      encounterId: state.id,
      source: reactorMechanics?.updatedActor ?? countering.reactor,
      spend: {
        featureResourceConsumption: null,
        actionEconomyTransition: countering.counter.actionEconomyTransition,
        attackActionTransition: undefined
      },
      economyOverridden: false
    })
  }
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
    actor.id === source.id
      ? settledSource
      : actor.id === settledCounterReactor?.id
        ? settledCounterReactor.actor
        : (settledReactors.get(actor.id) ?? actor)
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
  await recordCounterCheckRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    occurrenceId: root.occurrenceId,
    checks: [
      ...reactionSpends.flatMap(({ check, reactor: checkedReactor }) =>
        check ? [{ reactor: checkedReactor, check }] : []
      ),
      ...(countering?.counter.check
        ? [{ reactor: countering.reactor, check: countering.counter.check }]
        : [])
    ],
    response,
    responderUserId: userId,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt
  })
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
