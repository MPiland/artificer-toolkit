import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { MutationCtx } from '../_generated/server'
import { insertNativeCleavingChoice } from '../encounters/actionChildPersistence'
import { persistLiveEncounterConcentrationChildren } from './encounterConcentrationChildrenCommit'

/** Persists only children of this completed action; all writes share the parent's transaction. */
export async function persistLiveEncounterActionChildren(
  ctx: MutationCtx,
  args: {
    input: LiveSessionEncounterActionCommitInput
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>
    fingerprint: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
  }
) {
  const { input, state, execution } = args
  const batch = execution.applicationOutputs
  if (
    batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
    batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Live Session action child parent is invalid.')
  const applications = nativeConcentrationDamageApplications(
    [{ targetActorId: batch.targetActorId, applications: batch.applications }],
    true
  )
  const actors = await persistLiveEncounterConcentrationChildren(ctx, {
    state,
    actors: args.actors,
    parentOccurrenceId: execution.occurrenceId,
    fingerprint: args.fingerprint,
    userId: args.userId,
    authorizedCharacterIds: args.authorizedCharacterIds,
    occurredAt: input.occurredAt,
    applications,
    concentration: input.concentration,
    pendingConcentration: input.pendingConcentration
  })
  const pending = input.pendingConcentration
  const cleaving = input.cleaving
  if (cleaving) {
    if (
      cleaving.snapshotKind !== 'AGGREGATE_CHOICE' ||
      cleaving.applicationContext.kind !== 'ENCOUNTER_OPTIONAL_COMBAT_CLEAVING'
    )
      throw new Error('Live Session Cleaving choice is invalid.')
    const context = cleaving.applicationContext
    const scene = input.command.sceneContext
    if (
      !scene ||
      cleaving.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      cleaving.occurrenceId !== cleavingChildOccurrenceIdentity(execution.occurrenceId, 1) ||
      context.parentOccurrenceId !== execution.occurrenceId ||
      context.parentResultChecksum !== checksumRuleDocument(execution) ||
      context.sourceActorId !== input.command.actorId ||
      context.initialTargetActorId !== input.command.targetActorId ||
      context.action.actionId !== input.command.actionId ||
      context.chainStep !== 1 ||
      context.scene.sceneId !== scene.sceneId ||
      context.scene.sceneVersion !== scene.expectedSceneVersion ||
      context.scene.sourceTokenId !== scene.sourceTokenId ||
      context.options.some((option) => !actors.some((actor) => actor.id === option.targetActorId))
    )
      throw new Error('Live Session Cleaving choice scope mismatch.')
    if (pending?.snapshotKind === 'KERNEL_EVIDENCE') {
      if (
        checksumCanonicalJson(pending.deferredCleaving ?? null) !== checksumCanonicalJson(context)
      )
        throw new Error('Live Session deferred Cleaving mismatch.')
    } else await insertNativeCleavingChoice(ctx, state, cleaving, input.occurredAt)
  } else if (pending?.snapshotKind === 'KERNEL_EVIDENCE' && pending.deferredCleaving)
    throw new Error('Live Session deferred Cleaving is missing.')
  return actors
}
