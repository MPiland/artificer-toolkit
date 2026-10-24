import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { InitiativeFactSources } from '@artificer-toolkit/schema/shared/initiativeFactSources'
import { encounterInitiativeSettlementDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionInitiative'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import type { ServerRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { stableActors } from './encounterActorState.js'
import { skippedEncounterActorIds, type DeadCharacterIds } from './encounterActorDefeat.js'
import {
  firstUndefeatedActorId,
  skipDefeatedOpeningTurns
} from './encounterInitiativeStateSettlement.js'
import {
  compileEncounterInitiativeDeclaration,
  createEncounterInitiativeDeclarationRequest,
  type InitiativeDeclarationSource
} from './encounterInitiativeDeclarationCompiler.js'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  resumeEncounterInitiativeLifecycle,
  startEncounterInitiativeLifecycle,
  type EncounterInitiativeLifecycleResult
} from './encounterInitiativeLifecycle.js'
import { createEncounterInitiativeScoreEntities } from './encounterInitiativeEntities.js'
import {
  createEncounterInitiativeDeclarationPendingSnapshot,
  createEncounterInitiativePendingSnapshot,
  restoreEncounterInitiativePending
} from './encounterInitiativeOccurrence.js'
import {
  createStagedInitiativeRoundState,
  hydrateStagedState,
  inMemoryInitiativeRepository,
  serializeStagedInitiativeRoundState
} from './encounterInitiativeStaging.js'
import { initiativeCapabilityRegistry } from './platformEncounterPolicy.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import { encounterEvidenceMode } from './encounterEvidenceMode.js'
import {
  resolveEncounterIntegerAnswer,
  type EncounterResponseAnswer
} from './encounterEvidenceAnswer.js'

type InitiativeRoot = Parameters<typeof createEncounterInitiativePendingSnapshot>[0]['root']

/** Starts initial or each-round initiative after the required turn boundary is settled. */
export async function prepareEncounterTurnInitiative(input: {
  state: EncounterRunState
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: readonly EncounterRunActorState[]
  /** The Characters dead once the turn's effects settled (D96); they keep their rolled place but are skipped. */
  deadCharacterIds: DeadCharacterIds
  /** The roller's auto-roll preference; the initiator rolls initiative in this slice. */
  autoRoll: boolean
  loadSources(): Promise<InitiativeFactSources>
  loadDeclarations(): Promise<{
    sources: readonly (InitiativeDeclarationSource & { controllerUserId: string | null })[]
  }>
  createRuntime(): Promise<RulesRuntimeService>
  integerSource(input: { min: number; max: number }): number
  createRequestId(): string
  resume?: {
    pending: ServerRuleExecutionPendingSnapshotDto
    resolution: EncounterResponseAnswer
  }
}): Promise<
  | { kind: 'PENDING'; snapshot: ServerRuleExecutionPendingSnapshotDto }
  | { kind: 'COMPLETE'; root: TurnCoordinatorRootDto }
> {
  const { state, root, occurrenceId, actors } = input
  const advance = root.initiativeAdvance
  const initial = root.commandType === 'START'
  const snapshot =
    initial && state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshot
  const snapshotChecksum =
    initial && state.automationMode === 'MANUAL' ? null : state.initiativePolicySnapshotChecksum
  // A manual start rolls no policy, so it needs none from the System.
  const adapter = snapshot ? initiativeCapabilityRegistry.require(state.gameSystemId) : null
  let round: number
  let beforePin: InitiativeRoot['initiativeBeforePin']
  let legacyOrderedActorIds: readonly string[]
  if (initial) {
    if (
      state.status !== 'PREPARED' ||
      actors.length === 0 ||
      advance ||
      root.outgoingTurn ||
      root.completedLegendaryActions ||
      root.legendaryActionQueue ||
      root.initiative ||
      root.stagedInitiative ||
      (root.startSystemId !== null && root.startSystemId !== state.gameSystemId) ||
      (state.automationMode !== 'MANUAL' && (!snapshot || !snapshotChecksum))
    )
      throw new Error('Encounter start initiative is unavailable.')
    round = 1
    beforePin = { kind: 'INITIAL_START', actorIds: [...state.actorIds].sort() }
    legacyOrderedActorIds = stableActors({ actors }).map((actor) => actor.id)
  } else {
    if (
      !advance ||
      advance.kind !== 'ROUND_WRAP' ||
      advance.cadence !== 'EACH_ROUND' ||
      !root.outgoingTurn ||
      root.legendaryActionQueue ||
      root.initiative ||
      !snapshot ||
      !snapshotChecksum
    )
      throw new Error('New-round initiative is unavailable.')
    round = advance.nextRound
    beforePin = {
      kind: 'EACH_ROUND',
      round: advance.round,
      version: state.version,
      checksum: advance.stateChecksum,
      actorIds: [...state.actorIds].sort()
    }
    legacyOrderedActorIds = advance.orderedActorIds
  }
  const resume = input.resume
  const pendingSnapshot = resume?.pending
  const pendingContext = pendingSnapshot?.applicationContext
  if (resume && pendingSnapshot) {
    if (
      !pendingContext ||
      ((pendingSnapshot.snapshotKind !== 'KERNEL_EVIDENCE' ||
        pendingContext.kind !== 'ENCOUNTER_INITIATIVE') &&
        (pendingSnapshot.snapshotKind !== 'AGGREGATE_CHOICE' ||
          pendingContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION')) ||
      pendingSnapshot.occurrenceId !== occurrenceId ||
      !snapshot ||
      !snapshotChecksum ||
      state.automationMode === 'MANUAL'
    )
      throw new Error('Encounter initiative continuation is unavailable.')
    const retained = pendingContext.root
    const cohort = [...state.actorIds].sort()
    if (
      retained.rootCommandId !== root.rootCommandId ||
      retained.commandFingerprint !== root.commandFingerprint ||
      retained.commandType !== root.commandType ||
      retained.initiatorUserId !== root.initiatorUserId ||
      retained.correlationId !== root.correlationId ||
      retained.expectedEncounterVersion !== root.expectedEncounterVersion ||
      retained.startSystemId !== root.startSystemId ||
      retained.round !== round ||
      retained.policySnapshotChecksum !== snapshotChecksum ||
      checksumCanonicalJson(retained.initiativeBeforePin) !== checksumCanonicalJson(beforePin) ||
      checksumCanonicalJson(retained.initiativeAdvance ?? null) !==
        checksumCanonicalJson(advance) ||
      checksumCanonicalJson(retained.outgoingTurn ?? null) !==
        checksumCanonicalJson(root.outgoingTurn ?? null) ||
      checksumCanonicalJson(retained.completedLegendaryActions ?? null) !==
        checksumCanonicalJson(root.completedLegendaryActions ?? null) ||
      checksumCanonicalJson(root.resolutionCommands) !==
        checksumCanonicalJson(retained.resolutionCommands) ||
      retained.stagedInitiativeRoundState.round.encounterId !== state.id ||
      retained.stagedInitiativeRoundState.round.round !== round ||
      retained.stagedInitiativeRoundState.round.procedure !== snapshot.policy.document.procedure ||
      retained.stagedInitiativeRoundState.round.policySnapshotChecksum !== snapshotChecksum ||
      checksumCanonicalJson(
        retained.stagedInitiativeRoundState.participants
          .map((participant) => participant.actorId)
          .sort()
      ) !== checksumCanonicalJson(cohort) ||
      retained.stagedInitiativeRoundState.participants.some(
        (participant) =>
          actors.find((actor) => actor.id === participant.actorId)?.sideId !== participant.sideId
      )
    )
      throw new Error('Encounter initiative continuation is stale.')
    const resolution = resume.resolution
    if (pendingContext.kind === 'ENCOUNTER_INITIATIVE') {
      if (pendingSnapshot.snapshotKind !== 'KERNEL_EVIDENCE')
        throw new Error('Encounter initiative continuation is unavailable.')
      const request = pendingSnapshot.request
      const scorePhase =
        pendingContext.phase.kind === 'PRIMARY_SCORE' ||
        pendingContext.phase.kind === 'TIE_RESOLUTION'
      if (
        request.kind !== 'INTEGER_RANGE' ||
        (resolution.kind !== 'ENTER_INTEGER' &&
          resolution.kind !== 'SYSTEM_ROLL' &&
          resolution.kind !== 'INITIATIVE_ENTITY')
      )
        throw new Error('Encounter initiative resolution is unavailable.')
      if (
        resolution.requestId !== request.requestId ||
        (scorePhase && resolution.kind === 'INITIATIVE_ENTITY') ||
        (!scorePhase && resolution.kind !== 'INITIATIVE_ENTITY')
      )
        throw new Error('Encounter initiative resolution is unavailable.')
    } else if (
      pendingContext.kind !== 'ENCOUNTER_INITIATIVE_DECLARATION' ||
      resolution.kind !== 'INITIATIVE_DECLARATION' ||
      resolution.requestId !== pendingContext.request.requestId ||
      snapshot?.policy.document.procedure !== 'DECLARED_ACTION_ROLL'
    )
      throw new Error('Encounter initiative declaration is unavailable.')
  }
  const staged = inMemoryInitiativeRepository(
    hydrateStagedState(
      pendingContext?.kind === 'ENCOUNTER_INITIATIVE' ||
        pendingContext?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION'
        ? pendingContext.root.stagedInitiativeRoundState
        : createStagedInitiativeRoundState({
            encounter: {
              ...state,
              actors: actors.map(({ id, sideId, owner }) => ({ id, sideId, owner }))
            },
            round
          })
    )
  )
  const pendingRoot: InitiativeRoot | null = snapshotChecksum
    ? {
        rootCommandId: root.rootCommandId,
        commandFingerprint: root.commandFingerprint,
        commandType: root.commandType,
        initiatorUserId: root.initiatorUserId,
        requestedByUserId: root.requestedByUserId,
        correlationId: root.correlationId,
        expectedEncounterVersion: root.expectedEncounterVersion,
        round,
        policySnapshotChecksum: snapshotChecksum,
        initiativeBeforePin: beforePin,
        stagedInitiativeRoundState: serializeStagedInitiativeRoundState(staged.read()),
        startSystemId: root.startSystemId,
        ...(advance ? { initiativeAdvance: advance } : {}),
        ...(root.outgoingTurn ? { outgoingTurn: root.outgoingTurn } : {}),
        ...(root.completedLegendaryActions
          ? { completedLegendaryActions: root.completedLegendaryActions }
          : {}),
        resolutionCommands: root.resolutionCommands
      }
    : null
  if (!resume && snapshot?.policy.document.procedure === 'DECLARED_ACTION_ROLL') {
    if (!pendingRoot) throw new Error('Initiative declaration requires a frozen policy.')
    const declarations = await input.loadDeclarations()
    const participant = staged
      .read()
      .participants.find((candidate) => candidate.declaration === null)
    const source =
      participant &&
      declarations.sources.find((candidate) => candidate.actor.id === participant.actorId)
    if (!participant || !source) throw new Error('Initiative declaration source is unavailable.')
    return {
      kind: 'PENDING' as const,
      snapshot: createEncounterInitiativeDeclarationPendingSnapshot({
        occurrenceId,
        root: pendingRoot,
        request: createEncounterInitiativeDeclarationRequest({
          requestId: input.createRequestId(),
          encounterId: state.id,
          round,
          actorId: participant.actorId,
          participantExpectedVersion: participant.version,
          controllerUserId: source.controllerUserId,
          source
        })
      })
    }
  }
  if (resume && pendingContext?.kind === 'ENCOUNTER_INITIATIVE_DECLARATION') {
    if (!pendingRoot || resume.resolution.kind !== 'INITIATIVE_DECLARATION')
      throw new Error('Encounter initiative declaration is unavailable.')
    const request = pendingContext.request
    const declarations = await input.loadDeclarations()
    const participant = staged
      .read()
      .participants.find((entry) => entry.actorId === request.actorId)
    const source = declarations.sources.find((entry) => entry.actor.id === request.actorId)
    if (
      !participant ||
      !source ||
      participant.declaration !== null ||
      participant.version !== request.participantExpectedVersion
    )
      throw new Error('Initiative declaration is stale.')
    const current = createEncounterInitiativeDeclarationRequest({
      ...request,
      participantExpectedVersion: participant.version,
      controllerUserId: source.controllerUserId,
      source
    })
    if (checksumCanonicalJson(current) !== checksumCanonicalJson(request))
      throw new Error('Initiative declaration options are stale.')
    const { primary, bonus } = resume.resolution
    if (
      !current.primaryOptions.some(
        (option) => option.kind === primary.kind && option.optionId === primary.optionId
      ) ||
      (bonus !== null &&
        !current.bonusOptions.some(
          (option) => option.kind === bonus.kind && option.optionId === bonus.optionId
        ))
    )
      throw new Error('Initiative declaration selection is unavailable.')
    const compiled = compileEncounterInitiativeDeclaration({ source, primary, bonus })
    await staged.repository.updateInitiativeParticipant({
      encounterId: participant.encounterId,
      round: participant.round,
      actorId: participant.actorId,
      expectedVersion: participant.version,
      status: participant.status,
      initiativeScore: participant.initiativeScore,
      evaluation: participant.evaluation,
      tie: participant.tie,
      declaration: compiled.declaration,
      declarationChecksum: compiled.checksum,
      turnOrderOrdinal: participant.turnOrderOrdinal
    })
    const nextParticipant = staged.read().participants.find((entry) => entry.declaration === null)
    if (nextParticipant) {
      const nextSource = declarations.sources.find(
        (entry) => entry.actor.id === nextParticipant.actorId
      )
      if (!nextSource) throw new Error('Initiative declaration source is unavailable.')
      return {
        kind: 'PENDING' as const,
        snapshot: createEncounterInitiativeDeclarationPendingSnapshot({
          occurrenceId,
          root: {
            ...pendingRoot,
            stagedInitiativeRoundState: serializeStagedInitiativeRoundState(staged.read())
          },
          request: createEncounterInitiativeDeclarationRequest({
            requestId: input.createRequestId(),
            encounterId: state.id,
            round,
            actorId: nextParticipant.actorId,
            participantExpectedVersion: nextParticipant.version,
            controllerUserId: nextSource.controllerUserId,
            source: nextSource
          })
        })
      }
    }
  }
  let result: EncounterInitiativeLifecycleResult
  if (resume && pendingContext?.kind === 'ENCOUNTER_INITIATIVE') {
    if (
      pendingSnapshot?.snapshotKind !== 'KERNEL_EVIDENCE' ||
      !snapshot ||
      !snapshotChecksum ||
      !adapter
    )
      throw new Error('Encounter initiative continuation is unavailable.')
    const sources = await input.loadSources()
    const restored = restoreEncounterInitiativePending({
      pendingSnapshot,
      entities: createEncounterInitiativeScoreEntities({
        state: staged.read(),
        sources,
        adapter
      }),
      actorIds: state.actorIds
    })
    const resolution = resume.resolution
    const request = pendingSnapshot.request
    if (
      request.kind !== 'INTEGER_RANGE' ||
      (resolution.kind !== 'ENTER_INTEGER' &&
        resolution.kind !== 'SYSTEM_ROLL' &&
        resolution.kind !== 'INITIATIVE_ENTITY')
    )
      throw new Error('Encounter initiative resolution is unavailable.')
    const value =
      resolution.kind === 'INITIATIVE_ENTITY'
        ? { selectedEntityId: resolution.entityId }
        : resolveEncounterIntegerAnswer({
            min: request.min,
            max: request.max,
            answer: resolution,
            random: (maxExclusive) => input.integerSource({ min: 0, max: maxExclusive - 1 })
          })
    result = await resumeEncounterInitiativeLifecycle({
      repository: staged.repository,
      runtime: await input.createRuntime(),
      gameSystemId: state.gameSystemId,
      state: staged.read(),
      snapshot,
      snapshotChecksum,
      sources,
      adapter,
      mode: encounterEvidenceMode(state.automationMode, input.autoRoll),
      pending: restored.pending,
      requestId: resolution.requestId,
      value,
      integerSource: input.integerSource
    })
  } else {
    result = await startEncounterInitiativeLifecycle({
      repository: staged.repository,
      runtime: snapshot ? await input.createRuntime() : null,
      occurrenceId,
      gameSystemId: state.gameSystemId,
      state: staged.read(),
      snapshot,
      snapshotChecksum,
      sources: snapshot ? await input.loadSources() : { characterIds: [], actors: [] },
      adapter,
      mode: encounterEvidenceMode(state.automationMode, input.autoRoll),
      legacyOrderedActorIds,
      integerSource: input.integerSource
    })
  }
  if (result.kind === 'PENDING') {
    if (!pendingRoot) throw new Error('Pending initiative requires a frozen policy.')
    return {
      kind: 'PENDING' as const,
      snapshot: createEncounterInitiativePendingSnapshot({
        root: {
          ...pendingRoot,
          stagedInitiativeRoundState: serializeStagedInitiativeRoundState(result.state)
        },
        pending: result.pending
      })
    }
  }
  if (result.orderedActorIds.length === 0) throw new Error('Encounter initiative did not settle.')
  // Defeated actors keep their rolled place, but the round opens with the first that can act (D63).
  const defeatedActorIds = skippedEncounterActorIds(actors, input.deadCharacterIds)
  const roundState = await skipDefeatedOpeningTurns({
    repository: staged.repository,
    state: result.state,
    defeatedActorIds
  })
  const initiative = encounterInitiativeSettlementDtoSchema.parse({
    round: result.state.round.round,
    cadence: result.state.round.cadence,
    procedure: result.state.round.procedure,
    policySnapshotChecksum: result.state.round.policySnapshotChecksum,
    orderedActorIds: result.orderedActorIds,
    orderedSideIds: result.orderedSideIds,
    evidence: result.evidence
  })
  return {
    kind: 'COMPLETE' as const,
    root: {
      ...root,
      initiative,
      stagedInitiative: {
        beforePin,
        stagedRoundState: serializeStagedInitiativeRoundState(roundState)
      },
      proposedTerminalTransition: {
        status: 'ACTIVE' as const,
        round,
        currentActorId: firstUndefeatedActorId(result.orderedActorIds, defeatedActorIds)
      }
    }
  }
}
