import { actionTargetActorId } from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import {
  nativeActionDamage,
  nativeConcentrationDamageApplications
} from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { cleavingChildOccurrenceIdentity } from '@artificer-toolkit/rules-runtime/encounterCleavingIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { insertNativeCleavingChoice } from './actionChildPersistence.js'
import { bindEncounterDamageSaveChain } from './effectRepeatSavePersistence.js'
import type {
  bindEncounterConcentrationApplications,
  persistEncounterConcentrationChildren
} from './concentrationChildrenPersistence.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

/** Persists only children of this completed action; all writes share the parent's transaction. */
export async function persistEncounterActionChildren(
  ctx: EncounterCharacterWriteTransaction,
  args: {
    input: LiveSessionEncounterActionCommitInput
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>
    fingerprint: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
  },
  callbacks: {
    bindConcentrationApplications(
      state: Parameters<typeof bindEncounterConcentrationApplications>[1],
      applications: Parameters<typeof bindEncounterConcentrationApplications>[2]
    ): ReturnType<typeof bindEncounterConcentrationApplications>
    persistConcentrationChildren(
      input: Parameters<typeof persistEncounterConcentrationChildren>[1]
    ): ReturnType<typeof persistEncounterConcentrationChildren>
  }
) {
  const { input, state, execution } = args
  const batch = execution.applicationOutputs
  if (
    batch.kind !== 'CHARACTER_MECHANICS_BATCH' &&
    batch.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH'
  )
    throw new Error('Live Session action child parent is invalid.')
  const damage = nativeActionDamage(batch)
  const applications = nativeConcentrationDamageApplications(damage, true)
  const { actors } = await callbacks.persistConcentrationChildren({
    state,
    actors: args.actors,
    parentOccurrenceId: execution.occurrenceId,
    parentCommandFingerprint: args.fingerprint,
    finalizedDamageEnvelopeChecksum: checksumRuleDocument(applications),
    remaining: await bindEncounterDamageSaveChain(ctx, {
      concentration: await callbacks.bindConcentrationApplications(state, applications),
      state,
      actors: args.actors,
      applications,
      parentOccurrenceId: execution.occurrenceId,
      damagerActorId: input.command.actorId
    }),
    correlationId: execution.occurrenceId,
    userId: args.userId,
    authorizedCharacterIds: args.authorizedCharacterIds,
    occurredAt: input.occurredAt,
    damagedActorIds: new Set(damage.map(({ targetActorId }) => targetActorId)),
    concentration: input.concentration,
    concentrationEnds: input.concentrationEnds,
    endedGrants: input.endedGrants,
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
      context.initialTargetActorId !== actionTargetActorId(input.command.target) ||
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
