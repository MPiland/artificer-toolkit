import {
  checksumCanonicalJson,
  createEncounterRepository,
  type DBLike,
  type EncounterInitiativeRoundStateRecord,
  type EncounterRecord
} from '@artificer-toolkit/db'
import type { EncounterActorRuleOutput } from '@artificer-toolkit/schema/api/encounterActorRules'
import type { ServerInitiativeDeclarationRequestDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type { EncounterInitiativeAdvancePlanDto } from '@artificer-toolkit/schema/shared/rulesExecution'
import type {
  InitiativeBeforePinDto,
  StagedInitiativeRoundStateDto
} from '@artificer-toolkit/schema/shared/rulesExecution'

import { initiativeFactAdapterRegistry } from '../rules/initiativeFactAdapterRegistry.js'
import type { RulesRuntimeService } from '../rules/rulesRuntimeService.js'
import { createEncounterInitiativeScoreEntities } from './encounterInitiativeEntities.js'
import {
  lockEncounterInitiativeFactSources,
  type LockedEncounterInitiativeActorSource
} from './encounterInitiativeFactSources.js'
import {
  compileEncounterInitiativeDeclaration,
  createEncounterInitiativeDeclarationRequest,
  type InitiativeDeclarationSelection
} from './encounterInitiativeDeclarationSources.js'
import {
  resumeEncounterInitiativeLifecycle,
  startEncounterInitiativeLifecycle,
  type EncounterInitiativeLifecycleResult
} from './encounterInitiativeLifecycle.js'
import { restoreEncounterInitiativePending } from './encounterInitiativeOccurrence.js'
import {
  applyEncounterInitiativeAdvance,
  settleEncounterInitiativeRound
} from './encounterInitiativeStateSettlement.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import type { TrustedInitiativeIntegerSource } from './encounterInitiativeScoreBatch.js'

type InitiativeRepository = Pick<
  ReturnType<typeof createEncounterRepository>,
  | 'createInitiativeRound'
  | 'lockInitiativeRound'
  | 'updateInitiativeParticipant'
  | 'updateInitiativeRound'
  | 'updateInitiativeSide'
>

type MutableInitiativeRepository = Pick<
  ReturnType<typeof createEncounterRepository>,
  'updateInitiativeParticipant' | 'updateInitiativeRound' | 'updateInitiativeSide'
>

export type EncounterInitiativeCommandResult =
  | EncounterInitiativeLifecycleResult
  | {
      kind: 'DECLARATION_PENDING'
      state: EncounterInitiativeRoundStateRecord
      actorId: string
      source: LockedEncounterInitiativeActorSource
    }

function stagedStateFromRecord(
  state: EncounterInitiativeRoundStateRecord
): StagedInitiativeRoundStateDto {
  return {
    round: {
      encounterId: state.round.encounterId,
      round: state.round.round,
      procedure: state.round.procedure,
      cadence: state.round.cadence,
      status: state.round.status,
      policySnapshotChecksum: state.round.policySnapshotChecksum,
      nextTurnOrderOrdinal: state.round.nextTurnOrderOrdinal,
      version: state.round.version
    },
    participants: state.participants.map((participant) => ({
      encounterId: participant.encounterId,
      round: participant.round,
      actorId: participant.actorId,
      sideId: participant.sideId,
      status: participant.status,
      initiativeScore: participant.initiativeScore,
      evaluation: participant.evaluation,
      tie: participant.tie,
      declaration: participant.declaration,
      declarationChecksum: participant.declarationChecksum,
      turnOrderOrdinal: participant.turnOrderOrdinal,
      version: participant.version
    })),
    sides: state.sides.map((side) => ({
      encounterId: side.encounterId,
      round: side.round,
      sideId: side.sideId,
      status: side.status,
      initiativeScore: side.initiativeScore,
      evaluation: side.evaluation,
      tie: side.tie,
      sideOrderOrdinal: side.sideOrderOrdinal,
      version: side.version
    }))
  }
}

function hydrateStagedState(
  input: StagedInitiativeRoundStateDto
): EncounterInitiativeRoundStateRecord {
  const timestamp = '1970-01-01T00:00:00.000Z'
  return {
    round: { ...input.round, createdAt: timestamp, updatedAt: timestamp },
    participants: input.participants.map((participant) => ({
      ...participant,
      createdAt: timestamp,
      updatedAt: timestamp
    })),
    sides: input.sides.map((side) => ({ ...side, createdAt: timestamp, updatedAt: timestamp }))
  }
}

function inMemoryInitiativeRepository(initial: EncounterInitiativeRoundStateRecord): {
  repository: MutableInitiativeRepository
  read: () => EncounterInitiativeRoundStateRecord
} {
  let state = initial
  const requireVersion = (actual: number, expected: number) => {
    if (actual !== expected) throw new EncounterConflictError('Staged initiative state is stale.')
  }
  return {
    repository: {
      async updateInitiativeRound(input) {
        requireVersion(state.round.version, input.expectedVersion)
        state = {
          ...state,
          round: {
            ...state.round,
            status: input.status,
            nextTurnOrderOrdinal: input.nextTurnOrderOrdinal,
            version: state.round.version + 1
          }
        }
        return state.round
      },
      async updateInitiativeParticipant(input) {
        const index = state.participants.findIndex(
          (candidate) => candidate.actorId === input.actorId
        )
        const current = state.participants[index]
        if (!current)
          throw new EncounterConflictError('Staged initiative participant is unavailable.')
        requireVersion(current.version, input.expectedVersion)
        const updated = { ...current, ...input, version: current.version + 1 }
        state = {
          ...state,
          participants: state.participants.map((candidate, candidateIndex) =>
            candidateIndex === index ? updated : candidate
          )
        }
        return updated
      },
      async updateInitiativeSide(input) {
        const index = state.sides.findIndex((candidate) => candidate.sideId === input.sideId)
        const current = state.sides[index]
        if (!current) throw new EncounterConflictError('Staged initiative side is unavailable.')
        requireVersion(current.version, input.expectedVersion)
        const updated = { ...current, ...input, version: current.version + 1 }
        state = {
          ...state,
          sides: state.sides.map((candidate, candidateIndex) =>
            candidateIndex === index ? updated : candidate
          )
        }
        return updated
      }
    },
    read: () => state
  }
}

export function serializeStagedInitiativeRoundState(
  state: EncounterInitiativeRoundStateRecord
): StagedInitiativeRoundStateDto {
  return stagedStateFromRecord(state)
}

export function createStagedInitiativeRoundState(input: {
  encounter: EncounterRecord
  round: number
}): StagedInitiativeRoundStateDto {
  const timestamp = '1970-01-01T00:00:00.000Z'
  const manualExecution = input.encounter.automationMode === 'MANUAL'
  const policy = manualExecution ? null : input.encounter.initiativePolicySnapshot
  const procedure = policy?.policy.document.procedure ?? 'MANUAL'
  const cadence = policy?.policy.document.cadence ?? 'ENCOUNTER_START'
  const actorSides = input.encounter.actors.map((actor) => {
    if (!actor.sideId) {
      throw new EncounterConflictError('Encounter actor side state is unavailable for initiative.')
    }
    return { actor, sideId: actor.sideId }
  })
  return stagedStateFromRecord({
    round: {
      encounterId: input.encounter.id,
      round: input.round,
      procedure,
      cadence,
      status: 'PREPARING',
      policySnapshotChecksum: manualExecution
        ? null
        : (input.encounter.initiativePolicySnapshotChecksum ?? null),
      nextTurnOrderOrdinal: 0,
      version: 0,
      createdAt: timestamp,
      updatedAt: timestamp
    },
    participants: [...actorSides]
      .sort((left, right) => left.actor.id.localeCompare(right.actor.id))
      .map(({ actor, sideId }) => ({
        encounterId: input.encounter.id,
        round: input.round,
        actorId: actor.id,
        sideId,
        status: 'UNRESOLVED',
        initiativeScore: null,
        evaluation: { occurrenceId: null, resultChecksum: null },
        tie: { occurrenceId: null, resultChecksum: null },
        declaration: null,
        declarationChecksum: null,
        turnOrderOrdinal: null,
        version: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      })),
    sides:
      procedure === 'SIDE_ROLL'
        ? [...new Set(actorSides.map(({ sideId }) => sideId))].sort().map((sideId) => ({
            encounterId: input.encounter.id,
            round: input.round,
            sideId,
            status: 'UNRESOLVED',
            initiativeScore: null,
            evaluation: { occurrenceId: null, resultChecksum: null },
            tie: { occurrenceId: null, resultChecksum: null },
            sideOrderOrdinal: null,
            version: 0,
            createdAt: timestamp,
            updatedAt: timestamp
          }))
        : []
  })
}

function sortedActorIds(encounter: EncounterRecord): string[] {
  return encounter.actors.map((actor) => actor.id).sort()
}

function requireExactActorCohort(input: {
  expected: readonly string[]
  actual: readonly string[]
}): void {
  if (
    input.expected.length !== input.actual.length ||
    input.expected.some((actorId, index) => actorId !== input.actual[index])
  ) {
    throw new EncounterConflictError('Initiative actor cohort changed while the turn was paused.')
  }
}

async function requireInitiativeBeforePin(input: {
  repository: InitiativeRepository
  encounter: EncounterRecord
  beforePin: InitiativeBeforePinDto
}): Promise<void> {
  requireExactActorCohort({
    expected: input.beforePin.actorIds,
    actual: sortedActorIds(input.encounter)
  })
  if (input.beforePin.kind === 'INITIAL_START') {
    const existing = await input.repository.lockInitiativeRound({
      encounterId: input.encounter.id,
      round: 1
    })
    if (existing) throw new EncounterConflictError('Initial initiative state changed while paused.')
    return
  }
  const current = await input.repository.lockInitiativeRound({
    encounterId: input.encounter.id,
    round: input.beforePin.round
  })
  if (
    !current ||
    current.round.version !== input.beforePin.version ||
    checksumCanonicalJson(current) !== input.beforePin.checksum
  ) {
    throw new EncounterConflictError('Initiative state changed while the turn was paused.')
  }
}

async function applyStagedEvaluationState(input: {
  repository: InitiativeRepository
  state: EncounterInitiativeRoundStateRecord
  staged: EncounterInitiativeRoundStateRecord
}): Promise<EncounterInitiativeRoundStateRecord> {
  let current = input.state
  for (const stagedParticipant of input.staged.participants) {
    if (stagedParticipant.status === 'UNRESOLVED') continue
    const participant = current.participants.find(
      (candidate) => candidate.actorId === stagedParticipant.actorId
    )
    if (!participant)
      throw new EncounterConflictError('Initiative participant changed while paused.')
    const updated = await input.repository.updateInitiativeParticipant({
      encounterId: participant.encounterId,
      round: participant.round,
      actorId: participant.actorId,
      expectedVersion: participant.version,
      status: 'EVALUATED',
      initiativeScore: stagedParticipant.initiativeScore,
      evaluation: stagedParticipant.evaluation,
      tie: stagedParticipant.tie,
      declaration: stagedParticipant.declaration,
      declarationChecksum: stagedParticipant.declarationChecksum,
      turnOrderOrdinal: null
    })
    current = {
      ...current,
      participants: current.participants.map((candidate) =>
        candidate.actorId === updated.actorId ? updated : candidate
      )
    }
  }
  for (const stagedSide of input.staged.sides) {
    if (stagedSide.status === 'UNRESOLVED') continue
    const side = current.sides.find((candidate) => candidate.sideId === stagedSide.sideId)
    if (!side) throw new EncounterConflictError('Initiative side changed while paused.')
    const updated = await input.repository.updateInitiativeSide({
      encounterId: side.encounterId,
      round: side.round,
      sideId: side.sideId,
      expectedVersion: side.version,
      status: 'EVALUATED',
      initiativeScore: stagedSide.initiativeScore,
      evaluation: stagedSide.evaluation,
      tie: stagedSide.tie,
      sideOrderOrdinal: null
    })
    current = {
      ...current,
      sides: current.sides.map((candidate) =>
        candidate.sideId === updated.sideId ? updated : candidate
      )
    }
  }
  return current
}

/**
 * Persists a sealed initiative result only at the terminal turn boundary.
 * Paused lifecycle state lives exclusively in the rule occurrence.
 */
export async function applyStagedInitiativeState(input: {
  repository: InitiativeRepository
  encounter: EncounterRecord
  beforePin: InitiativeBeforePinDto
  stagedRoundState: StagedInitiativeRoundStateDto
  initiativeAdvance?: EncounterInitiativeAdvancePlanDto
}): Promise<EncounterInitiativeRoundStateRecord> {
  await requireInitiativeBeforePin({
    repository: input.repository,
    encounter: input.encounter,
    beforePin: input.beforePin
  })
  if (input.initiativeAdvance) {
    await applyEncounterInitiativeAdvanceCommand({
      repository: input.repository,
      encounterId: input.encounter.id,
      plan: input.initiativeAdvance
    })
  }
  await input.repository.createInitiativeRound({
    encounterId: input.encounter.id,
    round: input.stagedRoundState.round.round,
    procedure: input.stagedRoundState.round.procedure,
    cadence: input.stagedRoundState.round.cadence,
    policySnapshotChecksum: input.stagedRoundState.round.policySnapshotChecksum
  })
  const created = await input.repository.lockInitiativeRound({
    encounterId: input.encounter.id,
    round: input.stagedRoundState.round.round
  })
  if (!created) throw new EncounterConflictError('Staged initiative round could not be created.')
  const staged = hydrateStagedState(input.stagedRoundState)
  if (
    created.round.procedure !== staged.round.procedure ||
    created.round.cadence !== staged.round.cadence ||
    created.round.policySnapshotChecksum !== staged.round.policySnapshotChecksum
  ) {
    throw new EncounterConflictError('Staged initiative policy changed before terminal settlement.')
  }
  requireExactActorCohort({
    expected: staged.participants.map((participant) => participant.actorId).sort(),
    actual: created.participants.map((participant) => participant.actorId).sort()
  })
  const evaluated = await applyStagedEvaluationState({
    repository: input.repository,
    state: created,
    staged
  })
  const orderedActorIds = [...staged.participants]
    .sort((left, right) => (left.turnOrderOrdinal ?? -1) - (right.turnOrderOrdinal ?? -1))
    .map((participant) => participant.actorId)
  const orderedSideIds = [...staged.sides]
    .sort((left, right) => (left.sideOrderOrdinal ?? -1) - (right.sideOrderOrdinal ?? -1))
    .map((side) => side.sideId)
  return settleEncounterInitiativeRound({
    repository: input.repository,
    state: evaluated,
    orderedActorIds,
    orderedSideIds
  })
}

async function createAndLockRound(input: {
  repository: InitiativeRepository
  encounterId: string
  round: number
  procedure: EncounterInitiativeRoundStateRecord['round']['procedure']
  cadence: EncounterInitiativeRoundStateRecord['round']['cadence']
  policySnapshotChecksum: string | null
}): Promise<EncounterInitiativeRoundStateRecord> {
  await input.repository.createInitiativeRound({
    encounterId: input.encounterId,
    round: input.round,
    procedure: input.procedure,
    cadence: input.cadence,
    policySnapshotChecksum: input.policySnapshotChecksum
  })
  const state = await input.repository.lockInitiativeRound({
    encounterId: input.encounterId,
    round: input.round
  })
  if (!state) throw new EncounterConflictError('The normalized initiative round is unavailable.')
  return state
}

/**
 * Starts one normalized initiative round under an already locked Encounter.
 * It owns no receipt or Encounter transition; the root command coordinator
 * keeps those atomic with the subsequent START_OF_TURN boundary.
 */
type StartEncounterInitiativeCommandInput = {
  trx: DBLike
  repository: InitiativeRepository
  encounter: EncounterRecord
  round: number
  occurrenceId: string
  runtime: RulesRuntimeService | null
  attunementSlotOverride: number | null
  getEncounterActorSnapshot: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
  legacyOrderedActorIds: readonly string[]
  integerSource?: TrustedInitiativeIntegerSource
  stagedRoundState?: StagedInitiativeRoundStateDto
  allowDeclarationPending?: boolean
}

export function startEncounterInitiativeCommand(
  input: StartEncounterInitiativeCommandInput & { allowDeclarationPending: true }
): Promise<EncounterInitiativeCommandResult>
export function startEncounterInitiativeCommand(
  input: StartEncounterInitiativeCommandInput & { allowDeclarationPending?: false | undefined }
): Promise<EncounterInitiativeLifecycleResult>
export async function startEncounterInitiativeCommand(
  input: StartEncounterInitiativeCommandInput
): Promise<EncounterInitiativeCommandResult> {
  const staged = input.stagedRoundState
    ? inMemoryInitiativeRepository(hydrateStagedState(input.stagedRoundState))
    : null
  const state = staged
    ? staged.read()
    : await createAndLockRound({
        repository: input.repository,
        encounterId: input.encounter.id,
        round: input.round,
        procedure:
          input.encounter.automationMode === 'MANUAL'
            ? 'MANUAL'
            : (input.encounter.initiativePolicySnapshot?.policy.document.procedure ?? 'MANUAL'),
        cadence:
          input.encounter.automationMode === 'MANUAL'
            ? 'ENCOUNTER_START'
            : (input.encounter.initiativePolicySnapshot?.policy.document.cadence ??
              'ENCOUNTER_START'),
        policySnapshotChecksum:
          input.encounter.automationMode === 'MANUAL'
            ? null
            : (input.encounter.initiativePolicySnapshotChecksum ?? null)
      })
  // Manual automation retains the selected policy as Encounter metadata, but it
  // must not execute or validate that policy. This makes a manual round safe
  // even when its frozen System policy can no longer be resolved.
  const manualExecution = input.encounter.automationMode === 'MANUAL'
  const snapshot = manualExecution ? null : (input.encounter.initiativePolicySnapshot ?? null)
  const adapter = snapshot
    ? (initiativeFactAdapterRegistry.get(input.encounter.gameSystemId) ?? null)
    : null
  if (snapshot && !adapter) {
    throw new EncounterValidationError(
      'The Encounter Game System does not support the selected initiative policy.'
    )
  }
  const sources = snapshot
    ? await lockEncounterInitiativeFactSources({
        trx: input.trx,
        encounter: input.encounter,
        actors: input.encounter.actors,
        attunementSlotOverride: input.attunementSlotOverride,
        getEncounterActorSnapshot: input.getEncounterActorSnapshot
      })
    : { characterIds: [], actors: [] }
  if (state.round.procedure === 'DECLARED_ACTION_ROLL') {
    const participant = state.participants.find(
      (candidate) =>
        candidate.declaration === null &&
        sources.actors.some((source) => source.actor.id === candidate.actorId)
    )
    if (participant) {
      const source = sources.actors.find((candidate) => candidate.actor.id === participant.actorId)
      if (!source) throw new EncounterConflictError('Initiative declaration source is unavailable.')
      if (!input.allowDeclarationPending) {
        throw new EncounterConflictError(
          'Speed Factor declaration must be resolved through its aggregate choice.'
        )
      }
      return {
        kind: 'DECLARATION_PENDING',
        state: staged?.read() ?? state,
        actorId: participant.actorId,
        source
      }
    }
  }
  const result = await startEncounterInitiativeLifecycle({
    repository: staged?.repository ?? input.repository,
    runtime: manualExecution ? null : input.runtime,
    occurrenceId: input.occurrenceId,
    gameSystemId: input.encounter.gameSystemId,
    state,
    snapshot,
    snapshotChecksum: manualExecution
      ? null
      : (input.encounter.initiativePolicySnapshotChecksum ?? null),
    sources,
    adapter,
    mode: input.encounter.automationMode,
    legacyOrderedActorIds: input.legacyOrderedActorIds,
    integerSource: input.integerSource
  })
  if (!staged) return result
  return { ...result, state: staged.read() }
}

/**
 * Seals one controller declaration into the aggregate-owned staged state, then
 * continues the same Speed Factor root. The caller owns request/authority
 * validation; this coordinator owns source compilation and participant CAS.
 */
export async function resumeEncounterInitiativeDeclarationCommand(input: {
  trx: DBLike
  repository: InitiativeRepository
  encounter: EncounterRecord
  round: number
  occurrenceId: string
  runtime: RulesRuntimeService | null
  attunementSlotOverride: number | null
  getEncounterActorSnapshot: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
  legacyOrderedActorIds: readonly string[]
  actorId: string
  expectedParticipantVersion: number
  primary: InitiativeDeclarationSelection
  bonus: InitiativeDeclarationSelection | null
  request: ServerInitiativeDeclarationRequestDto
  stagedRoundState: StagedInitiativeRoundStateDto
  integerSource?: TrustedInitiativeIntegerSource
}): Promise<EncounterInitiativeCommandResult> {
  if (input.encounter.automationMode === 'MANUAL') {
    throw new EncounterConflictError('Manual initiative cannot resolve a declaration.')
  }
  const staged = inMemoryInitiativeRepository(hydrateStagedState(input.stagedRoundState))
  const participant = staged
    .read()
    .participants.find((candidate) => candidate.actorId === input.actorId)
  if (
    !participant ||
    participant.declaration !== null ||
    participant.version !== input.expectedParticipantVersion ||
    staged.read().round.procedure !== 'DECLARED_ACTION_ROLL'
  ) {
    throw new EncounterConflictError('Initiative declaration is stale.')
  }
  const sources = await lockEncounterInitiativeFactSources({
    trx: input.trx,
    encounter: input.encounter,
    actors: input.encounter.actors,
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: input.getEncounterActorSnapshot
  })
  const source = sources.actors.find((candidate) => candidate.actor.id === input.actorId)
  if (!source) throw new EncounterConflictError('Initiative declaration source is unavailable.')
  const currentRequest = createEncounterInitiativeDeclarationRequest({
    requestId: input.request.requestId,
    encounterId: input.encounter.id,
    round: input.round,
    actorId: input.actorId,
    participantExpectedVersion: participant.version,
    controllerUserId: input.request.controllerUserId,
    source
  })
  if (
    currentRequest.sourceOptionsChecksum !== input.request.sourceOptionsChecksum ||
    JSON.stringify(currentRequest.primaryOptions) !==
      JSON.stringify(input.request.primaryOptions) ||
    JSON.stringify(currentRequest.bonusOptions) !== JSON.stringify(input.request.bonusOptions) ||
    JSON.stringify(currentRequest.adjudicationFields) !==
      JSON.stringify(input.request.adjudicationFields)
  ) {
    throw new EncounterConflictError('Initiative declaration options are stale.')
  }
  const primaryOption = currentRequest.primaryOptions.find(
    (candidate) =>
      candidate.kind === input.primary.kind && candidate.optionId === input.primary.optionId
  )
  const bonusOption = input.bonus
    ? currentRequest.bonusOptions.find(
        (candidate) =>
          candidate.kind === input.bonus!.kind && candidate.optionId === input.bonus!.optionId
      )
    : null
  if (!primaryOption || (input.bonus !== null && !bonusOption)) {
    throw new EncounterConflictError('Initiative declaration selection is unavailable.')
  }
  const compiled = compileEncounterInitiativeDeclaration({
    source,
    primary: input.primary,
    bonus: input.bonus
  })
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
  return startEncounterInitiativeCommand({
    trx: input.trx,
    repository: input.repository,
    encounter: input.encounter,
    round: input.round,
    occurrenceId: input.occurrenceId,
    runtime: input.runtime,
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: input.getEncounterActorSnapshot,
    legacyOrderedActorIds: input.legacyOrderedActorIds,
    stagedRoundState: serializeStagedInitiativeRoundState(staged.read()),
    integerSource: input.integerSource,
    allowDeclarationPending: true
  })
}

/** Resumes one initiative phase after the Encounter root and occurrence are locked. */
export async function resumeEncounterInitiativeCommand(input: {
  trx: DBLike
  repository: InitiativeRepository
  encounter: EncounterRecord
  round: number
  runtime: RulesRuntimeService
  pendingSnapshot: ServerKernelRuleExecutionPendingSnapshotDto
  attunementSlotOverride: number | null
  getEncounterActorSnapshot: () => Promise<{
    rules: EncounterActorRuleOutput
    encounter: EncounterRecord
  }>
  requestId: string
  value: number | { selectedEntityId: string }
  integerSource?: TrustedInitiativeIntegerSource
  stagedRoundState?: StagedInitiativeRoundStateDto
}): Promise<EncounterInitiativeLifecycleResult> {
  if (input.encounter.automationMode === 'MANUAL') {
    throw new EncounterConflictError('Manual initiative cannot resume a policy evaluation.')
  }
  const staged = input.stagedRoundState
    ? inMemoryInitiativeRepository(hydrateStagedState(input.stagedRoundState))
    : null
  const state = staged
    ? staged.read()
    : await input.repository.lockInitiativeRound({
        encounterId: input.encounter.id,
        round: input.round
      })
  if (!state) throw new EncounterConflictError('The normalized initiative round is unavailable.')
  const snapshot = input.encounter.initiativePolicySnapshot ?? null
  const snapshotChecksum = input.encounter.initiativePolicySnapshotChecksum ?? null
  if (!snapshot || !snapshotChecksum) {
    throw new EncounterConflictError('Pending initiative lacks its pinned policy snapshot.')
  }
  const adapter = initiativeFactAdapterRegistry.get(input.encounter.gameSystemId) ?? null
  if (!adapter) {
    throw new EncounterValidationError(
      'The Encounter Game System does not support the selected initiative policy.'
    )
  }
  const sources = await lockEncounterInitiativeFactSources({
    trx: input.trx,
    encounter: input.encounter,
    actors: input.encounter.actors,
    attunementSlotOverride: input.attunementSlotOverride,
    getEncounterActorSnapshot: input.getEncounterActorSnapshot
  })
  const entities = createEncounterInitiativeScoreEntities({ state, sources, adapter })
  const restored = restoreEncounterInitiativePending({
    pendingSnapshot: input.pendingSnapshot,
    entities,
    actorIds: state.participants.map((participant) => participant.actorId)
  })
  if (
    restored.root.round !== input.round ||
    restored.root.policySnapshotChecksum !== snapshotChecksum ||
    restored.root.expectedEncounterVersion !== input.encounter.version
  ) {
    throw new EncounterConflictError('The pending initiative source is stale.')
  }
  const result = await resumeEncounterInitiativeLifecycle({
    repository: staged?.repository ?? input.repository,
    runtime: input.runtime,
    gameSystemId: input.encounter.gameSystemId,
    state,
    snapshot,
    snapshotChecksum,
    sources,
    adapter,
    mode: input.encounter.automationMode,
    pending: restored.pending,
    requestId: input.requestId,
    value: input.value,
    integerSource: input.integerSource
  })
  if (!staged) return result
  return { ...result, state: staged.read() }
}

/** Applies one previously sealed turn cursor after all known turn boundaries settle. */
export async function applyEncounterInitiativeAdvanceCommand(input: {
  repository: InitiativeRepository
  encounterId: string
  plan: EncounterInitiativeAdvancePlanDto
}): Promise<{
  round: number
  currentActorId: string | null
  state: EncounterInitiativeRoundStateRecord
}> {
  const current = await input.repository.lockInitiativeRound({
    encounterId: input.encounterId,
    round: input.plan.round
  })
  if (!current) throw new EncounterConflictError('The normalized initiative round is unavailable.')
  const advanced = await applyEncounterInitiativeAdvance({
    repository: input.repository,
    state: current,
    plan: input.plan
  })
  if (input.plan.kind === 'SAME_ROUND')
    return {
      round: input.plan.round,
      currentActorId: input.plan.nextActorId,
      state: advanced
    }
  if (input.plan.cadence === 'EACH_ROUND')
    return { round: input.plan.nextRound, currentActorId: null, state: advanced }

  const next = await createAndLockRound({
    repository: input.repository,
    encounterId: input.encounterId,
    round: input.plan.nextRound,
    procedure: current.round.procedure,
    cadence: current.round.cadence,
    policySnapshotChecksum: current.round.policySnapshotChecksum
  })
  if (next.round.cadence !== 'ENCOUNTER_START' || next.round.procedure !== current.round.procedure)
    throw new EncounterConflictError('The carried initiative policy changed between rounds.')
  const settled = await settleEncounterInitiativeRound({
    repository: input.repository,
    state: next,
    orderedActorIds: input.plan.orderedActorIds,
    orderedSideIds: input.plan.orderedSideIds
  })
  return {
    round: input.plan.nextRound,
    currentActorId: input.plan.firstActorId,
    state: settled
  }
}
