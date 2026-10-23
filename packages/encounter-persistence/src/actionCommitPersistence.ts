import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { ActionSceneRequestDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterRulesResponse } from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  encounterCommandResultDtoSchema,
  type EncounterCommandResultDto
} from '@artificer-toolkit/schema/api/encounterData'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import {
  encounterRunStateSchema,
  type EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { clearHolderDamageTypes } from './damageTypesClearing.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { attackedHostileCreature } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import { effectiveHitPointMaximum } from '@artificer-toolkit/rules-runtime/character/activeEffectGrantTotals'
import { executionOutcomeCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformEncounterPolicy'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { readLiveEncounterActionAdmission } from './liveActionAdmission.js'
import { insertActionEvidenceReceipt } from './actionEvidenceReceipt.js'
import { readRunActors } from './documents.js'
import {
  combineSpendMutations,
  sourceSpendMutation,
  settleActionSourceSpend
} from './actionSourceSpend.js'
import { applyFailedCounterSpends, failedCounterSpends } from './failedCounterSpend.js'
import {
  completeActionOccurrence,
  recordActionRoot,
  type ApplyEncounterForcedMovements
} from './actionCommitRecords.js'
import { endEffects, receiptConsumedGrants, spendEffectUses } from './consumedGrantPersistence.js'
import { persistEncounterMeleeRetaliation } from './meleeRetaliationPersistence.js'
import { listActiveRuleEffects } from './effectStore.js'
import { projectNativeGm } from './nativeProjection.js'
import { recordTurnSpeedBonus, recordTurnTeleportAllowance, spendTurnUses } from './turnMovement.js'
import { insertSpellCastCheck } from './spellCastCheckPersistence.js'
import { projectNativeBasicActionCheckPending } from './basicActionCheckPending.js'
import { presentEncounterResultForMember } from './resultPresentation.js'
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
import { castPendingContinues } from './actionPending.js'
import { idleTurnMarkChanges } from './idleTurnMark.js'
import { actionSystemRollAnswers, readAppCardedDice } from './appCardedDice.js'
import {
  recordActionRollCards,
  recordCounterCheckRollCards,
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
  const admission = await readLiveEncounterActionAdmission(ctx, input)
  const userId = input.expectedUserId
  const { state, run, fingerprint, campaign, membership } = admission
  if (state.campaignId !== input.campaignId)
    throw new Error('Live Session Encounter scope mismatch.')
  // A lost response replays before checking revisions consumed by the successful transaction.
  if (admission.kind === 'REPLAY')
    return presentEncounterResultForMember(ctx, {
      campaign,
      membership,
      result: admission.result
    })
  const { resume, initiatorUserId } = admission
  const occurrenceVersion = resume ? resume.occurrence.version + 1 : 0
  const command = admission.input
  const execution = input.execution
  if (
    execution.status !== 'COMPLETE' ||
    execution.occurrenceVersion !== occurrenceVersion ||
    (resume && execution.occurrenceId !== resume.occurrence.id) ||
    // Failed counters come from a cast's earlier pauses, so a commit with none behind it carries none.
    (!resume && input.failedCounters.length > 0) ||
    (resume &&
      !castPendingContinues(resume.pending.context, input.response, {
        failedCounters: input.failedCounters.map(({ receipt }) => receipt),
        // A ward passed earlier stays passed through the terminal commit; only the planner passes it.
        passedIncomingGate: resume.pending.context.passedIncomingGate
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
  const actors = await readRunActors(ctx, state)
  const source = actors.find((actor) => actor.id === command.actorId)
  const target = actors.find((actor) => actor.id === targetActorId)
  if (
    !source ||
    !target ||
    (target.kind === 'CHARACTER') !== (batch.kind === 'CHARACTER_MECHANICS_BATCH')
  )
    throw new Error('Live Session action actor scope mismatch.')
  const ruleActors = actors.filter((actor) => actor.kind !== 'CHARACTER')
  if (
    ('sourceCharacterId' in batch &&
      batch.sourceCharacterId !== (source.kind === 'CHARACTER' ? source.sourceId : null)) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetFeatureResourceConsumption !== null) ||
    input.rules.actors.length !== ruleActors.length ||
    new Set(input.rules.actors.map((actor) => actor.actorId)).size !== ruleActors.length ||
    input.rules.actors.some((actor) => !ruleActors.some((current) => current.id === actor.actorId))
  )
    throw new Error('Live Session action output scope mismatch.')
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
      sceneContext: command.sceneContext
    },
    membership.role === 'OWNER' ? 'OWNER' : 'MEMBER'
  )
  await callbacks.validateReadFence(state, [...characterIds], input.revisions)
  const collision = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', execution.occurrenceId))
    .unique()
  if (collision && collision._id !== resume?.occurrence._id)
    throw new Error('Encounter rule occurrence ID was already used.')
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
  // A reaction the target used spends its own slot and allowance with the outcome it answered.
  const reaction = batch.reaction
  if (
    reaction &&
    (reaction.reaction.reactorActorId !== target.id ||
      reaction.reaction.characterId !== (target.kind === 'CHARACTER' ? target.sourceId : null))
  )
    throw new Error('Live Session reaction scope mismatch.')
  if (!reaction && input.reactionSpellConsumption)
    throw new Error('Live Session reaction spell slot has no reaction.')
  const reactionSpend = sourceSpendMutation({
    source: target,
    command: { acceptedWieldConflict: null },
    resource: null,
    item: null,
    spell: input.reactionSpellConsumption,
    receipts: {
      resourceConsumption: null,
      sourceItemConsumption: null,
      spellCastConsumption: reaction?.spellCastConsumption ?? null
    }
  })
  // Every counter that failed against this cast spends its reactor's slot and reaction with the cast (D127).
  const failedSpends = failedCounterSpends({
    failedCounters: input.failedCounters,
    actors,
    source
  })
  // The cast's target pays its own failed counter in its single mechanics call; a Shield-like reaction
  // would be a second spend of the same reaction.
  const targetFailed = failedSpends.find(({ reactor }) => reactor.id === target.id)
  if (targetFailed && reaction)
    throw new Error('Live Session failed counter and reaction spend the same reaction.')
  // The source's counter to a Counterspell against its cast spends its slot in the source's one
  // mechanics call, after the cast's, so the Character advances once.
  const sourceFailed =
    source.id === target.id
      ? undefined
      : failedSpends.find(({ reactor }) => reactor.id === source.id)
  const common = {
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    occurrenceId: execution.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt
  }
  // The source's own batch carries its spend and the conditions its ended effects released.
  const sourceMechanics =
    (spends || batch.sourceApplications.length) && source.id !== target.id
      ? await callbacks.applyMechanics({
          ...common,
          targetActorId: source.id,
          commandId: deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: execution.occurrenceId,
            sourceCommandId: command.commandId,
            phase: 'DIRECT_ACTION_RESOURCE',
            ordinal: 0,
            targetCharacterId: source.kind === 'CHARACTER' ? source.sourceId : source.id
          }),
          applications: batch.sourceApplications.map((application) => ({
            ...application,
            targetActorId: source.id
          })),
          effectiveMaximumHitPoints:
            source.kind === 'CHARACTER'
              ? await callbacks.currentCharacterMaximumHitPoints(state, source.sourceId)
              : effectiveHitPointMaximum(
                  source.maxHitPoints,
                  await listActiveRuleEffects(
                    ctx,
                    { kind: 'ENCOUNTER_ACTOR', encounterId: state.id, targetActorId: source.id },
                    { ownerVerified: true }
                  )
                ),
          forceVersionAdvance: false,
          ...combineSpendMutations(sourceMutation, sourceFailed?.mutation ?? {})
        })
      : null
  // The item the outcome made the target drop (Heat Metal), applied again from the room's receipt.
  const targetRelease = batch.targetItemUseStateTransition
  const targetDegradation =
    batch.kind === 'CHARACTER_MECHANICS_BATCH' ? batch.targetItemDegradation : null
  const mechanics = await callbacks.applyMechanics({
    ...common,
    targetActorId: target.id,
    commandId: command.commandId,
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
      : {}),
    applications: batch.applications.map((application) => ({
      ...application,
      targetActorId: target.id
    })),
    effectiveMaximumHitPoints: batch.targetTransition.before.maximumHitPoints,
    effectiveScalarValues: batch.targetTransition.before.scalarValues,
    forceVersionAdvance: target.kind === 'CHARACTER' && input.createdEffects.length > 0,
    ...combineSpendMutations(
      source.id === target.id ? sourceMutation : {},
      reactionSpend.mutation,
      targetFailed?.mutation ?? {}
    )
  })
  if (
    (sourceFailed &&
      sourceFailed.failed.receipt.characterStreamVersion !==
        sourceMechanics?.characterStreamVersion) ||
    (targetFailed &&
      targetFailed.failed.receipt.characterStreamVersion !== mechanics.characterStreamVersion)
  )
    throw new Error('Live Session failed counter Character receipt mismatch.')
  if (
    checksumCanonicalJson(mechanics.receiptApplications) !==
      checksumCanonicalJson(batch.applications) ||
    checksumCanonicalJson(mechanics.targetTransition) !==
      checksumCanonicalJson(batch.targetTransition) ||
    checksumCanonicalJson(mechanics.itemReleaseTransition) !==
      checksumCanonicalJson(targetRelease) ||
    checksumCanonicalJson(mechanics.itemDegradationTransition) !==
      checksumCanonicalJson(targetDegradation) ||
    checksumCanonicalJson(sourceMechanics?.receiptApplications ?? []) !==
      checksumCanonicalJson(batch.sourceApplications) ||
    (batch.kind === 'CHARACTER_MECHANICS_BATCH' &&
      batch.targetCharacterStreamVersion !== mechanics.characterStreamVersion) ||
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
  // A Legendary Resistance the target used spends one of its own charges with the outcome.
  const targetCharge =
    batch.kind === 'ENCOUNTER_ACTOR_MECHANICS_BATCH' ? batch.targetFeatureResourceConsumption : null
  if (targetCharge && targetCharge.ownerActorId !== target.id)
    throw new Error('Live Session action charge scope mismatch.')
  const targetReactionEconomy =
    reaction?.actionEconomyTransition ??
    targetFailed?.failed.receipt.actionEconomyTransition ??
    null
  const settledTarget =
    targetCharge || targetReactionEconomy
      ? await settleActionSourceSpend(ctx, {
          encounterId: state.id,
          source: mechanics.updatedActor,
          spend: {
            featureResourceConsumption: targetCharge,
            actionEconomyTransition: targetReactionEconomy,
            attackActionTransition: undefined
          },
          economyOverridden: false
        })
      : mechanics.updatedActor
  const beforeSource =
    sourceMechanics?.updatedActor ?? (source.id === target.id ? settledTarget : source)
  const castSettledSource = await settleActionSourceSpend(ctx, {
    encounterId: state.id,
    source: beforeSource,
    spend: batch,
    economyOverridden: overridesActionEconomy(input.ruleOverrides),
    engages: attackedHostileCreature({ d20s: [batch.d20, batch.nestedD20], source, target })
  })
  const settledSource = sourceFailed
    ? await settleActionSourceSpend(ctx, {
        encounterId: state.id,
        source: castSettledSource,
        spend: {
          featureResourceConsumption: null,
          actionEconomyTransition: sourceFailed.failed.receipt.actionEconomyTransition,
          attackActionTransition: undefined
        },
        economyOverridden: false
      })
    : castSettledSource
  const settledFailed = await applyFailedCounterSpends(ctx, {
    state,
    occurrenceId: execution.occurrenceId,
    sourceCommandId: command.commandId,
    occurredAt: input.occurredAt,
    spends: failedSpends,
    exceptActorIds: [source.id, target.id],
    applyMechanics: callbacks.applyMechanics,
    currentCharacterMaximumHitPoints: callbacks.currentCharacterMaximumHitPoints
  })
  let nextActors = actors.map((actor) =>
    actor.id === source.id
      ? settledSource
      : actor.id === target.id
        ? settledTarget
        : (settledFailed.get(actor.id) ?? actor)
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
  await recordCounterCheckRollCards(ctx, {
    campaign,
    encounterId: state.id,
    gameSystemId: state.gameSystemId,
    occurrenceId: execution.occurrenceId,
    checks: failedSpends.flatMap(({ failed, reactor }) =>
      failed.receipt.check ? [{ reactor, check: failed.receipt.check }] : []
    ),
    response: input.response,
    responderUserId: userId,
    initiatorUserId,
    visibility: command.visibility,
    createdAt: input.occurredAt
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    occurrence: spellCheck
      ? {
          occurrenceId: spellCheck.occurrence.id,
          occurrenceVersion: 0,
          status: 'PENDING',
          pending: projectNativeBasicActionCheckPending(spellCheck.occurrence, spellCheck.snapshot)
        }
      : {
          occurrenceId: execution.occurrenceId,
          occurrenceVersion,
          status: 'COMPLETE',
          pending: null
        }
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
  await recordActionRoot(ctx, {
    run,
    state,
    nextState,
    command,
    fingerprint,
    initiatorUserId,
    execution,
    definitionId: input.initialDefinitionId,
    factsChecksum: execution.initialFactsChecksum,
    result,
    checkOccurrenceId: spellCheck?.occurrence.id,
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
      failedCounters: input.failedCounters.map(({ receipt }) => receipt),
      idleTurnMarkChanges: idleTurnMarkChanges(actors, nextActors)
    },
    occurredAt: input.occurredAt
  })
  if (resume && input.response)
    await insertActionEvidenceReceipt(ctx, {
      occurrence: { ...resume.occurrence, ...completedOccurrence },
      response: input.response,
      rootCommand: command,
      rootFingerprint: fingerprint,
      userId,
      rootInitiatorUserId: initiatorUserId,
      answeredRequestId: resume.pending.snapshot.request.requestId,
      result: execution
    })
  return presentEncounterResultForMember(ctx, {
    campaign,
    membership,
    result
  })
}
