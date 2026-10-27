import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import {
  contestApplicationOutputs,
  contestSourceWins,
  planEncounterDisarmSuccess
} from '@artificer-toolkit/rules-runtime/encounterDisarmPreparation'
import { checksumRunActorPlayState } from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import { findEncounterHolderContestEscape } from '@artificer-toolkit/rules-runtime/encounterEscapeCheck'
import { encounterActorRelationship } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import { relationshipConditionApplications } from '@artificer-toolkit/rules-runtime/encounterActionEffectPlans'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { LiveSessionEncounterContestCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterContest'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { consumeNativeActionEconomy } from './actionEconomyPersistence.js'
import { readActorConditionIds } from './concentrationEnd.js'
import { replaceRunActor, writeRunActor } from './documents.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { endEncounterEscapedEffect } from './escapedEffectEndPersistence.js'
import { armIdleTurnActor, engageIdleTurnActor } from './idleTurnMark.js'
import { readLiveCharacterMaximumHitPoints } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterDocument } from './store.js'
import { settleTargetOutcome, targetOutcomeCommandId } from './targetOutcomeSettlement.js'

type ContestApplicationOutputsInput = Parameters<typeof contestApplicationOutputs>[0]

type ContestSettlementInput = Omit<ContestApplicationOutputsInput, 'stateTransition'> & {
  state: EncounterRunState
  campaign: EncounterDocument<'campaigns'>
  /** Every current Run actor, which an escape's ended effect may reconcile. */
  actors: readonly EncounterRunActorState[]
  actor: EncounterRunActorState
  target: EncounterRunActorState
  /** The hold effect a won basic action contest creates on its target; null otherwise. */
  createdEffect: ActiveRuleEffectRecord | null
  /** What the room planned the contest settles; a won picked outcome (Shove, D105) re-applies it. */
  plannedStateTransition: ContestApplicationOutputsInput['stateTransition']
  /** The pushes a won picked outcome lands on the Scene (D157); empty otherwise. */
  forcedMovements: LiveSessionEncounterContestCommitInput['forcedMovements']
  commandId: string
  sourceCommandId: string
  userId: string
  occurredAt: string
  applyMechanics(
    batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
  ): Promise<EncounterMechanicsBatchResult>
}

/** The one mechanics batch a won basic action contest applies to its target (D152). */
async function applyContestTargetMechanics(
  ctx: EncounterCharacterWriteTransaction,
  input: ContestSettlementInput,
  applications: EncounterMechanicsBatchInput['applications'],
  forceVersionAdvance: boolean
) {
  const { state, target, occurrenceId, sourceCommandId, occurredAt } = input
  return input.applyMechanics({
    encounterId: state.id,
    targetActorId: target.id,
    expectedEncounterVersion: state.version,
    occurrenceId,
    sourceCommandId,
    commandId: targetOutcomeCommandId(input),
    occurredAt,
    applications,
    effectiveMaximumHitPoints:
      target.kind === 'CHARACTER'
        ? await readLiveCharacterMaximumHitPoints(ctx, state, target.sourceId)
        : effectiveHitPointMaximum(
            target.maxHitPoints,
            await createActiveRuleEffectStore(ctx).list(turnEffectOwner(target, state.id))
          ),
    forceVersionAdvance
  })
}

function appliedConditionIds(mechanics: EncounterMechanicsBatchResult) {
  return mechanics.receiptApplications.flatMap((application) =>
    application.kind === 'CONDITION_APPLY' && application.applied ? [application.conditionId] : []
  )
}

/**
 * A won basic action contest (Grapple) applies the conditions its hold names to the target, then
 * creates the hold effect the room planned. It checks the effect against its current owner and
 * source and re-derives the conditions from the effect and the target's current conditions.
 */
async function settleContestHold(
  ctx: EncounterCharacterWriteTransaction,
  input: ContestSettlementInput
) {
  const { state, actor, target, occurrenceId, sourceCommandId, occurredAt } = input
  const effect = input.createdEffect
  const owner = turnEffectOwner(target, state.id)
  const origin = effect?.definition.origin
  if (
    !effect ||
    checksumCanonicalJson(effect.owner) !== checksumCanonicalJson(owner) ||
    origin?.kind !== 'ENCOUNTER' ||
    origin.sourceAggregateId !== state.id ||
    origin.sourceActorId !== actor.id ||
    origin.sourceOccurrenceId !== occurrenceId ||
    origin.rootCommandId !== sourceCommandId ||
    effect.definition.frozenGraph.source.gameSystemId !== state.gameSystemId ||
    effect.maintainedEffectStateId !== null ||
    effect.sourceEncounterId !==
      (owner.kind === 'CHARACTER' ? sourceEncounterIdForDefinition(effect.definition, null) : null)
  )
    throw new Error('Contest hold effect does not match its current owner and source.')
  const store = createActiveRuleEffectStore(ctx)
  const applications = relationshipConditionApplications({
    definition: effect.definition,
    target: {
      actorId: target.id,
      conditionIds: await readActorConditionIds(ctx, {
        state,
        actor: target,
        campaign: input.campaign
      })
    },
    resolvedPath: 'ON_CHECK_SUCCESS'
  })
  // The hold lands on the Character, so its stream advances with it.
  const mechanics = await applyContestTargetMechanics(
    ctx,
    input,
    applications,
    target.kind === 'CHARACTER'
  )
  const created = await store.create({
    id: effect.id,
    owner: effect.owner,
    definition: effect.definition,
    lifecycle: effect.lifecycle,
    maintainedEffectStateId: null,
    occurredAt
  })
  if (checksumCanonicalJson(created) !== checksumCanonicalJson(effect))
    throw new Error('Contest hold effect changed before settlement.')
  const armed = armIdleTurnActor({
    actor: mechanics.updatedActor,
    createdEffects: [effect],
    currentActorId: state.currentActorId
  })
  if (armed !== mechanics.updatedActor) await replaceRunActor(ctx, mechanics.updatedActor, armed)
  const [createdEffect] = projectNativeActionEffectTransitions({
    state: null,
    recurring: effect,
    targetActorId: target.id
  }).activeEffectTransitions
  return {
    target: armed,
    stateTransition: {
      kind: 'ACTOR_RELATIONSHIP' as const,
      createdEffect: createdEffect!,
      appliedConditionIds: appliedConditionIds(mechanics)
    }
  }
}

/**
 * A contested escape spends the escaper's action; a win ends the target's holding effect on the
 * escaper and the conditions only it held. It checks the effect is still the target's hold, and
 * that the commit moves the holder exactly as that hold's escape authors: none on a loss.
 */
async function settleContestEscape(
  ctx: EncounterCharacterWriteTransaction,
  input: ContestSettlementInput,
  activeEffectId: string
) {
  const { state, target, occurredAt } = input
  const actor = input.actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: input.actor,
        consumption: input.actionEconomy,
        overridden: false
      })
    : input.actor
  let actors = input.actors.map((entry) => (entry.id === actor.id ? actor : entry))
  let stateTransition: ContestApplicationOutputsInput['stateTransition'] = { kind: 'NONE' }
  const sourceWins = contestSourceWins(input.rolls)
  const held = sourceWins
    ? (await createActiveRuleEffectStore(ctx).list(turnEffectOwner(actor, state.id))).find(
        (effect) => effect.id === activeEffectId
      )
    : undefined
  // The holder's move is re-derived from the hold; only the square its pusher picked comes from the commit.
  const holderMovement = held ? findEncounterHolderContestEscape(held)?.holderMovement : null
  if (
    checksumCanonicalJson(
      input.forcedMovements.map((movement) => ({ ...movement, position: null }))
    ) !== checksumCanonicalJson(holderMovement ? [holderMovement] : [])
  )
    throw new Error('Contested escape movement does not match its hold.')
  if (sourceWins) {
    const origin = held?.definition.origin
    if (origin?.kind !== 'ENCOUNTER' || origin.sourceActorId !== target.id)
      throw new Error('Contested escape effect does not match its holder.')
    const ended = await endEncounterEscapedEffect(ctx, {
      encounterId: state.id,
      actors,
      holderActorId: actor.id,
      activeEffectId,
      occurredAt
    })
    if (!ended) throw new Error('Contested escape effect changed before settlement.')
    actors = ended.actors
    stateTransition = {
      kind: 'RELATIONSHIP_ENDED',
      endedEffectId: activeEffectId,
      removedConditionIds: ended.endedConditionIds
    }
  }
  return { actors, applicationOutputs: contestApplicationOutputs({ ...input, stateTransition }) }
}

/**
 * Persists a settled contest inside the caller's transaction: a won Disarm moves the held item to
 * carried, a won basic action contest creates its hold, a won escape ends the hold, and the source
 * spends its action economy.
 * It re-derives every change from current state.
 */
export async function settleContest(
  ctx: EncounterCharacterWriteTransaction,
  input: ContestSettlementInput
) {
  const { contest, rolls } = input
  if (contest.origin.kind === 'ESCAPE')
    return settleContestEscape(ctx, input, contest.origin.activeEffectId)
  let target = input.target
  let stateTransition: ContestApplicationOutputsInput['stateTransition'] = { kind: 'NONE' }
  if (contestSourceWins(rolls) && contest.origin.kind === 'BASIC_ACTION') {
    const planned = input.plannedStateTransition
    const won = input.createdEffect
      ? await settleContestHold(ctx, input)
      : planned.kind === 'TARGET_OUTCOME'
        ? await settleTargetOutcome({ ...input, planned })
        : null
    if (!won) throw new Error('Contest outcome does not match its target.')
    target = won.target
    stateTransition = won.stateTransition
  } else if (contestSourceWins(rolls)) {
    const targetRow = await ctx.db
      .query('encounterRunActors')
      .withIndex('by_encounterId_id', (q) =>
        q.eq('encounterId', target.encounterId).eq('id', target.id)
      )
      .unique()
    if (!targetRow || targetRow.stateChecksum !== checksumRunActorPlayState(target))
      throw new Error('Disarm target changed before settlement.')
    const active =
      target.kind === 'CHARACTER' ? await ctx.ports.readCharacterRow(target.sourceId) : null
    if (active && active.status !== 'ACTIVE')
      throw new Error('Disarm Character changed before settlement.')
    const planned = planEncounterDisarmSuccess({
      target,
      contest,
      character: active
        ? {
            id: active.id,
            streamVersion: active.play.streamVersion,
            document: ctx.ports.readCharacterRecord(active) as CharacterAuthored
          }
        : null
    })
    stateTransition = planned.stateTransition
    if (planned.kind === 'CHARACTER' && active) {
      await ctx.ports.writeCharacterRecord({
        current: active,
        fields: { streamVersion: active.play.streamVersion + 1, updatedAt: input.occurredAt },
        document: JSON.parse(JSON.stringify(characterAuthoredDtoSchema.parse(planned.character)))
      })
    } else if (planned.kind === 'CREATURE') {
      target = planned.actor
      await writeRunActor(ctx, targetRow._id, target)
    }
  }
  const spent = input.actionEconomy
    ? await consumeNativeActionEconomy(ctx, {
        actor: input.actor,
        consumption: input.actionEconomy,
        overridden: false,
        attackAction: input.attackAction ?? null
      })
    : input.actor
  // The contest is the initiator's action against the target: against a hostile creature it
  // engages an actor armed for an idle-bound grant (SRD Rage).
  const engaged =
    encounterActorRelationship(input.actor.disposition, target.disposition) === 'HOSTILE'
      ? engageIdleTurnActor(spent)
      : spent
  if (engaged !== spent) await replaceRunActor(ctx, spent, engaged)
  return {
    actors: input.actors.map((actor) =>
      actor.id === engaged.id ? engaged : actor.id === target.id ? target : actor
    ),
    applicationOutputs: contestApplicationOutputs({ ...input, stateTransition })
  }
}
