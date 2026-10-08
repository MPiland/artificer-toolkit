import type { LiveSessionMovementSettlement } from '@artificer-toolkit/schema/api/liveSessionMovementCommit'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import {
  deriveEncounterCharacterMechanicsEventCommandId,
  targetTransitionChecksum
} from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import {
  spatialEffectTransition,
  spatialMovementEffectBeforeTransition
} from '@artificer-toolkit/rules-runtime/encounterSpatialMovementEffects'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'
import {
  readLiveCharacterStreamVersion,
  readLiveMovementTargetState
} from './liveMovementTargetState.js'

type SpatialStep = Extract<LiveSessionMovementSettlement, { kind: 'SPATIAL' }>
type SpatialExecution = SpatialStep['executions'][number]

/** Applies only a validated, ordered spatial receipt; the parent owns authority and root admission. */
export async function persistLiveMovementSpatial(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actors: readonly EncounterRunActorState[]
    step: SpatialStep
    occurrenceId: string
    sourceCommandId: string
    occurredAt: string
    sceneId: string
    effectOriginals: ReadonlyMap<string, EncounterSpatialRuleEffectRecord>
    appliedEffectIds: Set<string>
  },
  callbacks: {
    applyMechanics(
      input: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    readCampaignCharacterState: Parameters<typeof readLiveMovementTargetState>[4]
  }
) {
  const { state, step } = input
  const actors = new Map(input.actors.map((actor) => [actor.id, actor]))
  if (
    actors.size !== input.actors.length ||
    actors.size !== state.actorIds.length ||
    state.actorIds.some((id) => !actors.has(id)) ||
    input.actors.some(
      (actor) => actor.encounterId !== state.id || actor.systemId !== state.gameSystemId
    )
  )
    throw new Error('Spatial settlement actor cohort is stale.')
  const byTarget = new Map<string, SpatialExecution[]>()
  const effectIds = new Set<string>()
  // The movement admission's revision fence pins these to the room's captured Characters.
  const characterBeforeVersions = new Map<string, number>()
  for (const execution of step.executions) {
    const { candidate } = execution
    const targetActorId = candidate.candidate.targetActorId
    const actor = actors.get(targetActorId)
    const effect = input.effectOriginals.get(candidate.effect.effectId)
    if (
      !actor ||
      !effect ||
      candidate.candidate.effectId !== effect.id ||
      effect.encounterId !== state.id ||
      effect.sceneId !== input.sceneId ||
      effect.definition.frozenGraph.source.gameSystemId !== state.gameSystemId
    )
      throw new Error('Spatial settlement source or target is unavailable.')
    const pin = candidate.effect
    if (
      pin.version !== effect.version ||
      pin.definitionChecksum !== effect.definitionChecksum ||
      pin.lifecycleChecksum !== effect.lifecycleChecksum ||
      pin.placementChecksum !== effect.placementChecksum ||
      pin.spatialStateChecksum !== effect.spatialStateChecksum ||
      pin.authoredEffectId !== effect.definition.authoredEffectId ||
      pin.compiledEntryId !== effect.definition.compiledEntryId ||
      pin.frozenGraphNodeId !== effect.definition.frozenGraphNodeId ||
      pin.frozenSourceChecksum !== effect.definition.frozenGraph.source.checksum ||
      pin.capabilityContractVersion !== effect.definition.frozenGraph.capabilityContractVersion ||
      pin.activation !== effect.placement.activation ||
      pin.revealed !== effect.spatialState.revealed ||
      pin.revealOnTrigger !== effect.placement.revealOnTrigger ||
      checksumRuleDocument(effect.definition) !== effect.definitionChecksum ||
      checksumRuleDocument(effect.lifecycle) !== effect.lifecycleChecksum ||
      checksumRuleDocument(effect.placement) !== effect.placementChecksum ||
      checksumRuleDocument(effect.spatialState) !== effect.spatialStateChecksum
    )
      throw new Error('Spatial settlement effect pin is stale.')
    if (actor.kind === 'CHARACTER') {
      const streamVersion =
        characterBeforeVersions.get(targetActorId) ??
        (await readLiveCharacterStreamVersion(ctx, state, actor.sourceId))
      characterBeforeVersions.set(targetActorId, streamVersion)
      if (
        candidate.target.kind !== 'CHARACTER' ||
        candidate.target.characterId !== actor.sourceId ||
        candidate.target.streamVersion !== streamVersion
      )
        throw new Error('Spatial Character source pin is stale.')
    } else if (candidate.target.kind !== 'ENCOUNTER_ACTOR')
      throw new Error('Spatial actor source pin is stale.')
    if (
      execution.targetTransition.checksum !== candidate.target.targetStateChecksum ||
      execution.targetTransition.checksum !==
        targetTransitionChecksum(targetActorId, execution.targetTransition.before)
    )
      throw new Error('Spatial target checksum is stale.')
    const grouped = byTarget.get(targetActorId) ?? []
    const previous = grouped.at(-1)
    if (
      previous &&
      checksumRuleDocument(previous.targetTransition.after) !==
        checksumRuleDocument(execution.targetTransition.before)
    )
      throw new Error('Spatial target transitions do not chain.')
    grouped.push(execution)
    byTarget.set(targetActorId, grouped)
    effectIds.add(effect.id)
  }
  if (
    step.transitions.length !== effectIds.size ||
    new Set(step.transitions.map((entry) => entry.effectId)).size !== effectIds.size ||
    step.transitions.some(
      (entry) =>
        !effectIds.has(entry.effectId) ||
        checksumRuleDocument(entry.transition) !==
          checksumRuleDocument(spatialEffectTransition(input.effectOriginals.get(entry.effectId)!))
    )
  )
    throw new Error('Spatial settlement lifecycle transitions are stale.')

  for (const [targetActorId, executions] of byTarget) {
    const before = executions[0]!.targetTransition.before
    const current = await readLiveMovementTargetState(
      ctx,
      state,
      actors.get(targetActorId)!,
      before.maximumHitPoints,
      callbacks.readCampaignCharacterState
    )
    if (
      current.currentHitPoints !== before.currentHitPoints ||
      current.temporaryHitPoints !== before.temporaryHitPoints ||
      current.maximumHitPoints !== before.maximumHitPoints
    )
      throw new Error('Spatial target state is stale.')
  }

  const changed = [...byTarget].flatMap(([id, executions]) => {
    const first = executions[0]!
    const last = executions.at(-1)!
    return checksumRuleDocument(first.targetTransition.before) ===
      checksumRuleDocument(last.targetTransition.after)
      ? []
      : [[id, actors.get(id)!] as const]
  })
  changed.sort(([leftId, left], [rightId, right]) =>
    left.kind === 'CHARACTER' && right.kind !== 'CHARACTER'
      ? -1
      : left.kind !== 'CHARACTER' && right.kind === 'CHARACTER'
        ? 1
        : left.kind === 'CHARACTER' && right.kind === 'CHARACTER'
          ? left.sourceId.localeCompare(right.sourceId)
          : leftId.localeCompare(rightId)
  )
  const characterTransitions: Array<{
    characterId: string
    targetActorId: string
    beforeStreamVersion: number
    afterStreamVersion: number
    before: SpatialExecution['targetTransition']['before']
    after: SpatialExecution['targetTransition']['after']
  }> = []
  for (const [ordinal, [targetActorId, actor]] of changed.entries()) {
    const executions = byTarget.get(targetActorId)!
    const first = executions[0]!
    const last = executions.at(-1)!
    const before = first.targetTransition.before
    const applications = executions.flatMap((execution) =>
      execution.applications.map((application) => ({ ...application, targetActorId }))
    )
    const applied = await callbacks.applyMechanics({
      encounterId: state.id,
      targetActorId,
      expectedEncounterVersion: state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.sourceCommandId,
      commandId:
        actor.kind === 'CHARACTER'
          ? deriveEncounterCharacterMechanicsEventCommandId({
              occurrenceId: input.occurrenceId,
              sourceCommandId: input.sourceCommandId,
              phase: 'SPATIAL_EFFECT',
              ordinal: step.executions[0]!.ordinal + ordinal,
              targetCharacterId: actor.sourceId
            })
          : input.sourceCommandId,
      occurredAt: input.occurredAt,
      applications,
      effectiveMaximumHitPoints: before.maximumHitPoints,
      effectiveScalarValues: before.scalarValues,
      forceVersionAdvance: actor.kind === 'CHARACTER'
    })
    if (
      checksumRuleDocument(applied.targetTransition.before) !== checksumRuleDocument(before) ||
      checksumRuleDocument(applied.targetTransition.after) !==
        checksumRuleDocument(last.targetTransition.after) ||
      applied.targetTransition.checksum !== first.targetTransition.checksum ||
      checksumRuleDocument(applied.receiptApplications) !==
        checksumRuleDocument(
          applications.map(({ targetActorId: _id, ...application }, index) => ({
            ...application,
            ordinal: index
          }))
        ) ||
      (actor.kind === 'CHARACTER'
        ? applied.characterStreamVersion !== characterBeforeVersions.get(targetActorId)! + 1
        : applied.characterStreamVersion !== null)
    )
      throw new Error('Spatial mechanics settlement differs from prepared evidence.')
    actors.set(targetActorId, applied.updatedActor)
    if (actor.kind === 'CHARACTER')
      characterTransitions.push({
        characterId: actor.sourceId,
        targetActorId,
        beforeStreamVersion: characterBeforeVersions.get(targetActorId)!,
        afterStreamVersion: applied.characterStreamVersion!,
        before,
        after: applied.targetTransition.after
      })
  }

  const scope = await createSpatialRuleEffectStore(ctx).scope({
    encounterId: state.id,
    sceneId: input.sceneId
  })
  if (!scope) throw new Error('Spatial settlement Scene binding is stale.')
  for (const effectId of [...effectIds].sort()) {
    const effect = input.effectOriginals.get(effectId)!
    const transition = spatialEffectTransition(effect)
    const current = await scope.get(effectId)
    if (input.appliedEffectIds.has(effectId)) {
      spatialMovementEffectBeforeTransition({
        current,
        consumed: effect,
        effectId,
        transition,
        encounterId: state.id,
        sceneId: input.sceneId,
        allowUnapplied: false
      })
      continue
    }
    if (checksumRuleDocument(current) !== checksumRuleDocument(effect))
      throw new Error('Spatial rule effect changed before settlement.')
    if (transition.kind === 'DELETE')
      await scope.deleteCas({ id: effect.id, expectedVersion: effect.version })
    else if (transition.kind === 'UPDATE')
      await scope.updateCurrentStateCas({
        id: effect.id,
        expectedVersion: effect.version,
        lifecycle: effect.lifecycle,
        spatialState: { schemaVersion: 1, revealed: true }
      })
    input.appliedEffectIds.add(effectId)
  }
  return { actors: input.actors.map((actor) => actors.get(actor.id)!), characterTransitions }
}
