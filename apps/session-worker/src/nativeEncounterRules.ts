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
import { prepareEncounterActionEconomy } from '@artificer-toolkit/rules-runtime/encounterActionEconomy'
import { resolveEncounterActionSource } from '@artificer-toolkit/rules-runtime/encounterActionSources'
import { lockedRelationshipActionFacts } from '@artificer-toolkit/rules-runtime/encounterRelationshipActionFacts'
import { encounterSceneGridPolicyRegistry } from '@artificer-toolkit/rules-runtime/sceneGridPolicyRegistry'
import { targetPolicyPermitsEncounterActor } from '@artificer-toolkit/rules-runtime/encounterActionTargetPolicy'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import { prepareNativeLiveActionMaintenance } from './nativeEncounterMaintenance.js'
import {
  advanceNativeActionGraphs,
  type NativeActionEvidenceResolution
} from '@artificer-toolkit/rules-runtime/encounterActionExecution'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { discoverEncounterLegendaryResistanceCandidate } from '@artificer-toolkit/rules-runtime/encounterLegendaryResistanceDiscovery'
import { prepareNativeActionEffectsPlan } from '@artificer-toolkit/rules-runtime/encounterActionEffects'
import { planNativeEncounterActionMechanics } from '@artificer-toolkit/rules-runtime/encounterActionMechanicsPlan'
import {
  liveSessionEncounterActionPendingInputSchema,
  liveSessionEncounterActionCommitInputSchema
} from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import { encounterCommandResultDtoSchema } from '@artificer-toolkit/schema/api/encounterData'
import { planNativeLiveEncounterSettlement } from './nativeEncounterSettlement.js'
import { planNativeLiveConcentration } from './nativeEncounterConcentration.js'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  encounterRunStateSchema,
  type EncounterRunActorState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { buildEncounterActorRuleFacts } from '@artificer-toolkit/rules-runtime/encounterActorRuleFacts'
import { reconcileEncounterActorRuleOutput } from '@artificer-toolkit/rules-runtime/encounterActorRuleOutput'
import { evaluateInstalledEncounterActors } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { projectCurrentEncounterGm } from '@artificer-toolkit/rules-runtime/encounterProjection'
import { buildEncounterActionStoredExecution } from '@artificer-toolkit/rules-runtime/encounterActionReceipt'
import { planNativeLiveCleaving } from './nativeEncounterCleaving.js'
import { rangeDtoSchema } from '@artificer-toolkit/schema/shared/range'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { serverKernelRuleExecutionPendingSnapshotDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'

/** Computes the action in the DO; only a later atomic Convex commit may publish this plan. */
export async function planNativeLiveEncounterAction(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  commandInput: ResolveEncounterActionInputDto | ResolveRuleOccurrenceInputDto,
  executionOptions: {
    runtime: RulesRuntimeService
    random?: (maximum: number) => number
  }
) {
  const responseCommand = commandInput.type === 'RESOLVE_RULE_OCCURRENCE' ? commandInput : null
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    request: responseCommand
      ? { kind: 'ACTION_RESPONSE', response: responseCommand }
      : { kind: 'ACTION_COMMAND', command: commandInput }
  })
  if (
    commandInput.encounterId.toLowerCase() !== initial.encounterId ||
    commandInput.expectedVersion !== initial.expectedVersion
  )
    throw new Error('Live Encounter command scope mismatch.')
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest; readChecksum: string }> =
    []
  let revisions: LiveSessionRulesRevisions = []
  async function capture(request: LiveSessionEncounterRulesRequest) {
    const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
    const response = await callLiveSessionRoute(environment, accessToken, 'encounterRules', input)
    if (response.kind !== request.kind) throw new Error('Encounter rules capture kind mismatch.')
    revisions = mergeNativeRulesRevisions(revisions, response.revisions)
    dependencies.push({ request: input.request, readChecksum: response.readChecksum })
    return response
  }
  const admission = await capture(initial.request)
  if (admission.kind !== 'ACTION_COMMAND' && admission.kind !== 'ACTION_RESPONSE')
    throw new Error('Encounter command is unavailable.')
  if (admission.result) return { kind: 'REPLAY' as const, result: admission.result }
  if (admission.kind !== initial.request.kind) throw new Error('Encounter command is unavailable.')
  const command = admission.command
  const snapshot = admission.kind === 'ACTION_RESPONSE' ? admission.snapshot : null
  let evidenceResolution: NativeActionEvidenceResolution | null = null
  if (responseCommand) {
    if (!snapshot || snapshot.applicationContext.kind !== 'ENCOUNTER_ACTION')
      throw new Error('The pending action snapshot is unavailable.')
    const resolution = responseCommand.resolution
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
      context.initiatorUserId !== initial.expectedUserId ||
      context.contest ||
      snapshot.deferredCleaving ||
      root.optionalCombatIntent != null ||
      snapshot.request.requestId !== resolution.requestId ||
      (context.d20Policy === null && resolution.kind === 'ENTER_DICE') ||
      (context.d20Policy !== null && resolution.kind === 'ENTER_INTEGER')
    )
      throw new Error('The pending action evidence is invalid.')
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
    throw new Error('Native action execution requires Automatic or Assisted Encounter mode.')

  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })

  async function loadTarget(actor: EncounterRunActorState) {
    const preparedTarget = await prepareNativeLiveMovementTarget({
      environment,
      accessToken,
      scope: initial,
      state,
      actor,
      activeEffectsByActorId
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
  const prepared = await prepareEncounterActionMechanics({
    state,
    actor: actors.find((actor) => actor.id === command.actorId)!,
    target: actors.find((actor) => actor.id === command.targetActorId)!,
    actors,
    actionId: command.actionId,
    movementTargets,
    loadSource: async (input) => resolveEncounterActionSource({ ...input, system }),
    loadRelationshipFacts: async (input) =>
      lockedRelationshipActionFacts({
        actionEffectId: input.actionEffectId,
        sourceActorId: input.sourceActorId,
        targetActorId: input.targetActorId,
        targets: { activeEffectsByActorId }
      })
  })
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
  if (command.optionalCombatIntent != null)
    throw new Error('Native action execution requires the complete contextual action coordinator.')
  if (
    !targetPolicyPermitsEncounterActor({
      actorId: prepared.actor.id,
      targetActorId: prepared.target.id,
      targetPolicy: prepared.targetPolicy,
      sceneContext
    })
  )
    throw new Error('The selected action does not permit this target.')
  const activation =
    prepared.source.kind === 'CHARACTER_ACTION'
      ? prepared.source.candidate.mechanicFacts.invocation.activation
      : prepared.source.capability.mechanicFacts.invocation.activation
  if (!activation || activation.amount === null)
    throw new Error('The selected action activation is not normalized.')
  const actionEconomy = await prepareEncounterActionEconomy({
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
  const maintenance = await prepareNativeLiveActionMaintenance({
    prepared,
    activeEffectsByActorId,
    capture
  })
  const currentnessChecksum = encounterActionCurrentnessChecksum({
    prepared,
    actionEconomy,
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
    automationMode: state.automationMode,
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
      if (candidate) throw new Error('The action requires a Legendary Resistance decision.')
    }
  })
  const occurredAt = new Date().toISOString()
  const preflight = {
    command,
    response: responseCommand,
    fingerprint: admission.fingerprint,
    occurrenceId,
    occurrenceVersion,
    occurredAt,
    prepared,
    actionEconomy,
    maintenance,
    sceneContext,
    currentnessChecksum,
    activeEffectsByActorId,
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
    throw new Error('Native action execution requires the complete contextual action coordinator.')
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
    maintenance,
    activeEffectsByActorId
  })
  const nextState = encounterRunStateSchema.parse({
    ...state,
    version: state.version + 1,
    updatedAt: occurredAt
  })
  const concentration = await planNativeLiveConcentration({
    state: nextState,
    parentOccurrenceId: occurrenceId,
    parentCommandFingerprint: admission.fingerprint,
    applications: nativeConcentrationDamageApplications(
      [
        { targetActorId: prepared.target.id, applications: mechanics.mechanics.receiptApplications }
      ],
      true
    ),
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
  const initiative = await capture({ kind: 'INITIATIVE_ROUND' })
  if (initiative.kind !== 'INITIATIVE_ROUND')
    throw new Error('Encounter initiative round is unavailable.')
  const projection = projectCurrentEncounterGm({
    state: nextState,
    actors: concentration.actors,
    rules: nextRules,
    initiativeRoundState: initiative.state
  })
  const result = encounterCommandResultDtoSchema.parse({
    projection,
    roll: null,
    resolution: null,
    occurrence: {
      occurrenceId,
      occurrenceVersion,
      status: 'COMPLETE',
      outcome: null,
      pending: null
    }
  })
  const storedExecution = buildEncounterActionStoredExecution({
    prepared,
    execution,
    occurrenceId,
    occurrenceVersion,
    settled: mechanics,
    effects: settlement,
    maintainedState: settlement.maintainedState,
    maintenanceTransition: settlement.maintenanceTransition
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
            attackKind: ['MELEE_WEAPON_ATTACK', 'UNARMED_ATTACK'].includes(
              prepared.source.kind === 'CREATURE'
                ? prepared.source.capability.mechanicFacts.invocation.triggerCode
                : prepared.source.candidate.mechanicFacts.invocation.triggerCode
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
    projection,
    result,
    storedExecution,
    cleaving,
    revisions
  }
}

/** Persists the sealed pending root before a room may acknowledge an assisted action. */
export async function commitNativeLiveEncounterActionPending(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  plan: Extract<Awaited<ReturnType<typeof planNativeLiveEncounterAction>>, { kind: 'PENDING' }>
) {
  const input = liveSessionEncounterActionPendingInputSchema.parse({
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
        initiatorUserId: scope.expectedUserId,
        currentnessChecksum: plan.currentnessChecksum,
        d20Policy: plan.execution.d20Policy,
        twoPhase: plan.execution.twoPhase
      },
      ...(plan.execution.phaseReceipts ? { phaseReceipts: plan.execution.phaseReceipts } : {})
    }
  })
  return callLiveSessionRoute(environment, accessToken, 'encounterActionPending', input)
}

/** Publishes the completed root and its dependent records in one authenticated transaction. */
export async function commitNativeLiveEncounterAction(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
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
  const input = liveSessionEncounterActionCommitInputSchema.parse({
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
    actionEconomy: plan.actionEconomy,
    createdEffects: plan.settlement.createdEffects,
    maintainedState: plan.settlement.maintainedState,
    concentration: plan.concentration.completed,
    pendingConcentration: plan.concentration.pending,
    cleaving: plan.cleaving
  })
  return callLiveSessionRoute(environment, accessToken, 'encounterActionCommit', input)
}
