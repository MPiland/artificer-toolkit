import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  actionTargetActorId,
  ammunitionCommandChoice,
  castChoiceOptionId,
  resolveEncounterActionInputDtoSchema,
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
  heldGrantedActions,
  nextGrantedActionUseKey,
  parseGrantedActionId
} from '@artificer-toolkit/rules-runtime/encounterGrantedActions'
import { encounterSourceHandHolds } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import {
  encounterActionSourceLabel,
  resolveEncounterActionSource,
  systemAbilityDefinitions,
  type EncounterActionSourceRequest
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { discoverEncounterFeatureActions } from '@artificer-toolkit/rules-runtime/encounterFeatureActionCapabilityDiscoveryRegistry'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { StaleCharacterActionError } from '@artificer-toolkit/rules-runtime/encounterErrors'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { resolveCheckActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  isEncounterBasicActionId,
  readEncounterBasicActionEntries
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import {
  decoyStrikeEffects,
  type EncounterAttackDecoy,
  prepareAttackBehindDecoys
} from '@artificer-toolkit/rules-runtime/encounterAttackDecoys'
import { encounterActionTargetKind } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { encounterSourceImmunityLabel } from '@artificer-toolkit/rules-runtime/encounterSourceImmunity'
import { encounterSpellSchoolImmunity } from '@artificer-toolkit/rules-runtime/encounterSpellSchoolImmunity'
import {
  actionEndedEffects,
  actsAgainstEnemy,
  attackHitEndedEffects,
  targetEndedEffects,
  withOwnedTemporaryHitPoints
} from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import { resolveEncounterSceneGrid } from '@artificer-toolkit/rules-runtime/sceneGridPolicy'
import {
  snapshotCreatureTypeId,
  withFeatureChargeUsed
} from '@artificer-toolkit/rules-runtime/encounterActorState'
import {
  encounterActionSuppressedWarning,
  evaluateEncounterActionRuleWarnings,
  overridesActionEconomy,
  RULE_WARNINGS_MESSAGE
} from '@artificer-toolkit/rules-runtime/encounterActionRuleWarnings'
import {
  encounterConditionFleeSources,
  encounterFleeActionWarnings
} from '@artificer-toolkit/rules-runtime/encounterConditionMechanics'
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
  readNativeLiveHasNotTakenTurn,
  readNativeLiveTurnMovedFeet,
  readNativeLiveTurnUses
} from './nativeTurnUses.js'
import {
  readNativeLiveAttackPerception,
  readNativeLiveSourcesSeen
} from './nativeAttackPerception.js'
import { planNativeLiveContestRolls } from './nativeContest.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import {
  endedByAction,
  planEndEffects,
  planEndEffectsChecks,
  reactionCastEnded
} from './nativeEndEffects.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import {
  holdForForcedMovementDestination,
  settleForcedMovementDestination
} from '@artificer-toolkit/rules-runtime/encounterForcedMovementChoice'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import { replayNativeActionReaction } from '@artificer-toolkit/rules-runtime/encounterActionReaction'
import {
  onHitCandidates,
  onHitResourceConsumption,
  onHitSpellConsumption
} from '@artificer-toolkit/rules-runtime/character/characterOnHitCosts'
import { discoverNativeAttackReaction } from './nativeEncounterAttackReaction.js'
import { createNativeCastPause } from './nativeEncounterCastPause.js'
import { readNativePauseAnswer, settleNativePauseAnswer } from './nativePauseHandlers.js'
import type { NativePauseAnswer } from './nativePauseTypes.js'
import { createNativeCurrentReaction } from './nativePauseReaction.js'
import { advanceNativeIncomingGate, planNativeGatedAction } from './nativeEncounterIncomingGate.js'
import { preparedCastsSpell } from '@artificer-toolkit/rules-runtime/encounterPreparedSpellCast'
import {
  buildEncounterActionPendingSnapshot,
  buildEncounterHeldActionPendingSnapshot
} from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import {
  chosenEncounterAttackRetarget,
  encounterAttackRetargetOffer,
  openEncounterAttackRetargetChoice,
  retargetEncounterAction,
  settleEncounterAttackRetarget,
  type EncounterAttackRetargetCandidate
} from '@artificer-toolkit/rules-runtime/encounterAttackRetarget'
import { withEncounterAppRoll } from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import { endSubscriptions } from '@artificer-toolkit/rules-runtime/events/effectHooks'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { replayNativeActionLegendaryResistance } from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { settleEncounterAttackActionHit } from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  encounterActorEffectiveSize,
  prepareNativeActionEffectsPlan,
  prepareNativeIncomingDamageGrantTriggers
} from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { encounterChosenItemRefusal } from '@artificer-toolkit/rules-runtime/encounterChosenItem'
import { parseRepeatPathActionId } from '@artificer-toolkit/rules-runtime/encounterRepeatPathAction'
import { restoreEncounterActionPending } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterActionCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { authoredCheckOf, planNativeLiveCheckAction } from './nativeCheckAction.js'
import { planNativeLiveConcealmentCheckAction } from './nativeConcealmentCheck.js'
import { planNativeLiveEncounterSettlement } from './nativeEncounterSettlement.js'
import { planNativeLiveEncounterActorsAction } from './nativeEncounterActorsRules.js'
import {
  planNativeLiveEncounterAreaAction,
  planNativeLiveEncounterAreaAnswer,
  planNativeLiveEncounterAreaForcedMovement,
  planNativeLiveEncounterAreaLegendaryResistance,
  planNativeLiveEncounterAreaRemoval
} from './nativeEncounterAreaRules.js'
import { discoverNativeLegendaryResistance } from './nativeAreaRevalidation.js'
import { type ForcedMovementPick } from './nativeAreaPreparation.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import {
  checkActionSource,
  nativeLiveRelationshipFacts,
  refuseActionOutsideItsWindow,
  interpretForcedMovements,
  refuseUnmetBasicActionRestrictions,
  refuseUnmetItemActionRequirements
} from './nativeEncounterActionInputs.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import {
  nativeConcentrationDamageApplications,
  nativeConcentrationDamageSourceLabels
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  encounterRunActorStateSchema,
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import {
  evaluateInstalledEncounterActors,
  isInstalledMeleeAttackTrigger
} from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

const TARGET_NOT_PERMITTED_MESSAGE = 'The selected action does not permit this target.'

/** Computes the action in the DO; the room commits this plan in its own transaction. */
export async function planNativeLiveEncounterAction(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  commandInput:
    | ResolveEncounterActionInputDto
    | ResolveRuleOccurrenceInputDto
    | RemoveAreaTargetInputDto,
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
  const request = removalCommand
    ? { kind: 'AREA_REMOVAL' as const, removal: removalCommand }
    : responseCommand
      ? { kind: 'ACTION_RESPONSE' as const, response: responseCommand }
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
    admission.kind !== 'AREA_REMOVAL'
  )
    throw new Error('Encounter command is unavailable.')
  if (admission.kind !== 'AREA_REMOVAL' && admission.result)
    return { kind: 'REPLAY' as const, result: admission.result }
  if (admission.kind !== initial.request.kind) throw new Error('Encounter command is unavailable.')
  const snapshot = admission.kind === 'ACTION_RESPONSE' ? admission.snapshot : null
  const areaSnapshot = admission.kind === 'ACTION_COMMAND' ? null : admission.areaSnapshot
  let areaDecision: Extract<
    ResolveRuleOccurrenceInputDto['resolution'],
    { kind: 'AREA_LEGENDARY_RESISTANCE' }
  > | null = null
  let areaLanding: Extract<
    ResolveRuleOccurrenceInputDto['resolution'],
    { kind: 'FORCED_MOVEMENT' }
  > | null = null
  let pauseAnswer: NativePauseAnswer | null = null
  if (responseCommand) {
    if (!snapshot || snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
      throw new Error('The pending action snapshot is unavailable.')
    // An app roll settles with the faces Convex recorded for it, never client-supplied values.
    const resolution = withEncounterAppRoll(
      responseCommand.resolution,
      admission.kind === 'ACTION_RESPONSE' ? admission.appRoll : null
    )
    if (resolution.kind === 'AREA_LEGENDARY_RESISTANCE') areaDecision = resolution
    // An area's push pick is the area's own, never its pushed creature's save (D157).
    else if (areaSnapshot && resolution.kind === 'FORCED_MOVEMENT') areaLanding = resolution
    else {
      const decision =
        resolution.kind === 'DECLINE' || resolution.kind === 'OPTION' ? resolution : null
      pauseAnswer = readNativePauseAnswer({
        pause: snapshot.applicationContext.pause,
        snapshot,
        resolution,
        decision,
        dice:
          (resolution.kind === 'ENTER_DICE' || resolution.kind === 'SYSTEM_ROLL') &&
          snapshot.request.requestId === resolution.requestId
            ? resolution
            : null,
        evidence:
          resolution.kind === 'ENTER_DICE' ||
          resolution.kind === 'ENTER_INTEGER' ||
          resolution.kind === 'SYSTEM_ROLL'
            ? resolution
            : null
      })
    }
    const context = snapshot.applicationContext
    const root = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
    if (
      // An area save is sealed under its own occurrence id; the answer names the area's.
      (areaSnapshot ?? snapshot).occurrenceId !== responseCommand.occurrenceId ||
      context.commandFingerprint !== admission.fingerprint ||
      checksumCanonicalJson(root) !== admission.fingerprint ||
      (pauseAnswer?.kind === 'EVIDENCE' &&
        (snapshot.request.requestId !== pauseAnswer.answer.requestId ||
          (context.d20Policy === null && pauseAnswer.answer.kind === 'ENTER_DICE') ||
          (context.d20Policy !== null && pauseAnswer.answer.kind === 'ENTER_INTEGER')))
    )
      throw new Error('The pending action evidence is invalid.')
    // Contests (Disarm) and deferred Cleaving have their own planners; their evidence never
    // routes here.
    if (context.contest || snapshot.deferredCleaving || root.optionalCombatIntent != null)
      throw new Error('The pending action is not an ordinary action.')
  }
  const evidenceResolution = pauseAnswer?.kind === 'EVIDENCE' ? pauseAnswer.answer : null
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
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: TARGET_NOT_PERMITTED_MESSAGE
    })
  if (command.target.kind !== 'ACTOR') {
    const target = command.target
    // An answer to a counter offered before the cast did anything replays the cast itself.
    const castResume =
      castAnswer && snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION' && responseCommand
        ? {
            response: responseCommand,
            answer: castAnswer,
            initiatorUserId: snapshot.applicationContext.initiatorUserId,
            currentnessChecksum: snapshot.applicationContext.currentnessChecksum,
            failedCounters: snapshot.applicationContext.failedCounters ?? []
          }
        : undefined
    const areaInput = {
      castResume,
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
      if (!evidenceResolution) throw new Error('The pending area action is unavailable.')
      return {
        ...(await planNativeLiveEncounterAreaAnswer({
          ...areaInput,
          response: responseCommand,
          resolution: evidenceResolution,
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
      dependencies,
      revisions
    }
  }
  const targetActorId = actionTargetActorId(command.target)
  const choiceOptionId = castChoiceOptionId(command.target)
  const selectedActors = actors.filter(
    (actor) => actor.id === command.actorId || actor.id === targetActorId
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
          sceneContext: command.sceneContext
        }
      })
    : null
  if (capturedScene && capturedScene.kind !== 'ACTION_SCENE')
    throw new Error('Action Scene context is unavailable.')
  const sceneInputs = capturedScene?.context ?? null
  const sceneContext = sceneInputs
    ? {
        sceneId: sceneInputs.sceneId,
        sceneVersion: sceneInputs.sceneVersion,
        sourceToken: sceneInputs.sourceToken,
        targetToken: sceneInputs.targetToken,
        grid: resolveEncounterSceneGrid({
          encounter: state,
          sceneGrid: sceneInputs.sceneGrid
        })
      }
    : null
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
        // A granted action resolves against the holder's effects and spent uses as they stand now (D160).
        granted: parseGrantedActionId(input.actionId)
          ? {
              heldEffects: activeEffectsByActorId.get(input.actor.id) ?? [],
              spentKeys: await readNativeLiveTurnUses(capture, input.actor.id)
            }
          : undefined,
        // A repeat offer resolves against the effects every holder keeps now (D166).
        repeat: parseRepeatPathActionId(input.actor.id, input.actionId)
          ? { effectsByHolder: activeEffectsByActorId }
          : undefined,
        system,
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
  // The attack is prepared again against a target's facts once a reaction has changed them.
  const prepareAttackAs = (
    targets: typeof movementTargets,
    attackDecoy: EncounterAttackDecoy | null
  ) =>
    prepareEncounterActionMechanics({
      attackDecoy,
      state,
      actor: actors.find((actor) => actor.id === command.actorId)!,
      target: actors.find((actor) => actor.id === targetActorId)!,
      actors,
      actionId: command.actionId,
      choiceOptionId,
      ammunition: ammunitionCommandChoice(command.target),
      wieldConflictAcceptance: {
        kind: 'PROMPTED',
        accepted: command.acceptedWieldConflict,
        handHolds: encounterSourceHandHolds(activeEffectsByActorId, command.actorId)
      },
      overridable: true,
      movementTargets: targets,
      sceneContext,
      loadAttackPerception: ({ sourceFacts, targetFacts, roller }) =>
        readNativeLiveAttackPerception({
          state,
          system,
          attacker: sourceFacts,
          target: targetFacts,
          roller,
          sceneContext,
          capture
        }),
      loadSourcesSeen: ({ holder, sourceActorIds }) =>
        readNativeLiveSourcesSeen({
          state,
          system,
          holder,
          sourceActorIds,
          actors,
          loadTarget: async (actor) => targets.get(actor.id) ?? loadTarget(actor),
          sceneContext,
          capture
        }),
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
      loadMoveToward: ({ sourceFacts, targetFacts }) =>
        readNativeLiveMoveToward({
          attacker: sourceFacts,
          target: targetFacts,
          sceneContext,
          capture
        }),
      loadTurnUses: () => readNativeLiveTurnUses(capture, command.actorId),
      loadTargetHasNotTakenTurn: ({ targetFacts }) =>
        readNativeLiveHasNotTakenTurn(capture, targetFacts.actor.id),
      ...actionSources
    }).catch(refuseStaleCharacterAction)
  const occurrenceId = responseCommand ? responseCommand.occurrenceId : crypto.randomUUID()
  const occurrenceVersion = responseCommand ? responseCommand.expectedOccurrenceVersion + 1 : 0
  // An attack that a decoy of the target intercepts is rolled against the decoy's armor class.
  const prepared = await prepareAttackBehindDecoys({
    occurrenceId,
    effects: activeEffectsByActorId.get(targetActorId) ?? [],
    system,
    prepare: (attackDecoy) => prepareAttackAs(movementTargets, attackDecoy)
  })
  // A spell that takes a list of creatures is not aimed at one.
  if (encounterActionTargetKind(prepared.targetPolicy) === 'ACTORS')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: TARGET_NOT_PERMITTED_MESSAGE
    })
  refuseActionOutsideItsWindow(prepared)
  // A target immune to this source's use of the action (D156) is refused outright.
  const immunityLabel = encounterSourceImmunityLabel({
    source: prepared.source,
    holderEffects: activeEffectsByActorId.get(prepared.target.id) ?? []
  })
  if (immunityLabel !== null)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: `Immune to ${immunityLabel}`
    })
  const actorTarget = movementTargets.get(prepared.actor.id)
  if (!actorTarget) throw new Error('Encounter rules input binding mismatch.')
  if (
    encounterSpellSchoolImmunity({
      source: prepared.source,
      sourceFacts: actorTarget,
      target: prepared.targetFacts
    })
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: 'Immune to spells of this school'
    })
  await refuseUnmetBasicActionRestrictions(
    { source: prepared.source, acceptedWieldConflict: command.acceptedWieldConflict },
    {
      target: actorTarget,
      gameSystemId: state.gameSystemId,
      definitions,
      speedDefinitions: system.speeds,
      runEffectsByActorId: activeEffectsByActorId,
      readTurnMovedFeet: () => readNativeLiveTurnMovedFeet(capture, prepared.actor.id)
    }
  )
  refuseUnmetItemActionRequirements(prepared, state)
  // A repeat runs against the creature that holds the offering effect, on the item that cast chose.
  if (
    prepared.source.kind === 'REPEAT_PATH' &&
    prepared.target.id !== prepared.source.capability.holderActorId
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: TARGET_NOT_PERMITTED_MESSAGE
    })
  // A Character action's item choice is known before it rolls; a Creature's plan follows its roll.
  const chosenItemInstanceId =
    prepared.source.kind === 'REPEAT_PATH'
      ? prepared.source.boundItemInstanceId
      : command.target.kind === 'ACTOR'
        ? command.target.boundItemInstanceId
        : undefined
  const targetMovement = movementTargets.get(prepared.target.id)
  const chosenItemRefusal =
    prepared.source.kind === 'CHARACTER_ACTION' && targetMovement
      ? encounterChosenItemRefusal({
          plan: prepared.source.entry.compilation.activeEffectPlan?.chosenItem,
          target: targetMovement,
          itemInstanceId: chosenItemInstanceId
        })
      : null
  if (chosenItemRefusal !== null)
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: chosenItemRefusal
    })
  // An optional-combat intent routes to the Disarm planner.
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  const weaponAttackHolds = heldGrantedActions(
    activeEffectsByActorId.get(prepared.actor.id) ?? []
  ).filter(({ offer }) => offer.weaponAttack)
  const turnUsesSpent =
    weaponAttackHolds.length > 0 ? await readNativeLiveTurnUses(capture, prepared.actor.id) : []
  const weaponAttackUseKey =
    weaponAttackHolds
      .map((held) => nextGrantedActionUseKey(held, turnUsesSpent))
      .find((key): key is string => typeof key === 'string') ?? null
  const { activationCode, economy, suppressed, attackAction, grantedUseKey } =
    await evaluateNativeLiveActionEconomy({
      prepared,
      state,
      actionId: command.actionId,
      sourceTarget: movementTargets.get(prepared.actor.id),
      targetIds: [prepared.target.id],
      targetSize: targetMovement ? encounterActorEffectiveSize(targetMovement) : null,
      capture,
      weaponAttackOffer: weaponAttackUseKey ? { useKey: weaponAttackUseKey } : null
    })
  const mechanicFacts =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts
      : prepared.source.capability.mechanicFacts
  const heldOnTarget = activeEffectsByActorId.get(prepared.target.id) ?? []
  const endPlan = planEndEffects(mechanicFacts.outcomes, heldOnTarget, command.target, prepared)
  const fleeWarnings = encounterFleeActionWarnings({
    sourceActorIds: encounterConditionFleeSources(actorTarget),
    activationCode,
    dash: mechanicFacts.outcomes.some(
      (outcome) =>
        outcome.kind === 'EFFECT' &&
        outcome.effectKind === 'MOVEMENT_RULE' &&
        outcome.ruleKind === 'ADD_SPEED_TO_MOVEMENT'
    )
  })
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: [
      ...prepared.ruleWarnings,
      ...fleeWarnings,
      ...endPlan.warnings,
      ...(suppressed ? [encounterActionSuppressedWarning(activationCode)] : [])
    ],
    target: {
      actor: prepared.actor,
      target: prepared.target,
      targetPolicy: prepared.targetPolicy,
      makesAttackRoll: prepared.makesAttackRoll,
      sceneContext
    },
    targetCreatureTypeId: snapshotCreatureTypeId(prepared.target),
    actorSize: encounterActorEffectiveSize(actorTarget),
    targetSize: targetMovement ? encounterActorEffectiveSize(targetMovement) : null,
    targetDefeated: isEncounterActorDefeated(
      prepared.target,
      deadCharacterIdsOfTargets(movementTargets.values())
    ),
    targetPreconditions: {
      declared: prepared.adapter.outcomeTargetPreconditions({
        effectKinds: mechanicFacts.outcomes.flatMap((o) =>
          o.kind === 'EFFECT' ? [o.effectKind] : []
        )
      }),
      target: targetMovement
    },
    actionEconomy: economy,
    activationCode,
    acknowledged: command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: TARGET_NOT_PERMITTED_MESSAGE
    })
  // The same user-safe rejection the Convex fallback raises, so the room forwards it unchanged.
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
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
          settlement: { kind: 'ACTION', prepared },
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
      overrides: ruleWarnings.overrides,
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
    maintenance,
    sceneContext
  })
  if (
    snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    snapshot.applicationContext.currentnessChecksum !== currentnessChecksum &&
    // The retargeted action's facts are the new creature's, not the ones the offer was made against.
    !retargetOption
  )
    throw new Error('The pending action source or target changed.')
  const resume =
    responseCommand &&
    evidenceResolution &&
    snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
      ? {
          pending: restoreEncounterActionPending(snapshot),
          resolution: evidenceResolution
        }
      : null
  const actionSource = {
    runtime: executionOptions.runtime,
    random: executionOptions.random,
    adapter: prepared.adapter,
    plan: prepared.plan,
    occurrenceId,
    autoRoll: {
      SOURCE: requireAutoRoll(prepared.actor.id),
      TARGET: requireAutoRoll(prepared.target.id)
    },
    binding: prepared.binding,
    afterTest: async () => undefined
  }
  const discoverResistance = discoverNativeLegendaryResistance({ state, capture }, prepared)
  const targetStateChecksum = checksumRuleDocument(prepared.target)
  /** The creature's Legendary Resistance and pool as they are now; a decision or its record needs both. */
  const currentResistance = async () => {
    const candidate = await discoverResistance()
    const currentFeatureResource =
      candidate &&
      findEncounterFeatureResource(
        prepared.actorRules,
        candidate.targetActorId,
        candidate.ownerFeatureId
      )
    if (!candidate || !currentFeatureResource)
      throw new Error('Legendary Resistance evidence is stale.')
    return { candidate, currentFeatureResource, targetStateChecksum }
  }
  // An attack, or a harmful spell cast at an enemy, aimed at a warded creature (Sanctuary) is lost unless
  // its attacker passes the ward's save first. An area that merely catches the creature is not aimed at it.
  const gateOwed =
    prepared.actor.id !== prepared.target.id && (makesAttackRoll || (castsSpell && againstEnemy))
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
          holderActorId: prepared.target.id,
          holderEffects: activeEffectsByActorId.get(prepared.target.id) ?? [],
          holderGrantFold:
            movementTargets.get(prepared.target.id)?.effectiveRulePolicyOutput?.grantFold ?? null,
          attacker: actorTarget,
          attackerCreatureTypeId: snapshotCreatureTypeId(prepared.actor),
          owner: async (ownerActorId) => {
            const owner = actors.find((actor) => actor.id === ownerActorId)
            return owner ? (movementTargets.get(owner.id) ?? (await loadTarget(owner))) : null
          },
          autoRoll: requireAutoRoll(prepared.actor.id),
          passedEffectId:
            snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
              ? snapshot.applicationContext.passedIncomingGate
              : undefined,
          answer: gateAnswer
        })
      : { kind: 'NONE' as const, passed: null }
  /** The ward whose save the attacker has passed, carried by every later pause of this action. */
  const passedIncomingGate =
    gate.kind === 'PASSED'
      ? gate.effectId
      : snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
        ? snapshot.applicationContext.passedIncomingGate
        : undefined
  const occurredAt = new Date().toISOString()
  /** What every plan of this action carries; read after the captures it made, so its revisions are current. */
  const preflight = () => ({
    command,
    response: responseCommand,
    // A response continues the original initiator's action; the responder is authorized in Convex.
    initiatorUserId:
      snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
        ? snapshot.applicationContext.initiatorUserId
        : initial.expectedUserId,
    fingerprint,
    occurrenceId,
    occurrenceVersion,
    occurredAt,
    prepared,
    actionEconomy,
    attackAction,
    ruleOverrides: ruleWarnings.overrides,
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
  if (gate.kind === 'FAILED' && !declinedRetarget && command.target.kind === 'ACTOR') {
    // The attacker may turn the lost action on another creature before it is lost.
    const bindings = command.sceneContext ? await capture({ kind: 'ACTOR_TOKEN_BINDINGS' }) : null
    if (bindings && bindings.kind !== 'ACTOR_TOKEN_BINDINGS')
      throw new Error('Retarget bindings are unavailable.')
    // Only creatures the attacker's own list shows are offered: a hidden creature's id never leaves.
    const seen = await capture({ kind: 'SEEN_ACTORS' })
    if (seen.kind !== 'SEEN_ACTORS') throw new Error('Retarget sight is unavailable.')
    const seenIds = new Set(seen.actorIds)
    const candidates = actors.flatMap((actor): EncounterAttackRetargetCandidate[] => {
      if (actor.id === prepared.actor.id || actor.id === prepared.target.id) return []
      if (!seenIds.has(actor.id)) return []
      if (!bindings) return [{ actorId: actor.id, tokenId: null }]
      const binding = bindings.bindings.find((entry) => entry.actorId === actor.id)
      return binding ? [{ actorId: actor.id, tokenId: binding.tokenId }] : []
    })
    if (candidates.length)
      return {
        ...preflight(),
        kind: 'RETARGET_PENDING' as const,
        continuation: await openEncounterAttackRetargetChoice({
          runtime: executionOptions.runtime,
          occurrenceId,
          gameSystemId: state.gameSystemId,
          optionCount: candidates.length
        }),
        rollerActorId: prepared.actor.id,
        pause: {
          kind: 'ATTACK_RETARGET' as const,
          payload: encounterAttackRetargetOffer(gate.gate, candidates)
        }
      }
  }
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
        ruleOverrides: ruleWarnings.overrides,
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
    random: executionOptions.random,
    state,
    system,
    actors,
    activeEffectsByActorId,
    loadTarget,
    capture,
    requireAutoRoll,
    command,
    prepared,
    movementTargets,
    // A single-target cast has no chosen list to react to being chosen (T4 covers a chosen list).
    chosenActorIds: null,
    reactionSources: actionSources,
    // Range is read from the Scene, so a cast made without one offers no reaction.
    readScene: command.sceneContext
      ? async () => {
          const castScene = await capture({
            kind: 'ACTION_AREA_SCENE',
            command: {
              actorId: command.actorId,
              sceneId: command.sceneContext!.sceneId,
              expectedSceneVersion: command.sceneContext!.expectedSceneVersion
            }
          })
          if (castScene.kind !== 'ACTION_AREA_SCENE')
            throw new Error('Action Scene context is unavailable.')
          return castScene.context
        }
      : null,
    occurrenceId,
    occurredAt,
    userId: initial.expectedUserId,
    answer: castAnswer,
    // A gate pause held the action before any counter was offered, so its answer replays them all.
    resumed: snapshot !== null && !gateAnswer,
    // The counters that failed against this cast so far; its terminal commit spends them (D127).
    failedCounters:
      snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
        ? (snapshot.applicationContext.failedCounters ?? [])
        : []
  })
  const cast = await castPause.advance({
    actionEconomy,
    ruleOverrides: ruleWarnings.overrides,
    occurrenceVersion
  })
  if (cast.kind !== 'NONE') return { ...preflight(), ...cast }
  const failedCounters = cast.failedCounters
  const discoverReaction = discoverNativeAttackReaction({
    state,
    system,
    spells: await readNativeLiveSpellPins(capture),
    attack: prepared,
    reactionSpentActorIds: failedCounters.map(({ reaction }) => reaction.reactorActorId),
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
    capture
  })
  const currentReaction = createNativeCurrentReaction({
    discoverReaction,
    runtime: executionOptions.runtime,
    occurrenceId,
    commandId: command.commandId,
    occurredAt,
    activeEffectsByActorId,
    // The answered attack keeps the decoy it was rolled against.
    prepareAttack: (reactedTargets: typeof movementTargets) =>
      prepareAttackAs(reactedTargets, prepared.attackDecoy),
    loadTarget,
    targetStateChecksum,
    binding: prepared.binding
  })
  // The optional on-hit riders the attacker could pay for now: a Character's slots and resource pools
  // pay them. An action that already spends a slot offers no slot rider, and one that already spends a
  // pool offers no pool rider.
  const attackPlan = prepared.plan
  const onHitNow =
    prepared.source.kind === 'CHARACTER_ACTION' && attackPlan.kind === 'TEST_OUTCOME'
      ? onHitCandidates({
          riders: prepared.adapter
            .optionalOnHitRiders({ compilerSource: attackPlan.compilerSource })
            .filter(({ cost }) =>
              cost.kind === 'SPELL_SLOT'
                ? !prepared.characterActionState?.spellConsumption
                : !prepared.characterActionState?.resourceConsumption
            ),
          spellSlots: prepared.source.effectivePolicyOutput.spellSlots,
          resources: prepared.source.effectivePolicyOutput.resources
        })
      : []
  const settled = await settleNativePauseAnswer(pauseAnswer, {
    actionSource,
    currentResistance,
    currentReaction,
    onHitNow
  })
  const execution =
    settled?.execution ??
    (await advanceNativeActionGraphs({
      ...actionSource,
      attackSight: prepared.attackSight,
      onHitCandidates: onHitNow,
      ...(resume ? { resume } : {}),
      legendaryResistance: { discover: discoverResistance, targetStateChecksum },
      reaction: {
        discover: async (critical) =>
          (await discoverReaction({ critical })).map(({ candidate }) => candidate),
        targetStateChecksum
      }
    }))
  const retained = resume?.pending.twoPhase ?? forcedMovementAnswer?.outcomePhase
  const resistance =
    settled?.resistance ??
    (execution.kind !== 'PENDING' && retained?.phase === 'OUTCOME' && retained.legendaryResistance
      ? await replayNativeActionLegendaryResistance({
          ...actionSource,
          outcome: retained,
          ...(await currentResistance())
        })
      : null)
  const heldReaction = settled?.heldReaction ?? null
  const retainedReaction =
    execution.kind !== 'PENDING' && !settled?.reaction
      ? (heldReaction ?? (retained?.phase === 'OUTCOME' && retained.reaction ? retained : null))
      : null
  const replayedReaction =
    settled?.heldReactionNow ??
    (retainedReaction
      ? await currentReaction(
          retainedReaction.reaction!.selection === 'USE',
          retainedReaction.reaction!.reaction.actionId,
          retainedReaction.testExecution.outputs.resultPath === 'ON_CRIT'
        )
      : null)
  const reaction =
    execution.kind === 'PENDING'
      ? null
      : (settled?.reaction ??
        (retainedReaction && replayedReaction
          ? {
              ...replayedReaction,
              audit: await replayNativeActionReaction({
                ...actionSource,
                outcome: retainedReaction,
                ...replayedReaction
              })
            }
          : null))
  if (execution.kind === 'PENDING')
    return { ...preflight(), kind: 'PENDING' as const, execution, failedCounters }
  // What an on-hit rider the attacker chose is paid with is spent with the outcome; the currentness
  // fence above was taken on the unspent attack.
  const chosenOnHit =
    settled?.onHit?.audit.option ??
    (retained?.phase === 'OUTCOME' ? (retained.onHit?.option ?? null) : null)
  const onHitSpend = (() => {
    if (!chosenOnHit || prepared.source.kind !== 'CHARACTER_ACTION') return null
    const { source } = prepared
    if (chosenOnHit.kind === 'SPELL_SLOT')
      return {
        spellConsumption: onHitSpellConsumption({
          spellSlots: source.effectivePolicyOutput.spellSlots,
          slotLevel: chosenOnHit.slotLevel,
          characterId: source.characterId,
          expectedStreamVersion: source.characterStreamVersion
        })
      }
    const { characterFacts } = prepared.sourceFacts
    if (!characterFacts)
      throw new StaleCharacterActionError('The selected Character action source is stale.')
    return {
      resourceConsumption: onHitResourceConsumption({
        resources: source.effectivePolicyOutput.resources,
        resourceUsage: characterFacts.sheetState.resourceUsage,
        poolId: chosenOnHit.poolId,
        cost: chosenOnHit.cost,
        characterId: source.characterId,
        expectedStreamVersion: source.characterStreamVersion,
        automationMode: state.automationMode
      })
    }
  })()
  const settledPrepared =
    onHitSpend && prepared.characterActionState
      ? {
          ...prepared,
          characterActionState: { ...prepared.characterActionState, ...onHitSpend }
        }
      : prepared
  const preparedEffects = prepareNativeActionEffectsPlan({
    prepared,
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
  const reactionUse =
    reaction?.audit.selection === 'USE' && reaction.applied
      ? {
          applied: reaction.applied,
          prepared: reaction.found.prepared,
          economy: reaction.found.economy.consumption
        }
      : null
  // A reaction that casts a spell (Shield) ends the reactor's own cast-ended effects too, with the
  // reactor's one batch: the hit target's, since the reaction answers an attack on its caster.
  const reactionEnded = reactionCastEnded(
    reactionUse,
    activeEffectsByActorId,
    consumedGrants,
    dispositions
  )
  const failedSpends = await castPause.planFailedCounters(failedCounters)
  // A creature that failed to counter the cast has spent its reaction, so it answers nothing else; the
  // cast's target pays that reaction in its own mechanics, beside the reaction a Shield-like answer uses.
  const failedTarget = failedSpends.find(
    ({ receipt }) => receipt.reaction.reactorActorId === prepared.target.id
  )
  const failedTargetEconomy = failedTarget?.economy ?? null
  const targetFailedCounterSpend = Boolean(failedTarget?.spellConsumption)
  const interpretedMovements = interpretForcedMovements(prepared, {
    execution: execution.execution,
    occurrenceId,
    published: execution.published,
    targetActorId: prepared.target.id
  })
  // A movement with two or more legal squares waits for its source to pick one (D157).
  if (interpretedMovements.some(({ collision }) => collision))
    throw new Error('A forced-movement collision is resolved only in an area action.')
  const { owed: owedPick } = await executionOptions.forcedMovementPick({
    encounterId: state.id,
    sourceActorId: prepared.actor.id,
    movements: interpretedMovements
  })
  if (owedPick && !forcedMovementAnswer)
    return {
      ...preflight(),
      kind: 'PENDING' as const,
      execution: await holdForForcedMovementDestination({
        runtime: executionOptions.runtime,
        occurrenceId,
        completion: {
          execution: execution.execution,
          published: execution.published,
          initialPublished: execution.initialPublished,
          initialFactsChecksum: execution.initialFactsChecksum,
          phaseReceipts: execution.phaseReceipts ?? null,
          d20: execution.d20,
          nestedD20: execution.nestedD20
        },
        outcomePhase: execution.outcomePhase,
        targetActorId: owedPick.targetActorId,
        positions: owedPick.positions
      }),
      failedCounters
    }
  if (forcedMovementAnswer && !owedPick)
    throw new Error('The forced-movement destination is no longer owed.')
  const chosenPosition =
    forcedMovementAnswer && owedPick
      ? await settleForcedMovementDestination({
          runtime: executionOptions.runtime,
          continuation: forcedMovementAnswer.continuation,
          offer: forcedMovementAnswer.offer,
          position: forcedMovementAnswer.position
        })
      : null
  const forcedMovements = interpretedMovements.map((movement) =>
    movement.targetActorId === owedPick?.targetActorId
      ? { ...movement, position: chosenPosition }
      : movement
  )
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
  // A hit on a decoy destroys it: the last one ends the effect, any other spends a use of it.
  const decoyStrike = decoyStrikeEffects(prepared.attackDecoy, execution.d20?.resultPath)
  // An attack roll against the target uses up what it consumes, and damage it takes ends the effects
  // that end on damage; the conditions only they held are released in the target's own batch.
  const targetHeld = heldOnTarget.filter(
    ({ id }) => !(reactionEnded?.consumedGrants ?? []).some((ended) => ended.id === id)
  )
  const damageEnded = targetEndedEffects({
    holderActorId: prepared.target.id,
    held: targetHeld,
    attacked: prepared.makesAttackRoll,
    testEvidence: [execution.d20, execution.nestedD20],
    turnActorId: prepared.state.currentActorId,
    applications,
    damagerActorId: prepared.actor.id,
    dispositions,
    grantTriggers: prepareNativeIncomingDamageGrantTriggers({
      encounter: settledPrepared.state,
      holder: settledPrepared.target,
      held: settledPrepared.targetFacts.activeEffects,
      occurrenceId,
      commandId: command.commandId,
      activeEffectsByActorId
    })
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
  const planned = planNativeEncounterActionMechanics(
    {
      prepared: settledPrepared,
      encounterId: state.id,
      expectedEncounterVersion: state.version,
      occurrenceId,
      sourceCommandId: command.commandId,
      commandId: command.commandId,
      occurredAt,
      applications,
      sourceReleases: [...sourceReleases, ...hitEnded.sourceReleases],
      targetReleases: reactionEnded?.sourceReleases,
      damageReleases: [...damageEnded.releases, ...(actionEnded?.releases ?? [])],
      releaseTargetItemInstanceId: preparedEffects.releasedItemInstanceId,
      degradeTargetItem: preparedEffects.degradedItem && {
        itemInstanceId: preparedEffects.degradedItem.itemInstanceId,
        afterPenalty: preparedEffects.degradedItem.afterPenalty,
        destroyed: preparedEffects.degradedItem.destroyed
      },
      degradeSourceItem: preparedEffects.sourceDegradedItem && {
        itemInstanceId: preparedEffects.sourceDegradedItem.itemInstanceId,
        afterPenalty: preparedEffects.sourceDegradedItem.afterPenalty,
        destroyed: preparedEffects.sourceDegradedItem.destroyed
      },
      forceTargetVersionAdvance:
        prepared.target.kind === 'CHARACTER' &&
        (preparedEffects.stateEffect !== null ||
          preparedEffects.recurringEffect !== null ||
          preparedEffects.riderEffects.some(Boolean) ||
          reactionUse !== null ||
          targetFailedCounterSpend ||
          damageEnded.grants.length > 0 ||
          gateImmunityGrant !== null)
    },
    initial.expectedUserId
  )
  // A Legendary Resistance the target used spends its own charge, and a reaction its allowance,
  // with the outcome.
  const charge = resistance?.charge
  const chargedTarget = (actor: EncounterRunActorState) => {
    const charged = charge
      ? encounterRunActorStateSchema.parse({
          ...actor,
          resources: withFeatureChargeUsed(actor, charge.ownerFeatureId, charge.afterUsed)
        })
      : actor
    const spentReaction = reactionUse?.economy ?? failedTargetEconomy
    return spentReaction
      ? consumeEncounterActionEconomy({
          actor: charged,
          consumption: spentReaction,
          overridden: false
        })
      : charged
  }
  const mechanics = {
    ...planned,
    mechanics: {
      ...planned.mechanics,
      updatedActor: chargedTarget(planned.mechanics.updatedActor)
    },
    settledSource:
      planned.settledSource.id === prepared.target.id
        ? chargedTarget(planned.settledSource)
        : planned.settledSource
  }
  // The attack's outcome is known now: a later slot's "earlier attacks hit" predicate reads it.
  const settledAttackAction =
    attackAction &&
    settleEncounterAttackActionHit(
      attackAction,
      prepared.makesAttackRoll
        ? execution.d20?.resultPath === 'ON_HIT' || execution.d20?.resultPath === 'ON_CRIT'
        : null
    )
  const settlement = planNativeLiveEncounterSettlement({
    command,
    occurrenceId,
    occurredAt,
    prepared: settledPrepared,
    mechanics,
    effects: preparedEffects,
    recurringEffectId,
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
    damageGrants: [
      ...damageEnded.grants.map(({ id, effect }) => ({ id, plan: effect })),
      ...(gateImmunityGrant ? [gateImmunityGrant] : [])
    ],
    actionEconomy,
    actionEconomyOverridden: overridesActionEconomy(ruleWarnings.overrides),
    attackAction: settledAttackAction,
    maintenance,
    activeEffectsByActorId
  })
  const actionRange = rangeDtoSchema.safeParse(prepared.targetPolicy.range)
  const meleeAttack = isInstalledMeleeAttackTrigger(
    state.gameSystemId,
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts.invocation.triggerCode
      : prepared.source.capability.mechanicFacts.invocation.triggerCode
  )
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
    effects: settlement,
    maintainedState: settlement.maintainedState,
    maintenanceTransition: settlement.maintenanceTransition,
    actionEconomy,
    attackAction: settledAttackAction,
    resistance,
    reaction: reaction && {
      audit: reaction.audit,
      spent: reactionUse && {
        spellConsumption: reactionUse.prepared.characterActionState?.spellConsumption,
        economy: reactionUse.economy,
        activeEffectTransitions: settlement.reactionActiveEffectTransitions
      }
    },
    targetFailedCounterSpend,
    meleeRetaliation: retaliation?.evidence ?? null,
    grantEffectTransitions: settlement.grantEffectTransitions
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
    reactionUse,
    reactionConsumedGrants: reactionEnded?.consumedGrants ?? [],
    spentUseGrants: decoyStrike.spentUseGrants,
    failedSpends,
    forcedMovements,
    revisions,
    // The attacker's one-roll grants and the target's effects the damage or action ended, one receipt.
    consumedGrants: [
      ...consumedGrants,
      ...hitEnded.consumedGrants,
      ...decoyStrike.endedGrants,
      ...damageEnded.endedEffects,
      ...(actionEnded?.endedEffects ?? [])
    ]
  }
}

/** The sealed pending contract the room persists before acknowledging an assisted action. */
export function buildNativeLiveEncounterActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<
    Awaited<ReturnType<typeof planNativeLiveEncounterAction>>,
    { kind: 'PENDING' | 'CAST_PENDING' | 'GATE_PENDING' | 'RETARGET_PENDING' }
  >
) {
  const pinned = {
    optionalCombatSnapshotChecksum: plan.prepared.state.optionalCombatSnapshotChecksum,
    commandJson: JSON.stringify(plan.command),
    commandFingerprint: plan.fingerprint,
    initiatorUserId: plan.initiatorUserId,
    currentnessChecksum: plan.currentnessChecksum
  }
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot:
      plan.kind === 'PENDING'
        ? buildEncounterActionPendingSnapshot({
            ...pinned,
            execution: plan.execution,
            sourceActorId: plan.prepared.actor.id,
            targetActorId: plan.prepared.target.id,
            failedCounters: plan.failedCounters,
            passedIncomingGate: plan.passedIncomingGate
          })
        : buildEncounterHeldActionPendingSnapshot({
            ...pinned,
            continuation: plan.continuation,
            pause: plan.pause,
            rollerActorId: plan.rollerActorId,
            ...(plan.kind === 'CAST_PENDING'
              ? { failedCounters: plan.failedCounters, passedIncomingGate: plan.passedIncomingGate }
              : {})
          })
  })
}

/** The completed action and child contracts the room persists in one transaction. */
export function buildNativeLiveEncounterActionCommitInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<Awaited<ReturnType<typeof planNativeLiveEncounterAction>>, { kind: 'PLANNED' }>
) {
  const owners = new Map(
    plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER'
        ? [[checksumRuleDocument(request), request] as const]
        : []
    )
  )
  return liveSessionEncounterActionCommitInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: [...owners.values()],
    occurredAt: plan.occurredAt,
    initialDefinitionId: plan.execution.initialPublished.id,
    execution: plan.storedExecution,
    rules: plan.nextRules,
    resourceConsumption: plan.prepared.characterActionState?.resourceConsumption ?? null,
    itemConsumption: plan.prepared.characterActionState?.itemConsumption ?? null,
    spellConsumption: plan.prepared.characterActionState?.spellConsumption ?? null,
    reactionSpellConsumption:
      plan.reactionUse?.prepared.characterActionState?.spellConsumption ?? null,
    failedCounters: plan.failedSpends.map(({ receipt, spellConsumption }) => ({
      receipt,
      spellConsumption
    })),
    label: encounterActionSourceLabel(plan.prepared.source),
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants,
    cleaving: plan.cleaving,
    spellCheck: plan.spellCheck ?? undefined,
    consumedGrants: [...plan.consumedGrants, ...plan.reactionConsumedGrants],
    spentUseGrants: plan.spentUseGrants,
    turnUses: plan.turnUses,
    forcedMovements: plan.forcedMovements
  })
}
