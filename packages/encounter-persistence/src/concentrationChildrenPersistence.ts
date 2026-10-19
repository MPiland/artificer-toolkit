import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import {
  grantsEndedByHolderState,
  grantsEndedBySourceState,
  sourceBoundGrants,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import {
  persistNativeConcentrationEnd,
  persistNativeConcentrationPending,
  persistNativeConcentrationResult
} from './actionChildPersistence.js'
import {
  postConcentrationEndMessage,
  postGrantEndMessages,
  readHolderEndState
} from './concentrationEnd.js'
import { deleteGrants } from './consumedGrantPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'
import { concentrationTargetPinChanged } from './concentrationTargetPin.js'
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
      maintenanceDefinitionId: requireInstalledConcentrationMaintenanceDefinitionId(
        state.gameSystemId
      )
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
      Pick<EncounterWritePorts, 'recordConcentrationCheckRoll' | 'postRulesChatMessage'>
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
    /**
     * The actors this commit's damage reached: the only holders whose state-bound grants the plan
     * had to end. A continuation settles the checks of damage already committed, so it names none.
     */
    damagedActorIds: ReadonlySet<string>
  } & Pick<
    LiveSessionEncounterActionCommitInput,
    'concentration' | 'concentrationEnds' | 'endedGrants' | 'pendingConcentration'
  >,
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
  // D95: a holder that can't act or is defeated loses Concentration with no check. Every reason is
  // derived from the committed state before any cleanup runs, as the planner derived them.
  const ends: {
    end: (typeof args.concentrationEnds)[number]
    slot: NonNullable<Awaited<ReturnType<typeof store.findMaintainedStateById>>>
    holder: EncounterRunActorState
  }[] = []
  let previousOwnerId: string | null = null
  for (const end of args.concentrationEnds) {
    const slot = await store.findMaintainedStateById({
      encounterId: state.id,
      stateId: end.maintainedStateId
    })
    const holder = actors.find((actor) => actor.id === end.ownerActorId)
    if (
      state.automationMode === 'MANUAL' ||
      (previousOwnerId !== null && end.ownerActorId.localeCompare(previousOwnerId) <= 0) ||
      !slot ||
      slot.ownerActorId !== end.ownerActorId ||
      slot.maintenanceDefinitionId !==
        requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId) ||
      !holder ||
      (await readHolderEndState(ctx, { state, actor: holder, userId: args.userId })).reason !==
        end.reason
    )
      throw new Error('Live Session concentration end is unexpected.')
    previousOwnerId = end.ownerActorId
    ends.push({ end, slot, holder })
  }
  // The committed reason each actor that applied a grant to another can't act, read once.
  const sourceReasons = new Map<string, Awaited<ReturnType<typeof readHolderEndState>>['reason']>()
  async function readSourceReason(sourceActorId: string) {
    if (!sourceReasons.has(sourceActorId)) {
      const source = actors.find((actor) => actor.id === sourceActorId)
      sourceReasons.set(
        sourceActorId,
        source
          ? (await readHolderEndState(ctx, { state, actor: source, userId: args.userId })).reason
          : null
      )
    }
    return sourceReasons
  }
  // The grants the holder's or source's state ends must be stored as sent and be ones the committed state ends.
  for (const grant of args.endedGrants) {
    const stored = await store.findById(grant.owner, grant.id)
    const holder = actors.find(
      (actor) =>
        checksumCanonicalJson(turnEffectOwner(actor, state.id)) ===
        checksumCanonicalJson(grant.owner)
    )
    const holderState =
      holder && (await readHolderEndState(ctx, { state, actor: holder, userId: args.userId }))
    if (
      state.automationMode === 'MANUAL' ||
      !stored ||
      checksumCanonicalJson(stored) !== checksumCanonicalJson(grant) ||
      !holderState ||
      (!grantsEndedByHolderState([stored], holderState).length &&
        !grantsEndedBySourceState(
          [stored],
          await readSourceReason(
            stored.definition.origin.kind === 'ENCOUNTER'
              ? (stored.definition.origin.sourceActorId ?? '')
              : ''
          )
        ).length)
    )
      throw new Error('Live Session grant end is unexpected.')
  }
  // And the plan must omit none: every grant a damaged holder's committed state ends is sent.
  if (state.automationMode !== 'MANUAL') {
    const sent = new Set(args.endedGrants.map(({ id }) => id))
    for (const holder of actors.filter(({ id }) => args.damagedActorIds.has(id))) {
      const stateBound = stateBoundGrants(await store.list(turnEffectOwner(holder, state.id)))
      if (!stateBound.length) continue
      const holderState = await readHolderEndState(ctx, {
        state,
        actor: holder,
        userId: args.userId
      })
      if (grantsEndedByHolderState(stateBound, holderState).some(({ id }) => !sent.has(id)))
        throw new Error('Live Session grant end is missing.')
    }
    // A damaged source that can no longer act ends the grants it applied, on whichever actor holds them.
    for (const holder of actors) {
      const sourceBound = sourceBoundGrants(await store.list(turnEffectOwner(holder, state.id)))
      for (const grant of sourceBound) {
        const sourceActorId =
          grant.definition.origin.kind === 'ENCOUNTER'
            ? grant.definition.origin.sourceActorId
            : null
        if (sourceActorId === null || !args.damagedActorIds.has(sourceActorId)) continue
        if (
          !sent.has(grant.id) &&
          grantsEndedBySourceState([grant], await readSourceReason(sourceActorId)).length
        )
          throw new Error('Live Session grant end is missing.')
      }
    }
  }
  for (const { end, slot, holder } of ends) {
    actors = await callbacks.applyCleanup({
      state,
      actors,
      slot,
      cleanup: end.cleanup,
      authorizedCharacterIds: args.authorizedCharacterIds,
      occurredAt: args.occurredAt
    })
    const occurrenceId = await persistNativeConcentrationEnd(ctx, {
      state,
      parentOccurrenceId,
      end,
      userId: args.userId,
      correlationId,
      occurredAt: args.occurredAt
    })
    await postConcentrationEndMessage(ctx, {
      state,
      actor: holder,
      reason: end.reason,
      occurrenceId,
      userId: args.userId
    })
    remaining = remaining.filter((entry) => entry.maintainedStateId !== end.maintainedStateId)
  }
  await deleteGrants(ctx, args.endedGrants)
  for (const holder of actors) {
    const owner = checksumCanonicalJson(turnEffectOwner(holder, state.id))
    await postGrantEndMessages(ctx, {
      state,
      actor: holder,
      grants: args.endedGrants.filter((grant) => checksumCanonicalJson(grant.owner) === owner),
      occurrenceId: parentOccurrenceId,
      userId: args.userId
    })
  }
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
      slot.maintenanceDefinitionId !==
        requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId) ||
      !target ||
      (await concentrationTargetPinChanged(target, output.targetCharacter, (characterId) =>
        callbacks.currentCharacterStreamVersion(characterId)
      ))
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
      (await concentrationTargetPinChanged(target, context.targetCharacter, (characterId) =>
        callbacks.currentCharacterStreamVersion(characterId)
      )) ||
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
