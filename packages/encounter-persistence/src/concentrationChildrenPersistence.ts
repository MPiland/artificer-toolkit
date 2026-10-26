import type { LiveSessionEncounterActionCommitInput } from '@artificer-toolkit/schema/api/liveSessionEncounterAction'
import type { ActiveRuleEffectRecord } from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import {
  damageSaveApplicationsAfterRelease,
  isMaintainedDamageApplication,
  unboundDamageSaveApplication,
  type ConcentrationMaintainedDamageApplicationDto,
  type DamageSaveApplicationDto
} from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import { damageSaveCheckBoundApplication } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import { nativeConcentrationDamageApplications } from '@artificer-toolkit/rules-runtime/encounterConcentrationDamage'
import { savingThrowSpentEffects } from '@artificer-toolkit/rules-runtime/encounterEndedEffectRelease'
import {
  grantsEndedByHolderState,
  grantsEndedBySourceState,
  sourceBoundGrants,
  stateBoundGrants
} from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { abilityScoreCapabilityRegistry } from '@artificer-toolkit/rules-runtime/platformPolicyModules'
import { turnEffectOwner } from '@artificer-toolkit/rules-runtime/encounterTurnEffectState'
import {
  concentrationCommandId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import {
  encounterMassiveDamageRule,
  massiveDamageRulePinned
} from '@artificer-toolkit/rules-runtime/encounterMassiveDamage'
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
import { readEncounterActorMaximumHitPoints } from './characterMaximumHitPoints.js'
import { readEffectRepeatSaveRow, releaseEffectRepeatSave } from './effectRepeatSavePersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterCharacterWriteTransaction, EncounterWritePorts } from './ports.js'
import type { EncounterWriteContext } from './store.js'
import { concentrationTargetPinChanged } from './concentrationTargetPin.js'
import type {
  concentrationCheckApplicationOutputDtoSchema,
  damageSaveCheckApplicationOutputDtoSchema
} from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'

type ConcentrationDamageApplication = ReturnType<
  typeof nativeConcentrationDamageApplications
>[number]
type MaintainedSlot = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectStore>['findMaintainedStateById']>>
>
type CleanupOutput = ReturnType<
  typeof concentrationCheckApplicationOutputDtoSchema.parse
>['cleanup']
type DamageSaveCheckOutput = ReturnType<typeof damageSaveCheckApplicationOutputDtoSchema.parse>

/**
 * Binds a parent's damage to the concentration each target currently maintains. The effect store
 * requires the owning write transaction; this binding performs only reads.
 */
export async function bindEncounterConcentrationApplications(
  ctx: EncounterWriteContext,
  state: EncounterRunState,
  applications: readonly ConcentrationDamageApplication[]
): Promise<ConcentrationMaintainedDamageApplicationDto[]> {
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
    remaining: readonly DamageSaveApplicationDto[]
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
    /** The check a response commit answered, whose spent saving-throw dice (D156) it also ends. */
    answeredCheck?: DamageSaveCheckOutput
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
  let mutated = false
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
  // The saving-throw dice (D156) the settled checks spend from their holders, by the same rule an
  // action's saves use.
  const spentDice = new Set<string>()
  const checks = [
    ...args.concentration.flatMap(({ result }) =>
      result.status === 'COMPLETE' && result.applicationOutputs.kind === 'DAMAGE_SAVE_CHECK'
        ? [result.applicationOutputs]
        : []
    ),
    ...(args.answeredCheck ? [args.answeredCheck] : [])
  ]
  for (const check of checks) {
    const holder = actors.find((actor) => actor.id === check.application.targetActorId)
    if (!holder) continue
    for (const die of savingThrowSpentEffects(
      await store.list(turnEffectOwner(holder, state.id)),
      abilityScoreCapabilityRegistry
        .require(state.gameSystemId)
        .abilityCode(check.savingThrowAbilityDefinitionId)
    ))
      spentDice.add(die.id)
  }
  // The committed reason an actor that applied a grant can't act, read once.
  const sourceReasons = new Map<string, Awaited<ReturnType<typeof readHolderEndState>>['reason']>()
  async function readSourceReason(sourceActorId: string) {
    const cached = sourceReasons.get(sourceActorId)
    if (cached !== undefined) return cached
    const source = actors.find((actor) => actor.id === sourceActorId)
    const reason = source
      ? (await readHolderEndState(ctx, { state, actor: source, userId: args.userId })).reason
      : null
    sourceReasons.set(sourceActorId, reason)
    return reason
  }
  // The Encounter actor that applied a source-bound grant; any other grant doesn't follow one.
  const sourceActorOf = (grant: ActiveRuleEffectRecord) =>
    sourceBoundGrants([grant]).length > 0 && grant.definition.origin.kind === 'ENCOUNTER'
      ? (grant.definition.origin.sourceActorId ?? null)
      : null
  async function endedBySourceState(grant: ActiveRuleEffectRecord) {
    const sourceActorId = sourceActorOf(grant)
    if (sourceActorId === null) return false
    await readSourceReason(sourceActorId)
    return grantsEndedBySourceState([grant], sourceReasons).length > 0
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
      (!spentDice.has(grant.id) &&
        !grantsEndedByHolderState([stored], holderState).length &&
        !(await endedBySourceState(stored)))
    )
      throw new Error('Live Session grant end is unexpected.')
  }
  // And the plan must omit none: every grant a damaged holder's committed state ends is sent,
  // and every die a settled check spent.
  if (state.automationMode !== 'MANUAL') {
    const sent = new Set(args.endedGrants.map(({ id }) => id))
    if ([...spentDice].some((id) => !sent.has(id)))
      throw new Error('Live Session grant end is missing.')
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
    // A damaged actor whose committed state can no longer act ends every grant it applied, on
    // whichever actor holds them. No index answers "which grants did this actor apply", so only
    // the commit that drops a creature pays for a scan of the Encounter's holders, and a source's
    // committed reason is read only when a holder carries a grant it applied.
    const held = (
      await Promise.all(
        actors.map(async (holder) =>
          sourceBoundGrants(await store.list(turnEffectOwner(holder, state.id)))
        )
      )
    ).flat()
    for (const source of actors.filter(({ id }) => args.damagedActorIds.has(id))) {
      if (!held.some((grant) => sourceActorOf(grant) === source.id)) continue
      await readSourceReason(source.id)
    }
    if (grantsEndedBySourceState(held, sourceReasons).some(({ id }) => !sent.has(id)))
      throw new Error('Live Session grant end is missing.')
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
    remaining = remaining.filter(
      (entry) =>
        !isMaintainedDamageApplication(entry) || entry.maintainedStateId !== end.maintainedStateId
    )
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
      result.applicationOutputs.kind !== 'DAMAGE_SAVE_CHECK'
    )
      throw new Error('Live Session concentration child is unexpected.')
    const output = result.applicationOutputs
    const damage = unboundDamageSaveApplication(application)
    const expectedId = concentrationOccurrenceId(parentOccurrenceId, application)
    const target = actors.find((actor) => actor.id === application.targetActorId)
    if (
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
    // The rule definition that proves the check: Concentration's, the effect's frozen save, or the
    // massive-damage rule's save.
    let source: { id: string; checksum: string }
    let cleanup: { slot: MaintainedSlot; cleanup: NonNullable<CleanupOutput> } | null = null
    if (output.source === 'CONCENTRATION' && isMaintainedDamageApplication(application)) {
      source = output.concentrationDefinition
      const slot = await store.findMaintainedStateById({
        encounterId: state.id,
        stateId: application.maintainedStateId
      })
      if (
        !slot ||
        slot.ownerActorId !== application.targetActorId ||
        slot.maintenanceDefinitionId !==
          requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId)
      )
        throw new Error('Live Session concentration target changed.')
      const skipped =
        output.outcome === 'SAVE_FAILURE'
          ? remaining.filter(
              (entry) =>
                isMaintainedDamageApplication(entry) &&
                entry.maintainedStateId === application.maintainedStateId
            )
          : []
      if (
        checksumCanonicalJson(output.skipped) !==
        checksumCanonicalJson(
          skipped.map((entry) => ({ ...entry, reason: 'MAINTAINED_STATE_ENDED' }))
        )
      )
        throw new Error('Live Session concentration skipped applications mismatch.')
      if (output.cleanup) cleanup = { slot, cleanup: output.cleanup }
    } else if (output.source === 'EFFECT_REPEAT_SAVE' && 'activeEffectId' in application) {
      const effect = await readEffectRepeatSaveRow(ctx, {
        encounterId: state.id,
        holder: target,
        pin: output.activeEffect
      })
      const frozen = effect.definition.frozenGraph.source
      source = { id: frozen.definitionId, checksum: frozen.checksum }
    } else if (output.source === 'MASSIVE_DAMAGE' && 'optionalCombatDefinitionId' in application) {
      const rule = encounterMassiveDamageRule(state)
      if (!massiveDamageRulePinned(rule, output))
        throw new Error('Live Session concentration receipt scope mismatch.')
      source = rule.published
    } else throw new Error('Live Session concentration child is unexpected.')
    if (
      state.automationMode === 'MANUAL' ||
      result.occurrenceId !== expectedId ||
      result.occurrenceVersion !== 1 ||
      result.evidence.source.gameSystemId !== state.gameSystemId ||
      result.evidence.source.definitionId !== source.id ||
      result.evidence.source.checksum !== source.checksum ||
      output.occurrenceId !== expectedId ||
      output.parentOccurrenceId !== parentOccurrenceId ||
      checksumCanonicalJson(damageSaveCheckBoundApplication(output)) !==
        checksumCanonicalJson(application) ||
      child.commandId !== concentrationCommandId(expectedId) ||
      child.correlationId !== correlationId ||
      child.fingerprint !==
        checksumRuleDocument({
          parentOccurrenceId,
          application: damage,
          contextChecksum: output.contextChecksum
        }) ||
      child.metadata.transition !== 'START' ||
      child.metadata.definitionId !== source.id ||
      child.metadata.expectedAggregateVersion !== state.version ||
      child.metadata.factsChecksum !== result.initialFactsChecksum ||
      child.metadata.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum
    )
      throw new Error('Live Session concentration receipt scope mismatch.')
    if (cleanup) {
      mutated = true
      const lostSlotId = cleanup.slot.id
      actors = await callbacks.applyCleanup({
        state,
        actors,
        slot: cleanup.slot,
        cleanup: cleanup.cleanup,
        authorizedCharacterIds: args.authorizedCharacterIds,
        occurredAt: args.occurredAt
      })
      remaining = remaining.filter(
        (entry) => !isMaintainedDamageApplication(entry) || entry.maintainedStateId !== lostSlotId
      )
    } else if (output.source === 'EFFECT_REPEAT_SAVE' && output.released) {
      mutated = true
      actors = await releaseEffectRepeatSave(ctx, {
        encounterId: state.id,
        actors,
        output,
        occurredAt: args.occurredAt
      })
      remaining = damageSaveApplicationsAfterRelease(remaining, output.released.activeEffectId)
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
      pending.applicationContext.kind !== 'ENCOUNTER_DAMAGE_SAVE_CHECK'
    )
      throw new Error('Live Session pending concentration is unexpected.')
    const context = pending.applicationContext
    const damage = unboundDamageSaveApplication(application)
    const target = actors.find((actor) => actor.id === application.targetActorId)
    // The rule definition that proves the check, and the state, effect or rule it was started from.
    let source: { id: string; checksum: string }
    let pinned: unknown
    let expectedPin: unknown
    if (context.source === 'CONCENTRATION' && isMaintainedDamageApplication(application)) {
      source = context.concentrationDefinition
      const slot = await store.findMaintainedStateById({
        encounterId: state.id,
        stateId: application.maintainedStateId
      })
      if (!slot || slot.ownerActorId !== application.targetActorId)
        throw new Error('Live Session pending concentration scope mismatch.')
      pinned = context.maintainedState
      expectedPin = {
        id: slot.id,
        version: slot.version,
        maintenanceDefinitionId: slot.maintenanceDefinitionId,
        descriptorChecksum: slot.descriptorChecksum
      }
    } else if (
      context.source === 'EFFECT_REPEAT_SAVE' &&
      'activeEffectId' in application &&
      target
    ) {
      const effect = await readEffectRepeatSaveRow(ctx, {
        encounterId: state.id,
        holder: target,
        pin: context.activeEffect
      })
      const frozen = effect.definition.frozenGraph.source
      source = { id: frozen.definitionId, checksum: frozen.checksum }
      pinned = context.activeEffect
      expectedPin = {
        id: effect.id,
        version: effect.version,
        lifecycleChecksum: effect.lifecycleChecksum
      }
    } else if (
      context.source === 'MASSIVE_DAMAGE' &&
      'optionalCombatDefinitionId' in application &&
      target
    ) {
      const rule = encounterMassiveDamageRule(state)
      if (!massiveDamageRulePinned(rule, context))
        throw new Error('Live Session pending concentration scope mismatch.')
      source = rule.published
      pinned = context.maximumHitPoints
      expectedPin = await readEncounterActorMaximumHitPoints(ctx, {
        encounterId: state.id,
        actor: target
      })
    } else throw new Error('Live Session pending concentration scope mismatch.')
    if (
      !target ||
      (await concentrationTargetPinChanged(target, context.targetCharacter, (characterId) =>
        callbacks.currentCharacterStreamVersion(characterId)
      )) ||
      pending.occurrenceId !== concentrationOccurrenceId(parentOccurrenceId, application) ||
      pending.graph.source.gameSystemId !== state.gameSystemId ||
      pending.graph.source.definitionId !== source.id ||
      pending.graph.source.checksum !== source.checksum ||
      pending.optionalCombatSnapshotChecksum !== state.optionalCombatSnapshotChecksum ||
      context.parentOccurrenceId !== parentOccurrenceId ||
      context.parentCommandFingerprint !== args.parentCommandFingerprint ||
      context.finalizedDamageEnvelopeChecksum !== args.finalizedDamageEnvelopeChecksum ||
      checksumCanonicalJson(context.application) !== checksumCanonicalJson(damage) ||
      checksumCanonicalJson(context.remaining) !== checksumCanonicalJson(remaining) ||
      checksumCanonicalJson(pinned) !== checksumCanonicalJson(expectedPin)
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
  return { actors, mutated }
}
