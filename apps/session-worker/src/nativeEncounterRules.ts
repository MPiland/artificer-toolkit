import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import {
  resolveEncounterActionInputDtoSchema,
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
  encounterAttackActionTransition,
  evaluateEncounterAttackAction
} from '@artificer-toolkit/rules-runtime/encounterAttackAction'
import {
  encounterActionSourceLabel,
  encounterLegendaryActionFeatureIds,
  resolveEncounterActionSource
} from '@artificer-toolkit/rules-runtime/encounterActionSources'
import {
  deadCharacterIdsOfTargets,
  isEncounterActorDefeated,
  isEncounterTargetDying
} from '@artificer-toolkit/rules-runtime/encounterActorDefeat'
import { DOMAIN_REJECTION_MESSAGES } from '@artificer-toolkit/schema/api/domainRejections'
import {
  lockedRelationshipActionFacts,
  mergeCanonicalD20Contributors
} from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { encounterBasicActionAllyAdvantage } from '@artificer-toolkit/rules-runtime/encounterBasicActions'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
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
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import type { LiveCaptureReads } from './nativeEncounterReads.js'
import { LiveSessionDomainRejectionError } from './liveSessionRoutes.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import { advanceNativeActionGraphs } from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import {
  withEncounterAppRoll,
  type EncounterEvidenceAnswer
} from '@artificer-toolkit/rules-runtime/encounterEvidenceAnswer'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterActionCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { planNativeLiveEncounterSettlement } from './nativeEncounterSettlement.js'
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
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { planNativeLiveCleaving } from './nativeEncounterCleaving.js'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

/** Computes the action in the DO; the room commits this plan in its own transaction. */
export async function planNativeLiveEncounterAction(
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  commandInput: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random?: (maximum: number) => number
    captures: LiveCaptureReads
  }
) {
  const responseCommand = commandInput.type === 'RESOLVE_RULE_OCCURRENCE' ? commandInput : null
  const request = responseCommand
    ? { kind: 'ACTION_RESPONSE' as const, response: responseCommand }
    : { kind: 'ACTION_COMMAND' as const, command: commandInput }
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    // A player's admitted action scope lets its follow-up captures read the rules inputs.
    ...(scope.expectedRole === 'PLAYER' ? { action: request } : {}),
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
    const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
    const response = await executionOptions.captures.encounterRules(input)
    if (response.kind !== request.kind) throw new Error('Encounter rules capture kind mismatch.')
    revisions = mergeNativeRulesRevisions(revisions, response.revisions)
    dependencies.push({ request: input.request })
    return response
  }
  const admission = await capture(initial.request)
  if (admission.kind !== 'ACTION_COMMAND' && admission.kind !== 'ACTION_RESPONSE')
    throw new Error('Encounter command is unavailable.')
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (admission.kind !== initial.request.kind) throw new Error('Encounter command is unavailable.')
  const command = admission.command
  const snapshot = admission.kind === 'ACTION_RESPONSE' ? admission.snapshot : null
  let evidenceResolution: EncounterEvidenceAnswer | null = null
  if (responseCommand) {
    if (!snapshot || snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
      throw new Error('The pending action snapshot is unavailable.')
    // An app roll settles with the faces Convex recorded for it, never client-supplied values.
    const resolution = withEncounterAppRoll(
      responseCommand.resolution,
      admission.kind === 'ACTION_RESPONSE' ? admission.appRoll : null
    )
    if (
      resolution.kind !== 'ENTER_DICE' &&
      resolution.kind !== 'ENTER_INTEGER' &&
      resolution.kind !== 'SYSTEM_ROLL'
    )
      throw new Error('The action requires dice or integer evidence.')
    evidenceResolution = resolution
    const context = snapshot.applicationContext
    const root = resolveEncounterActionInputDtoSchema.parse(JSON.parse(context.commandJson))
    if (
      snapshot.occurrenceId !== responseCommand.occurrenceId ||
      context.commandFingerprint !== admission.fingerprint ||
      checksumCanonicalJson(root) !== admission.fingerprint ||
      snapshot.request.requestId !== resolution.requestId ||
      (context.d20Policy === null && resolution.kind === 'ENTER_DICE') ||
      (context.d20Policy !== null && resolution.kind === 'ENTER_INTEGER')
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
    !state.actorIds.includes(command.targetActorId)
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
  const selectedActors = actors.filter(
    (actor) => actor.id === command.actorId || actor.id === command.targetActorId
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
          targetActorId: command.targetActorId,
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
  // An ally's Help (basic action, Q11) gives this actor's next attack roll advantage.
  const allyAdvantage = encounterBasicActionAllyAdvantage({ actors, attackerId: command.actorId })
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor: actors.find((actor) => actor.id === command.actorId)!,
    target: actors.find((actor) => actor.id === command.targetActorId)!,
    actors,
    actionId: command.actionId,
    wieldConflictAcceptance: { kind: 'PROMPTED', accepted: command.acceptedWieldConflict },
    overridable: true,
    movementTargets,
    sceneContext,
    loadSource: async (input) => resolveEncounterActionSource({ ...input, system }),
    loadRelationshipFacts: async (input) =>
      mergeCanonicalD20Contributors(
        lockedRelationshipActionFacts({
          actionEffectId: input.actionEffectId,
          sourceActorId: input.sourceActorId,
          targetActorId: input.targetActorId,
          targets: { activeEffectsByActorId }
        }),
        allyAdvantage ? [allyAdvantage.contributor] : []
      )
  })
  if (
    prepared.source.kind === 'CREATURE' &&
    encounterLegendaryActionFeatureIds(prepared.actor).has(
      prepared.source.capability.ownerFeatureId
    )
  )
    throw new LiveSessionDomainRejectionError(422, {
      code: 'DOMAIN_REJECTED',
      reason: 'LEGENDARY_WINDOW_ONLY',
      message: DOMAIN_REJECTION_MESSAGES.LEGENDARY_WINDOW_ONLY
    })
  // Only an attack roll uses the advantage; a saving-throw action leaves it for the next attack.
  const allyAdvantageUses =
    allyAdvantage && typeof prepared.binding.actionMechanic.attackBonus === 'number'
      ? [{ helperActorId: allyAdvantage.helperActorId, effect: allyAdvantage.effect }]
      : []
  // An optional-combat intent routes to the Disarm planner.
  if (command.optionalCombatIntent != null) throw new Error('The action is not an ordinary action.')
  const activation =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts.invocation.activation
      : prepared.source.capability.mechanicFacts.invocation.activation
  if (!activation || activation.amount === null)
    throw new Error('The selected action activation is not normalized.')
  const {
    economy,
    attackAction: openedAttackAction,
    suppressed
  } = await evaluateEncounterAttackAction({
    triggerCode:
      prepared.source.kind === 'CHARACTER_ACTION'
        ? prepared.source.candidate.mechanicFacts.invocation.triggerCode
        : prepared.source.capability.mechanicFacts.invocation.triggerCode,
    actor: prepared.actor,
    state,
    activation: { code: activation.code, amount: activation.amount },
    target: movementTargets.get(prepared.actor.id),
    loadTarget: async () => movementTargets.get(prepared.actor.id),
    definitions: {
      requireCurrent: async (definitionId) => {
        const response = await capture({ kind: 'DEFINITION', definitionId })
        if (response.kind !== 'DEFINITION' || !response.definition)
          throw new Error('Action-economy capability is unavailable.')
        return response.definition
      }
    }
  })
  const attackAction = openedAttackAction
    ? encounterAttackActionTransition(openedAttackAction, {
        actionId: command.actionId,
        targetIds: [prepared.target.id]
      })
    : null
  const ruleWarnings = evaluateEncounterActionRuleWarnings({
    preparedWarnings: suppressed
      ? [...prepared.ruleWarnings, encounterActionSuppressedWarning(activation.code)]
      : prepared.ruleWarnings,
    target: {
      actor: prepared.actor,
      target: prepared.target,
      targetPolicy: prepared.targetPolicy,
      sceneContext
    },
    targetDefeated: isEncounterActorDefeated(
      prepared.target,
      deadCharacterIdsOfTargets(movementTargets.values())
    ),
    stabilize: (prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts
      : prepared.source.capability.mechanicFacts
    ).outcomes.some((outcome) => outcome.kind === 'EFFECT' && outcome.effectKind === 'STABILIZE')
      ? { targetDying: isEncounterTargetDying(movementTargets.get(prepared.target.id)) }
      : null,
    actionEconomy: economy,
    activationCode: activation.code,
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
    capture
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
          pending: {
            kind: 'PENDING' as const,
            continuation: (() => {
              const {
                snapshotKind: _snapshotKind,
                applicationContext: _applicationContext,
                optionalCombatSnapshotChecksum: _optionalCombatSnapshotChecksum,
                phaseReceipts: _phaseReceipts,
                deferredCleaving: _deferredCleaving,
                ...continuation
              } = snapshot
              return continuation
            })(),
            d20Policy: snapshot.applicationContext.d20Policy,
            twoPhase: snapshot.applicationContext.twoPhase,
            ...(snapshot.phaseReceipts ? { phaseReceipts: snapshot.phaseReceipts } : {})
          },
          resolution: evidenceResolution
        }
      : null
  const execution = await advanceNativeActionGraphs({
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
    ...(resume ? { resume } : {}),
    afterTest: async (test) => {
      if (test.outputs.resultPath !== 'ON_SAVE_FAIL' || prepared.target.kind !== 'CREATURE') return
      const candidate = await discoverEncounterLegendaryResistanceCandidate({
        encounter: state,
        targetActor: prepared.target,
        actorRules: prepared.actorRules,
        definitions: {
          requireCurrent: async (definitionId) => {
            const response = await capture({ kind: 'DEFINITION', definitionId })
            if (response.kind !== 'DEFINITION' || !response.definition)
              throw new Error('Legendary Resistance definition is unavailable.')
            return response.definition
          }
        }
      })
      // A Legendary Resistance decision on an action save is not built yet (movement saves have it).
      if (candidate) throw new Error('The action requires a Legendary Resistance decision.')
    }
  })
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
    allyAdvantageUses,
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
  if (
    prepared.adapter.interpretSpatial?.({
      execution: execution.execution,
      occurrenceId,
      published: execution.published,
      targetActorId: prepared.target.id
    }).length
  )
    throw new Error('Spatially interpreted actions are not available yet.')
  const mechanics = planNativeEncounterActionMechanics(
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
  const nextFacts = buildEncounterActorRuleFacts({ actors: concentration.actors })
  const nextRules = reconcileEncounterActorRuleOutput(
    evaluateInstalledEncounterActors({ gameSystemId: state.gameSystemId, facts: nextFacts }),
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
    attackAction
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
                prepared.source.kind === 'CREATURE'
                  ? prepared.source.capability.mechanicFacts.invocation.triggerCode
                  : prepared.source.candidate.mechanicFacts.invocation.triggerCode
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
    snapshot: {
      ...plan.execution.continuation,
      snapshotKind: 'KERNEL_EVIDENCE',
      optionalCombatSnapshotChecksum: plan.prepared.state.optionalCombatSnapshotChecksum,
      applicationContext: {
        kind: 'ENCOUNTER_ACTION',
        schemaVersion: 1,
        commandJson: JSON.stringify(plan.command),
        commandFingerprint: plan.fingerprint,
        initiatorUserId: plan.initiatorUserId,
        rollerActorId:
          plan.execution.roller === 'SOURCE' ? plan.prepared.actor.id : plan.prepared.target.id,
        currentnessChecksum: plan.currentnessChecksum,
        d20Policy: plan.execution.d20Policy,
        twoPhase: plan.execution.twoPhase
      },
      ...(plan.execution.phaseReceipts ? { phaseReceipts: plan.execution.phaseReceipts } : {})
    }
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
    ruleOverrides: plan.ruleOverrides,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    concentrationEnds: plan.concentration.concentrationEnds,
    cleaving: plan.cleaving,
    allyAdvantageUses: plan.allyAdvantageUses
  })
}
