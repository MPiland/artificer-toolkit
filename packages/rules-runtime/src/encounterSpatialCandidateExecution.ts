import type { EncounterSpatialRuleEffectRecord } from '@artificer-toolkit/schema/projections/spatialRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { CharacterDeathSaves } from '@artificer-toolkit/schema/shared/characterDeathSaves'
import type { ServerRuleExecutionD20EvidenceDto } from '@artificer-toolkit/schema/shared/ruleExecutionEvidence'
import type { ServerCompletedRuleExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionProtocol'
import type { D20RolledAddedDieDto } from '@artificer-toolkit/schema/shared/d20AddedDice'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'

import { foldCharacterMechanicsApplications } from './encounterCharacterMechanicsBatch.js'
import { settleEncounterD20Answer } from './encounterD20Settlement.js'
import { EncounterConflictError, EncounterValidationError } from './encounterErrors.js'
import {
  resolveEncounterIntegerAnswer,
  type EncounterD20RollMode
} from './encounterEvidenceAnswer.js'
import type { EncounterAutoRollByActorId } from './encounterEvidenceMode.js'
import type { ProjectableCharacterFacts } from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'
import { spatialPendingRollerActorId } from './encounterSpatialPendingRoller.js'
import { isEncounterPassiveZone } from './encounterPassiveZones.js'
import { isVisibleHalfSpeedField } from './halfSpeedField.js'
import type { RulesRuntimeService } from './rulesRuntimeService.js'
import {
  isDamageDieRequest,
  resumeTargetBoundActiveRuleEffectWithPause,
  type TargetBoundActiveRuleEffectExecutionInput,
  type TargetBoundActiveRuleEffectExecutionPaused,
  type TargetBoundActiveRuleEffectExecutionResult
} from './targetBoundActiveRuleEffectExecutor.js'

export type SpatialTargetState = {
  current: number
  temporary: number
  conditions: string[]
  deathSaves: CharacterDeathSaves | null
}

export type SpatialMovementTarget = {
  actor: Pick<EncounterRunActorState, 'id' | 'kind' | 'systemId'>
  character: {
    id: string
    streamVersion: number
    projectionChecksum: string
    mechanicalContextChecksum: string
  } | null
  /** The target's effective maximum: Run-owned for creatures, live-evaluated for Characters. */
  maximumHitPoints: number
  state: SpatialTargetState
  targetDerivedFacts: Readonly<Record<string, unknown>>
  defenses: TargetBoundActiveRuleEffectExecutionInput['defenses']
  conditionImmunityIds: readonly string[]
  scalarValues: Readonly<Record<string, number>>
}

/** The resolved d20 of a candidate whose damage dice are being answered. */
export type SpatialD20Roll = {
  rollMode: EncounterD20RollMode
  rawFaces: number[]
  addedDice: D20RolledAddedDieDto[]
}

export function toSpatialMovementTarget<TCharacterFacts extends ProjectableCharacterFacts>(
  target: MovementTarget<TCharacterFacts>
): SpatialMovementTarget {
  return {
    actor: target.actor,
    character:
      target.actor.kind === 'CHARACTER'
        ? {
            id: target.actor.sourceId,
            streamVersion: target.characterFacts!.active.play.streamVersion,
            ...target.characterCurrentness!
          }
        : null,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    state: { ...target.state, conditions: [...target.state.conditions] },
    targetDerivedFacts: target.targetDerivedFacts,
    defenses: target.defenses,
    conditionImmunityIds: target.conditionImmunityIds,
    scalarValues: target.effectiveScalarValues
  }
}

/**
 * The Scene's effects as the spatial seams read them. A Creature's passive zone rests, still drawn,
 * while its source is defeated and acts again once the source is revived (D144); `actors` is
 * required so that no seam can miss it.
 */
export function toSpatialInstances(
  effects: readonly EncounterSpatialRuleEffectRecord[],
  actors: readonly EncounterRunActorState[]
) {
  const defeated = new Set(
    actors.flatMap((actor) => (actor.kind !== 'CHARACTER' && actor.defeated ? [actor.id] : []))
  )
  return effects.map((effect) => toSpatialInstance(effect, defeated))
}

function toSpatialInstance(
  effect: EncounterSpatialRuleEffectRecord,
  defeatedActorIds: ReadonlySet<string>
) {
  const sourceActorId =
    effect.definition.origin.kind === 'ENCOUNTER' ? effect.definition.origin.sourceActorId : null
  return {
    effectId: effect.id,
    sourceActorId,
    sourceTokenId: effect.placement.sourceTokenId,
    anchorKind: effect.placement.anchorKind,
    geometry: effect.placement.geometry,
    triggerModes: effect.placement.triggerModes,
    turnTriggers: effect.placement.turnTriggers,
    movementKinds: effect.placement.movementKinds,
    bypassAtHalfSpeed: isVisibleHalfSpeedField(effect),
    movementCostMultiplier: effect.placement.movementCostMultiplier,
    unaffectedActorIds: effect.placement.unaffectedActorIds,
    maxApplicationsPerTurn: effect.placement.maxApplicationsPerTurn,
    requiresFullyWithin: effect.placement.requiresFullyWithin,
    retaliatesMeleeHits: effect.placement.retaliatesMeleeHits,
    distanceStep: effect.placement.distanceStep,
    suppressed:
      isEncounterPassiveZone(effect) &&
      sourceActorId !== null &&
      defeatedActorIds.has(sourceActorId)
  } as const
}

export function spatialExecutionInput(input: {
  effect: EncounterSpatialRuleEffectRecord
  target: SpatialMovementTarget
  state: SpatialTargetState
  occurrenceId: string
  runtime: RulesRuntimeService
  /** Facts a planner reads about this contact, merged over the target's derived facts. */
  contactFacts?: Readonly<Record<string, unknown>>
}): TargetBoundActiveRuleEffectExecutionInput {
  if (input.effect.definition.frozenGraph.source.gameSystemId !== input.target.actor.systemId)
    throw new EncounterValidationError('The spatial effect and target Game Systems do not match.')
  return {
    activeEffectId: input.effect.id,
    activeEffectVersion: input.effect.version,
    definition: input.effect.definition,
    lifecycle: input.effect.lifecycle,
    lifecycleChecksum: input.effect.lifecycleChecksum,
    occurrenceId: input.occurrenceId,
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    targetScalarValues: input.target.scalarValues,
    targetConditionIds: input.state.conditions,
    targetDerivedFacts: { ...input.target.targetDerivedFacts, ...input.contactFacts },
    defenses: input.target.defenses,
    conditionImmunityIds: input.target.conditionImmunityIds,
    runtime: input.runtime
  }
}

/** What a spatial candidate pins besides its contact: effect and target currentness and its evidence stage. */
export function spatialCandidateEvidence(input: {
  effect: EncounterSpatialRuleEffectRecord
  target: SpatialMovementTarget
  state: SpatialTargetState
  d20Policy: TargetBoundActiveRuleEffectExecutionPaused['evidencePolicy']
  diceStage: SpatialD20Roll | null
}) {
  const targetStateChecksum = checksumRuleDocument({
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    conditionIds: input.state.conditions,
    scalarValues: input.target.scalarValues
  })
  return {
    effect: {
      effectId: input.effect.id,
      version: input.effect.version,
      definitionChecksum: input.effect.definitionChecksum,
      lifecycleChecksum: input.effect.lifecycleChecksum,
      placementChecksum: input.effect.placementChecksum,
      spatialStateChecksum: input.effect.spatialStateChecksum,
      authoredEffectId: input.effect.definition.authoredEffectId,
      compiledEntryId: input.effect.definition.compiledEntryId,
      frozenGraphNodeId: input.effect.definition.frozenGraphNodeId,
      frozenSourceChecksum: input.effect.definition.frozenGraph.source.checksum,
      capabilityContractVersion: input.effect.definition.frozenGraph.capabilityContractVersion,
      activation: input.effect.placement.activation,
      revealed: input.effect.spatialState.revealed,
      revealOnTrigger: input.effect.placement.revealOnTrigger
    },
    target: input.target.character
      ? {
          kind: 'CHARACTER' as const,
          characterId: input.target.character.id,
          streamVersion: input.target.character.streamVersion,
          projectionChecksum: input.target.character.projectionChecksum,
          mechanicalContextChecksum: input.target.character.mechanicalContextChecksum,
          targetStateChecksum
        }
      : { kind: 'ENCOUNTER_ACTOR' as const, targetStateChecksum },
    d20Policy: input.d20Policy,
    diceStage: input.diceStage
  }
}

/** The outcome a finished spatial candidate records: its evidence, and the target's folded transition. */
export function spatialExecutionOutcome(input: {
  target: SpatialMovementTarget
  state: SpatialTargetState
  targetStateChecksum: string
  result: TargetBoundActiveRuleEffectExecutionResult
}) {
  const folded = foldCharacterMechanicsApplications({
    targetActorId: input.target.actor.id,
    currentHitPoints: input.state.current,
    temporaryHitPoints: input.state.temporary,
    maximumHitPoints: input.target.maximumHitPoints,
    deathSaves: input.state.deathSaves,
    conditionIds: input.state.conditions,
    scalarValues: input.target.scalarValues,
    applications: input.result.applications
  })
  return {
    execution: input.result.execution,
    d20: input.result.d20,
    targetTransition: {
      checksum: input.targetStateChecksum,
      before: folded.before,
      after: folded.after
    },
    applications: folded.applications
  }
}

/**
 * Whether a finished spatial execution ends the move at its contact: its graph interrupts the
 * movement, or it drops a creature moving of its own accord to 0 Hit Points, which can move no
 * further (D156). A forced move carries a creature on regardless.
 */
export function spatialExecutionStopsMovement(
  recorded: {
    execution: { movementInterruption?: { kind: 'STOP' } | null }
    candidate: { candidate: { sourceMoved: boolean } }
    targetTransition: { before: { currentHitPoints: number }; after: { currentHitPoints: number } }
  },
  movementKind: string
): boolean {
  if (recorded.execution.movementInterruption?.kind === 'STOP') return true
  const { before, after } = recorded.targetTransition
  return (
    movementKind === 'VOLUNTARY' &&
    !recorded.candidate.candidate.sourceMoved &&
    before.currentHitPoints > 0 &&
    after.currentHitPoints === 0
  )
}

/** The dice a recorded spatial execution rolled, in roll order, so a replay can roll them again. */
export function spatialExecutionRecordedFaces(recorded: {
  d20: Pick<ServerRuleExecutionD20EvidenceDto, 'rawFaces'> | null
  execution: Pick<ServerCompletedRuleExecutionDto, 'evidence'>
}): number[] {
  return [
    ...(recorded.d20?.rawFaces ?? []),
    ...recorded.execution.evidence.trace.flatMap((entry) =>
      // Dice behind a save are optional; a zone with no save (melee retaliation) rolls plain ones.
      (entry.operation.key === 'evidence.optional-integer-range' ||
        entry.operation.key === 'evidence.integer-range') &&
      entry.evidence?.kind === 'INTEGER_RANGE'
        ? [entry.evidence.value]
        : []
    )
  ]
}

/**
 * Answers a paused candidate's evidence for the rollers who auto-roll: the contacted creature's
 * save, then the zone source's damage dice, each by its own roller's preference. Stops at the first
 * request a roller must answer.
 */
export async function settleAutomaticSpatialEvidence(input: {
  effectInput: TargetBoundActiveRuleEffectExecutionInput
  candidate: { sourceActorId: string | null; targetActorId: string }
  result: TargetBoundActiveRuleEffectExecutionResult | TargetBoundActiveRuleEffectExecutionPaused
  d20: SpatialD20Roll | null
  autoRoll: EncounterAutoRollByActorId
  random: (maxExclusive: number) => number
}): Promise<{
  result: TargetBoundActiveRuleEffectExecutionResult | TargetBoundActiveRuleEffectExecutionPaused
  d20: SpatialD20Roll | null
}> {
  let { result, d20 } = input
  const { effectInput, random } = input
  // A spatial save belongs to the contacted actor, so its roller's preference applies.
  if (
    'continuation' in result &&
    result.evidencePolicy &&
    !d20 &&
    input.autoRoll[input.candidate.targetActorId] === true
  ) {
    const answer = { kind: 'AUTO_ROLL' as const, requestId: result.continuation.request.requestId }
    const { rawFaces, rollMode, addedDice } = settleEncounterD20Answer({
      d20: result.evidencePolicy,
      answer,
      rollD20: () => random(20) + 1,
      random
    })
    d20 = { rollMode, rawFaces, addedDice }
    result = await resumeTargetBoundActiveRuleEffectWithPause({
      ...effectInput,
      continuation: result.continuation,
      resolution: { requestId: answer.requestId, ...d20 },
      expectedEvidencePolicy: result.evidencePolicy
    })
  }
  // Its damage dice, after the save or with none, belong to the zone source's controller, who may
  // auto-roll them.
  while (
    'continuation' in result &&
    (d20 || !result.evidencePolicy) &&
    isDamageDieRequest(result.continuation, result.evidencePolicy) &&
    input.autoRoll[
      spatialPendingRollerActorId({
        candidate: input.candidate,
        d20Policy: result.evidencePolicy,
        diceStage: d20
      })
    ] === true
  ) {
    const { request } = result.continuation
    if (request.kind !== 'INTEGER_RANGE')
      throw new EncounterConflictError(
        'Automatic spatial execution requested unsupported evidence.'
      )
    const value = resolveEncounterIntegerAnswer({
      min: request.min,
      max: request.max,
      answer: { kind: 'AUTO_ROLL', requestId: request.requestId },
      random
    })
    result = await resumeTargetBoundActiveRuleEffectWithPause({
      ...effectInput,
      continuation: result.continuation,
      resolution: { requestId: request.requestId, value, d20 },
      expectedEvidencePolicy: result.evidencePolicy
    })
  }
  return { result, d20 }
}
