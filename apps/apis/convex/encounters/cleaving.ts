import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { buildCompiledActionTargetPolicy } from '@artificer-toolkit/rules-runtime/encounterActionEntryPointCompiler'
import { createNativeCleavingChoice } from '@artificer-toolkit/rules-runtime/encounterCleavingChoice'
import {
  retainedCleavingDamage,
  nativeCleavingSourceCurrentness,
  type CleavingContext
} from '@artificer-toolkit/rules-runtime/encounterCleavingFacts'
import type { MutationCtx } from '../_generated/server'
import type { MovementTarget } from './movementTargets'
import { loadNativeEncounterActionSource, type NativeEncounterActionSource } from './actionSources'
import { nativeCleavingCandidates } from './cleavingFacts'
import { insertNativeCleavingChoice } from './actionChildPersistence'
import { verifyNativeCleavingParentChain } from './cleavingParent'

/** Called after resource consumption and Run publication, inside the same native mutation. */
export async function persistNativeCleavingAfterAction(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    result: Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>
    source: NativeEncounterActionSource
    action: CleavingContext['action']
    scene: CleavingContext['scene'] | null
    occurredAt: string
  }
) {
  const retained = retainedCleavingDamage(input.result)
  if (
    !retained ||
    !input.scene ||
    input.action.attackKind !== 'MELEE' ||
    input.state.optionalCombatSnapshotChecksum === null
  )
    return
  const visitedTargetActorIds = [retained.initialTargetActorId]
  const { candidates, targets } = await nativeCleavingCandidates(ctx, {
    state: input.state,
    sourceActorId: input.source.actor.id,
    action: input.action,
    scene: input.scene,
    originalAttack: retained.originalAttack,
    visitedTargetActorIds
  })
  const source = targets.get(input.source.actor.id)
  if (!source) throw new Error('Cleaving source is unavailable.')
  const snapshot = createNativeCleavingChoice({
    ...input.state,
    parentOccurrenceId: input.result.occurrenceId,
    parentResultChecksum: checksumRuleDocument(input.result),
    optionalCombatSnapshotChecksum: input.state.optionalCombatSnapshotChecksum,
    sourceActorId: source.actor.id,
    sourceControllerCharacterId: source.actor.kind === 'CHARACTER' ? source.actor.sourceId : null,
    sourceCurrentness: nativeCleavingSourceCurrentness(source, input.source),
    action: input.action,
    scene: input.scene,
    ...retained,
    visitedTargetActorIds,
    chainStep: 0,
    candidates
  })
  if (snapshot) await insertNativeCleavingChoice(ctx, input.state, snapshot, input.occurredAt)
}

async function currentSource(
  ctx: MutationCtx,
  state: EncounterRunState,
  target: MovementTarget,
  actionId: string
) {
  const character = target.characterReactionSource
  const candidate = character?.mechanics.rulePolicyInput.actionCandidates.find(
    (entry) => entry.actionId === actionId
  )
  const entry = candidate
    ? character?.mechanics.compiledActionEntryPoints.find(
        (
          entry
        ): entry is NonNullable<
          Parameters<typeof loadNativeEncounterActionSource>[1]['characterSource']
        >['entry'] =>
          entry.actionId === actionId &&
          entry.effectId === candidate.effectId &&
          entry.kind === 'CHARACTER_ACTION' &&
          entry.compilation.kind === 'COMPILED'
      )
    : undefined
  return loadNativeEncounterActionSource(ctx, {
    actor: target.actor,
    actionId,
    gameSystemId: state.gameSystemId,
    ...(character &&
    candidate &&
    entry?.kind === 'CHARACTER_ACTION' &&
    entry.compilation.kind === 'COMPILED' &&
    target.effectiveRulePolicyOutput
      ? {
          characterSource: {
            id: character.id,
            streamVersion: character.streamVersion,
            candidate,
            entry,
            effectivePolicyOutput: target.effectiveRulePolicyOutput
          }
        }
      : {})
  })
}

/** Rebuild only while the caller holds the same transaction that validates the sealed choice. */
export async function rebuildNativeDeferredCleaving(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    context: CleavingContext
    sceneScope: 'OWNER' | 'MEMBER'
  }
) {
  const { state, context, sceneScope } = input
  await verifyNativeCleavingParentChain(ctx, state, context)
  const { candidates, targets } = await nativeCleavingCandidates(ctx, {
    state,
    ...context,
    sceneScope
  })
  const sourceFacts = targets.get(context.sourceActorId)
  if (!sourceFacts) throw new Error('Deferred Cleaving source is unavailable.')
  const source = await currentSource(ctx, state, sourceFacts, context.action.actionId)
  const range =
    source.kind === 'CREATURE'
      ? buildCompiledActionTargetPolicy(source.capability).range
      : source.entry.targetPolicy?.range
  if (checksumRuleDocument(range) !== checksumRuleDocument(context.action.range))
    throw new Error('Deferred Cleaving action is stale.')
  return createNativeCleavingChoice({
    ...state,
    ...context,
    optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum ?? '',
    sourceCurrentness: nativeCleavingSourceCurrentness(sourceFacts, source),
    chainStep: context.chainStep - 1,
    candidates
  })
}
