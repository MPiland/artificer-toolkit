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
  resolveEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated,
  isEncounterTargetDying
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { refuseStaleCharacterAction } from '@artificer-toolkit/encounter-persistence/staleCharacterAction'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import { readEncounterBasicActionEntries } from '@artificer-toolkit/rules-runtime/encounterBasicActionCapabilityDiscovery'
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
import { readNativeLiveAttackPerception } from './nativeAttackPerception.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
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
import { planNativeLiveEncounterSettlement } from './nativeEncounterSettlement.js'
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
  refuseLegendaryWindowAction,
  refuseSpatialInterpretation
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
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

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
    (command.target.kind === 'ACTOR' && !state.actorIds.includes(command.target.actorId))
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

  async function loadTarget(actor: EncounterRunActorState) {
    const preparedTarget = await prepareNativeLiveMovementTarget({
      scope: initial,
      state,
      actor,
      activeEffectsByActorId,
      captures: executionOptions.captures
    })
    revisions = mergeNativeRulesRevisions(revisions, preparedTarget.revisions)
    return preparedTarget.target
  }
  if (command.target.kind === 'POINT') {
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
  const prepared = await prepareEncounterActionMechanics({
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
    movementTargets,
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
    loadSource: async (input) =>
      resolveEncounterActionSource({
        ...input,
        system,
        basicActions: await readEncounterBasicActionEntries({
          actorId: input.actor.id,
          actionId: input.actionId,
          gameSystemId: input.gameSystemId,
          definitions: {
            requireCurrent: async (definitionId) => {
              const response = await capture({ kind: 'DEFINITION', definitionId })
              if (response.kind !== 'DEFINITION' || !response.definition)
                throw new Error('The rule definition is unavailable.')
              return response.definition
            }
          }
        })
      }),
    loadRelationshipFacts: nativeLiveRelationshipFacts({ activeEffectsByActorId })
  }).catch(refuseStaleCharacterAction)
  refuseLegendaryWindowAction(prepared)
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
    stabilize: (prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts
      : prepared.source.capability.mechanicFacts
    ).outcomes.some((outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'STABILIZE')
      ? {
          targetDying: isEncounterTargetDying(movementTargets.get(prepared.target.id))
        }
      : null,
    actionEconomy: economy,
    activationCode,
    acknowledged: command.acknowledgedWarnings
  })
  if (ruleWarnings.kind === 'UNSUPPORTED_TARGET')
    throw new Error('The selected action does not permit this target.')
  // The same user-safe rejection the Convex fallback raises, so the room forwards it unchanged.
  if (ruleWarnings.kind === 'UNACKNOWLEDGED')
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'RULE_WARNINGS',
      message: RULE_WARNINGS_MESSAGE,
      warnings: ruleWarnings.warnings
    })
  const actionEconomy = economy?.consumption ?? null
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
  const answered = resistanceAnswer
    ? await resolveNativeActionLegendaryResistance({
        ...actionSource,
        ...resistanceAnswer,
        ...(await currentResistance())
      })
    : null
  const execution =
    answered?.execution ??
    (await advanceNativeActionGraphs({
      ...actionSource,
      attackSight: prepared.attackSight,
      ...(resume ? { resume } : {}),
      legendaryResistance: { discover: discoverResistance, targetStateChecksum }
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
  const occurredAt = new Date().toISOString()
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
  const preparedEffects = prepareNativeActionEffectsPlan({
    prepared,
    execution,
    occurrenceId,
    commandId: command.commandId,
    activeEffectsByActorId
  })
  refuseSpatialInterpretation(prepared, {
    execution: execution.execution,
    occurrenceId,
    published: execution.published,
    targetActorId: prepared.target.id
  })
  const planned = planNativeEncounterActionMechanics(
    {
      prepared,
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
        (preparedEffects.stateEffect !== null || preparedEffects.recurringEffect !== null)
    },
    initial.expectedUserId
  )
  // A Legendary Resistance the target used spends its own charge with the outcome.
  const charge = resistance?.charge
  const chargedTarget = (actor: EncounterRunActorState) =>
    charge
      ? encounterRunActorStateSchema.parse({
          ...actor,
          resources: withFeatureChargeUsed(actor, charge.ownerFeatureId, charge.afterUsed)
        })
      : actor
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
    prepared,
    mechanics,
    effects: preparedEffects,
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
    prepared,
    execution,
    occurrenceId,
    occurrenceVersion,
    settled: mechanics,
    effects: settlement,
    maintainedState: settlement.maintainedState,
    maintenanceTransition: settlement.maintenanceTransition,
    actionEconomy,
    attackAction,
    resistance
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
    label: encounterActionSourceLabel(plan.prepared.source),
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    cleaving: plan.cleaving,
    consumedGrants: plan.consumedGrants
  })
}
