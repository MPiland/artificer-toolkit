import {
  concentrationCommandId,
  concentrationEndOccurrenceId,
  concentrationOccurrenceId
} from '@artificer-toolkit/rules-runtime/encounterConcentrationIdentity'
import { requireInstalledConcentrationMaintenanceDefinitionId } from '@artificer-toolkit/rules-runtime/platformRulesRuntime'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import { damagedHitRepeatTrigger } from '@artificer-toolkit/rules-runtime/events/encounterEventHooks'
import {
  movementConcentrationEndDtoSchema,
  movementConcentrationExecutionDtoSchema,
  movementMassiveDamageSaveExecutionDtoSchema,
  movementRepeatSaveExecutionDtoSchema,
  type MovementConcentrationEndDto,
  type MovementConcentrationExecutionDto,
  type MovementMassiveDamageSaveExecutionDto,
  type MovementRepeatSaveExecutionDto
} from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import { unboundDamageSaveApplication } from '@artificer-toolkit/schema/shared/ruleExecutionConcentration'
import {
  encounterMassiveDamageRule,
  massiveDamageRulePinned
} from '@artificer-toolkit/rules-runtime/encounterMassiveDamage'
import { damageSaveCheckBoundApplication } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { EncounterPersistenceTransaction } from './ports.js'
import {
  persistNativeConcentrationEnd,
  persistNativeConcentrationResult
} from './actionChildPersistence.js'
import { postConcentrationEndMessage, readHolderEndState } from './concentrationEnd.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import type { applyLiveConcentrationCleanup } from './concentrationCleanupPersistence.js'
import { movementPersistedTransitionState } from './liveMovementTargetState.js'
import { concentrationTargetPinChanged } from './concentrationTargetPin.js'
import {
  bindEncounterDamageSaveChain,
  readEffectRepeatSaveRow,
  releaseEffectRepeatSave
} from './effectRepeatSavePersistence.js'

type MovementConcentrationPersistenceCallbacks = {
  applyCleanup: (
    input: Parameters<typeof applyLiveConcentrationCleanup>[1]
  ) => ReturnType<typeof applyLiveConcentrationCleanup>
  currentCharacterStreamVersion(state: EncounterRunState, id: string): Promise<number>
  readTargetState(
    state: EncounterRunState,
    actor: EncounterRunActorState,
    plannedMaximumHitPoints: number
  ): Promise<ReturnType<typeof movementPersistedTransitionState>>
}

/** The cleanup's owner projection must still be the one the DO planned from, before it runs. */
async function requireOwnerTransitionsBefore(
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
  },
  callbacks: Pick<MovementConcentrationPersistenceCallbacks, 'readTargetState'>
) {
  const { state } = input
  for (const transition of input.ownerTransitions) {
    const actor = input.actors.find((entry) => entry.id === transition.targetActorId)
    if (
      !actor ||
      actor.encounterId !== state.id ||
      !state.actorIds.includes(actor.id) ||
      transition.characterId !== (actor.kind === 'CHARACTER' ? actor.sourceId : null)
    )
      throw new Error('Live Session movement Concentration owner projection changed.')
    if (
      checksumCanonicalJson(movementPersistedTransitionState(transition.before)) !==
      checksumCanonicalJson(
        movementPersistedTransitionState(
          await callbacks.readTargetState(state, actor, transition.before.maximumHitPoints)
        )
      )
    )
      throw new Error('Live Session movement Concentration owner projection changed.')
  }
}

/** After cleanup runs, the committed owners must be exactly the planned ones. */
async function requireOwnerTransitionsAfter(
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions']
    /** What advanced the owners' Characters: a Concentration cleanup or a repeat save's release. */
    cleanup: MovementRepeatSaveExecutionDto['release']
  },
  callbacks: Pick<
    MovementConcentrationPersistenceCallbacks,
    'currentCharacterStreamVersion' | 'readTargetState'
  >
) {
  const { state } = input
  for (const transition of input.ownerTransitions) {
    const actor = input.actors.find((entry) => entry.id === transition.targetActorId)
    const characterVersion = input.cleanup?.characterOwnerTransitions.find(
      (entry) => entry.characterId === transition.characterId
    )
    if (
      !actor ||
      (characterVersion &&
        (await callbacks.currentCharacterStreamVersion(state, characterVersion.characterId)) !==
          characterVersion.afterStreamVersion)
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
    if (
      checksumCanonicalJson(movementPersistedTransitionState(transition.after)) !==
      checksumCanonicalJson(
        movementPersistedTransitionState(
          await callbacks.readTargetState(state, actor, transition.after.maximumHitPoints)
        )
      )
    )
      throw new Error('Live Session movement Concentration cleanup differs from its plan.')
  }
}

/**
 * Persists one DO-prepared child in its parent's mutation. The enclosing caller has already
 * validated the revision cohort, parent command, and exact damage order against the movement
 * receipt; this helper validates the child's current persistence scope and cleanup projection.
 */
export async function persistLiveMovementConcentration(
  ctx: EncounterPersistenceTransaction & Parameters<typeof persistNativeConcentrationResult>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementConcentrationExecutionDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  },
  callbacks: MovementConcentrationPersistenceCallbacks
): Promise<EncounterRunActorState[]> {
  const execution = movementConcentrationExecutionDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const result = execution.result
  const output = result.applicationOutputs
  const { maintainedStateId } = output.application
  const expectedId = concentrationOccurrenceId(parentOccurrenceId, output.application)
  if (
    execution.sourceCommandId !== input.sourceCommandId ||
    result.occurrenceId !== expectedId ||
    result.occurrenceVersion !== 1 ||
    output.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    result.evidence.source.gameSystemId !== state.gameSystemId ||
    result.evidence.source.definitionId !== output.concentrationDefinition.id ||
    result.evidence.source.checksum !== output.concentrationDefinition.checksum ||
    (output.outcome === 'SAVE_FAILURE') !== (output.cleanup !== null)
  )
    throw new Error('Live Session movement Concentration receipt scope mismatch.')
  const target = input.actors.find((actor) => actor.id === output.application.targetActorId)
  if (
    !target ||
    target.encounterId !== state.id ||
    target.systemId !== state.gameSystemId ||
    !state.actorIds.includes(target.id) ||
    (target.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(target.sourceId)) ||
    (await concentrationTargetPinChanged(target, output.targetCharacter, (characterId) =>
      callbacks.currentCharacterStreamVersion(state, characterId)
    ))
  )
    throw new Error('Live Session movement Concentration target changed.')
  const store = createActiveRuleEffectStore(ctx)
  const slot = await store.findMaintainedStateById({
    encounterId: state.id,
    stateId: maintainedStateId
  })
  if (
    !slot ||
    slot.id !== maintainedStateId ||
    slot.encounterId !== state.id ||
    slot.ownerActorId !== target.id ||
    slot.maintenanceDefinitionId !==
      requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId)
  )
    throw new Error('Live Session movement Concentration state changed.')
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', expectedId))
    .unique()
  if (existing) throw new Error('The concentration child occurrence already exists.')
  await requireOwnerTransitionsBefore(
    { state, actors: input.actors, ownerTransitions: execution.ownerTransitions },
    callbacks
  )
  const actors = output.cleanup
    ? await callbacks.applyCleanup({
        state,
        actors: input.actors,
        slot,
        cleanup: output.cleanup,
        authorizedCharacterIds: input.authorizedCharacterIds,
        occurredAt: input.occurredAt
      })
    : input.actors
  await requireOwnerTransitionsAfter(
    { state, actors, ownerTransitions: execution.ownerTransitions, cleanup: output.cleanup },
    callbacks
  )
  await persistNativeConcentrationResult(ctx, {
    state,
    result,
    commandId: concentrationCommandId(expectedId),
    fingerprint: checksumRuleDocument(execution),
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'START',
      definitionId: output.concentrationDefinition.id,
      expectedAggregateVersion: state.version,
      factsChecksum: result.initialFactsChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
  return actors
}

/**
 * Persists one Concentration end (D95) a movement contact caused. Its reason is re-derived from
 * the state the contact just committed, so a forged end is refused, and its cleanup, receipt and
 * chat entry follow the same path as an end from a direct action.
 */
export async function persistLiveMovementConcentrationEnd(
  ctx: EncounterPersistenceTransaction &
    Parameters<typeof persistNativeConcentrationEnd>[0] &
    Parameters<typeof postConcentrationEndMessage>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementConcentrationEndDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  },
  callbacks: MovementConcentrationPersistenceCallbacks
): Promise<EncounterRunActorState[]> {
  const execution = movementConcentrationEndDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const output = execution.result.applicationOutputs
  const expectedId = concentrationEndOccurrenceId(parentOccurrenceId, output.maintainedStateId)
  const holder = input.actors.find((actor) => actor.id === output.ownerActorId)
  const slot = await createActiveRuleEffectStore(ctx).findMaintainedStateById({
    encounterId: state.id,
    stateId: output.maintainedStateId
  })
  if (
    state.automationMode === 'MANUAL' ||
    execution.sourceCommandId !== input.sourceCommandId ||
    execution.result.occurrenceId !== expectedId ||
    output.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    !holder ||
    holder.encounterId !== state.id ||
    !state.actorIds.includes(holder.id) ||
    !slot ||
    slot.ownerActorId !== holder.id ||
    slot.maintenanceDefinitionId !==
      requireInstalledConcentrationMaintenanceDefinitionId(state.gameSystemId) ||
    (await readHolderEndState(ctx, { state, actor: holder, userId: input.userId })).reason !==
      output.reason
  )
    throw new Error('Live Session movement Concentration end is unexpected.')
  await requireOwnerTransitionsBefore(
    { state, actors: input.actors, ownerTransitions: execution.ownerTransitions },
    callbacks
  )
  const actors = await callbacks.applyCleanup({
    state,
    actors: input.actors,
    slot,
    cleanup: output.cleanup,
    authorizedCharacterIds: input.authorizedCharacterIds,
    occurredAt: input.occurredAt
  })
  await requireOwnerTransitionsAfter(
    { state, actors, ownerTransitions: execution.ownerTransitions, cleanup: output.cleanup },
    callbacks
  )
  const occurrenceId = await persistNativeConcentrationEnd(ctx, {
    state,
    parentOccurrenceId,
    end: output,
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt
  })
  await postConcentrationEndMessage(ctx, {
    state,
    actor: holder,
    reason: output.reason,
    occurrenceId,
    userId: input.userId
  })
  return actors
}

/**
 * Persists one effect repeat save (D167) a movement contact's damage owed its holder. The save is
 * re-derived from the committed effect row: the row must still offer a repeat save for damage of
 * this contact's source and type, and a made save releases it through the shared release seam.
 */
export async function persistLiveMovementRepeatSave(
  ctx: Parameters<typeof releaseEffectRepeatSave>[0] &
    Parameters<typeof persistNativeConcentrationResult>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementRepeatSaveExecutionDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
    /** The source of the zone whose contact dealt the damage. */
    damagerActorId: string | null
  },
  callbacks: Pick<
    MovementConcentrationPersistenceCallbacks,
    'currentCharacterStreamVersion' | 'readTargetState'
  >
): Promise<EncounterRunActorState[]> {
  const execution = movementRepeatSaveExecutionDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const result = execution.result
  const output = result.applicationOutputs
  const expectedId = concentrationOccurrenceId(
    parentOccurrenceId,
    damageSaveCheckBoundApplication(output)
  )
  if (
    state.automationMode === 'MANUAL' ||
    execution.sourceCommandId !== input.sourceCommandId ||
    result.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    result.evidence.source.gameSystemId !== state.gameSystemId
  )
    throw new Error('Live Session movement repeat save receipt scope mismatch.')
  const target = input.actors.find((actor) => actor.id === output.application.targetActorId)
  if (
    !target ||
    target.encounterId !== state.id ||
    target.systemId !== state.gameSystemId ||
    !state.actorIds.includes(target.id) ||
    (target.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(target.sourceId)) ||
    (await concentrationTargetPinChanged(target, output.targetCharacter, (characterId) =>
      callbacks.currentCharacterStreamVersion(state, characterId)
    ))
  )
    throw new Error('Live Session movement repeat save target changed.')
  const effect = await readEffectRepeatSaveRow(ctx, {
    encounterId: state.id,
    holder: target,
    pin: output.activeEffect
  })
  const { definition } = effect
  const frozen = definition.frozenGraph.source
  if (
    result.evidence.source.definitionId !== frozen.definitionId ||
    result.evidence.source.checksum !== frozen.checksum ||
    (definition.origin.kind === 'ENCOUNTER' &&
      definition.origin.sourceOccurrenceId === parentOccurrenceId) ||
    !damagedHitRepeatTrigger(
      effect,
      {
        damagerActorId: output.application.damagerActorId ?? input.damagerActorId,
        damageTypeIds: [output.application.damageTypeId]
      },
      new Map(input.actors.map(({ id, disposition }) => [id, disposition]))
    )
  )
    throw new Error('Live Session movement repeat save is not owed by its effect.')
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', expectedId))
    .unique()
  if (existing) throw new Error('The repeat save child occurrence already exists.')
  await requireOwnerTransitionsBefore(
    { state, actors: input.actors, ownerTransitions: execution.ownerTransitions },
    callbacks
  )
  const actors = await releaseEffectRepeatSave(ctx, {
    encounterId: state.id,
    actors: input.actors,
    output,
    occurredAt: input.occurredAt
  })
  await requireOwnerTransitionsAfter(
    { state, actors, ownerTransitions: execution.ownerTransitions, cleanup: execution.release },
    callbacks
  )
  await persistNativeConcentrationResult(ctx, {
    state,
    result,
    commandId: concentrationCommandId(expectedId),
    fingerprint: checksumRuleDocument(execution),
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'START',
      definitionId: frozen.definitionId,
      expectedAggregateVersion: state.version,
      factsChecksum: result.initialFactsChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
  return actors
}

/**
 * Persists one massive-damage save (ATTACK-16) a movement contact's damage owed its holder. The
 * save is re-derived from the committed rows through the chain every damage root binds: the
 * Encounter's rule must still be the pinned one and this damage must still owe its holder the save.
 * It records the outcome and changes no Run state.
 */
export async function persistLiveMovementMassiveDamageSave(
  ctx: Parameters<typeof bindEncounterDamageSaveChain>[0] &
    Parameters<typeof persistNativeConcentrationResult>[0],
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    execution: MovementMassiveDamageSaveExecutionDto
    parentOccurrenceId: string
    sourceCommandId: string
    userId: string
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  },
  callbacks: Pick<MovementConcentrationPersistenceCallbacks, 'currentCharacterStreamVersion'>
): Promise<void> {
  const execution = movementMassiveDamageSaveExecutionDtoSchema.parse(input.execution)
  const { state, parentOccurrenceId } = input
  const result = execution.result
  const output = result.applicationOutputs
  const application = damageSaveCheckBoundApplication(output)
  const expectedId = concentrationOccurrenceId(parentOccurrenceId, application)
  const rule = encounterMassiveDamageRule(state)
  if (
    state.automationMode === 'MANUAL' ||
    !massiveDamageRulePinned(rule, output) ||
    execution.sourceCommandId !== input.sourceCommandId ||
    result.occurrenceId !== expectedId ||
    output.parentOccurrenceId !== parentOccurrenceId ||
    result.evidence.source.gameSystemId !== state.gameSystemId ||
    result.evidence.source.definitionId !== rule.published.id ||
    result.evidence.source.checksum !== rule.published.checksum
  )
    throw new Error('Live Session movement massive-damage save receipt scope mismatch.')
  const target = input.actors.find((actor) => actor.id === application.targetActorId)
  if (
    !target ||
    target.encounterId !== state.id ||
    target.systemId !== state.gameSystemId ||
    !state.actorIds.includes(target.id) ||
    (target.kind === 'CHARACTER' && !input.authorizedCharacterIds.has(target.sourceId)) ||
    (await concentrationTargetPinChanged(target, output.targetCharacter, (characterId) =>
      callbacks.currentCharacterStreamVersion(state, characterId)
    ))
  )
    throw new Error('Live Session movement massive-damage save target changed.')
  const owed = await bindEncounterDamageSaveChain(ctx, {
    state,
    actors: input.actors,
    applications: [unboundDamageSaveApplication(application)],
    parentOccurrenceId,
    damagerActorId: null
  })
  if (!owed.some((entry) => checksumCanonicalJson(entry) === checksumCanonicalJson(application)))
    throw new Error('Live Session movement massive-damage save is not owed by its damage.')
  const existing = await ctx.db
    .query('encounterRuleOccurrences')
    .withIndex('by_publicId', (q) => q.eq('id', expectedId))
    .unique()
  if (existing) throw new Error('The massive-damage save child occurrence already exists.')
  await persistNativeConcentrationResult(ctx, {
    state,
    result,
    commandId: concentrationCommandId(expectedId),
    fingerprint: checksumRuleDocument(execution),
    userId: input.userId,
    correlationId: parentOccurrenceId,
    occurredAt: input.occurredAt,
    metadata: {
      schemaVersion: 1,
      transition: 'START',
      definitionId: rule.published.id,
      expectedAggregateVersion: state.version,
      factsChecksum: result.initialFactsChecksum,
      optionalCombatSnapshotChecksum: state.optionalCombatSnapshotChecksum
    }
  })
}
