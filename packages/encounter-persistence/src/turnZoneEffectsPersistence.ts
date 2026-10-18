import { deriveEncounterCharacterMechanicsEventCommandId } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import { planSpatialHeldCondition } from '@artificer-toolkit/rules-runtime/encounterSpatialHeldCondition'
import type { EncounterMechanicsBatchInput } from '@artificer-toolkit/rules-runtime/encounterMechanicsBatchPlan'
import {
  turnEffectOwner,
  type TurnEffectBoundary
} from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import { selectTurnZoneContacts } from '@artificer-toolkit/rules-runtime/encounterTurnZoneEffects'
import { encounterActorTokenBindingSchema } from '@artificer-toolkit/schema/projections/encounterRunPersistence'
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
import { readRunActor } from './documents.js'
import { readLiveCharacterStreamVersion } from './liveMovementTargetState.js'
import type { EncounterMechanicsBatchResult } from './mechanicsBatchPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { createSpatialRuleEffectStore } from './spatialEffectStore.js'

function same(left: unknown, right: unknown) {
  return checksumCanonicalJson(left) === checksumCanonicalJson(right)
}

/**
 * Persists one zone phase of a terminal turn inside the owning transaction. The zones that catch
 * the boundary creature and the per-turn counter are derived again from the locked Scene, so a
 * plan made against a moved token, an edited zone or a spent limit is refused. Returns null when no
 * zone batch ran at this boundary.
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
  actor: EncounterRunActorState
} | null> {
  const { state, boundary, plan } = input
  const stale = () => new Error('Staged turn zone selection is stale.')
  if (boundary.actorId === null || state.automationMode === 'MANUAL') {
    if (plan) throw stale()
    return null
  }
  const actor = await readRunActor(ctx, state, boundary.actorId)
  const binding = await ctx.db
    .query('encounterSceneBindings')
    .withIndex('by_encounterId', (q) => q.eq('encounterId', state.id))
    .unique()
  const tokenRow =
    binding &&
    (await ctx.db
      .query('encounterActorTokenBindings')
      .withIndex('by_encounterId_actorId', (q) =>
        q.eq('encounterId', state.id).eq('actorId', actor.id)
      )
      .unique())
  const tokenBinding =
    tokenRow &&
    (({ _id, _creationTime, ...stored }) => encounterActorTokenBindingSchema.parse(stored))(
      tokenRow
    )
  if (tokenBinding && tokenBinding.sceneId !== binding?.sceneId)
    throw new Error('Stored Encounter token binding is inconsistent.')
  const scope =
    binding && tokenBinding
      ? await createSpatialRuleEffectStore(ctx).scope({
          encounterId: state.id,
          sceneId: binding.sceneId
        })
      : null
  const selected =
    binding && tokenBinding && scope
      ? selectTurnZoneContacts({
          state,
          commandType: input.commandType,
          boundary,
          actorId: actor.id,
          scene: {
            effects: await scope.list(),
            tokens: await callbacks.readSceneTokens(binding.sceneId),
            actorIdByTokenId: new Map([[tokenBinding.tokenId, actor.id]])
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

  // The turn admission's revision fence pins a Character to the room's captured version.
  const beforeStreamVersion =
    actor.kind === 'CHARACTER'
      ? await readLiveCharacterStreamVersion(ctx, state, actor.sourceId)
      : null
  const applications: EncounterMechanicsBatchInput['applications'][number][] = []
  for (const [ordinal, execution] of executions.entries()) {
    const { candidate } = execution
    // Only a failed save of a zone that costs the Action spends one (D141).
    if (
      execution.actionEconomy &&
      (!effects[ordinal]!.placement.failedSaveLosesAction ||
        execution.execution.outputs.resultPath !== 'ON_SAVE_FAIL')
    )
      throw new Error('Staged turn zone action economy is stale.')
    if (
      actor.kind === 'CHARACTER'
        ? candidate.target.kind !== 'CHARACTER' ||
          candidate.target.characterId !== actor.sourceId ||
          candidate.target.streamVersion !== beforeStreamVersion
        : candidate.target.kind !== 'ENCOUNTER_ACTOR'
    )
      throw new Error('Staged turn zone target pin is stale.')
    applications.push(
      ...execution.applications.map(({ ordinal: _ordinal, ...application }) => ({
        ...application,
        targetActorId: actor.id
      }))
    )
  }
  const first = executions[0]!
  const last = executions.at(-1)!
  const applied = await callbacks.applyMechanics({
    encounterId: state.id,
    targetActorId: actor.id,
    expectedEncounterVersion: state.version,
    occurrenceId: input.occurrenceId,
    sourceCommandId: input.rootCommandId,
    commandId:
      actor.kind === 'CHARACTER'
        ? deriveEncounterCharacterMechanicsEventCommandId({
            occurrenceId: input.occurrenceId,
            sourceCommandId: input.rootCommandId,
            phase: 'TURN_ZONE_EFFECT',
            ordinal: boundary.ordinal,
            targetCharacterId: actor.sourceId
          })
        : input.rootCommandId,
    occurredAt: input.occurredAt,
    applications,
    effectiveMaximumHitPoints: first.targetTransition.before.maximumHitPoints,
    effectiveScalarValues: first.targetTransition.before.scalarValues,
    forceVersionAdvance: actor.kind === 'CHARACTER'
  })
  let applicationOrdinal = 0
  const expectedApplications = executions.flatMap((execution) =>
    execution.applications.map((application) => ({ ...application, ordinal: applicationOrdinal++ }))
  )
  if (
    !same(applied.targetTransition.before, first.targetTransition.before) ||
    !same(applied.targetTransition.after, last.targetTransition.after) ||
    !same(applied.receiptApplications, expectedApplications) ||
    (beforeStreamVersion !== null && applied.characterStreamVersion !== beforeStreamVersion + 1)
  )
    throw new Error('Turn zone settlement differs from its plan.')
  // A zone holds the condition its failed save applied (D146).
  const effectStore = createActiveRuleEffectStore(ctx)
  const owner = turnEffectOwner(actor, state.id)
  for (const [ordinal, execution] of executions.entries()) {
    const zone = effects[ordinal]!
    const held = planSpatialHeldCondition({
      zone,
      holder: {
        activeEffects: await effectStore.list(owner),
        conditionIds: execution.targetTransition.before.conditionIds
      },
      applications: execution.applications,
      encounterId: state.id,
      occurrenceId: input.occurrenceId,
      sourceCommandId: input.rootCommandId,
      targetActorId: actor.id
    })
    if (held)
      await effectStore.create({
        ...held,
        owner,
        maintainedEffectStateId: zone.maintainedEffectStateId,
        occurredAt: input.occurredAt
      })
  }
  let settledActor = applied.updatedActor
  for (const { actionEconomy } of executions)
    if (actionEconomy)
      settledActor = await consumeNativeActionEconomy(ctx, {
        actor: settledActor,
        consumption: actionEconomy,
        overridden: false
      })
  return {
    actor: settledActor,
    phase: executedTurnZonePhaseEvidenceDtoSchema.parse({
      kind: 'EXECUTED',
      selectionChecksum,
      executions,
      characterTransitions:
        actor.kind === 'CHARACTER'
          ? [
              {
                characterId: actor.sourceId,
                targetActorId: actor.id,
                beforeStreamVersion,
                afterStreamVersion: applied.characterStreamVersion,
                before: applied.targetTransition.before,
                after: applied.targetTransition.after
              }
            ]
          : [],
      encounterActorTransitions:
        actor.kind !== 'CHARACTER'
          ? [
              {
                targetActorId: actor.id,
                before: applied.targetTransition.before,
                after: applied.targetTransition.after
              }
            ]
          : []
    })
  }
}
