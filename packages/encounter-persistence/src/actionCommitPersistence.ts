import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { ActionSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { EncounterCommandResultDto } from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { clearHolderDamageTypes } from './damageTypesClearing.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { attackedHostileCreature } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  admitActionCommit,
  requireActionCommitFence,
  requireRuleOutputScope
} from './actionCommitFences.js'
import { settleActionTargetOutcome } from './actionTargetOutcomeSettlement.js'
import { readRunActors } from './documents.js'
import {
  applyActionSpendMechanics,
  sourceSpendMutation,
  settleActionSourceSpend
} from './actionSourceSpend.js'
import {
  completeActionOccurrence,
  recordActionCommit,
  type ApplyEncounterForcedMovements
} from './actionCommitRecords.js'
import { endEffects, receiptConsumedGrants, spendEffectUses } from './consumedGrantPersistence.js'
import { persistEncounterMeleeRetaliation } from './meleeRetaliationPersistence.js'
import { projectNativeGm } from './nativeProjection.js'
import { recordTurnSpeedBonus, recordTurnTeleportAllowance, spendTurnUses } from './turnMovement.js'
import { queueReactionOffer } from './reactionOffer.js'
import { insertSpellCastCheck } from './spellCastCheckPersistence.js'
import { projectNativeBasicActionCheckPending } from './basicActionCheckPending.js'
import {
  readMaintenanceOwnerRequests,
  type readEncounterMaintenanceCapture
} from './maintenanceCapture.js'
import type {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from './actionEffectPersistence.js'
import type { persistEncounterActionChildren } from './actionChildrenPersistence.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import {
  castPendingContinues,
  failedWardsBehind,
  passedGateAfter,
  sameGate
} from './actionPending.js'
import { idleTurnMarkChanges } from './idleTurnMark.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import {
  recordActionRollCards,
  recordIncomingGateRollCards,
  settledD20s
} from './actionRollCards.js'

/** Validates the admitted completed root and applies its native writes in the owning transaction. */
export async function persistEncounterActionCommit(
  ctx: EncounterCharacterWriteTransaction & {
    readonly ports: Pick<EncounterWritePorts, 'insertTableRoll' | 'retainPrivateRoll'>
  },
  input: LiveSessionEncounterActionCommitInput,
  callbacks: {
    readMaintenanceCapture(
      state: EncounterRunState,
      request: LiveSessionEncounterActionCommitInput['maintenanceOwners'][number]
    ): ReturnType<typeof readEncounterMaintenanceCapture>
    readActionSceneInputs(
      state: EncounterRunState,
      input: ActionSceneRequestDto,
      role: 'OWNER' | 'MEMBER'
    ): Promise<Extract<LiveSessionEncounterRulesResponse, { kind: 'ACTION_SCENE' }>['context']>
    validateReadFence(
      state: EncounterRunState,
      characterIds: readonly string[],
      revisions: LiveSessionRulesRevisions
    ): Promise<void>
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    currentCharacterMaximumHitPoints(state: EncounterRunState, characterId: string): Promise<number>
    prepareActionMaintenance(
      input: Parameters<typeof prepareEncounterActionMaintenance>[1]
    ): ReturnType<typeof prepareEncounterActionMaintenance>
    persistActionEffects(
      input: Parameters<typeof persistEncounterActionEffects>[1]
    ): ReturnType<typeof persistEncounterActionEffects>
    persistActionChildren(
      input: Parameters<typeof persistEncounterActionChildren>[1]
    ): ReturnType<typeof persistEncounterActionChildren>
    applyForcedMovements: ApplyEncounterForcedMovements
  }
): Promise<EncounterCommandResultDto> {
  const admission = await admitActionCommit(ctx, input)
  if (admission.kind === 'REPLAY') return admission.result
  const userId = input.expectedUserId
  const { state, fingerprint, campaign, membership, resume, initiatorUserId } = admission
  const occurrenceVersion = resume ? resume.occurrence.version + 1 : 0
  const command = admission.input
  const execution = input.execution
  if (
    execution.status !== 'COMPLETE' ||
    execution.occurrenceVersion !== occurrenceVersion ||
    (resume && execution.occurrenceId !== resume.occurrence.id) ||
    (resume &&
      !castPendingContinues(resume.pending.context, input.response, {
        // A gate passed earlier, or by the roll this commit answers, stays passed through the commit.
        passedIncomingGate: passedGateAfter(resume.pending.context)
      })) ||
    command.optionalCombatIntent != null ||
    command.target.kind !== 'ACTOR'
  )
    throw new Error('Live Session terminal action is not an ordinary completed root.')
  const targetActorId = command.target.actorId
  const initialEvidence = execution.phaseReceipts?.[0]?.execution.evidence ?? execution.evidence
  if (
    initialEvidence.source.definitionId !== input.initialDefinitionId ||
    initialEvidence.source.gameSystemId !== state.gameSystemId ||
    execution.evidence.source.gameSystemId !== state.gameSystemId ||
    execution.phaseReceipts?.some((phase) => phase.template.gameSystemId !== state.gameSystemId)
  )
    throw new Error('Live Session action evidence source mismatch.')
  const batch = execution.applicationOutputs
  // The room gated these warnings; only codes the command acknowledged may be recorded.
  if (input.ruleOverrides.some((warning) => !command.acknowledgedWarnings.includes(warning.code)))
    throw new Error('Live Session action overrides were not acknowledged.')
  if (
    (batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
    batch.sourceActorId !== command.actorId ||
    batch.targetActorId !== targetActorId ||
    batch.occurrenceId !== execution.occurrenceId
  )
    throw new Error('Live Session action result scope mismatch.')
  // An action that passed a gate records it, and it is the gate its pending asked: a reaction child's
  // trigger check, or the ward of the creature it attacked.
  const gateBehind = resume ? passedGateAfter(resume.pending.context) : undefined
  const { passedGate } = batch
  if (
    passedGate
      ? (passedGate.origin.kind === 'TRIGGER'
          ? command.systemTrigger?.trigger !== 'REACTION'
          : passedGate.origin.holderActorId !== targetActorId) ||
        // A gate its pending already passed is the one recorded; a retargeted action's is new.
        (gateBehind && !sameGate(passedGate, gateBehind))
      : gateBehind
  )
    throw new Error('Live Session action incoming gate mismatch.')
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const target = actors.find((actor) => actor.id === targetActorId)
  if (
    !source ||
    !target ||
    (target.kind === 'CHARACTER') !== (batch.kind === 'CHARACTER_MECHANICS_BATCH')
  )
    throw new Error('Live Session action actor scope mismatch.')
  if (
    ('sourceCharacterId' in batch &&
      batch.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null)) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' && batch.targetFeatureResourceConsumption !== null)
  )
    throw new Error('Live Session action output scope mismatch.')
  requireRuleOutputScope(actors, input.rules, 'action')
  const characterIds = new Set(
    actors.flatMap((actor) => (actor.kind === 'CHARACTER' ? [actor.sourceId] : []))
  )
  await readMaintenanceOwnerRequests({
    requests: input.maintenanceOwners,
    actorIds: [source.id, target.id],
    characterIds,
    read: (request) => callbacks.readMaintenanceCapture(state, request)
  })
  const sceneInputs = await callbacks.readActionSceneInputs(
    state,
    {
      actorId: command.actorId,
      targetActorId,
      sceneContext: command.sceneContext,
      actionId: command.actionId
    },
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  await requireActionCommitFence(ctx, {
    state,
    characterIds: [...characterIds],
    revisions: input.revisions,
    occurrenceIds: [execution.occurrenceId],
    pendingOccurrence: resume?.occurrence ?? null,
    validateReadFence: callbacks.validateReadFence
  })
  const effectInput = {
    state,
    command,
    execution,
    maintainedState: input.maintainedState,
    createdEffects: input.createdEffects,
    authorizedCharacterIds: characterIds
  }
  const maintenance = await callbacks.prepareActionMaintenance(effectInput)
  const { spends, mutation: sourceMutation } = sourceSpendMutation({
    source,
    command,
    resource: input.resourceConsumption,
    item: input.itemConsumption,
    spell: input.spellConsumption,
    receipts: batch
  })
  // The source's own batch carries its spend and the conditions its ended effects released.
  const sourceMechanics =
    (spends || batch.sourceApplications.length) && source.id !== target.id
      ? await applyActionSpendMechanics(ctx, {
          state,
          occurrenceId: execution.occurrenceId,
          sourceCommandId: command.commandId,
          occurredAt: input.occurredAt,
          actor: source,
          applications: batch.sourceApplications,
          mutation: sourceMutation,
          applyMechanics: callbacks.applyMechanics,
          currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
        })
      : null
  // The item the outcome made the target drop (Heat Metal), applied again from the room's receipt.
  const targetRelease = batch.targetItemUseStateTransition
  const targetDegradation =
    batch.kind === 'CHARACTER_MECHANICS_BATCH' ? batch.targetItemDegradation : null
  const { mechanics, target: settledTarget } = await settleActionTargetOutcome(ctx, {
    state,
    target,
    batch,
    label: 'action',
    occurrenceId: execution.occurrenceId,
    sourceCommandId: command.commandId,
    commandId: command.commandId,
    occurredAt: input.occurredAt,
    forceVersionAdvance: target.kind === 'CHARACTER' && input.createdEffects.length > 0,
    sourceMutation: source.id === target.id ? sourceMutation : {},
    extra: {
      ...(targetRelease
        ? {
            releaseHeldItemInstanceId:
              targetRelease.kind === 'CHARACTER_ITEM_USE_STATE'
                ? targetRelease.itemInstanceId
                : targetRelease.loadoutEntryId
          }
        : {}),
      ...(targetDegradation
        ? {
            degradeItem: {
              itemInstanceId: targetDegradation.itemInstanceId,
              afterPenalty: targetDegradation.afterPenalty,
              destroyed: targetDegradation.afterUsed > targetDegradation.beforeUsed
            }
          }
        : {})
    },
    applyMechanics: callbacks.applyMechanics
  })
  if (
    checksumCanonicalJson(mechanics.itemReleaseTransition) !==
      checksumCanonicalJson(targetRelease) ||
    checksumCanonicalJson(mechanics.itemDegradationTransition) !==
      checksumCanonicalJson(targetDegradation) ||
    checksumCanonicalJson(sourceMechanics?.receiptApplications ?? []) !==
      checksumCanonicalJson(batch.sourceApplications) ||
    // The accepted stow must be exactly the one the room planned and this commit applied.
    checksumCanonicalJson(
      (source.id === target.id ? mechanics : sourceMechanics)?.itemUseStateTransition ?? null
    ) !== checksumCanonicalJson(batch.sourceItemUseStateTransition) ||
    // The weapon the source drew must be exactly the one the room planned and this commit applied.
    checksumCanonicalJson(
      (source.id === target.id ? mechanics : sourceMechanics)?.itemDrawTransition ?? null
    ) !== checksumCanonicalJson(batch.sourceItemDraw) ||
    // The weapon the source struck with must wear exactly as the room planned and this commit applied.
    checksumCanonicalJson(
      (source.id === target.id ? mechanics : sourceMechanics)?.itemDegradationTransition ?? null
    ) !== checksumCanonicalJson(batch.sourceItemDegradation)
  )
    throw new Error('Live Session mechanics receipt mismatch.')
  const beforeSource =
    sourceMechanics?.updatedActor ?? (source.id === target.id ? settledTarget : source)
  const settledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: beforeSource,
    spend: batch,
    economyOverridden: overridesActionEconomy(input.ruleOverrides),
    engages: attackedHostileCreature({ d20s: [batch.d20, batch.nestedD20], source, target })
  })
  // A delegated attack spends one attack of its commander's Attack action (DELEGATED_ATTACK).
  const delegated = batch.delegatingActorSpend
  const commander = delegated && actors.find((actor) => actor.id === delegated.actorId)
  if (delegated && (!commander || commander.id === source.id || commander.id === target.id))
    throw new Error('Live Session delegated attack scope mismatch.')
  const settledCommander =
    delegated && commander
      ? await settleActionSourceSpend(ctx, {
          encounterId: state.id,
          source: commander,
          spend: { ...delegated, featureResourceConsumption: null },
          economyOverridden: false
        })
      : null
  let nextActors = actors.map((actor) =>
    actor.id === source.id
      ? settledSource
      : actor.id === target.id
        ? settledTarget
        : actor.id === settledCommander?.id
          ? settledCommander
          : actor
  )
  nextActors = await callbacks.persistActionEffects({
    ...effectInput,
    maintenance,
    actors: nextActors,
    occurredAt: input.occurredAt
  })
  // The one-roll grants the rolls used up (Vicious Mockery's disadvantage, Help) end with the roll.
  const endedMaintainedStates = await endEffects(ctx, input.consumedGrants)
  await spendEffectUses(ctx, input.spentUseGrants)
  // The zones the melee hit set off burn the attacker after the hit lands (D153).
  let retaliationEnded: ActiveRuleEffectRecord[] = []
  if (batch.meleeRetaliation) {
    const retaliated = await persistEncounterMeleeRetaliation(
      ctx,
      {
        state,
        initialActors: actors,
        attacker: nextActors.find((actor) => actor.id === source.id)!,
        scene: sceneInputs && {
          sceneId: sceneInputs.sceneId,
          attacker: sceneInputs.sourceToken,
          hit: sceneInputs.targetToken
        },
        evidence: batch.meleeRetaliation,
        occurrenceId: execution.occurrenceId,
        sourceCommandId: command.commandId,
        occurredAt: input.occurredAt
      },
      { applyMechanics: callbacks.applyMechanics }
    )
    nextActors = nextActors.map((actor) => (actor.id === source.id ? retaliated.actor : actor))
    retaliationEnded = retaliated.endedEffects
  }
  const sourceVersion =
    sourceMechanics?.characterStreamVersion ??
    (source.kind === 'CHARACTER' && source.id !== target.id
      ? (batch.maintenanceTransition?.characterOwnerTransitions.find(
          (entry) => entry.characterId === source.sourceId
        )?.afterStreamVersion ?? null)
      : null)
  if (batch.sourceCharacterStreamVersion !== sourceVersion)
    throw new Error('Live Session source Character receipt mismatch.')
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: input.occurredAt
  })
  const completedOccurrence = await completeActionOccurrence(ctx, {
    state,
    nextState,
    occurrenceId: execution.occurrenceId,
    rootCommandId: command.commandId,
    version: occurrenceVersion,
    resume,
    occurredAt: input.occurredAt
  })
  const spellCheck = input.spellCheck
    ? await insertSpellCastCheck(ctx, {
        snapshot: input.spellCheck,
        input,
        nextState,
        executionOccurrenceId: execution.occurrenceId,
        sourceActorId: source.id
      })
    : null
  // The reactions this attack offers once it has resolved (D219) wait queued behind its own
  // decisions; each is this command's own, against its source, for another actor of the Run.
  for (const offer of input.reactionOffers) {
    const context = offer.applicationContext
    if (
      context.kind !== 'ENCOUNTER_REACTION_OFFER' ||
      context.parentCommandId !== command.commandId ||
      context.parentOccurrenceId !== execution.occurrenceId ||
      context.attackerActorId !== source.id ||
      !nextActors.some((actor) => actor.id === context.reactorActorId)
    )
      throw new Error('Reaction offer scope mismatch.')
    await queueReactionOffer(ctx, nextState, offer, input.occurredAt)
  }
  nextActors = await callbacks.persistActionChildren({
    input,
    state: nextState,
    actors: nextActors,
    execution,
    fingerprint,
    userId,
    authorizedCharacterIds: characterIds
  })
  // A push or pull moves its target's token on the Scene in this commit (D139), settling the
  // zones it passes through (D170).
  const settledMovements = input.forcedMovements.length
    ? await callbacks.applyForcedMovements({
        state,
        sourceActorId: source.id,
        commandId: command.commandId,
        movements: input.forcedMovements,
        occurrenceId: execution.occurrenceId,
        occurredAt: input.occurredAt,
        authorizedCharacterIds: characterIds,
        actors: nextActors,
        rules: input.rules
      })
    : { moves: [], landings: [], actors: nextActors, rules: input.rules }
  nextActors = settledMovements.actors
  const projection = await projectNativeGm(ctx, nextState, nextActors, settledMovements.rules)
  // Each d20 the action rolled gets a chat card: an attack is the source's, a save the target's.
  await recordActionRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    rollScope: execution.occurrenceId,
    batch,
    actionLabel: input.label,
    source,
    target,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt,
    appCardedD20s: await readAppCardedDice(ctx, {
      occurrenceId: execution.occurrenceId,
      answers: await actionSystemRollAnswers(ctx, {
        occurrenceId: execution.occurrenceId,
        response: input.response,
        responderUserId: userId
      }),
      dice: settledD20s(batch)
    })
  })
  await recordIncomingGateRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    occurrenceId: execution.occurrenceId,
    roller: source,
    // The saves that turned the action, then the ward its chosen creature passed.
    gates: [
      ...(resume ? failedWardsBehind(resume.pending.context) : []),
      ...(batch.passedGate ? [batch.passedGate] : [])
    ],
    response: input.response,
    responderUserId: userId,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt
  })
  // A Dash adds the actor's speed to this turn's movement; the stored execution proves it resolved.
  const outcomes = executionOutcomeCapabilityRegistry.require(state.gameSystemId)
  const addsSpeed = outcomes.addsSpeedToMovement(execution)
  if (addsSpeed) await recordTurnSpeedBonus(ctx, { state, actorId: source.id })
  // A teleport spell (Misty Step) grants a one-shot allowance keyed by this cast; the move consumes it.
  const teleport = outcomes.teleportAllowance(execution)
  const teleportAllowanceTurn = teleport
    ? await recordTurnTeleportAllowance(ctx, {
        state,
        actorId: source.id,
        castCommandId: command.commandId,
        ...teleport
      })
    : null
  // A once-per-turn use (Sneak Attack) the attack dealt is spent from the attacker's turn record.
  const turnUses = await spendTurnUses(ctx, { state, actorId: source.id, keys: input.turnUses })
  // A start-of-turn trigger root reads the holder's damage record, then empties it.
  const clearedDamageTypes =
    command.systemTrigger?.trigger === 'START_OF_TURN'
      ? await clearHolderDamageTypes(ctx, { state, actorId: source.id })
      : null
  return recordActionCommit(ctx, {
    admission,
    command,
    nextState,
    projection,
    completedOccurrence,
    execution,
    definitionId: input.initialDefinitionId,
    factsChecksum: execution.initialFactsChecksum,
    pendingCheck: spellCheck
      ? {
          occurrenceId: spellCheck.occurrence.id,
          pending: projectNativeBasicActionCheckPending(spellCheck.occurrence, spellCheck.snapshot)
        }
      : undefined,
    response: input.response,
    userId,
    commandFields: {
      label: input.label,
      ruleOverrides: input.ruleOverrides,
      consumedGrants: receiptConsumedGrants({
        consumedGrants: [...input.consumedGrants, ...input.spentUseGrants],
        endedGrants: [...input.endedGrants, ...mechanics.endedGrants, ...retaliationEnded]
      }),
      endedMaintainedStates,
      addedConcentrationCasterId: maintenance?.addedConcentrationCasterId ?? null,
      speedBonusTurn: addsSpeed ? { round: state.round, turnActorId: source.id } : null,
      teleportAllowanceTurn,
      forcedMovements: settledMovements.moves,
      forcedMovementLandings: settledMovements.landings,
      turnUses,
      clearedDamageTypes,
      idleTurnMarkChanges: idleTurnMarkChanges(actors, nextActors)
    },
    occurredAt: input.occurredAt
  })
}
