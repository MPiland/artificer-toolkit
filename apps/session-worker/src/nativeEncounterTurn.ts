import {
  liveSessionEncounterRulesInputSchema,
  type LiveSessionEncounterRulesInput,
  type LiveSessionEncounterRulesRequest,
  type LiveSessionEncounterRulesResponse
} from '@artificer-toolkit/schema/api/liveSessionEncounterRules'
import type { LiveSessionRulesRevisions } from '@artificer-toolkit/schema/api/liveSessionRulesRevisions'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import { prepareEncounterTurn } from '@artificer-toolkit/rules-runtime/encounterTurnPreparation'
import { prepareEncounterTurnResponse } from '@artificer-toolkit/rules-runtime/encounterTurnResponse'
import { restoreEncounterInitiativeTurnActors } from '@artificer-toolkit/rules-runtime/encounterTurnInitiativeReplay'
import { validateInitiativeCursor } from '@artificer-toolkit/rules-runtime/encounterInitiativeCursor'
import { planEncounterInitiativeAdvance } from '@artificer-toolkit/rules-runtime/encounterInitiativeStateSettlement'
import type { RulesRuntimeService } from '@artificer-toolkit/rules-runtime/rulesRuntimeService'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { mergeNativeRulesRevisions } from './nativeRulesRevisions.js'
import { callLiveSessionRoute, type NativeLiveSessionEnvironment } from './liveSessionRoutes.js'
import {
  prepareNativeLiveMovementTarget,
  readNativeLiveActorsAndEffects
} from './nativeEncounterTargets.js'
import { createNativeLiveTurnStages } from './nativeEncounterTurnPreparation.js'
import { prepareNativeLiveTurnCompletion } from './nativeEncounterTurnCompletion.js'
import { liveSessionEncounterTurnCommitInputSchema } from '@artificer-toolkit/schema/api/liveSessionEncounterTurn'

type LiveTurnCommand = Extract<
  LiveSessionEncounterRulesRequest,
  { kind: 'TURN_COMMAND' }
>['command']

/** Plans the turn without writes; the caller must atomically commit it before acknowledging it. */
export async function planNativeLiveEncounterTurn(
  environment: NativeLiveSessionEnvironment,
  accessToken: string,
  scope: Omit<LiveSessionEncounterRulesInput, 'request'>,
  command: LiveTurnCommand,
  execution: { runtime: RulesRuntimeService; random(maximum: number): number }
) {
  const initial = liveSessionEncounterRulesInputSchema.parse({
    ...scope,
    ...(scope.expectedRole === 'PLAYER' && command.type === 'RESOLVE_RULE_OCCURRENCE'
      ? { turnResponse: command }
      : {}),
    request: { kind: 'TURN_COMMAND', command }
  })
  let revisions: LiveSessionRulesRevisions = []
  const dependencies: Array<{ request: LiveSessionEncounterRulesRequest; readChecksum: string }> =
    []
  const reads = new Map<string, Promise<LiveSessionEncounterRulesResponse>>()
  function capture(request: LiveSessionEncounterRulesRequest) {
    const key = checksumCanonicalJson(request)
    let read = reads.get(key)
    if (!read) {
      read = (async () => {
        const input = liveSessionEncounterRulesInputSchema.parse({ ...initial, request })
        const response = await callLiveSessionRoute(
          environment,
          accessToken,
          'encounterRules',
          input
        )
        if (response.kind !== request.kind) throw new Error('Turn capture kind mismatch.')
        revisions = mergeNativeRulesRevisions(revisions, response.revisions)
        dependencies.push({ request: input.request, readChecksum: response.readChecksum })
        return response
      })()
      reads.set(key, read)
    }
    return read
  }
  const admission = await capture(initial.request)
  if (
    admission.kind !== 'TURN_COMMAND' ||
    admission.fingerprint !== checksumCanonicalJson(admission.command)
  )
    throw new Error('Turn command is unavailable.')
  const context = admission.snapshot?.applicationContext
  const initiativeReplay =
    admission.result &&
    (context?.kind === 'ENCOUNTER_INITIATIVE' ||
      context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION')
      ? context.root
      : null
  if (admission.result && (!initiativeReplay || initial.expectedRole === 'PLAYER'))
    return { kind: 'REPLAY' as const, result: admission.result }
  const inputs = await capture({ kind: 'INPUTS' })
  if (inputs.kind !== 'INPUTS') throw new Error('Turn inputs are unavailable.')
  const { state, system } = inputs
  const starting =
    admission.command.type === 'START' ||
    ((context?.kind === 'ENCOUNTER_INITIATIVE' ||
      context?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION' ||
      context?.kind === 'ENCOUNTER_TURN_RECHARGE' ||
      context?.kind === 'ENCOUNTER_TURN_ACTIVE_EFFECTS' ||
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' ||
      context?.kind === 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE') &&
      context.root.commandType === 'START')
  if (
    state.id !== initial.encounterId ||
    state.version !== initial.expectedVersion ||
    state.campaignId !== initial.campaignId ||
    state.sessionId !== initial.sessionId ||
    state.gameSystemId !== system.id ||
    state.status !== (starting ? 'PREPARED' : 'ACTIVE') ||
    (starting ? state.currentActorId !== null : state.currentActorId === null)
  )
    throw new Error('Turn input binding mismatch.')
  const campaign = { id: state.campaignId, ownerUserId: admission.campaignOwnerUserId }
  const { actors, activeEffectsByActorId } = await readNativeLiveActorsAndEffects({
    state,
    capture
  })
  const targetReads = new Map<string, ReturnType<typeof prepareNativeLiveMovementTarget>>()
  async function loadTarget(actorId: string) {
    const actor = actors.find((candidate) => candidate.id === actorId)
    if (!actor) return undefined
    let read = targetReads.get(actorId)
    if (!read) {
      read = prepareNativeLiveMovementTarget({
        environment,
        accessToken,
        scope: initial,
        state,
        actor,
        activeEffectsByActorId
      })
      targetReads.set(actorId, read)
    }
    const prepared = await read
    revisions = mergeNativeRulesRevisions(revisions, prepared.revisions)
    return prepared.target
  }
  const scenes: Array<{ sceneId: string; sceneVersion: number; definitionSaveId: string }> = []
  const stages = createNativeLiveTurnStages(
    { state, actors },
    {
      system,
      activeEffectsByActorId,
      capture,
      loadTarget,
      ...execution,
      onSceneRead: (fence) => {
        const prior = scenes.find((scene) => scene.sceneId === fence.sceneId)
        if (prior && checksumCanonicalJson(prior) !== checksumCanonicalJson(fence))
          throw new Error('Turn Scene changed during preparation.')
        if (!prior) scenes.push(fence)
      }
    }
  )
  async function readInitiativeRound() {
    const response = await capture({ kind: 'INITIATIVE_ROUND' })
    if (response.kind !== 'INITIATIVE_ROUND') throw new Error('Turn initiative is unavailable.')
    return response.state
  }
  const occurredAt = new Date().toISOString()
  if (initiativeReplay) {
    if (!admission.result?.occurrence) throw new Error('Pending turn occurrence is unavailable.')
    await restoreEncounterInitiativeTurnActors({
      state,
      campaign,
      root: initiativeReplay,
      occurrenceId: admission.result.occurrence.occurrenceId,
      updatedAt: occurredAt,
      readActors: async () => actors,
      readInitiativeRound,
      prepareEffects: stages.effects,
      prepareLegendary: stages.legendary
    })
    return { kind: 'REPLAY' as const, result: admission.result }
  }
  let root: TurnCoordinatorRootDto
  let occurrenceId: string
  let pending: typeof admission.snapshot | undefined
  let resolution:
    | Extract<LiveTurnCommand, { type: 'RESOLVE_RULE_OCCURRENCE' }>['resolution']
    | undefined
  let rawDie: number | undefined
  let initiativeResume: Parameters<typeof stages.initiative>[0]['resume']
  let initiativeActors = actors
  let initiativeTargets: Parameters<typeof stages.initiative>[0]['movementTargets']
  if (admission.command.type === 'START') {
    root = {
      rootCommandId: admission.command.commandId,
      commandFingerprint: admission.fingerprint,
      commandType: 'START',
      initiatorUserId: initial.expectedUserId,
      correlationId: null,
      expectedEncounterVersion: state.version,
      startSystemId: admission.command.systemId ?? null,
      frozenActorRuleRevisionId: null,
      frozenActorRuleRevisionChecksum: null,
      frozenActorRuleSnapshotChecksum: null,
      initiative: null,
      initiativeAdvance: null,
      resolutionCommands: [],
      proposedTerminalTransition: { status: 'ACTIVE', round: 1, currentActorId: null }
    }
    occurrenceId = crypto.randomUUID()
  } else if (admission.command.type === 'ADVANCE_TURN') {
    if (state.currentActorId === null) throw new Error('Turn input binding mismatch.')
    const normalized = await readInitiativeRound()
    if (!normalized) throw new Error('The normalized initiative round is unavailable.')
    if (
      normalized.round.policySnapshotChecksum !==
      (state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum)
    )
      throw new Error('Initiative policy snapshot does not match the Encounter Run.')
    validateInitiativeCursor({
      state: normalized,
      currentActorId: state.currentActorId,
      actorIds: state.actorIds,
      allowedSideIds: state.sides.map((side) => side.id)
    })
    const advance = planEncounterInitiativeAdvance({
      state: normalized,
      currentActorId: state.currentActorId
    })
    root = {
      rootCommandId: admission.command.commandId,
      commandFingerprint: admission.fingerprint,
      commandType: 'ADVANCE_TURN',
      initiatorUserId: initial.expectedUserId,
      correlationId: null,
      expectedEncounterVersion: state.version,
      startSystemId: null,
      frozenActorRuleRevisionId: null,
      frozenActorRuleRevisionChecksum: null,
      frozenActorRuleSnapshotChecksum: null,
      initiative: null,
      initiativeAdvance: advance,
      resolutionCommands: [],
      proposedTerminalTransition: {
        status: 'ACTIVE',
        round: advance.kind === 'SAME_ROUND' ? state.round : advance.nextRound,
        currentActorId: advance.kind === 'SAME_ROUND' ? advance.nextActorId : advance.firstActorId
      }
    }
    occurrenceId = crypto.randomUUID()
  } else {
    const snapshot = admission.snapshot
    const version = admission.occurrenceVersion
    if (!snapshot || version === null) throw new Error('Pending turn occurrence is unavailable.')
    const pendingContext = snapshot.applicationContext
    if (
      pendingContext.kind !== 'ENCOUNTER_INITIATIVE' &&
      pendingContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' &&
      pendingContext.kind !== 'ENCOUNTER_TURN_RECHARGE' &&
      pendingContext.kind !== 'ENCOUNTER_TURN_ACTIVE_EFFECTS' &&
      pendingContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_CHOICE' &&
      pendingContext.kind !== 'ENCOUNTER_TURN_LEGENDARY_ACTION_EVIDENCE'
    )
      throw new Error('Encounter turn response is unavailable.')
    const response = prepareEncounterTurnResponse({
      pending: snapshot,
      command: admission.command,
      userId: initial.expectedUserId,
      ownerUserId: campaign.ownerUserId,
      occurrence: {
        id: snapshot.occurrenceId,
        rootCommandId: pendingContext.root.rootCommandId,
        version,
        expectedEncounterVersion: state.version
      },
      encounterVersion: state.version
    })
    if (response.kind === 'REPLAY') {
      if (!admission.result) throw new Error('Pending turn replay is unavailable.')
      return { kind: 'REPLAY' as const, result: admission.result }
    }
    occurrenceId = snapshot.occurrenceId
    if (response.kind === 'INITIATIVE') {
      const retained = response.root
      const restored = await restoreEncounterInitiativeTurnActors({
        state,
        campaign,
        root: retained,
        occurrenceId,
        updatedAt: occurredAt,
        readActors: async () => actors,
        readInitiativeRound,
        prepareEffects: stages.effects,
        prepareLegendary: stages.legendary
      })
      initiativeActors = restored.actors
      initiativeTargets = restored.movementTargets
      initiativeResume = { pending: response.pending, resolution: admission.command.resolution }
      root = {
        rootCommandId: retained.rootCommandId,
        commandFingerprint: retained.commandFingerprint,
        commandType: retained.commandType,
        initiatorUserId: retained.initiatorUserId,
        correlationId: retained.correlationId,
        expectedEncounterVersion: retained.expectedEncounterVersion,
        startSystemId: retained.startSystemId,
        frozenActorRuleRevisionId: null,
        frozenActorRuleRevisionChecksum: null,
        frozenActorRuleSnapshotChecksum: null,
        initiative: null,
        initiativeAdvance: retained.initiativeAdvance ?? null,
        ...(retained.outgoingTurn ? { outgoingTurn: retained.outgoingTurn } : {}),
        ...(retained.completedLegendaryActions
          ? { completedLegendaryActions: retained.completedLegendaryActions }
          : {}),
        resolutionCommands: retained.resolutionCommands,
        proposedTerminalTransition: {
          status: 'ACTIVE',
          round: retained.round,
          currentActorId: null
        }
      }
    } else {
      root = response.root
      pending = response.pending
      resolution = admission.command.resolution
      if (pendingContext.kind === 'ENCOUNTER_TURN_RECHARGE') {
        if (resolution.kind === 'ENTER_INTEGER') rawDie = resolution.value
        else if (resolution.kind === 'SYSTEM_ROLL') rawDie = execution.random(6) + 1
      }
    }
  }
  if (admission.command.type === 'START' || initiativeResume) {
    const initiative = await stages.initiative({
      state,
      root,
      occurrenceId,
      actors: initiativeActors,
      ...(initiativeTargets ? { movementTargets: initiativeTargets } : {}),
      ...(initiativeResume ? { resume: initiativeResume } : {})
    })
    if (initiative.kind === 'PENDING')
      return {
        kind: 'PLANNED' as const,
        command: admission.command,
        state,
        actors,
        occurrenceId,
        occurredAt,
        prepared: initiative,
        revisions,
        dependencies,
        scenes,
        terminal: null
      }
    root = initiative.root
  }
  const prepared = await prepareEncounterTurn(
    {
      state,
      campaign,
      root,
      occurrenceId,
      actors,
      updatedAt: occurredAt,
      ...(pending ? { pending } : {}),
      ...(resolution ? { resolution } : {}),
      ...(rawDie === undefined ? {} : { rawDie })
    },
    stages
  )
  const completion =
    prepared.kind === 'COMPLETE'
      ? await prepareNativeLiveTurnCompletion({
          state,
          prepared,
          occurrenceId,
          occurredAt,
          activeEffectsByActorId,
          capture,
          ...execution
        })
      : null
  const terminal =
    prepared.kind === 'COMPLETE' && completion
      ? liveSessionEncounterTurnCommitInputSchema.parse({
          ...scope,
          command: admission.command,
          revisions,
          scenes,
          occurrenceId,
          occurredAt,
          root: prepared.root,
          incomingTurn: prepared.incoming.phase,
          rules: completion.rules,
          maintenanceOwners: [
            ...new Map(
              dependencies.flatMap((dependency) =>
                dependency.request.kind === 'MAINTENANCE_OWNER'
                  ? [[checksumCanonicalJson(dependency.request), dependency.request] as const]
                  : []
              )
            ).values()
          ],
          concentration: completion.concentration.completed,
          pendingConcentration: completion.concentration.pending
        })
      : null
  return {
    kind: 'PLANNED' as const,
    command: admission.command,
    state,
    actors,
    occurrenceId,
    occurredAt,
    prepared,
    revisions,
    dependencies,
    scenes,
    terminal
  }
}
