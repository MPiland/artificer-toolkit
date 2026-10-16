import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  actionTargetActorId,
  resolveEncounterActionInputDtoSchema,
  type RemoveAreaTargetInputDto,
  type ResolveEncounterActionInputDto,
  type ResolveRuleOccurrenceInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  encounterActionCurrentnessChecksum,
  prepareEncounterActionMechanics
} from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPreparation'
import {
  dnd5eAttackKind,
  isDnd5eMeleeAttackKind
} from '@artificer-toolkit/rules-runtime/systems/dnd5e/attackKind'
import {
  encounterActionSourceLabel,
  resolveEncounterActionSource,
  type EncounterActionSourceRequest
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated,
  isEncounterTargetDying
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { resolveCheckActionInputDtoSchema } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import {
  isEncounterBasicActionId,
  readEncounterBasicActionEntries
} from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
import { encounterActionTargetKind } from '@artificer-toolkit/rules-runtime/encounterAreaAction'
import { consumableGrants } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
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
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { readNativeLiveEnemyProximity } from './nativeAttackEnemyProximity.js'
import { readNativeLiveAttackPerception } from './nativeAttackPerception.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import { consumeEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomyConsumption'
import {
  replayNativeActionReaction,
  resolveNativeActionReaction
} from '@artificer-toolkit/rules-runtime/encounterActionReaction'
import {
  chosenEncounterReaction,
  type EncounterReactionSelection
} from '@artificer-toolkit/rules-runtime/encounterReactionChoice'
import type { EncounterReactionOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionReactionChoice'
import { resolveNativeActionOnHit } from '@artificer-toolkit/rules-runtime/encounterActionOnHit'
import type { EncounterOnHitSelection } from '@artificer-toolkit/rules-runtime/encounterOnHitChoice'
import {
  onHitCandidates,
  onHitSpellConsumption
} from '@artificer-toolkit/rules-runtime/character/characterOnHitSlots'
import type { EncounterOnHitOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionOnHitChoice'
import {
  applyNativeAttackReaction,
  discoverNativeAttackReaction
} from './nativeEncounterAttackReaction.js'
import { buildEncounterActionPendingSnapshot } from '@artificer-toolkit/rules-runtime/encounterActionPendingSnapshot'
import {
  withEncounterAppRoll,
  type EncounterEvidenceAnswer
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import {
  replayNativeActionLegendaryResistance,
  resolveNativeActionLegendaryResistance
} from '@artificer-toolkit/rules-runtime/encounterActionLegendaryResistance'
import type { EncounterLegendaryResistanceSelection } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceChoice'
import { findEncounterFeatureResource } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import type { EncounterLegendaryResistanceOfferDto } from '@artificer-toolkit/schema/shared/ruleExecutionDirectActionPendingContexts'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
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
  discoverNativeLegendaryResistance,
  planNativeLiveEncounterAreaAction,
  planNativeLiveEncounterAreaAnswer,
  planNativeLiveEncounterAreaLegendaryResistance,
  planNativeLiveEncounterAreaRemoval
} from './nativeEncounterAreaRules.js'
import { evaluateNativeLiveActionEconomy } from './nativeEncounterActionEconomy.js'
import {
  nativeLiveRelationshipFacts,
  refuseActionOutsideItsWindow,
  refuseSpatialInterpretation,
  refuseUnmetBasicActionRestrictions
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
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { planNativeLiveCleaving } from './nativeEncounterCleaving.js'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
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
    random?: (maximum: number) => number
    captures: LiveCaptureReads
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
  const command = admission.command
  const snapshot = admission.kind === 'ACTION_RESPONSE' ? admission.snapshot : null
  const areaSnapshot = admission.kind === 'ACTION_COMMAND' ? null : admission.areaSnapshot
  let evidenceResolution: EncounterEvidenceAnswer | null = null
  let areaDecision: Extract<
    ResolveRuleOccurrenceInputDto['resolution'],
    { kind: 'AREA_LEGENDARY_RESISTANCE' }
  > | null = null
  let resistanceAnswer: {
    offer: EncounterLegendaryResistanceOfferDto
    selection: EncounterLegendaryResistanceSelection
  } | null = null
  let reactionAnswer: {
    offer: EncounterReactionOfferDto
    selection: EncounterReactionSelection
  } | null = null
  let onHitAnswer: {
    offer: EncounterOnHitOfferDto
    selection: EncounterOnHitSelection
  } | null = null
  if (responseCommand) {
    if (!snapshot || snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
      throw new Error('The pending action snapshot is unavailable.')
    // An app roll settles with the faces Convex recorded for it, never client-supplied values.
    const resolution = withEncounterAppRoll(
      responseCommand.resolution,
      admission.kind === 'ACTION_RESPONSE' ? admission.appRoll : null
    )
    if (resolution.kind === 'AREA_LEGENDARY_RESISTANCE') areaDecision = resolution
    else if (snapshot.applicationContext.legendaryResistance) {
      if (resolution.kind !== 'DECLINE' && resolution.kind !== 'OPTION')
        throw new Error('The action requires a Legendary Resistance decision.')
      resistanceAnswer = {
        offer: snapshot.applicationContext.legendaryResistance,
        selection: resolution
      }
    } else if (snapshot.applicationContext.reactionChoice) {
      if (resolution.kind !== 'DECLINE' && resolution.kind !== 'OPTION')
        throw new Error('The action requires a reaction decision.')
      reactionAnswer = { offer: snapshot.applicationContext.reactionChoice, selection: resolution }
    } else if (snapshot.applicationContext.onHitChoice) {
      if (resolution.kind !== 'DECLINE' && resolution.kind !== 'OPTION')
        throw new Error('The action requires an on-hit decision.')
      onHitAnswer = { offer: snapshot.applicationContext.onHitChoice, selection: resolution }
    } else if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('The action requires dice or integer evidence.')
    else evidenceResolution = resolution
    const context = snapshot.applicationContext
    const root = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
    if (
      // An area save is sealed under its own occurrence id; the answer names the area's.
      (areaSnapshot ?? snapshot).occurrenceId !== responseCommand.occurrenceId ||
      context.commandFingerprint !== admission.fingerprint ||
      checksumCanonicalJson(root) !== admission.fingerprint ||
      (evidenceResolution !== null &&
        (snapshot.request.requestId !== evidenceResolution.requestId ||
          (context.d20Policy === null && evidenceResolution.kind === 'ENTER_DICE') ||
          (context.d20Policy !== null && evidenceResolution.kind === 'ENTER_INTEGER')))
    )
      throw new Error('The pending action evidence is invalid.')
    // Contests (Disarm) and deferred Cleaving have their own planners; their evidence never
    // routes here.
    if (context.contest || snapshot.deferredCleaving || root.optionalCombatIntent != null)
      throw new Error('The pending action is not an ordinary action.')
  }
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
      captures: executionOptions.captures
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
  if (command.target.kind === 'ACTORS') {
    if (removalCommand || responseCommand) throw new Error('A chosen-creature action never pends.')
    return {
      ...(await planNativeLiveEncounterActorsAction({
        initial,
        command: { ...command, target: command.target },
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
        autoRollByActorId
      })),
      dependencies,
      revisions
    }
  }
  if (command.target.kind !== 'ACTOR') {
    const areaInput = {
      initial,
      command: { ...command, target: command.target },
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
      autoRollByActorId
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
    if (responseCommand) {
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
      ...(await planNativeLiveEncounterAreaAction(areaInput)),
      dependencies,
      revisions
    }
  }
  const targetActorId = actionTargetActorId(command.target)
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
        grid: encounterSceneGridPolicyRegistry.resolveEffectiveGrid({
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
        system,
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
  const prepareAttack = (targets: typeof movementTargets) =>
    prepareEncounterActionMechanics({
      state,
      actor: actors.find((actor) => actor.id === command.actorId)!,
      target: actors.find((actor) => actor.id === targetActorId)!,
      actors,
      actionId: command.actionId,
      wieldConflictAcceptance: {
        kind: 'PROMPTED',
        accepted: command.acceptedWieldConflict
      },
      overridable: true,
      movementTargets: targets,
      sceneContext,
      loadAttackPerception: ({ sourceFacts, targetFacts }) =>
        readNativeLiveAttackPerception({
          state,
          system,
          attacker: sourceFacts,
          target: targetFacts,
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
      ...actionSources
    }).catch(refuseStaleCharacterAction)
  const prepared = await prepareAttack(movementTargets)
  // A spell that takes a list of creatures is not aimed at one.
  if (encounterActionTargetKind(prepared.targetPolicy) === 'ACTORS')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'TARGET_UNAVAILABLE',
      message: TARGET_NOT_PERMITTED_MESSAGE
    })
  refuseActionOutsideItsWindow(prepared)
  const actorTarget = movementTargets.get(prepared.actor.id)
  if (!actorTarget) throw new Error('Encounter rules input binding mismatch.')
  await refuseUnmetBasicActionRestrictions(prepared, {
    target: actorTarget,
    gameSystemId: state.gameSystemId,
    definitions,
    speedDefinitions: system.speeds
  })
  // Only an attack roll uses the attacker's one-roll grants (Vicious Mockery's disadvantage, Help);
  // a saving-throw action leaves them for the next attack.
  const consumedGrants =
    typeof prepared.binding.actionMechanic.attackBonus === 'number'
      ? consumableGrants(activeEffectsByActorId.get(prepared.actor.id) ?? [], 'ON_ATTACK_ROLL')
      : []
  // An optional-combat intent routes to the Disarm planner.
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  const { activationCode, economy, suppressed, attackAction } =
    await evaluateNativeLiveActionEconomy({
      prepared,
      state,
      actionId: command.actionId,
      sourceTarget: movementTargets.get(prepared.actor.id),
      targetIds: [prepared.target.id],
      capture
    })
  const mechanicFacts =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts
      : prepared.source.capability.mechanicFacts
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: suppressed
      ? [...prepared.ruleWarnings, encounterActionSuppressedWarning(activationCode)]
      : prepared.ruleWarnings,
    target: {
      actor: prepared.actor,
      target: prepared.target,
      targetPolicy: prepared.targetPolicy,
      makesAttackRoll: prepared.makesAttackRoll,
      sceneContext
    },
    targetCreatureTypeId: snapshotCreatureTypeId(prepared.target),
    targetDefeated: isEncounterActorDefeated(
      prepared.target,
      deadCharacterIdsOfTargets(movementTargets.values())
    ),
    stabilize: mechanicFacts.outcomes.some(
      (outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'STABILIZE'
    )
      ? {
          targetDying: isEncounterTargetDying(movementTargets.get(prepared.target.id))
        }
      : null,
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
    // Only an authored basic action runs on the check test; a feature or Character action
    // authored with it would otherwise run its outcome with no check.
    const actor = movementTargets.get(prepared.actor.id)
    const target = movementTargets.get(prepared.target.id)
    if (prepared.source.kind !== 'BASIC_ACTION' || responseCommand || !actor || !target)
      throw new Error('Only a basic action can make a check.')
    const { capability } = prepared.source
    // A concealment check compares its roller with every actor in the Run; load them all before the
    // revisions the plan depends on are read.
    const concealmentTargets =
      authoredCheckOf(capability).dc.kind === 'FIXED'
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
      fingerprint: admission.fingerprint,
      capability,
      state,
      system,
      actors,
      actor,
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
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared,
    actionEconomy,
    attackAction,
    maintenance,
    sceneContext
  })
  if (
    snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION' &&
    snapshot.applicationContext.currentnessChecksum !== currentnessChecksum
  )
    throw new Error('The pending action source or target changed.')
  const occurrenceId = responseCommand ? responseCommand.occurrenceId : crypto.randomUUID()
  const occurrenceVersion = responseCommand ? responseCommand.expectedOccurrenceVersion + 1 : 0
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
  const occurredAt = new Date().toISOString()
  const discoverReaction = discoverNativeAttackReaction({
    state,
    attack: prepared,
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
  /**
   * The target's reaction as it is now. A used reaction also carries what it does to the attack it
   * answered: its effect plan and the attack's binding once that effect holds.
   */
  const currentReaction = async (used: boolean, answering: string, critical: boolean) => {
    const [found] = await discoverReaction({ answering, critical })
    if (!found) throw new Error('Reaction evidence is stale.')
    const applied = used
      ? await applyNativeAttackReaction({
          reaction: found,
          runtime: executionOptions.runtime,
          occurrenceId,
          commandId: command.commandId,
          occurredAt,
          activeEffectsByActorId,
          prepareAttack,
          loadTarget
        })
      : null
    return {
      found,
      applied,
      candidate: found.candidate,
      targetStateChecksum,
      adjustedBinding: applied?.adjustedBinding ?? prepared.binding
    }
  }
  // The optional on-hit riders the attacker could pay for now: a Character's slots pay them, unless
  // the action already spends one.
  const attackPlan = prepared.plan
  const onHitNow =
    prepared.source.kind === 'CHARACTER_ACTION' &&
    attackPlan.kind === 'TEST_OUTCOME' &&
    !prepared.characterActionState?.spellConsumption
      ? onHitCandidates({
          riders: prepared.adapter.optionalOnHitRiders({
            compilerSource: attackPlan.compilerSource
          }),
          spellSlots: prepared.source.effectivePolicyOutput.spellSlots
        })
      : []
  const answered = resistanceAnswer
    ? await resolveNativeActionLegendaryResistance({
        ...actionSource,
        ...resistanceAnswer,
        ...(await currentResistance())
      })
    : null
  const answeredReaction = reactionAnswer
    ? await currentReaction(
        reactionAnswer.selection.kind === 'OPTION',
        chosenEncounterReaction(reactionAnswer.offer, reactionAnswer.selection).actionId,
        reactionAnswer.offer.originalD20.resultPath === 'ON_CRIT'
      )
    : null
  const reactionAnswered =
    reactionAnswer && answeredReaction
      ? {
          ...answeredReaction,
          ...(await resolveNativeActionReaction({
            ...actionSource,
            ...reactionAnswer,
            ...answeredReaction,
            onHitCandidates: onHitNow
          }))
        }
      : null
  // A held on-hit offer that follows a used reaction answers the hit as that reaction left it.
  const heldReaction = onHitAnswer?.offer.reaction
    ? {
        reaction: onHitAnswer.offer.reaction,
        testExecution: onHitAnswer.offer.testExecution,
        testRollEvidence: onHitAnswer.offer.testD20
      }
    : null
  const heldReactionNow = heldReaction
    ? await currentReaction(
        heldReaction.reaction.selection === 'USE',
        heldReaction.reaction.reaction.actionId,
        heldReaction.testExecution.outputs.resultPath === 'ON_CRIT'
      )
    : null
  const answeredOnHit = onHitAnswer
    ? await resolveNativeActionOnHit({
        ...actionSource,
        ...onHitAnswer,
        candidates: onHitNow,
        adjustedBinding: heldReactionNow?.adjustedBinding ?? null
      })
    : null
  const execution =
    answered?.execution ??
    reactionAnswered?.execution ??
    answeredOnHit?.execution ??
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
  const retained = resume?.pending.twoPhase
  const resistance =
    answered?.resistance ??
    (execution.kind !== 'PENDING' && retained?.phase === 'OUTCOME' && retained.legendaryResistance
      ? await replayNativeActionLegendaryResistance({
          ...actionSource,
          outcome: retained,
          ...(await currentResistance())
        })
      : null)
  const retainedReaction =
    execution.kind !== 'PENDING' && !reactionAnswered
      ? (heldReaction ??
        (retained?.phase === 'OUTCOME' && retained.reaction ? retained : null))
      : null
  const replayedReaction =
    heldReactionNow ??
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
      : (reactionAnswered ??
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
  const preflight = {
    command,
    response: responseCommand,
    // A response continues the original initiator's action; the responder is authorized in Convex.
    initiatorUserId:
      snapshot?.applicationContext.kind === 'ENCOUNTER_ACTION'
        ? snapshot.applicationContext.initiatorUserId
        : initial.expectedUserId,
    fingerprint: admission.fingerprint,
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
    dependencies,
    revisions
  }
  if (execution.kind === 'PENDING') return { ...preflight, kind: 'PENDING' as const, execution }
  // The slot an on-hit rider the attacker chose is paid with is spent with the outcome; the currentness
  // fence above was taken on the unspent attack.
  const chosenOnHit =
    answeredOnHit?.audit.option ??
    (retained?.phase === 'OUTCOME' ? (retained.onHit?.option ?? null) : null)
  const settledPrepared =
    chosenOnHit && prepared.source.kind === 'CHARACTER_ACTION' && prepared.characterActionState
      ? {
          ...prepared,
          characterActionState: {
            ...prepared.characterActionState,
            spellConsumption: onHitSpellConsumption({
              spellSlots: prepared.source.effectivePolicyOutput.spellSlots,
              slotLevel: chosenOnHit.slotLevel,
              characterId: prepared.source.characterId,
              expectedStreamVersion: prepared.source.characterStreamVersion
            })
          }
        }
      : prepared
  const preparedEffects = prepareNativeActionEffectsPlan({
    prepared,
    execution,
    occurrenceId,
    commandId: command.commandId,
    activeEffectsByActorId
  })
  const reactionUse =
    reaction?.audit.selection === 'USE' && reaction.applied
      ? {
          applied: reaction.applied,
          prepared: reaction.found.prepared,
          economy: reaction.found.economy.consumption
        }
      : null
  refuseSpatialInterpretation(prepared, {
    execution: execution.execution,
    occurrenceId,
    published: execution.published,
    targetActorId: prepared.target.id
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
      applications: [
        ...execution.applications,
        ...preparedEffects.relationshipConditionApplications
      ],
      forceTargetVersionAdvance:
        prepared.target.kind === 'CHARACTER' &&
        (preparedEffects.stateEffect !== null ||
          preparedEffects.recurringEffect !== null ||
          reactionUse !== null)
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
    return reactionUse
      ? consumeEncounterActionEconomy({
          actor: charged,
          consumption: reactionUse.economy,
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
  const settlement = planNativeLiveEncounterSettlement({
    command,
    occurrenceId,
    occurredAt,
    prepared: settledPrepared,
    mechanics,
    effects: preparedEffects,
    reactionEffect: reactionUse?.applied.reactionEffect ?? null,
    actionEconomy,
    actionEconomyOverridden: overridesActionEconomy(ruleWarnings.overrides),
    attackAction,
    maintenance,
    activeEffectsByActorId
  })
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
    }
  ]
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    autoRollByActorId,
    parentOccurrenceId: occurrenceId,
    parentCommandFingerprint: admission.fingerprint,
    applications: nativeConcentrationDamageApplications(damage, true),
    sourceLabels: nativeConcentrationDamageSourceLabels(damage, true),
    occurredAt,
    settlement,
    capture,
    runtime: executionOptions.runtime,
    random: executionOptions.random
  })
  const nextFacts = buildEncounterActorRuleFacts({
    actors: concentration.actors
  })
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
    attackAction,
    resistance,
    reaction: reaction && {
      audit: reaction.audit,
      spent: reactionUse && {
        spellConsumption: reactionUse.prepared.characterActionState?.spellConsumption,
        economy: reactionUse.economy,
        activeEffectTransitions: settlement.reactionActiveEffectTransitions
      }
    }
  })
  const cleavingRange = rangeDtoSchema.safeParse(prepared.targetPolicy.range)
  const cleaving =
    storedExecution.status === 'COMPLETE' && cleavingRange.success && sceneContext
      ? await planNativeLiveCleaving({
          state: nextState,
          result: storedExecution,
          source: prepared.source,
          action: {
            actionId: command.actionId,
            publishedDefinitionId: execution.published.id,
            publishedDefinitionChecksum: execution.published.checksum,
            attackKind: isDnd5eMeleeAttackKind(
              dnd5eAttackKind(
                prepared.source.kind === 'CHARACTER_ACTION'
                  ? prepared.source.candidate.mechanicFacts.invocation.triggerCode
                  : prepared.source.capability.mechanicFacts.invocation.triggerCode
              )
            )
              ? 'MELEE'
              : 'OTHER',
            range: cleavingRange.data
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
    ...preflight,
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
    cleaving,
    reactionUse,
    revisions
  }
}

/** The sealed pending contract the room persists before acknowledging an assisted action. */
export function buildNativeLiveEncounterActionPendingInput(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<Awaited<ReturnType<typeof planNativeLiveEncounterAction>>, { kind: 'PENDING' }>
) {
  return liveSessionEncounterActionPendingInputSchema.parse({
    ...scope,
    command: plan.command,
    response: plan.response,
    revisions: plan.revisions,
    maintenanceOwners: plan.dependencies.flatMap(({ request }) =>
      request.kind === 'MAINTENANCE_OWNER' ? [request] : []
    ),
    snapshot: buildEncounterActionPendingSnapshot({
      execution: plan.execution,
      optionalCombatSnapshotChecksum: plan.prepared.state.optionalCombatSnapshotChecksum,
      commandJson: JSON.stringify(plan.command),
      commandFingerprint: plan.fingerprint,
      initiatorUserId: plan.initiatorUserId,
      sourceActorId: plan.prepared.actor.id,
      targetActorId: plan.prepared.target.id,
      currentnessChecksum: plan.currentnessChecksum
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
    label: encounterActionSourceLabel(plan.prepared.source),
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    endedGrants: plan.concentration.endedGrants,
    cleaving: plan.cleaving,
    consumedGrants: plan.consumedGrants
  })
}
