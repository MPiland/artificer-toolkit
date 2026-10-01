import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID } from '@artificer-toolkit/rules-runtime/systems/dnd5e/concentrationIdentity'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  persistNativeConcentrationPending,
  persistNativeConcentrationResult
} from './actionChildPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'
import type { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'

type ConcentrationDamageApplication = ReturnType<
  typeof nativeConcentrationDamageApplications
>[number]
type BoundConcentrationApplication = ConcentrationDamageApplication & { maintainedStateId: string }

/**
 * Binds a parent's damage to the concentration each target currently maintains. The effect store
 * requires the owning write transaction; this binding performs only reads.
 */
export async function bindEncounterConcentrationApplications(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  applications: readonly ConcentrationDamageApplication[]
): Promise<BoundConcentrationApplication[]> {
  const store = createActiveRuleEffectStore(ctx)
  const bindings = new Map<string, string>()
  for (const targetActorId of new Set(applications.map((entry) => entry.targetActorId))) {
    const slot = await store.findMaintainedState({
      encounterId: state.id,
      ownerActorId: targetActorId,
      maintenanceDefinitionId: DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID
    })
    if (slot) bindings.set(targetActorId, slot.id)
  }
  return applications.flatMap((application) => {
    const maintainedStateId = bindings.get(application.targetActorId)
    return maintainedStateId ? [{ ...application, maintainedStateId }] : []
  })
}

/**
 * Persists the settled concentration checks and next decision of one damage chain within the
 * authorized transaction: a parent's children, or the checks a response commit auto-rolled after
 * its answered check (D23). state is the transaction's final Encounter state.
 */
export async function persistEncounterConcentrationChildren(
  ctx: EncounterCharacterWriteTransaction & {
    ports: EncounterCharacterWriteTransaction['ports'] &
      Pick<EncounterWritePorts, 'recordConcentrationCheckRoll'>
  },
  args: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    parentOccurrenceId: string
    parentCommandFingerprint: string
    finalizedDamageEnvelopeChecksum: string
    /** The bound checks still to settle, in damage order. */
    remaining: readonly BoundConcentrationApplication[]
    /** The occurrence the first settled check correlates to. */
    correlationId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  } & Pick<LiveSessionEncounterActionCommitInput, 'concentration' | 'pendingConcentration'>,
  callbacks: {
    currentCharacterStreamVersion(characterId: string): Promise<number>
    applyCleanup(input: {
      state: EncounterRunState
      actors: EncounterRunActorState[]
      slot: NonNullable<
        Awaited<
          ReturnType<ReturnType<typeof createActiveRuleEffectStore>['findMaintainedStateById']>
        >
      >
      cleanup: NonNullable<
        ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>['cleanup']
      >
      authorizedCharacterIds: ReadonlySet<string>
      occurredAt: string
    }): Promise<EncounterRunActorState[]>
  }
) {
  const { state, parentOccurrenceId } = args
  const store = createActiveRuleEffectStore(ctx)
  let remaining = [...args.remaining]
  let actors = args.actors
  let correlationId = args.correlationId
  let failed = false
  for (const child of args.concentration) {
    const result = child.result
    const application = remaining.shift()
    if (
      !application ||
      result.status !== 'COMPLETE' ||
      result.applicationOutputs.kind !== 'CONCENTRATION_CHECK'
    )
      throw new Error('Live Session concentration child is unexpected.')
    const output = result.applicationOutputs
    const { maintainedStateId, ...damage } = application
    const expectedId = concentrationOccurrenceId(parentOccurrenceId, damage)
    if (
      state.automationMode === 'MANUAL' ||
      result.occurrenceId !== expectedId ||
      result.occurrenceVersion !== 1 ||
      result.evidence.source.gameSystemId !== state.gameSystemId ||
      result.evidence.source.definitionId !== output.concentrationDefinition.id ||
      result.evidence.source.checksum !== output.concentrationDefinition.checksum ||
      output.occurrenceId !== expectedId ||
      output.parentOccurrenceId !== parentOccurrenceId ||
      checksumCanonicalJson(output.application) !== checksumCanonicalJson(application) ||
      child.commandId !== concentrationCommandId(expectedId) ||
      child.correlationId !== correlationId ||
      child.fingerprint !==
        checksumRuleDocument({
          parentOccurrenceId,
          application: damage,
          contextChecksum: output.contextChecksum
        }) ||
      child.metadata.transition !== 'START' ||
      child.metadata.definitionId !== output.concentrationDefinition.id ||
      child.metadata.expectedAggregateVersion !== state.version ||
      child.metadata.factsChecksum !== result.initialFactsChecksum ||
      child.metadata.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum
    )
      throw new Error('Live Session concentration receipt scope mismatch.')
    const slot = await store.findMaintainedStateById({
      encounterId: state.id,
      stateId: maintainedStateId
    })
    const target = actors.find((actor) => actor.id === application.targetActorId)
    if (
      !slot ||
      slot.ownerActorId !== application.targetActorId ||
      slot.maintenanceDefinitionId !== DND5E_CONCENTRATION_MAINTENANCE_DEFINITION_ID ||
      !target ||
      (target.kind === 'CHARACTER' &&
        (await callbacks.currentCharacterStreamVersion(target.sourceId)) !==
          output.targetCharacter.streamVersion)
    )
      throw new Error('Live Session concentration target changed.')
    const existing = await ctx.db
      .query('encounterRuleOccurrences')
      .withIndex('by_publicId', (q) => q.eq('id', expectedId))
      .unique()
    if (existing) throw new Error('The concentration child occurrence already exists.')
    const skipped =
      output.outcome === 'SAVE_FAILURE'
        ? remaining.filter((entry) => entry.maintainedStateId === maintainedStateId)
        : []
    if (
      checksumCanonicalJson(output.skipped) !==
      checksumCanonicalJson(
        skipped.map((entry) => ({ ...entry, reason: 'MAINTAINED_STATE_ENDED' }))
      )
    )
      throw new Error('Live Session concentration skipped applications mismatch.')
    if (output.cleanup) {
      failed = true
      actors = await callbacks.applyCleanup({
        state,
        actors,
        slot,
        cleanup: output.cleanup,
        authorizedCharacterIds: args.authorizedCharacterIds,
        occurredAt: args.occurredAt
      })
      remaining = remaining.filter((entry) => entry.maintainedStateId !== maintainedStateId)
    }
    const nextId = remaining[0] ? concentrationOccurrenceId(parentOccurrenceId, remaining[0]) : null
    if (output.nextOccurrenceId !== nextId)
      throw new Error('Live Session concentration child order mismatch.')
    await persistNativeConcentrationResult(ctx, {
      state,
      result,
      commandId: child.commandId,
      fingerprint: child.fingerprint,
      userId: args.userId,
      correlationId,
      metadata: child.metadata,
      occurredAt: args.occurredAt
    })
    correlationId = expectedId
  }
  const pending = args.pendingConcentration
  if (pending) {
    const application = remaining.shift()
    if (
      state.automationMode === 'MANUAL' ||
      !application ||
      pending.snapshotKind !== 'KERNEL_EVIDENCE' ||
      pending.applicationContext.kind !== 'ENCOUNTER_CONCENTRATION_DAMAGE_CHECK'
    )
      throw new Error('Live Session pending concentration is unexpected.')
    const context = pending.applicationContext
    const { maintainedStateId, ...damage } = application
    const slot = await store.findMaintainedStateById({
      encounterId: state.id,
      stateId: maintainedStateId
    })
    const target = actors.find((actor) => actor.id === application.targetActorId)
    if (
      !slot ||
      slot.ownerActorId !== application.targetActorId ||
      !target ||
      (target.kind === 'CHARACTER' &&
        (await callbacks.currentCharacterStreamVersion(target.sourceId)) !==
          context.targetCharacter.streamVersion) ||
      pending.occurrenceId !== concentrationOccurrenceId(parentOccurrenceId, damage) ||
      pending.graph.source.gameSystemId !== state.gameSystemId ||
      pending.graph.source.definitionId !== context.concentrationDefinition.id ||
      pending.graph.source.checksum !== context.concentrationDefinition.checksum ||
      pending.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      context.parentOccurrenceId !== parentOccurrenceId ||
      context.parentCommandFingerprint !== args.parentCommandFingerprint ||
      context.finalizedDamageEnvelopeChecksum !== args.finalizedDamageEnvelopeChecksum ||
      checksumCanonicalJson(context.application) !== checksumCanonicalJson(damage) ||
      checksumCanonicalJson(context.remaining) !== checksumCanonicalJson(remaining) ||
      checksumCanonicalJson(context.maintainedState) !==
        checksumCanonicalJson({
          id: slot.id,
          version: slot.version,
          maintenanceDefinitionId: slot.maintenanceDefinitionId,
          descriptorChecksum: slot.descriptorChecksum
        })
    )
      throw new Error('Live Session pending concentration scope mismatch.')
    await persistNativeConcentrationPending(ctx, {
      state,
      context,
      continuation: pending,
      deferredCleaving: pending.deferredCleaving,
      occurredAt: args.occurredAt
    })
  } else if (remaining.length)
    throw new Error('Live Session concentration children are incomplete.')
  return { actors, failed }
}
