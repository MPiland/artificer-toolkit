import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  followsInZoneTurnOrder,
  type StagedTurnZonePlanDto
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnPhaseEvidence'
import type { TurnCoordinatorRootDto } from '@artificer-toolkit/schema/shared/ruleExecutionTurnPending'
import {
  serverKernelRuleExecutionPendingSnapshotDtoSchema,
  type ServerKernelRuleExecutionPendingSnapshotDto,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import { evaluateEncounterActionEconomy } from './encounterActionEconomy.js'
import { consumeEncounterActionEconomy } from './encounterActionEconomyConsumption.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { EncounterResponseAnswer } from './encounterEvidenceAnswer.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import {
  settleAutomaticSpatialEvidence,
  spatialCandidateEvidence,
  spatialExecutionInput,
  spatialExecutionOutcome,
  toSpatialInstances,
  toSpatialMovementTarget,
  type SpatialD20Roll,
  type SpatialTargetState
} from './encounterSpatialCandidateExecution.js'
import { planNativeSpatialMovementPrefix } from './encounterSpatialMovementPlan.js'
import { kernelContinuation } from './encounterTurnEffects.js'
import { zoneTurnContacts } from './encounterZoneContacts.js'
import { ZONE_SIGHT_REQUIREMENT_MET_FACT_KEY } from './encounterZonePlacement.js'
import type { TurnEffectBoundary } from './encounterTurnEffectState.js'
import { rebuildEncounterTurnTarget } from './encounterTurnTarget.js'
import type { CurrentReusableDefinitionSource } from './ruleCapabilityStateService.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  executeTargetBoundActiveRuleEffectWithPause,
  reconstructTargetBoundActiveRuleEffectCompletion,
  resumeTargetBoundActiveRuleEffectWithAnswer,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionResult
} from './targetBoundActiveRuleEffectExecutor.js'

type TurnZoneExecution = StagedTurnZonePlanDto['executions'][number]
type TurnZoneCandidate = TurnZoneExecution['candidate']
type TurnZonePending = Extract<
  ServerRuleExecutionPendingSnapshotDto['applicationContext'],
  { kind: 'ENCOUNTER_TURN_ZONE_EFFECTS' }
>

/** The Scene facts the zones of a boundary are read from, locked for the whole turn. */
export type TurnZoneScene = {
  effects: readonly EncounterSpatialRuleEffectRecord[]
  tokens: readonly SpatialSceneToken[]
  actorIdByTokenId: ReadonlyMap<string, string>
}

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

function requirePending(pending: ServerRuleExecutionPendingSnapshotDto): {
  context: TurnZonePending
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto
} {
  if (
    pending.snapshotKind !== 'KERNEL_EVIDENCE' ||
    pending.applicationContext.kind !== 'ENCOUNTER_TURN_ZONE_EFFECTS'
  )
    throw new Error('The pending occurrence is not turn zone evidence.')
  return { context: pending.applicationContext, snapshot: pending }
}

/**
 * The zones that catch creatures at a turn boundary, with the checksum that pins them. At its own
 * boundary a creature is caught by the zones it stands in; at the start of its turn every other
 * creature standing in one of its zones that acts at its source's turn is caught too (D144).
 * Contacts run in canonical zone turn order. The turn preparation plans against them and the
 * terminal transaction re-derives them from the locked Scene. Null when the boundary creature has
 * no token in the Scene or no zone catches anyone.
 */
export function selectTurnZoneContacts(input: {
  state: Pick<EncounterRunState, 'turnSequence' | 'zoneApplications'>
  actors: readonly EncounterRunActorState[]
  commandType: TurnCoordinatorRootDto['commandType']
  boundary: Pick<TurnEffectBoundary, 'ordinal' | 'stage'>
  actorId: string
  scene: TurnZoneScene
}) {
  const { scene, boundary } = input
  if (![...scene.actorIdByTokenId.values()].includes(input.actorId)) return null
  const effects = toSpatialInstances(scene.effects, input.actors)
  const sourced =
    boundary.stage === 'START_OF_TURN'
      ? effects.filter((effect) => effect.sourceActorId === input.actorId)
      : []
  const contacts = [...scene.actorIdByTokenId]
    .flatMap(([tokenId, actorId]) => {
      const own = actorId === input.actorId
      if (!own && !sourced.length) return []
      return zoneTurnContacts({
        actorIdByTokenId: scene.actorIdByTokenId,
        effects: own ? effects : sourced,
        targetTokenId: tokenId,
        tokens: scene.tokens,
        trigger: own ? boundary.stage : 'START_OF_SOURCE_TURN',
        zoneApplications: input.state.zoneApplications,
        // The turn commit advances the sequence once: the outgoing turn is the current one.
        turnSequence: input.state.turnSequence + (boundary.stage === 'START_OF_TURN' ? 1 : 0)
      })
    })
    .sort((left, right) => (followsInZoneTurnOrder(left, right) ? -1 : 1))
  if (!contacts.length) return null
  const contactEffects = contacts.map(({ effectId }) => {
    const effect = scene.effects.find((candidate) => candidate.id === effectId)
    if (!effect) throw new Error('Turn zone is unavailable.')
    return effect
  })
  const selectionChecksum = checksumCanonicalJson({
    commandType: input.commandType,
    boundaryOrdinal: boundary.ordinal,
    stage: boundary.stage,
    boundaryActorId: input.actorId,
    zones: contacts.map((contact, index) => ({
      contact,
      version: contactEffects[index]!.version,
      placementChecksum: contactEffects[index]!.placementChecksum
    }))
  })
  return { contacts, effects: contactEffects, selectionChecksum }
}

/**
 * Executes the zones that catch creatures at this turn boundary, after the boundary creature's
 * active effects, in canonical zone turn order. Like the active-effect stage it plans without
 * changing the Run. No zone batch runs when none catches anyone, so such a turn stores no zone
 * evidence.
 */
export async function prepareEncounterTurnZoneEffects<
  TCharacterFacts extends ProjectableCharacterFacts
>(input: {
  state: EncounterRunState
  userId: string
  root: TurnCoordinatorRootDto
  occurrenceId: string
  actors: EncounterRunActorState[]
  boundary: TurnEffectBoundary
  /** Null when the Encounter has no Scene in play. */
  loadScene: () => Promise<TurnZoneScene | null>
  loadTarget: (actorId: string) => Promise<MovementTarget<TCharacterFacts> | undefined>
  createRuntime: () => Promise<RulesRuntimeService>
  /**
   * Whether the occupant and the zone's source see each other; read only for a zone that requires
   * sight, which the persisted plan then trusts.
   */
  loadSourceSight?: (input: {
    sourceActorId: string
    occupantActorId: string
  }) => Promise<{ occupantSeesSource: boolean; sourceSeesOccupant: boolean }>
  /** The System definitions a zone that costs the Action reads its allowance from. */
  definitions: CurrentReusableDefinitionSource
  random: (maxExclusive: number) => number
  autoRollByActorId: Readonly<Record<string, boolean>>
  pending?: ServerRuleExecutionPendingSnapshotDto
  resolution?: EncounterResponseAnswer
  retainedPlan?: StagedTurnZonePlanDto
  movementTargets?: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
}): Promise<
  | { kind: 'PENDING'; snapshot: ServerRuleExecutionPendingSnapshotDto }
  | {
      kind: 'COMPLETE'
      actors: EncounterRunActorState[]
      movementTargets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
      plan: StagedTurnZonePlanDto | null
    }
> {
  const targets = new Map(input.movementTargets)
  const none = () => {
    if (input.pending || input.retainedPlan)
      throw new Error('Retained turn zone selection is stale.')
    return { kind: 'COMPLETE' as const, actors: input.actors, movementTargets: targets, plan: null }
  }
  const { state, boundary } = input
  const actor = input.actors.find((candidate) => candidate.id === boundary.actorId)
  // A manual Run leaves its zones to the GM, as it does its active effects.
  if (!actor || state.automationMode === 'MANUAL') return none()
  const scene = await input.loadScene()
  const selected =
    scene &&
    selectTurnZoneContacts({
      state,
      actors: input.actors,
      commandType: input.root.commandType,
      boundary,
      actorId: actor.id,
      scene
    })
  if (!selected) return none()
  const { contacts, effects, selectionChecksum } = selected
  const retained = input.pending ? requirePending(input.pending) : null
  const pending = retained?.context
  if (
    pending &&
    (!same(pending.root, input.root) ||
      pending.selectionChecksum !== selectionChecksum ||
      pending.completedExecutions.length !== pending.currentCandidate.ordinal ||
      pending.completedExecutions.length + pending.remainingCandidates.length + 1 !==
        contacts.length)
  )
    throw new Error('Turn zone evidence is stale.')
  if (
    input.retainedPlan &&
    (input.retainedPlan.selectionChecksum !== selectionChecksum ||
      input.retainedPlan.executions.length !== contacts.length)
  )
    throw new Error('Retained turn zone selection is stale.')
  if (pending && input.retainedPlan) throw new Error('Turn zone evidence is ambiguous.')

  // Each creature caught, rebuilt once from root-owned transient facts (earlier phase mechanics and
  // resource refreshes included), with its state and allowances after each zone that caught it.
  const caught = new Map<
    string,
    {
      target: MovementTarget<TCharacterFacts>
      spatialTarget: ReturnType<typeof toSpatialMovementTarget>
      state: SpatialTargetState
      economyActor: EncounterRunActorState
    }
  >()
  for (const { targetActorId } of contacts) {
    if (caught.has(targetActorId)) continue
    const caughtActor = input.actors.find((candidate) => candidate.id === targetActorId)
    const source =
      caughtActor && (targets.get(targetActorId) ?? (await input.loadTarget(targetActorId)))
    if (!caughtActor || !source) throw new Error('Turn zone target facts are unavailable.')
    const target = rebuildEncounterTurnTarget({
      source,
      actor: caughtActor,
      characterFacts: source.characterFacts,
      activeEffects: source.activeEffects,
      state
    })
    const spatialTarget = toSpatialMovementTarget(target)
    caught.set(targetActorId, {
      target,
      spatialTarget,
      state: spatialTarget.state,
      economyActor: caughtActor
    })
  }
  const zoneSightFacts = async (effect: (typeof effects)[number], occupantActorId: string) => {
    const required = effect.placement.requiredSight
    if (!required) return undefined
    const sourceActorId =
      effect.definition.origin.kind === 'ENCOUNTER' ? effect.definition.origin.sourceActorId : null
    if (!sourceActorId || !input.loadSourceSight) throw new Error('Turn zone sight is unavailable.')
    const sight = await input.loadSourceSight({ sourceActorId, occupantActorId })
    return {
      [ZONE_SIGHT_REQUIREMENT_MET_FACT_KEY]:
        (!required.includes('OCCUPANT_SEES_SOURCE') || sight.occupantSeesSource) &&
        (!required.includes('SOURCE_SEES_OCCUPANT') || sight.sourceSeesOccupant)
    }
  }
  const caughtAt = (ordinal: number) => caught.get(contacts[ordinal]!.targetActorId)!
  const runtime = await input.createRuntime()
  const executions: TurnZoneExecution[] = []

  const candidateAt = (
    ordinal: number,
    sealed: Pick<TurnZoneCandidate, 'd20Policy' | 'diceStage'> | null
  ): TurnZoneCandidate => ({
    ordinal,
    boundaryOrdinal: boundary.ordinal,
    candidate: contacts[ordinal]!,
    ...spatialCandidateEvidence({
      effect: effects[ordinal]!,
      target: caughtAt(ordinal).spatialTarget,
      state: caughtAt(ordinal).state,
      d20Policy: sealed?.d20Policy ?? null,
      diceStage: sealed?.diceStage ?? null
    })
  })

  for (const [ordinal, contact] of contacts.entries()) {
    const effect = effects[ordinal]!
    const entry = caughtAt(ordinal)
    const existing =
      input.retainedPlan?.executions[ordinal] ?? pending?.completedExecutions[ordinal]
    const resuming = pending !== undefined && ordinal === pending.currentCandidate.ordinal
    const sealed = existing?.candidate ?? (resuming ? pending.currentCandidate : null)
    const current = candidateAt(ordinal, sealed)
    if (resuming && !same(current, pending.currentCandidate))
      throw new Error('Turn zone target evidence is stale.')
    if (pending && ordinal > pending.currentCandidate.ordinal) {
      const expected = pending.remainingCandidates[ordinal - pending.currentCandidate.ordinal - 1]
      if (!expected || !same(current, expected)) throw new Error('Remaining turn zones changed.')
    }
    const effectInput = spatialExecutionInput({
      effect,
      target: entry.spatialTarget,
      state: entry.state,
      occurrenceId: input.occurrenceId,
      runtime,
      contactFacts: await zoneSightFacts(effect, contact.targetActorId)
    })
    let result:
      | TargetBoundActiveRuleEffectExecutionResult
      | TargetBoundActiveRuleEffectExecutionPaused
    let d20: SpatialD20Roll | null = null
    if (existing) {
      result = reconstructTargetBoundActiveRuleEffectCompletion({
        executionInput: effectInput,
        execution: existing.execution,
        d20Evidence: existing.d20
      })
    } else if (resuming) {
      const answer = input.resolution
      if (
        answer?.kind !== 'ENTER_DICE' &&
        answer?.kind !== 'ENTER_INTEGER' &&
        answer?.kind !== 'SYSTEM_ROLL'
      )
        throw new Error('Turn zone evidence is required.')
      const resumed = await resumeTargetBoundActiveRuleEffectWithAnswer({
        effectInput,
        continuation: kernelContinuation(retained!.snapshot),
        policy: pending.currentCandidate.d20Policy,
        diceStage: pending.currentCandidate.diceStage,
        answer,
        random: input.random
      })
      result = resumed.result
      d20 = resumed.d20
    } else {
      result = await executeTargetBoundActiveRuleEffectWithPause(effectInput)
    }
    if (!existing)
      ({ result, d20 } = await settleAutomaticSpatialEvidence({
        effectInput,
        candidate: contact,
        result,
        d20,
        autoRoll: input.autoRollByActorId,
        random: input.random
      }))
    if ('continuation' in result) {
      const paused = candidateAt(ordinal, { d20Policy: result.evidencePolicy, diceStage: d20 })
      return {
        kind: 'PENDING',
        snapshot: serverKernelRuleExecutionPendingSnapshotDtoSchema.parse({
          ...result.continuation,
          snapshotKind: 'KERNEL_EVIDENCE',
          applicationContext: {
            kind: 'ENCOUNTER_TURN_ZONE_EFFECTS',
            schemaVersion: 1,
            root: input.root,
            selectionChecksum,
            completedExecutions: executions,
            currentCandidate: paused,
            remainingCandidates: contacts
              .slice(ordinal + 1)
              .map((_, offset) => candidateAt(ordinal + offset + 1, null))
          }
        })
      }
    }
    const outcome = spatialExecutionOutcome({
      target: entry.spatialTarget,
      state: entry.state,
      targetStateChecksum: current.target.targetStateChecksum,
      result
    })
    const after = outcome.targetTransition.after
    const targetState: SpatialTargetState = {
      current: after.currentHitPoints,
      temporary: after.temporaryHitPoints,
      conditions: [...after.conditionIds],
      deathSaves: after.deathSaves
    }
    // D141: a failed save of a zone that costs the Action spends it for this turn, if it is unspent.
    const allowance =
      effect.placement.failedSaveLosesAction &&
      result.execution.outputs.resultPath === 'ON_SAVE_FAIL'
        ? await evaluateEncounterActionEconomy({
            actor: entry.economyActor,
            state,
            activation: { code: 'ACTION', amount: 1 },
            target: {
              ...entry.target,
              actor: entry.economyActor,
              state: { ...entry.target.state, conditions: targetState.conditions }
            },
            loadTarget: async () => undefined,
            definitions: input.definitions
          })
        : null
    const actionEconomy = allowance?.available ? allowance.consumption : null
    caught.set(contact.targetActorId, {
      ...entry,
      state: targetState,
      economyActor: actionEconomy
        ? consumeEncounterActionEconomy({
            actor: entry.economyActor,
            consumption: actionEconomy,
            overridden: false
          })
        : entry.economyActor
    })
    const execution: TurnZoneExecution = { ordinal, candidate: current, ...outcome, actionEconomy }
    if (existing && !same(existing, execution))
      throw new Error('Retained turn zone execution is stale.')
    executions.push(execution)
  }

  const plan: StagedTurnZonePlanDto = { selectionChecksum, executions }
  const occurredAt =
    caughtAt(0).target.characterFacts?.active.updatedAt ?? '1970-01-01T00:00:00.000Z'
  const settled = planNativeSpatialMovementPrefix<TCharacterFacts>({
    targets: new Map([...caught].map(([targetActorId, { target }]) => [targetActorId, target])),
    executions,
    encounterId: state.id,
    expectedEncounterVersion: state.version,
    campaignId: state.campaignId,
    gameSystemId: state.gameSystemId,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.root.rootCommandId,
    occurredAt,
    userId: input.userId,
    commandId: { phase: 'TURN_ZONE_EFFECT', ordinal: boundary.ordinal },
    settleUnchanged: true,
    damageEnds: {
      turnActorId: state.currentActorId,
      dispositions: new Map(input.actors.map(({ id, disposition }) => [id, disposition])),
      incomingDamageGrants: true
    }
  })
  const spendLostActions = (targetActorId: string, settledActor: EncounterRunActorState) =>
    executions.reduce(
      (spent, { candidate, actionEconomy }) =>
        actionEconomy && candidate.candidate.targetActorId === targetActorId
          ? consumeEncounterActionEconomy({
              actor: spent,
              consumption: actionEconomy,
              overridden: false
            })
          : spent,
      settledActor
    )
  const updatedActors = new Map(
    settled.settlements.map(({ batch, plan: settlement }) => [
      batch.targetActorId,
      spendLostActions(batch.targetActorId, settlement.updatedActor)
    ])
  )
  for (const [targetActorId, { target }] of caught) {
    const projected = settled.projectedTargets.get(targetActorId)!
    targets.set(
      targetActorId,
      rebuildEncounterTurnTarget({
        source: target,
        actor: spendLostActions(targetActorId, projected.actor),
        characterFacts: projected.characterFacts,
        activeEffects: projected.activeEffects,
        state
      })
    )
  }
  return {
    kind: 'COMPLETE',
    actors: input.actors.map((value) => updatedActors.get(value.id) ?? value),
    movementTargets: targets,
    plan
  }
}
