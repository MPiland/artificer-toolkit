import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  actionTargetActorId,
  resolveCheckActionInputDtoSchema,
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterActionCurrentnessChecksum,
  encounterActionSpentTurnUses,
  prepareEncounterActionMechanics
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import {
  encounterActionSourceLabel,
  isMeleeAttackSource,
  resolveEncounterActionSource,
  systemAbilityDefinitions,
  type EncounterActionSourceRequest
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import {
  isEncounterBasicActionId,
  readEncounterBasicActionEntries
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  type EncounterAttackDecoy,
  prepareAttackBehindDecoys
} from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
import { settledCountedUseSpend } from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'
import { encounterActionTargetKind } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  attackHitEndedEffects,
  withOwnedTemporaryHitPoints
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import { encounterFacingRule } from '@artificer-toolkit/rules-runtime/encounterFacing'
import { snapshotCreatureTypeId } from '@artificer-toolkit/rules-runtime/encounterActorState'
import { overridesActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects,
  readNativeLiveSpellPins
} from './nativeEncounterTargets.js'
import {
  readNativeLiveEnemyProximity,
  readNativeLiveMoveToward
} from './nativeAttackEnemyProximity.js'
import {
  nativeLiveAttackSceneLoaders,
  readNativeActionAreaScene
} from './nativeAttackSceneLoaders.js'
import {
  readNativeActionSourceOffers,
  nativeLiveHolderStateReads,
  readNativeWeaponAttackOffer
} from './nativeTurnUses.js'
import { planNativeLiveContestRolls } from './nativeContest.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { requireChosenItemInstance } from './nativeChosenItem.js'
import {
  endedByAction,
  planEndEffects,
  planEndEffectsChecks,
  reactionCastEnded
} from './nativeEndEffects.js'
import {
  payableCharacterDamageRerolls,
  prepareNativeLiveActionMaintenance,
  prepareNativeLiveMaintainedState,
  settledCharacterActionSpend
} from './nativeEncounterMaintenance.js'
import { onHitCandidates } from '@artificer-toolkit/rules-runtime/character/characterOnHitCosts'
import { advanceNativeActionTarget } from './nativeActionTargetAdvance.js'
import { nativeActionStateLoaders } from './nativeActionStateLoaders.js'
import { createNativeCastPause } from './nativeEncounterCastPause.js'
import {
  discoverNativeRollReactions,
  nextNativeRollReactionDice,
  planNativeWindowReactions,
  type NativeRollReaction
} from './nativeEncounterRollReaction.js'
import {
  readNativePendingActionAnswer,
  readNativeResumedReactionOffer
} from './nativePendingActionAnswer.js'
import {
  advanceNativeIncomingGate,
  offerNativeAttackRetarget,
  owedNativeTriggerCheck,
  planNativeGatedAction
} from './nativeEncounterIncomingGate.js'
import { preparedCastsSpell } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import {
  chosenEncounterAttackRetarget,
  retargetEncounterAction,
  settleEncounterAttackRetarget
} from '@artificer-toolkit/rules-runtime/encounterAttackRetarget'
import { endSubscriptions } from '@artificer-toolkit/rules-runtime/events/effectHooks'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { settleEncounterAttackActionHit } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  encounterActorEffectiveSize,
  prepareNativeActionEffectsPlan
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { prepareAttackTargetGrantTriggers } from '@artificer-toolkit/rules-runtime/encounterAttackAppliedEffects'
import {
  reactedUnderAwaitedChild,
  restoreEncounterActionPending,
  type PendingReactionChildren
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import type { LiveSessionEncounterActionResume } from '@artificer-toolkit/schema/api/liveSessionCommandScopes'
import { effectsAfterEnding } from '@artificer-toolkit/rules-runtime/encounterEffectOnEnd'
import { authoredCheckOf, planNativeLiveCheckAction } from './nativeCheckAction.js'
import { planNativeLiveConcealmentCheckAction } from './nativeConcealmentCheck.js'
import { planNativeLiveEncounterSettlement } from './nativeEncounterSettlement.js'
import { planNativeActionTargetOutcome } from './nativeActionTargetOutcome.js'
import { planNativeLiveEncounterActorsAction } from './nativeEncounterActorsRules.js'
import {
  planNativeLiveEncounterAreaAction,
  planNativeLiveEncounterAreaAnswer,
  planNativeLiveEncounterAreaForcedMovement,
  planNativeLiveEncounterAreaLegendaryResistance,
  planNativeLiveEncounterAreaRemoval
} from './nativeEncounterAreaRules.js'
import { prepareCasterActionOnTarget, type ForcedMovementPick } from './nativeAreaPreparation.js'
import { planForcedMovementDestination } from './nativeForcedMovementDestination.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import {
  checkActionSource,
  nativeLiveRelationshipFacts,
  refuseActionOutsideItsWindow,
  interpretForcedMovements,
  refuseUnmetActionRestrictions,
  refuseImmuneTarget,
  refuseUnmetItemActionRequirements,
  targetNotPermitted,
  targetRuleOverrides
} from './nativeEncounterActionInputs.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { plannedGateImmunityGrant } from './nativeGateImmunity.js'
import { isMeleeRetaliationHit } from '@artificer-toolkit/rules-runtime/encounterMeleeRetaliation'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { planNativeLiveCleaving } from './nativeEncounterCleaving.js'
import { planNativeLiveMeleeRetaliation } from './nativeMeleeRetaliation.js'
import { readNativeLiveSpatialEffects } from './nativeTurnEffectPerception.js'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { prepareEncounterBasicActionContest } from '@artificer-toolkit/rules-runtime/encounterBasicActionContest'
import { nextRollInt } from '@artificer-toolkit/rules-runtime/random'
import { settledActionSaveWindow } from './nativeActionSaveWindow.js'
import { targetSaveWindow } from '@artificer-toolkit/rules-runtime/encounterActionSaveWindow'
import { windowSpentEffects } from '@artificer-toolkit/rules-runtime/encounterD20Window'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

/** Computes the action in the DO; the room commits this plan in its own transaction. */
export async function planNativeLiveEncounterAction(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  commandInput:
    | ResolveEncounterActionInputDto
    | ResolveRuleOccurrenceInputDto
    | RemoveAreaTargetInputDto
    // The room's own resume of a pending action from the reaction child it just committed (D219).
    | LiveSessionEncounterActionResume,
  executionOptions: {
    runtime: RulesRuntimeService
    random(maximum: number): number
    captures: LiveCaptureReads
    /**
     * The pick an action's forced movements owe their source next on the Encounter's Scene (D157):
     * the farthest creature with two or more legal squares, its farther ones already landed.
     */
    forcedMovementPick: ForcedMovementPick
  }
) {
  const responseCommand = commandInput.type === 'RESOLVE_RULE_OCCURRENCE' ? commandInput : null
  const removalCommand = commandInput.type === 'REMOVE_AREA_TARGET' ? commandInput : null
  const resumeCommand = commandInput.type === 'RESUME_ACTION' ? commandInput : null
  const request =
    commandInput.type === 'REMOVE_AREA_TARGET'
      ? { kind: 'AREA_REMOVAL' as const, removal: commandInput }
      : commandInput.type === 'RESOLVE_RULE_OCCURRENCE'
        ? { kind: 'ACTION_RESPONSE' as const, response: commandInput }
        : commandInput.type === 'RESUME_ACTION'
          ? { kind: 'ACTION_RESUME' as const, resume: commandInput }
          : { kind: 'ACTION_COMMAND' as const, command: commandInput }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted action scope lets its follow-up captures read the rules inputs. Only the
    // GM removes a creature from an area, so that request needs none.
    ...(scope.expectedRole === 'PLAYER' && request.kind !== 'AREA_REMOVAL'
      ? { action: request }
      : {}),
    request
  })
  if (
    commandInput.encounterId.toLowerCase() !== initial.encounterId ||
    commandInput.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live Encounter command scope mismatch.')
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest }> = []
  let revisions: LiveSessionRulesRevisions = []
  async function capture(request: LiveSessionEncounterRulesRequest) {
    const input = liveSessionEncounterRulesInputSchema.parse({
      ...initial,
      request
    })
    const response = await executionOptions.captures.encounterRules(input)
    if (response.kind !== request.kind) throw new Error('Encounter rules capture kind mismatch.')
    revisions = mergeNativeRulesRevisions(revisions, response.revisions)
    dependencies.push({ request: input.request })
    return response
  }
  const admission = await capture(initial.request)
  if (
    admission.kind !== 'ACTION_COMMAND' &&
    admission.kind !== 'ACTION_RESPONSE' &&
    admission.kind !== 'ACTION_RESUME' &&
    admission.kind !== 'AREA_REMOVAL'
  )
    throw new Error('Encounter command is unavailable.')
  if ('result' in admission && admission.result)
    return { kind: 'REPLAY' as const, result: admission.result }
  if (admission.kind !== initial.request.kind) throw new Error('Encounter command is unavailable.')
  const pendingAdmission =
    admission.kind === 'ACTION_RESPONSE' || admission.kind === 'ACTION_RESUME' ? admission : null
  const snapshot = pendingAdmission?.snapshot ?? null
  /** What the pending ordinary action this command continues recorded so far, if it continues one. */
  const pendingContext =
    snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION' ? snapshot.applicationContext : null
  const areaSnapshot =
    admission.kind === 'ACTION_RESPONSE' || admission.kind === 'AREA_REMOVAL'
      ? admission.areaSnapshot
      : null
  const resumedOffer = resumeCommand
    ? readNativeResumedReactionOffer({
        resume: resumeCommand,
        snapshot,
        fingerprint: admission.fingerprint
      })
    : null
  /** The child action of each reaction chosen against this action, and this action's place in that tree (D219). */
  const reactionChildWindow = {
    recorded: pendingContext?.reactionChildren ?? [],
    // The committed child action of each reaction chosen against this action, if it is pending.
    committed: pendingAdmission?.reactionChildren ?? [],
    resumedOffer,
    ancestors: 'reactionAncestors' in admission ? admission.reactionAncestors : []
  }
  const { areaDecision, areaLanding, pauseAnswer } = responseCommand
    ? readNativePendingActionAnswer({
        response: responseCommand,
        snapshot,
        areaSnapshot,
        appRoll: admission.kind === 'ACTION_RESPONSE' ? admission.appRoll : null,
        fingerprint: admission.fingerprint
      })
    : { areaDecision: null, areaLanding: null, pauseAnswer: null }
  const retargetAnswer = pauseAnswer?.kind === 'ATTACK_RETARGET' ? pauseAnswer.answer : null
  const castAnswer = pauseAnswer?.kind === 'CAST_REACTION' ? pauseAnswer.answer : null
  const gateAnswer = pauseAnswer?.kind === 'INCOMING_GATE' ? pauseAnswer.answer : null
  const forcedMovementAnswer = pauseAnswer?.kind === 'FORCED_MOVEMENT' ? pauseAnswer.answer : null
  // A creature chosen at a retarget continues the action as that creature's: every later pause and the
  // terminal commit carry the retargeted command, and the pause that offered it is replaced.
  const retargetOption = retargetAnswer
    ? chosenEncounterAttackRetarget(retargetAnswer.offer, retargetAnswer.selection)
    : null
  const command = retargetOption
    ? retargetEncounterAction(admission.command, retargetOption)
    : admission.command
  const fingerprint = retargetOption ? checksumCanonicalJson(command) : admission.fingerprint
  const { autoRollByActorId } = admission
  const requireAutoRoll = (actorId: string) => {
    const autoRoll = autoRollByActorId[actorId]
    if (autoRoll === undefined) throw new Error('The roller preference is unavailable.')
    return autoRoll
  }
  const inputs = await capture({ kind: 'INPUTS' })
  if (inputs.kind !== 'INPUTS') throw new Error('Encounter inputs are unavailable.')
  const { state, system } = inputs
  if (
    state.id !== initial.encounterId ||
    state.version !== initial.expectedVersion ||
    state.campaignId !== initial.campaignId ||
    state.gameSystemId !== system.id ||
    new Set(state.actorIds).size !== state.actorIds.length ||
    !state.actorIds.includes(command.actorId) ||
    (command.target.kind === 'ACTOR' && !state.actorIds.includes(command.target.actorId)) ||
    (command.target.kind === 'ACTORS' &&
      command.target.actorIds.some((actorId) => !state.actorIds.includes(actorId)))
  )
    throw new Error('Encounter rules input binding mismatch.')
  if (state.automationMode === 'MANUAL')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'ASSISTED_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.ASSISTED_ONLY
    })

  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })

  async function loadTarget(
    actor: EncounterRunActorState,
    effectsByActorId: typeof activeEffectsByActorId = activeEffectsByActorId
  ) {
    const preparedTarget = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor,
      activeEffectsByActorId: effectsByActorId,
      ...executionOptions
    })
    revisions = mergeNativeRulesRevisions(revisions, preparedTarget.revisions)
    return preparedTarget.target
  }
  // A basic action is a check on one creature; only an area action aims at a point.
  if (
    isEncounterBasicActionId(command.actorId, command.actionId) &&
    !resolveCheckActionInputDtoSchema.safeParse(command).success
  )
    throw targetNotPermitted()
  // A d20 window settles its roll before the action goes on: the die it spent joins the roll, and its
  // effect ends with the action.
  const resolved = await settledActionSaveWindow(pauseAnswer, executionOptions)
  if (command.target.kind !== 'ACTOR') {
    const target = command.target
    // An answer to a reaction offered before the cast did anything, or the resume from that reaction's
    // child action (D219), replays the cast itself.
    const continuation = resumeCommand ?? (castAnswer ? responseCommand : null)
    const castResume =
      continuation && pendingContext
        ? {
            continuation,
            answer: castAnswer,
            initiatorUserId: pendingContext.initiatorUserId,
            currentnessChecksum: pendingContext.currentnessChecksum
          }
        : undefined
    const areaInput = {
      castResume,
      reactionChildren: reactionChildWindow,
      forcedMovementPick: executionOptions.forcedMovementPick,
      initial,
      command: { ...command, target },
      fingerprint: admission.fingerprint,
      state,
      system,
      actors,
      activeEffectsByActorId,
      loadTarget,
      capture,
      runtime: executionOptions.runtime,
      random: executionOptions.random,
      requireAutoRoll,
      autoRollByActorId,
      readFormCreature: executionOptions.captures.readFormCreature
    }
    if (removalCommand) {
      if (!areaSnapshot) throw new Error('The pending area action is unavailable.')
      return {
        ...(await planNativeLiveEncounterAreaRemoval({
          ...areaInput,
          removal: removalCommand,
          areaSnapshot
        })),
        dependencies,
        revisions
      }
    }
    if (responseCommand && !castResume) {
      if (!areaSnapshot) throw new Error('The pending area action is unavailable.')
      if (areaDecision)
        return {
          ...(await planNativeLiveEncounterAreaLegendaryResistance({
            ...areaInput,
            response: responseCommand,
            areaSnapshot,
            decision: areaDecision
          })),
          dependencies,
          revisions
        }
      if (areaLanding)
        return {
          ...(await planNativeLiveEncounterAreaForcedMovement({
            ...areaInput,
            response: responseCommand,
            areaSnapshot,
            landing: areaLanding
          })),
          dependencies,
          revisions
        }
      if (!snapshot || !resolved) throw new Error('The pending area action is unavailable.')
      return {
        ...(await planNativeLiveEncounterAreaAnswer({
          ...areaInput,
          response: responseCommand,
          requestId: snapshot.request.requestId,
          resolution: resolved,
          areaSnapshot
        })),
        dependencies,
        revisions
      }
    }
    return {
      ...(target.kind === 'ACTORS'
        ? await planNativeLiveEncounterActorsAction({
            ...areaInput,
            command: { ...command, target }
          })
        : await planNativeLiveEncounterAreaAction({
            ...areaInput,
            command: { ...command, target }
          })),
      // The child resume a held cast went on from, which its pause, commit or countered commit names.
      resume: resumeCommand,
      dependencies,
      revisions
    }
  }
  const targetActorId = actionTargetActorId(command.target)
  const selectedActors = actors.filter((actor) =>
    [command.actorId, targetActorId, command.delegatingActorId].includes(actor.id)
  )
  const movementTargets = new Map(
    await Promise.all(
      selectedActors.map(async (actor) => [actor.id, await loadTarget(actor)] as const)
    )
  )
  const capturedScene = command.sceneContext
    ? await capture({
        kind: 'ACTION_SCENE',
        command: {
          actorId: command.actorId,
          targetActorId,
          sceneContext: command.sceneContext,
          actionId: command.actionId
        }
      })
    : null
  if (capturedScene && capturedScene.kind !== 'ACTION_SCENE')
    throw new Error('Action Scene context is unavailable.')
  const sceneInputs = capturedScene?.context ?? null
  const sceneContext = sceneInputs && {
    sceneId: sceneInputs.sceneId,
    sceneVersion: sceneInputs.sceneVersion,
    sourceToken: sceneInputs.sourceToken,
    targetToken: sceneInputs.targetToken,
    grid: resolveEncounterSceneGrid({ encounter: state, sceneGrid: sceneInputs.sceneGrid })
  }
  const definitions = {
    requireCurrent: async (definitionId: string) => {
      const response = await capture({ kind: 'DEFINITION', definitionId })
      if (response.kind !== 'DEFINITION' || !response.definition)
        throw new Error('The rule definition is unavailable.')
      return response.definition
    }
  }
  const actionSources = {
    loadSource: async (input: EncounterActionSourceRequest) =>
      resolveEncounterActionSource({
        ...input,
        ...(await readNativeActionSourceOffers({
          capture,
          actorId: input.actor.id,
          actionId: input.actionId,
          state,
          activeEffectsByActorId,
          characterRules: movementTargets.get(input.actor.id)?.characterFacts?.ruleEvaluation
        })),
        system,
        rules: state,
        spells: await readNativeLiveSpellPins(capture),
        basicActions: await readEncounterBasicActionEntries({
          actorId: input.actor.id,
          actionId: input.actionId,
          gameSystemId: input.gameSystemId,
          definitions
        })
      }),
    loadRelationshipFacts: nativeLiveRelationshipFacts({ activeEffectsByActorId })
  }
  // The Scene's loaders for the attack, against the given targets' facts.
  const attackScene = { state, system, actors, loadTarget, definitions, sceneContext, capture }
  const attackSceneLoaders = (targets: typeof movementTargets) =>
    nativeLiveAttackSceneLoaders({ ...attackScene, movementTargets: targets })
  // What the Scene move a reaction's child answers offered it under (D219). The mover's token already
  // stands at the contact the move is held at, so the Scene is read as any action reads it.
  const triggerMovement = 'triggerMovement' in admission ? admission.triggerMovement : null
  // The attack is prepared again against a target's facts once a reaction has changed them.
  const prepareAttackAs = (
    targets: typeof movementTargets,
    attackDecoy: EncounterAttackDecoy | null,
    rollReactions: readonly NativeRollReaction[]
  ) =>
    prepareCasterActionOnTarget(
      { state, system, actors, activeEffectsByActorId, capture, command },
      {
        caster: actors.find((actor) => actor.id === command.actorId)!,
        target: actors.find((actor) => actor.id === targetActorId)!,
        movementTargets: targets,
        sceneContext,
        saveWindow: true,
        attack: {
          attackDecoy,
          attackOccasion: triggerMovement?.attackOccasion,
          windowReactionDice: rollReactions.map(({ die }) => die),
          ...attackSceneLoaders(targets),
          loadEnemyProximity: ({ sourceFacts, targetFacts }) =>
            readNativeLiveEnemyProximity({
              state,
              actors,
              attacker: sourceFacts,
              target: targetFacts,
              sceneContext,
              loadTarget,
              definitions,
              capture
            }),
          loadMoveToward: ({ sourceFacts: attacker, targetFacts: target }) =>
            readNativeLiveMoveToward({ attacker, target, sceneContext, capture }),
          ...nativeActionStateLoaders({
            campaign: state,
            actorId: command.actorId,
            sceneContext,
            capture
          }),
          ...actionSources
        }
      }
    )
  const continued = responseCommand ?? resumeCommand
  const occurrenceId = continued ? continued.occurrenceId : crypto.randomUUID()
  const occurrenceVersion = continued ? continued.expectedOccurrenceVersion + 1 : 0
  // An attack that a decoy of the target intercepts is rolled against the decoy's armor class.
  const unwindowed = await prepareAttackBehindDecoys({
    occurrenceId,
    effects: activeEffectsByActorId.get(targetActorId) ?? [],
    system,
    prepare: (attackDecoy) => prepareAttackAs(movementTargets, attackDecoy, [])
  })
  // The creatures that may roll a die against the attack roll by a reaction (D207); their dice join
  // the windows the roll opens, so the attack is prepared again with them. Range is read from the
  // Scene, so an attack made without one offers no such reaction.
  const actionSceneRef = command.sceneContext
  const rollReactions =
    unwindowed.makesAttackRoll && actionSceneRef
      ? await discoverNativeRollReactions({
          state,
          actors,
          system,
          roller: unwindowed.actor,
          movementTargets,
          loadTarget,
          loadScene: async () => {
            const scene = await readNativeActionAreaScene(capture, command.actorId, actionSceneRef)
            return { ...scene, rollerToken: scene.sourceToken }
          },
          loadAttackPerception: attackSceneLoaders(movementTargets).loadAttackPerception,
          actionSources,
          capture
        })
      : []
  const prepared =
    rollReactions.length > 0
      ? await prepareAttackAs(movementTargets, unwindowed.attackDecoy, rollReactions)
      : unwindowed
  // A spell that takes a list of creatures is not aimed at one.
  if (encounterActionTargetKind(prepared.targetPolicy) === 'ACTORS') throw targetNotPermitted()
  refuseActionOutsideItsWindow(prepared, command)
  const actorTarget = movementTargets.get(prepared.actor.id)
  if (!actorTarget) throw new Error('Encounter rules input binding mismatch.')
  refuseImmuneTarget(prepared, {
    targetEffects: activeEffectsByActorId.get(prepared.target.id) ?? [],
    sourceFacts: actorTarget
  })
  await refuseUnmetActionRestrictions(
    { source: prepared.source, acceptedWieldConflict: command.acceptedWieldConflict },
    {
      target: actorTarget,
      gameSystemId: state.gameSystemId,
      definitions,
      speedDefinitions: system.speeds,
      runEffectsByActorId: activeEffectsByActorId,
      ...nativeLiveHolderStateReads(capture, state.gameSystemId, prepared.actor.id)
    }
  )
  refuseUnmetItemActionRequirements(prepared, state)
  // A repeat runs against its holder unless the offer lets the repeated invocation pick targets.
  if (
    prepared.source.kind === 'REPEAT_PATH' &&
    prepared.source.capability.target === 'HOLDER' &&
    prepared.target.id !== prepared.source.capability.holderActorId
  )
    throw targetNotPermitted()
  const targetMovement = movementTargets.get(prepared.target.id)
  const chosenItemInstanceId = requireChosenItemInstance({
    source: prepared.source,
    commandTarget: command.target,
    targetMovement
  })
  // An optional-combat intent routes to the Disarm planner.
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  const weaponAttackOffer = await readNativeWeaponAttackOffer({
    capture,
    actor: prepared.actor,
    heldEffects: activeEffectsByActorId.get(prepared.actor.id) ?? [],
    characterRules: movementTargets.get(prepared.actor.id)?.characterFacts?.ruleEvaluation
  })
  const delegatingActor = actors.find((actor) => actor.id === command.delegatingActorId)
  if (command.delegatingActorId !== undefined && !delegatingActor)
    throw new Error('Encounter rules input binding mismatch.')
  const { activationCode, economy, suppressed, attackAction, grantedUseKey, delegation } =
    await evaluateNativeLiveActionEconomy({
      delegation: delegatingActor && {
        actor: delegatingActor,
        target: movementTargets.get(delegatingActor.id),
        effects: activeEffectsByActorId.get(delegatingActor.id) ?? []
      },
      prepared,
      state,
      actionId: command.actionId,
      sourceTarget: movementTargets.get(prepared.actor.id),
      targetIds: [prepared.target.id],
      targetSize: targetMovement ? encounterActorEffectiveSize(targetMovement) : null,
      capture,
      weaponAttackOffer: weaponAttackOffer.charge,
      offeredAllowanceDefinitionId: triggerMovement?.allowanceDefinitionId
    })
  const mechanicFacts =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts
      : prepared.source.capability.mechanicFacts
  const heldOnTarget = activeEffectsByActorId.get(prepared.target.id) ?? []
  const endPlan = planEndEffects(mechanicFacts.outcomes, heldOnTarget, command.target, prepared)
  const ruleOverrides = targetRuleOverrides({
    prepared,
    command,
    evaluation: { activationCode, economy, suppressed },
    endWarnings: endPlan.warnings,
    scene: { sceneContext, facing: encounterFacingRule(state) },
    gameSystemId: state.gameSystemId,
    movementTargets
  })
  const actionEconomy = economy?.consumption ?? null
  if (mechanicFacts.invocation.triggerCode === 'CHECK') {
    const source = checkActionSource(prepared)
    const actor = movementTargets.get(prepared.actor.id)
    const target = movementTargets.get(prepared.target.id)
    if (responseCommand || !actor || !target) throw new Error('A check action is unavailable.')
    // A check its target contests (Grapple) rolls both participants' d20s as one contest (D152).
    if (authoredCheckOf(source.capability).dc.kind === 'CONTEST') {
      const contestInput = {
        state,
        actor: prepared.actor,
        target: prepared.target,
        command,
        prepared,
        sceneContext
      }
      return {
        kind: 'CONTEST' as const,
        plan: await planNativeLiveContestRolls({
          ...contestInput,
          scope,
          root: command,
          ready: {
            fingerprint: admission.fingerprint,
            initiatorUserId: scope.expectedUserId,
            autoRollByActorId,
            appRoll: null,
            snapshot: null,
            occurrenceVersion: null
          },
          priorContext: null,
          actors,
          settlement: {
            kind: 'ACTION',
            prepared,
            forcedMovementPick: executionOptions.forcedMovementPick
          },
          actorRules: prepared.actorRules,
          activeEffectsByActorId,
          preparation: prepareEncounterBasicActionContest({
            ...contestInput,
            system,
            actionEconomy
          }),
          actionEconomy,
          attackAction,
          runtime: executionOptions.runtime,
          random: executionOptions.random ?? nextRollInt,
          revisions
        }),
        dependencies,
        revisions
      }
    }
    // A concealment check compares its roller with every actor in the Run; load them all before the
    // revisions the plan depends on are read.
    const concealmentTargets =
      authoredCheckOf(source.capability).dc.kind === 'FIXED'
        ? null
        : new Map(
            await Promise.all(
              actors.map(
                async (entry) =>
                  [entry.id, movementTargets.get(entry.id) ?? (await loadTarget(entry))] as const
              )
            )
          )
    const checkInput = {
      scope,
      command,
      fingerprint,
      source,
      prepared,
      state,
      system,
      actors,
      actor,
      actorEffects: activeEffectsByActorId.get(prepared.actor.id) ?? [],
      target,
      overrides: ruleOverrides,
      actionEconomy,
      autoRoll: requireAutoRoll(prepared.actor.id)
        ? (executionOptions.random ?? nextRollInt)
        : null,
      runtime: executionOptions.runtime,
      revisions
    }
    return {
      ...(concealmentTargets
        ? await planNativeLiveConcealmentCheckAction({
            ...checkInput,
            targets: concealmentTargets,
            activeEffectsByActorId,
            sceneContext,
            capture
          })
        : await planNativeLiveCheckAction(checkInput)),
      dependencies,
      revisions
    }
  }
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared,
    activeEffectsByActorId,
    capture,
    endedMaintainedStateId: command.endedMaintainedStateId,
    allowCapacityUses: true,
    loadCarriedHolder: async (actor) => movementTargets.get(actor.id) ?? loadTarget(actor)
  })
  // Only an attack roll uses the attacker's one-roll grants (Vicious Mockery's disadvantage, Help);
  // a saving-throw action leaves them for the next attack. An effect that ends with the roll or the
  // cast (Invisibility) releases the condition it alone held in the source's own batch. A new
  // Concentration already ends its replaced dependents, and releases their conditions, with the
  // maintenance transition, so those are not ended a second time here.
  const dispositions = new Map(actors.map(({ id, disposition }) => [id, disposition]))
  const makesAttackRoll = typeof prepared.binding.actionMechanic.attackBonus === 'number'
  const castsSpell = preparedCastsSpell(prepared)
  const againstEnemy = actsAgainstEnemy({
    actorId: prepared.actor.id,
    targetActorIds: [prepared.target.id],
    dispositions
  })
  const { consumedGrants, sourceReleases } = actionEndedEffects({
    holderActorId: prepared.actor.id,
    held: (activeEffectsByActorId.get(prepared.actor.id) ?? []).filter(
      (effect) => !maintenance?.removed.some((removed) => removed.id === effect.id)
    ),
    makesAttackRoll,
    castsSpell,
    againstEnemy
  })
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared,
    actionEconomy,
    attackAction,
    delegation,
    maintenance,
    sceneContext
  })
  if (
    snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    snapshot.applicationContext.currentnessChecksum !== currentnessChecksum &&
    // The retargeted action's facts are the new creature's, not the ones the offer was made against.
    !retargetOption &&
    // A source or target that reacted under the child the action resumes from stands as that child's
    // tree left it (D219): the Run moved only by those actions, each of which held its own creatures to
    // its own currentness until it committed.
    !reactedUnderAwaitedChild(reactionChildWindow.recorded, reactionChildWindow.committed, [
      prepared.actor.id,
      prepared.target.id
    ])
  )
    throw new Error('The pending action source or target changed.')
  const resume =
    responseCommand && resolved && snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
      ? { pending: restoreEncounterActionPending(snapshot), resolution: resolved }
      : null
  const targetStateChecksum = checksumRuleDocument(prepared.target)
  // An attack, or a harmful spell cast at an enemy, aimed at a warded creature (Sanctuary) is lost unless
  // its attacker passes the ward's save first. An area that merely catches the creature is not aimed at it.
  // A reaction's child whose trigger asks a check against the cast it answers owes that check instead (D219).
  const triggerCheck = owedNativeTriggerCheck(
    prepared,
    'triggerCastLevel' in admission ? admission.triggerCastLevel : null
  )
  const gateOwed =
    triggerCheck !== null ||
    (prepared.actor.id !== prepared.target.id && (makesAttackRoll || (castsSpell && againstEnemy)))
  if (gateAnswer && !gateOwed) throw new Error('The incoming gate is no longer owed.')
  if (retargetAnswer)
    await settleEncounterAttackRetarget({
      runtime: executionOptions.runtime,
      occurrenceId,
      gameSystemId: state.gameSystemId,
      ...retargetAnswer
    })
  // Declining the offered retarget loses the action by the save already failed; it is not rolled again.
  const declinedRetarget = retargetAnswer && !retargetOption ? retargetAnswer.offer.gate : null
  const gate = declinedRetarget
    ? { kind: 'FAILED' as const, gate: declinedRetarget }
    : gateOwed
      ? await advanceNativeIncomingGate({
          runtime: executionOptions.runtime,
          random: executionOptions.random,
          gameSystemId: state.gameSystemId,
          occurrenceId,
          owed: triggerCheck
            ? { kind: 'TRIGGER', system, ...triggerCheck }
            : {
                kind: 'WARD',
                holderActorId: prepared.target.id,
                holderEffects: activeEffectsByActorId.get(prepared.target.id) ?? [],
                holderGrantFold:
                  movementTargets.get(prepared.target.id)?.effectiveRulePolicyOutput?.grantFold ??
                  null,
                attackerCreatureTypeId: snapshotCreatureTypeId(prepared.actor),
                owner: async (ownerActorId) => {
                  const owner = actors.find((actor) => actor.id === ownerActorId)
                  return owner ? (movementTargets.get(owner.id) ?? (await loadTarget(owner))) : null
                }
              },
          attacker: actorTarget,
          autoRoll: requireAutoRoll(prepared.actor.id),
          passed: pendingContext?.passedIncomingGate,
          answer: gateAnswer
        })
      : { kind: 'NONE' as const, passed: null }
  /** The gate the source has passed, carried by every later pause of this action. */
  const passedIncomingGate = gate.kind === 'PASSED' ? gate.gate : pendingContext?.passedIncomingGate
  const occurredAt = new Date().toISOString()
  /** What every plan of this action carries; read after the captures it made, so its revisions are current. */
  /** The child of each reaction chosen against this action so far, set once its offers are heard. */
  let reactionChildren: PendingReactionChildren = reactionChildWindow.recorded
  const preflight = () => ({
    command,
    response: responseCommand,
    resume: resumeCommand,
    reactionChildren,
    // A response continues the original initiator's action; the responder is authorized in Convex.
    initiatorUserId: pendingContext?.initiatorUserId ?? initial.expectedUserId,
    fingerprint,
    occurrenceId,
    occurrenceVersion,
    occurredAt,
    prepared,
    actionEconomy,
    attackAction,
    ruleOverrides: ruleOverrides,
    maintenance,
    sceneContext,
    currentnessChecksum,
    activeEffectsByActorId,
    consumedGrants,
    passedIncomingGate,
    dependencies,
    revisions
  })
  if (gate.kind === 'PENDING') return { ...preflight(), ...gate, kind: 'GATE_PENDING' as const }
  // The attacker may turn the action a ward stopped on another creature before it is lost.
  const retarget =
    gate.kind === 'FAILED' && !declinedRetarget
      ? await offerNativeAttackRetarget({
          runtime: executionOptions.runtime,
          occurrenceId,
          gameSystemId: state.gameSystemId,
          gate: gate.gate,
          command,
          actors,
          prepared,
          capture
        })
      : null
  if (retarget) return { ...preflight(), ...retarget, kind: 'RETARGET_PENDING' as const }
  if (gate.kind === 'FAILED')
    return {
      ...preflight(),
      kind: 'GATED' as const,
      gated: planNativeGatedAction({
        state,
        actors,
        prepared,
        sourceEffects: activeEffectsByActorId.get(prepared.actor.id) ?? [],
        actionEconomy,
        ruleOverrides: ruleOverrides,
        occurrenceId,
        occurrenceVersion,
        commandId: command.commandId,
        occurredAt,
        userId: initial.expectedUserId,
        failed: gate
      })
    }
  const castPause = createNativeCastPause({
    runtime: executionOptions.runtime,
    state,
    actors,
    activeEffectsByActorId,
    loadTarget,
    capture,
    command,
    prepared,
    movementTargets,
    // A single-target cast has no chosen list to react to being chosen (T4 covers a chosen list).
    chosenActorIds: null,
    reactionSources: actionSources,
    // Range is read from the Scene, so a cast made without one offers no reaction.
    readScene: actionSceneRef
      ? () => readNativeActionAreaScene(capture, command.actorId, actionSceneRef)
      : null,
    occurrenceId,
    occurredAt,
    userId: initial.expectedUserId,
    aimedAttackPerception: attackSceneLoaders(movementTargets).loadAttackPerception,
    reactionChildren: reactionChildWindow,
    answer: castAnswer,
    // A gate pause held the action before any counter was offered, so its answer replays them all.
    resumed: snapshot !== null && !gateAnswer
  })
  const cast = await castPause.advance({ actionEconomy, ruleOverrides, occurrenceVersion })
  if (cast.kind !== 'NONE') return { ...preflight(), ...cast }
  reactionChildren = cast.reactionChildren
  // A reaction a bystander used before the attack's d20 imposes its roll mode on that roll (D217).
  const react = castPause.imposeChildRollModes(reactionChildren)
  const reacted = react(prepared)
  const actionSource = {
    runtime: executionOptions.runtime,
    damageRerolls: payableCharacterDamageRerolls({ prepared, maintenance }),
    random: executionOptions.random,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId,
    autoRoll: {
      SOURCE: requireAutoRoll(prepared.actor.id),
      TARGET: requireAutoRoll(prepared.target.id)
    },
    binding: reacted.binding,
    afterTest: async () => undefined,
    // The target's held dice and the reactors' dice a save d20 is shown to (D168, D207), whichever
    // answer starts the OUTCOME.
    saveWindow: targetSaveWindow(
      state.gameSystemId,
      heldOnTarget,
      prepared.attackWindowDice,
      async (answeredReactorActorIds: readonly string[]) =>
        nextNativeRollReactionDice(rollReactions, answeredReactorActorIds)
    )
  }
  // The optional on-hit riders the attacker could pay for now: a Character's slots and resource pools
  // pay them. An action that already spends a slot offers no slot rider, and one that already spends a
  // pool offers no pool rider.
  const attackPlan = prepared.plan
  const onHitNow =
    prepared.source.kind === 'CHARACTER_ACTION' && attackPlan.kind === 'TEST_OUTCOME'
      ? onHitCandidates({
          riders: prepared.adapter.optionalOnHitRiders({
            compilerSource: attackPlan.compilerSource
          }),
          openOfferEffectIds: weaponAttackOffer.openEffectIds,
          settled: prepared.characterActionState,
          capacityUse: maintenance?.capacityUse,
          spellSlots: prepared.source.effectivePolicyOutput.spellSlots,
          resources: prepared.source.effectivePolicyOutput.resources
        })
      : []
  const { execution, resistance, reaction, reactionChild, reactionUse, chosenOnHit } =
    await advanceNativeActionTarget({
      state,
      system,
      capture,
      attack: prepared,
      actionSource,
      targetStateChecksum,
      prepareReaction: (actionId) =>
        prepareEncounterActionMechanics({
          state,
          actor: prepared.target,
          target: prepared.target,
          actors,
          actionId,
          wieldConflictAcceptance: { kind: 'UNPROMPTED' },
          overridable: false,
          movementTargets,
          sceneContext: null,
          ...actionSources
        }),
      // The answered attack keeps the decoy it was rolled against.
      prepareReactedAttack: async (reactedTargets: typeof movementTargets) =>
        react(await prepareAttackAs(reactedTargets, prepared.attackDecoy, rollReactions)),
      loadTarget,
      activeEffectsByActorId,
      commandId: command.commandId,
      occurredAt,
      onHitNow,
      pauseAnswer,
      resumedOffer:
        resumeCommand && pendingContext?.pause?.kind === 'CAST_REACTION'
          ? pendingContext.pause.payload
          : null,
      resume
    })
  if (execution.kind === 'PENDING')
    return {
      ...preflight(),
      kind: 'PENDING' as const,
      execution,
      // The reaction chosen against the hit answers its holder being hit, so its action is the
      // holder's on itself; the attack stays held on the answered offer until it commits (D219).
      ...(reactionChild
        ? await castPause.launchReactionChild(
            reactionChildren,
            reactionChild,
            reactionChild.holderActorId
          )
        : { reactionChild: null })
    }
  // What an on-hit rider the attacker chose is paid with is spent with the outcome; the currentness
  // fence above was taken on the unspent attack.
  // A Concentration the holder keeps beside another spends the use of the bonus that made room; an
  // on-hit pool rider is not offered beside it, so the two never spend the one resource slot together.
  const settledPrepared = settledCharacterActionSpend({
    prepared: reacted,
    chosenOnHit,
    damageReroll: resolved?.kind === 'DAMAGE_REROLL' ? resolved.option : null,
    maintenance,
    automationMode: state.automationMode
  })
  const preparedEffects = prepareNativeActionEffectsPlan({
    prepared: reacted,
    execution,
    occurrenceId,
    commandId: command.commandId,
    activeEffectsByActorId,
    attackAction,
    chosenItemInstanceId,
    weaponHits:
      prepared.source.kind === 'CHARACTER_ACTION' && prepared.target.kind === 'CREATURE'
        ? discoverEncounterFeatureActions({
            actor: prepared.target,
            conditionDefinitionIds: system.conditionTypes.map((condition) => condition.id),
            abilityDefinitions: systemAbilityDefinitions(system),
            spells: new Map()
          }).passiveWeaponHits
        : []
  })
  // A reaction that casts a spell (Shield) ends the reactor's own cast-ended effects too, with the
  // reactor's one batch: the hit target's, since the reaction answers an attack on its caster.
  const reactionEnded = reactionCastEnded(
    reactionUse,
    activeEffectsByActorId,
    consumedGrants,
    dispositions
  )
  // Each reaction rolled against the attack roll spends its reaction and charge with the outcome (D207);
  // the target's rides its own mechanics.
  const windowReactions = planNativeWindowReactions({
    reactions: rollReactions,
    execution,
    state,
    occurrenceId,
    commandId: command.commandId,
    occurredAt,
    userId: initial.expectedUserId
  })
  const windowTarget = windowReactions.find(
    ({ receipt }) => receipt.reaction.reactorActorId === prepared.target.id
  )
  const spentTargetEconomy = windowTarget?.economy ?? null
  const targetReactorSpend = Boolean(windowTarget?.resourceConsumption)
  const interpretedMovements = interpretForcedMovements(prepared, {
    execution: execution.execution,
    occurrenceId,
    published: execution.published,
    targetActorId: prepared.target.id
  })
  if (interpretedMovements.some(({ collision }) => collision))
    throw new Error('A forced-movement collision is resolved only in an area action.')
  // A movement with two or more legal squares waits for its source to pick one (D157).
  const destination = await planForcedMovementDestination({
    runtime: executionOptions.runtime,
    occurrenceId,
    encounterId: state.id,
    sourceActorId: prepared.actor.id,
    outcomePhase: execution.outcomePhase,
    settled: {
      pick: executionOptions.forcedMovementPick,
      movements: interpretedMovements,
      completion: {
        execution: execution.execution,
        published: execution.published,
        initialPublished: execution.initialPublished,
        initialFactsChecksum: execution.initialFactsChecksum,
        phaseReceipts: execution.phaseReceipts ?? null,
        d20: execution.d20,
        nestedD20: execution.nestedD20
      }
    },
    answer: forcedMovementAnswer
  })
  if (destination.kind === 'HELD')
    return {
      ...preflight(),
      kind: 'PENDING' as const,
      execution: destination.held
    }
  const forcedMovements = destination.movements
  // The temporary hit points the cast gives belong to the lasting effect that owns them (D156).
  const recurringEffectId = crypto.randomUUID()
  const castApplications = preparedEffects.recurringEffect
    ? withOwnedTemporaryHitPoints(execution.applications, {
        id: recurringEffectId,
        definition: preparedEffects.recurringEffect.definition
      })
    : execution.applications
  const applications = [...castApplications, ...preparedEffects.relationshipConditionApplications]
  // A hit uses up the attacker's grants consumed on hitting, after they added to its damage.
  const hitEnded = attackHitEndedEffects({
    holderActorId: prepared.actor.id,
    held: (activeEffectsByActorId.get(prepared.actor.id) ?? []).filter(
      ({ id }) =>
        !consumedGrants.some((ended) => ended.id === id) &&
        !maintenance?.removed.some((removed) => removed.id === id)
    ),
    resultPath: execution.d20?.resultPath
  })
  // A hit on a decoy destroys it, and a repeat spends one of its carrier's counted uses; the last
  // decoy or use ends its effect.
  const uses = settledCountedUseSpend(prepared, execution.d20?.resultPath, activeEffectsByActorId)
  // An attack roll against the target uses up what it consumes, and damage it takes ends the effects
  // that end on damage; the conditions only they held are released in the target's own batch.
  const targetHeld = heldOnTarget.filter(
    ({ id }) => !(reactionEnded?.consumedGrants ?? []).some((ended) => ended.id === id)
  )
  const meleeAttack = isMeleeAttackSource(state.gameSystemId, prepared.source)
  const grantTriggers = prepareAttackTargetGrantTriggers({
    encounter: settledPrepared.state,
    attacker: settledPrepared.actor,
    target: settledPrepared.targetFacts,
    occurrenceId,
    commandId: command.commandId,
    activeEffectsByActorId
  })
  // A basic action another creature uses on the target (rousing a sleeper) ends what names it.
  const actionEnded = endedByAction(endPlan, command, execution.execution, targetHeld, prepared)
  // A cast that may end higher-level effects pends one roller prompt per candidate (D182).
  const spellCheck = actionEnded
    ? await planEndEffectsChecks({
        plan: endPlan,
        executionOptions,
        system,
        state,
        movementTargets,
        prepared,
        command,
        fingerprint,
        castOccurrenceId: occurrenceId
      })
    : null
  const gateImmunityGrant = plannedGateImmunityGrant({
    ward: gate.kind === 'PASSED' || gate.kind === 'NONE' ? gate.passed : null,
    state,
    occurrenceId,
    commandId: command.commandId,
    actorId: prepared.actor.id,
    sourceCharacterId: prepared.actor.kind === 'CHARACTER' ? prepared.actor.sourceId : null,
    targetLabel: prepared.target.label,
    targetLifetimeScope: settledPrepared.target.kind === 'CHARACTER' ? 'OWNER' : 'ENCOUNTER'
  })
  // The maintained state the action's effects depend on replaces what its source maintained.
  const outcomeMaintenance = preparedEffects.maintenance ? maintenance : null
  const maintainedState = preparedEffects.maintenance
    ? prepareNativeLiveMaintainedState({
        completedPolicy: preparedEffects.maintenance,
        maintenance,
        encounterId: state.id,
        ownerActorId: prepared.actor.id,
        actionId: command.actionId,
        sourceOccurrenceId: occurrenceId,
        occurredAt
      })
    : null
  const targetEffects = effectsAfterEnding(
    settledPrepared.targetFacts.activeEffects,
    outcomeMaintenance?.removed ?? [],
    occurredAt
  )
  const outcome = planNativeActionTargetOutcome({
    prepared: settledPrepared,
    testEvidence: [execution.d20, execution.nestedD20],
    occurrenceId,
    commandId: command.commandId,
    sourceCommandId: command.commandId,
    occurredAt,
    userId: initial.expectedUserId,
    effects: preparedEffects,
    applications,
    held: targetHeld,
    grantTriggers,
    damagerActorId: prepared.actor.id,
    dispositions,
    currentEffects: targetEffects,
    recurringEffectId,
    maintainedState,
    // A reaction effect the answered attack uses up (`ON_ATTACKED`: a bonus against that one attack)
    // applied to its roll alone, so it is never kept.
    reactionEffect:
      reactionUse &&
      !(
        prepared.makesAttackRoll &&
        endSubscriptions(reactionUse.applied.pendingEffect).some((s) => s.event === 'ATTACKED')
      )
        ? reactionUse.applied.reactionEffect
        : null,
    grants: gateImmunityGrant ? [gateImmunityGrant] : [],
    formCreature: null,
    targetSpends: reactionUse !== null || targetReactorSpend,
    charge: resistance?.charge ?? null,
    reactionEconomy: reactionUse?.economy ?? spentTargetEconomy,
    mechanics: {
      sourceReleases: [...sourceReleases, ...hitEnded.sourceReleases],
      targetReleases: reactionEnded?.sourceReleases,
      damageReleases: actionEnded?.releases,
      releaseTargetItemInstanceId: preparedEffects.releasedItemInstanceId,
      degradeTargetItem: preparedEffects.degradedItem,
      degradeSourceItem: preparedEffects.sourceDegradedItem
    }
  })
  const { mechanics, damageEnded } = outcome
  // The attack's outcome is known now: a later slot's "earlier attacks hit" predicate reads it.
  const hit = prepared.makesAttackRoll
    ? execution.d20?.resultPath === 'ON_HIT' || execution.d20?.resultPath === 'ON_CRIT'
    : null
  const settledAttackAction = attackAction && settleEncounterAttackActionHit(attackAction, hit)
  const settledDelegation = delegation && {
    ...delegation,
    attackAction: settleEncounterAttackActionHit(delegation.attackAction, hit)
  }
  const settlement = planNativeLiveEncounterSettlement({
    occurredAt,
    prepared: settledPrepared,
    outcome,
    targetEffects,
    maintainedState,
    actionEconomy,
    actionEconomyOverridden: overridesActionEconomy(ruleOverrides),
    attackAction: settledAttackAction,
    delegation: settledDelegation,
    maintenance: outcomeMaintenance,
    activeEffectsByActorId
  })
  const actionRange = rangeDtoSchema.safeParse(prepared.targetPolicy.range)
  // A melee hit sets off the zones its target holds around itself against the attacker (D153).
  const attackerInProjection = settlement.projectedTargets.get(prepared.actor.id)
  const retaliation =
    sceneContext &&
    attackerInProjection &&
    isMeleeRetaliationHit({
      gameSystemId: state.gameSystemId,
      prepared,
      resultPath: execution.d20?.resultPath
    })
      ? await planNativeLiveMeleeRetaliation({
          state,
          attackerToken: sceneContext.sourceToken,
          hitToken: sceneContext.targetToken,
          effects: await readNativeLiveSpatialEffects({
            encounterId: state.id,
            sceneId: sceneContext.sceneId,
            sceneVersion: sceneContext.sceneVersion,
            capture
          }),
          initialActors: actors,
          attacker: attackerInProjection,
          occurrenceId,
          sourceCommandId: command.commandId,
          occurredAt,
          userId: initial.expectedUserId,
          runtime: executionOptions.runtime,
          random: executionOptions.random ?? nextRollInt
        })
      : null
  const retaliatedSettlement = retaliation
    ? {
        ...settlement,
        actors: settlement.actors.map((actor) =>
          actor.id === prepared.actor.id ? retaliation.projectedAttacker.actor : actor
        ),
        projectedTargets: new Map(settlement.projectedTargets).set(
          prepared.actor.id,
          retaliation.projectedAttacker
        )
      }
    : settlement
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const damage = [
    {
      targetActorId: prepared.target.id,
      applications: mechanics.mechanics.receiptApplications,
      sourceLabel: encounterActionSourceLabel(prepared.source)
    },
    ...(retaliation?.damage ?? [])
  ]
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId,
    parentOccurrenceId: occurrenceId,
    parentCommandFingerprint: fingerprint,
    applications: nativeConcentrationDamageApplications(damage, true),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage, true),
    occurredAt,
    settlement: retaliatedSettlement,
    capture,
    runtime: executionOptions.runtime,
    random: executionOptions.random,
    repeatSaves: { damagerActorId: command.actorId }
  })
  const nextFacts = buildEncounterActorRuleFacts({ actors: concentration.actors })
  const nextRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({
      gameSystemId: state.gameSystemId,
      facts: nextFacts
    }),
    nextFacts,
    { output: prepared.actorRules }
  )
  const storedExecution = buildEncounterActionStoredExecution({
    prepared: settledPrepared,
    execution,
    occurrenceId,
    occurrenceVersion,
    settled: mechanics,
    effects: outcome.effectTransitions,
    maintainedState,
    maintenanceTransition: settlement.maintenanceTransition,
    actionEconomy,
    attackAction: settledAttackAction,
    delegation: settledDelegation,
    resistance,
    reaction: reaction && {
      audit: reaction.audit,
      spent: reactionUse && {
        spellConsumption: reactionUse.prepared.characterActionState?.spellConsumption,
        economy: reactionUse.economy,
        activeEffectTransitions: outcome.reactionEffectTransitions
      }
    },
    targetReactorSpend,
    meleeRetaliation: retaliation?.evidence ?? null,
    grantEffectTransitions: outcome.grantEffectTransitions,
    // A passed ward's record is its immunity among the grant effects; a trigger check has only this.
    passedGate: passedIncomingGate?.origin.kind === 'TRIGGER' ? passedIncomingGate : null
  })
  const cleaving =
    storedExecution.status === 'COMPLETE' && actionRange.success && sceneContext
      ? await planNativeLiveCleaving({
          state: nextState,
          result: storedExecution,
          source: prepared.source,
          action: {
            actionId: command.actionId,
            publishedDefinitionId: execution.published.id,
            publishedDefinitionChecksum: execution.published.checksum,
            attackKind: meleeAttack ? 'MELEE' : 'OTHER',
            range: actionRange.data
          },
          scene: {
            sceneId: sceneContext.sceneId,
            sceneVersion: sceneContext.sceneVersion,
            effectiveGridChecksum: checksumRuleDocument(sceneContext.grid),
            sourceTokenId: sceneContext.sourceToken.tokenId
          },
          occurredAt,
          initialActors: actors,
          projection: concentration,
          loadTarget,
          capture
        })
      : null
  if (cleaving && concentration.pending) {
    concentration.pending = serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
      ...concentration.pending,
      deferredCleaving: cleaving.applicationContext
    })
  }
  return {
    ...preflight(),
    prepared: settledPrepared,
    kind: 'PLANNED' as const,
    execution,
    preparedEffects,
    mechanics,
    settlement,
    concentration,
    nextState,
    nextRules,
    storedExecution,
    turnUses:
      storedExecution.status === 'COMPLETE'
        ? [
            ...encounterActionSpentTurnUses(prepared, storedExecution.evidence),
            ...(grantedUseKey ? [grantedUseKey] : [])
          ]
        : [],
    cleaving,
    spellCheck,
    // What the attacked creature may react with now the attack has hit or missed (D219).
    reactionOffers:
      storedExecution.status === 'COMPLETE' && hit !== null
        ? await castPause.planResolvedOffers(hit)
        : [],
    reactionUse,
    reactionConsumedGrants: reactionEnded?.consumedGrants ?? [],
    spentUseGrants: uses.spentUseGrants,
    windowReactions,
    forcedMovements,
    revisions,
    // The attacker's one-roll grants and the target's effects the damage or action ended, one receipt.
    consumedGrants: [
      ...consumedGrants,
      ...windowSpentEffects(execution, activeEffectsByActorId, [prepared.actor, prepared.target]),
      ...hitEnded.consumedGrants,
      ...uses.endedGrants,
      ...damageEnded.endedEffects,
      ...damageEnded.replacedEffects,
      ...(actionEnded?.endedEffects ?? [])
    ]
  }
}
