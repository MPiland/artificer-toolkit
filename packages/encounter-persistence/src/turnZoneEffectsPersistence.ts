import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import { orderSpatialSettlementActors } from '@artificer-toolkit/rules-runtime/encounterSpatialMovementPlan'
import type { TurnEffectBoundary } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { selectTurnZoneContacts } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  executedTurnZonePhaseEvidenceDtoSchema,
  type StagedTurnZonePlanDto
} from '@artificer-toolkit/schema/shared/ruleExecutionTurnPhaseEvidence'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { SpatialSceneToken } from '@artificer-toolkit/shared/vtt'

import { consumeNativeActionEconomy } from './actionEconomyPersistence.js'
import { readEncounterActorTokenBindings } from './actorTokenBindings.js'
import { readRunActor, readRunActors } from './documents.js'
import { readLiveCharacterStreamVersion } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/**
 * Persists one zone phase of a terminal turn inside the owning transaction: one mechanics batch per
 * creature caught, in the order a spatial prefix settles. The zones that catch creatures at the
 * boundary and the per-turn counters are derived again from the locked Scene, so a plan made
 * against a moved token, an edited zone or a spent limit is refused. Returns null when no zone
 * batch ran at this boundary.
 */
export async function persistEncounterTurnZoneEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    occurrenceId: string
    rootCommandId: string
    commandType: 'START' | 'ADVANCE_TURN'
    occurredAt: string
    boundary: TurnEffectBoundary
    plan: StagedTurnZonePlanDto | undefined
  },
  callbacks: {
    applyMechanics(
      batch: Omit<EncounterMechanicsBatchInput, 'expectedCharacterStreamVersion'>
    ): Promise<EncounterMechanicsBatchResult>
    readSceneTokens(sceneId: string): Promise<readonly SpatialSceneToken[]>
  }
): Promise<{
  phase: ReturnType<typeof executedTurnZonePhaseEvidenceDtoSchema.parse>
  actors: EncounterRunActorState[]
} | null> {
  const { state, boundary, plan } = input
  const stale = () => new Error('Staged turn zone selection is stale.')
  if (boundary.actorId === null || state.automationMode === 'MANUAL') {
    if (plan) throw stale()
    return null
  }
  const actorId = boundary.actorId
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  const tokenBindings = binding
    ? await readEncounterActorTokenBindings(ctx, state, binding.sceneId)
    : []
  const scope =
    binding && tokenBindings.some((tokenBinding) => tokenBinding.actorId === actorId)
      ? await createSpatialRuleEffectStore(ctx).scope({
          encounterId: state.id,
          sceneId: binding.sceneId
        })
      : null
  const selected =
    binding && scope
      ? selectTurnZoneContacts({
          state,
          actors: await readRunActors(ctx, state),
          commandType: input.commandType,
          boundary,
          actorId,
          scene: {
            effects: await scope.list(),
            tokens: await callbacks.readSceneTokens(binding.sceneId),
            actorIdByTokenId: new Map(
              tokenBindings.map((tokenBinding) => [tokenBinding.tokenId, tokenBinding.actorId])
            )
          }
        })
      : null
  if (!selected) {
    if (plan) throw stale()
    return null
  }
  const { contacts, effects, selectionChecksum } = selected
  if (!plan || plan.selectionChecksum !== selectionChecksum) throw stale()
  const { executions } = plan
  if (executions.length !== contacts.length) throw stale()

  const caught: EncounterRunActorState[] = []
  // The turn admission's revision fence pins a Character to the room's captured version.
  const beforeStreamVersions = new Map<string, number | null>()
  for (const { targetActorId } of contacts) {
    if (beforeStreamVersions.has(targetActorId)) continue
    const target = await readRunActor(ctx, state, targetActorId)
    caught.push(target)
    beforeStreamVersions.set(
      targetActorId,
      target.kind === 'CHARACTER'
        ? await readLiveCharacterStreamVersion(ctx, state, target.sourceId)
        : null
    )
  }
  for (const [ordinal, execution] of executions.entries()) {
    const { candidate } = execution
    const target = caught.find((entry) => entry.id === contacts[ordinal]!.targetActorId)!
    // Only a failed save of a zone that costs the Action spends one (D141).
    if (
      execution.actionEconomy &&
      (!effects[ordinal]!.placement.failedSaveLosesAction ||
        execution.execution.outputs.resultPath !== 'ON_SAVE_FAIL')
    )
      throw new Error('Staged turn zone action economy is stale.')
    if (
      target.kind === 'CHARACTER'
        ? candidate.target.kind !== 'CHARACTER' ||
          candidate.target.characterId !== target.sourceId ||
          candidate.target.streamVersion !== beforeStreamVersions.get(target.id)
        : candidate.target.kind !== 'ENCOUNTER_ACTOR'
    )
      throw new Error('Staged turn zone target pin is stale.')
  }

  const settledActors: EncounterRunActorState[] = []
  const characterTransitions: ReturnType<
    typeof executedTurnZonePhaseEvidenceDtoSchema.parse
  >['characterTransitions'] = []
  const encounterActorTransitions: ReturnType<
    typeof executedTurnZonePhaseEvidenceDtoSchema.parse
  >['encounterActorTransitions'] = []
  for (const [index, target] of orderSpatialSettlementActors(caught).entries()) {
    const targetExecutions = executions.filter(
      (execution) => execution.candidate.candidate.targetActorId === target.id
    )
    const beforeStreamVersion = beforeStreamVersions.get(target.id)!
    const first = targetExecutions[0]!
    const last = targetExecutions.at(-1)!
    const applied = await callbacks.applyMechanics({
      encounterId: state.id,
      targetActorId: target.id,
      expectedEncounterVersion: state.version,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.rootCommandId,
      commandId:
        target.kind === 'CHARACTER'
          ? deriveEncounterCharacterMechanicsEventCommandId({
              occurrenceId: input.occurrenceId,
              sourceCommandId: input.rootCommandId,
              phase: 'TURN_ZONE_EFFECT',
              ordinal: boundary.ordinal + index,
              targetCharacterId: target.sourceId
            })
          : input.rootCommandId,
      occurredAt: input.occurredAt,
      applications: targetExecutions.flatMap((execution) =>
        execution.applications.map(({ ordinal: _ordinal, ...application }) => ({
          ...application,
          targetActorId: target.id
        }))
      ),
      effectiveMaximumHitPoints: first.targetTransition.before.maximumHitPoints,
      effectiveScalarValues: first.targetTransition.before.scalarValues,
      forceVersionAdvance: target.kind === 'CHARACTER'
    })
    let applicationOrdinal = 0
    const expectedApplications = targetExecutions.flatMap((execution) =>
      execution.applications.map((application) => ({
        ...application,
        ordinal: applicationOrdinal++
      }))
    )
    if (
      !same(applied.targetTransition.before, first.targetTransition.before) ||
      !same(applied.targetTransition.after, last.targetTransition.after) ||
      !same(applied.receiptApplications, expectedApplications) ||
      (beforeStreamVersion !== null && applied.characterStreamVersion !== beforeStreamVersion + 1)
    )
      throw new Error('Turn zone settlement differs from its plan.')
    let settledActor = applied.updatedActor
    for (const { actionEconomy } of targetExecutions)
      if (actionEconomy)
        settledActor = await consumeNativeActionEconomy(ctx, {
          actor: settledActor,
          consumption: actionEconomy,
          overridden: false
        })
    settledActors.push(settledActor)
    const transition = {
      targetActorId: target.id,
      before: applied.targetTransition.before,
      after: applied.targetTransition.after
    }
    if (target.kind === 'CHARACTER')
      characterTransitions.push({
        characterId: target.sourceId,
        ...transition,
        beforeStreamVersion: beforeStreamVersion!,
        afterStreamVersion: applied.characterStreamVersion!
      })
    else encounterActorTransitions.push(transition)
  }
  return {
    actors: settledActors,
    phase: executedTurnZonePhaseEvidenceDtoSchema.parse({
      kind: 'EXECUTED',
      selectionChecksum,
      executions,
      characterTransitions,
      encounterActorTransitions
    })
  }
}
