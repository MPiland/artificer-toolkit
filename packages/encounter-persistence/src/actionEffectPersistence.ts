import {
  buildEncounterJoinedMaintenanceTransition,
  buildEncounterMaintenanceTransition
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { planConcentrationCarriedGrantEnds } from '@artificer-toolkit/rules-runtime/encounterGrantLifetimes'
import { sourceEncounterIdForDefinition } from '@artificer-toolkit/rules-runtime/activeRuleEffectRecords'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import type { maintainedEffectTransitionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { z } from 'zod'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import {
  actionTargetActorId,
  type ResolveEncounterActionInputDto
} from '@artificer-toolkit/schema/api/encounterRuleCommands'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { StoredRuleExecutionResultDto } from '@artificer-toolkit/schema/shared/ruleExecutionResults'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { deleteStateZones, listStateZones } from './maintainedStateZones.js'
import { readRunActors, replaceRunActor } from './documents.js'
import { armIdleTurnActor } from './idleTurnMark.js'

type CompleteExecution = Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>

type EffectCommitInput = {
  state: EncounterRunState
  command: Pick<
    ResolveEncounterActionInputDto,
    'encounterId' | 'actorId' | 'target' | 'actionId' | 'commandId'
  >
  execution: Pick<CompleteExecution, 'occurrenceId' | 'applicationOutputs'>
  maintainedState: EncounterMaintainedEffectStateRecord | null
  createdEffects: ActiveRuleEffectRecord[]
  authorizedCharacterIds: ReadonlySet<string>
}

type PreparedMaintenance = {
  prior: EncounterMaintainedEffectStateRecord | null
  removed: ActiveRuleEffectRecord[]
  carried: ActiveRuleEffectRecord[]
  characterVersions: { characterId: string; beforeStreamVersion: number }[]
  /** The Character this command newly added to the Run's Concentration casters; its undo removes it. */
  addedConcentrationCasterId: string | null
}

function actionOutputs(input: EffectCommitInput) {
  const { execution, command } = input
  const outputs = execution.applicationOutputs
  if (
    (outputs.kind !== 'CHARACTER_MECHANICS_BATCH' &&
      outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH') ||
    input.state.id !== command.encounterId ||
    execution.occurrenceId !== outputs.occurrenceId ||
    outputs.sourceActorId !== command.actorId ||
    outputs.targetActorId !== actionTargetActorId(command.target)
  )
    throw new Error('Completed action effect receipt does not match the command.')
  return outputs
}

function isSourceImmunityEffect(effect: ActiveRuleEffectRecord) {
  return effect.definition.stateContributions.some(({ kind }) => kind === 'SOURCE_IMMUNITY')
}

function classifyCreatedEffects(input: EffectCommitInput) {
  const outputs = actionOutputs(input)
  const stateTransition = outputs.stateEffectTransitions
  const activeTransition = outputs.activeEffectTransitions
  // The effect of a reaction the target used lands on the target beside the action's own effects.
  const reactionTransition =
    outputs.kind === 'CHARACTER_MECHANICS_BATCH'
      ? [...(outputs.reaction?.activeEffectTransitions ?? []), ...outputs.reactionEffectTransitions]
      : []
  // The target's own rules create timed effects on it beside the action's effects: its damage-trigger
  // grants and the immunity a passed ward leaves on its holder.
  const grantTransition = outputs.grantEffectTransitions
  // The action's recurring effect may carry a failure-margin rider's effect after it.
  if (
    input.createdEffects.length > 8 ||
    stateTransition.length > 1 ||
    activeTransition.length > 2 ||
    reactionTransition.length > 1 ||
    grantTransition.length > 4 ||
    input.createdEffects.length !==
      stateTransition.length +
        activeTransition.length +
        reactionTransition.length +
        grantTransition.length
  )
    throw new Error('Completed action effects do not match the stored receipt.')
  const ids = input.createdEffects.map((effect) => effect.id)
  if (new Set(ids).size !== ids.length)
    throw new Error('Completed action effects contain a duplicate ID.')
  const state = stateTransition.length
    ? (input.createdEffects.find((effect) => effect.id === stateTransition[0]!.activeEffectId) ??
      null)
    : null
  const recurring = activeTransition.length
    ? (input.createdEffects.find((effect) => effect.id === activeTransition[0]!.activeEffectId) ??
      null)
    : null
  const rider =
    activeTransition.length > 1
      ? (input.createdEffects.find((effect) => effect.id === activeTransition[1]!.activeEffectId) ??
        null)
      : null
  const reaction = reactionTransition.length
    ? (input.createdEffects.find((effect) => effect.id === reactionTransition[0]!.activeEffectId) ??
      null)
    : null
  const grants = grantTransition.flatMap((transition) => {
    const effect = input.createdEffects.find(
      (candidate) => candidate.id === transition.activeEffectId
    )
    return effect ? [effect] : []
  })
  if (
    grants.length !== grantTransition.length ||
    (stateTransition.length > 0 && !state) ||
    (activeTransition.length > 0 && !recurring) ||
    (activeTransition.length > 1 && !rider) ||
    (reactionTransition.length > 0 && !reaction) ||
    (state && recurring && state.id === recurring.id) ||
    (reaction && (reaction.id === state?.id || reaction.id === recurring?.id))
  )
    throw new Error('Completed action effects do not match the stored receipt.')
  return { state, recurring, rider, reaction, grants, outputs }
}

/**
 * D99, SPELLS-5.7: appends the Character to the Run's set of Concentration casters (only the undo of
 * the command that added it removes it) and says whether this call added it.
 */
export async function recordConcentrationCaster(
  ctx: EncounterCharacterWriteTransaction,
  encounterId: string,
  characterId: string
): Promise<boolean> {
  const run = await ctx.db
    .query('encounterRuns')
    .withIndex('by_publicId', (q) => q.eq('id', encounterId))
    .unique()
  if (!run) throw new Error('Concentration caster Run is unavailable.')
  if (run.concentrationCasterCharacterIds.includes(characterId)) return false
  await ctx.db.patch(run._id, {
    concentrationCasterCharacterIds: [...run.concentrationCasterCharacterIds, characterId]
  })
  return true
}

/** Reads the exact replaced slot and affected Character versions before mechanics are applied. */
export async function prepareEncounterActionMaintenance(
  ctx: EncounterCharacterWriteTransaction,
  input: EffectCommitInput
): Promise<PreparedMaintenance | null> {
  const { recurring, rider, outputs } = classifyCreatedEffects(input)
  if (!input.maintainedState) {
    if (outputs.maintenanceTransition)
      throw new Error('Completed action maintenance receipt has no created state.')
    return null
  }
  if (!outputs.maintenanceTransition)
    throw new Error('Created maintained effect state has no completed action receipt.')
  return prepareMaintenanceReplacement(ctx, {
    state: input.state,
    command: input.command,
    maintainedState: input.maintainedState,
    sourceOccurrenceId: outputs.parentOccurrenceId ?? input.execution.occurrenceId,
    transition: outputs.maintenanceTransition,
    createdDependentEffectIds: [recurring, rider].flatMap((effect) => (effect ? [effect.id] : [])),
    authorizedCharacterIds: input.authorizedCharacterIds
  })
}

/**
 * Reads the state a Concentration replaces and everything that ends with it, and proves the
 * receipt that names them is the one the planner built. The receipt rides on a creature outcome,
 * or on the area root when the cast opens a Concentration for a zone alone (D135).
 */
export async function prepareMaintenanceReplacement(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    command: Pick<ResolveEncounterActionInputDto, 'actorId' | 'actionId'>
    maintainedState: EncounterMaintainedEffectStateRecord
    sourceOccurrenceId: string
    transition: z.infer<typeof maintainedEffectTransitionDtoSchema>
    createdDependentEffectIds: string[]
    authorizedCharacterIds: ReadonlySet<string>
  }
): Promise<PreparedMaintenance> {
  const created = input.maintainedState
  if (
    created.encounterId !== input.state.id ||
    created.ownerActorId !== input.command.actorId ||
    created.maintenanceDefinitionId !== created.descriptor.maintenanceDefinitionId ||
    created.descriptor.sourceActorId !== input.command.actorId ||
    created.descriptor.provenance.kind !== 'ACTION' ||
    created.descriptor.provenance.sourceActionId !== input.command.actionId ||
    created.descriptor.provenance.sourceOccurrenceId !== input.sourceOccurrenceId
  )
    throw new Error('Created maintained effect state does not match the completed action.')

  const store = createActiveRuleEffectStore(ctx)
  const prior = await store.findMaintainedState({
    encounterId: input.state.id,
    ownerActorId: input.command.actorId,
    maintenanceDefinitionId: created.maintenanceDefinitionId
  })
  const dependents = prior
    ? await store.listDependentEffects({ encounterId: input.state.id, stateId: prior.id })
    : []
  const actors = await readRunActors(ctx, input.state)
  const caster = actors.find((actor) => actor.id === input.command.actorId)
  // D99: a Character's new Concentration also ends its carried-over grants held in the Run.
  const carried =
    caster?.kind === 'CHARACTER'
      ? planConcentrationCarriedGrantEnds({
          casterCharacterId: caster.sourceId,
          effects: (
            await Promise.all(
              actors.flatMap((actor) =>
                actor.kind === 'CHARACTER'
                  ? [store.list({ kind: 'CHARACTER', characterId: actor.sourceId })]
                  : []
              )
            )
          ).flat()
        })
      : []
  // The completing checkpoint ends the caster's carried grants outside the Run from this record.
  const addedConcentrationCasterId =
    caster?.kind === 'CHARACTER' &&
    (await recordConcentrationCaster(ctx, input.state.id, caster.sourceId))
      ? caster.sourceId
      : null
  const byOwnerOrder = (left: ActiveRuleEffectRecord, right: ActiveRuleEffectRecord) => {
    const key = (effect: ActiveRuleEffectRecord) =>
      `${effect.owner.kind === 'CHARACTER' ? `0:${effect.owner.characterId}` : `1:${effect.owner.targetActorId}`}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.id}`
    return key(left).localeCompare(key(right))
  }
  const removed = [...dependents, ...carried].sort(byOwnerOrder)
  carried.sort(byOwnerOrder)
  const characterVersions: PreparedMaintenance['characterVersions'] = []
  const characterIds = [
    ...new Set(
      removed.flatMap((effect) =>
        effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []
      )
    )
  ]
  for (const characterId of characterIds) {
    if (!input.authorizedCharacterIds.has(characterId))
      throw new Error('Maintained-effect Character owner is unavailable.')
    const row = await ctx.ports.readCharacterRow(characterId)
    if (
      !row ||
      row.status !== 'ACTIVE' ||
      ctx.ports.readCharacterRecord(row).systemId !== input.state.gameSystemId
    )
      throw new Error('Maintained-effect Character owner is unavailable.')
    characterVersions.push({ characterId, beforeStreamVersion: row.play.streamVersion })
  }
  characterVersions.sort((left, right) => left.characterId.localeCompare(right.characterId))
  const maintenance = { prior, removed, carried, characterVersions, addedConcentrationCasterId }
  const transition = buildEncounterMaintenanceTransition({
    maintenance,
    createdState: created,
    createdDependentEffectIds: input.createdDependentEffectIds
  })
  if (checksumCanonicalJson(transition) !== checksumCanonicalJson(input.transition))
    throw new Error('Completed action maintenance receipt changed before settlement.')
  return maintenance
}

/** Deletes what the replaced Concentration held and creates the new state; its dependents follow. */
export async function applyMaintenanceReplacement(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actorId: string
    maintenance: PreparedMaintenance
    created: EncounterMaintainedEffectStateRecord
    occurredAt: string
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  for (const effect of input.maintenance.removed)
    await store.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version,
      removal: 'ENDED'
    })
  if (input.maintenance.prior) {
    // The replaced Concentration's zones end with it (D135).
    await deleteStateZones(
      ctx,
      await listStateZones(ctx, {
        encounterId: input.state.id,
        stateId: input.maintenance.prior.id
      })
    )
    await store.deleteMaintainedStateCas({
      id: input.maintenance.prior.id,
      encounterId: input.state.id,
      ownerActorId: input.actorId,
      expectedVersion: input.maintenance.prior.version,
      removal: 'ENDED'
    })
  }
  const created = await store.createMaintainedState({
    id: input.created.id,
    encounterId: input.created.encounterId,
    ownerActorId: input.created.ownerActorId,
    descriptor: input.created.descriptor,
    occurredAt: input.occurredAt
  })
  if (checksumCanonicalJson(created) !== checksumCanonicalJson(input.created))
    throw new Error('Created maintained effect state changed before settlement.')
}

/** Persists only records already projected into the completed action receipt. */
export async function persistEncounterActionEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: EffectCommitInput & {
    maintenance: PreparedMaintenance | null
    /**
     * Leaves the replaced Concentration's owners for the caller to reconcile once every effect the
     * action creates exists (an area creates one per creature).
     */
    deferOwnerReconcile?: boolean
    actors: EncounterRunActorState[]
    occurredAt: string
  }
): Promise<EncounterRunActorState[]> {
  const { state, recurring, rider, reaction, grants, outputs } = classifyCreatedEffects(input)
  const target = input.actors.find(
    (actor) => actor.id === actionTargetActorId(input.command.target)
  )
  if (!target) throw new Error('Completed action effect target is unavailable.')
  if (
    (target.kind === 'CHARACTER' && outputs.kind !== 'CHARACTER_MECHANICS_BATCH') ||
    (target.kind !== 'CHARACTER' && outputs.kind !== 'ENCOUNTER_ACTOR_MECHANICS_BATCH')
  )
    throw new Error('Completed action effect target does not match its receipt.')
  const owner =
    target.kind === 'CHARACTER'
      ? target.sourceId && input.authorizedCharacterIds.has(target.sourceId)
        ? ({ kind: 'CHARACTER' as const, characterId: target.sourceId } as const)
        : (() => {
            throw new Error('Encounter Character effect owner is incomplete.')
          })()
      : ({
          kind: 'ENCOUNTER_ACTOR' as const,
          encounterId: input.state.id,
          targetActorId: target.id
        } as const)
  for (const effect of input.createdEffects) {
    const origin = effect.definition.origin
    if (
      checksumCanonicalJson(effect.owner) !== checksumCanonicalJson(owner) ||
      origin.kind !== 'ENCOUNTER' ||
      origin.sourceAggregateId !== input.state.id ||
      // A reaction's effect and a damage-trigger grant come from the target itself; the immunity a
      // passed ward leaves on its holder names the attacker it frees.
      origin.sourceActorId !==
        (effect.id === reaction?.id ||
        (grants.some((grant) => grant.id === effect.id) && !isSourceImmunityEffect(effect))
          ? target.id
          : input.command.actorId) ||
      origin.sourceOccurrenceId !== input.execution.occurrenceId ||
      origin.rootCommandId !== input.command.commandId ||
      effect.definition.frozenGraph.source.gameSystemId !== input.state.gameSystemId ||
      effect.sourceEncounterId !==
        (owner.kind === 'CHARACTER'
          ? sourceEncounterIdForDefinition(effect.definition, effect.maintainedEffectStateId)
          : null) ||
      effect.maintainedEffectStateId !==
        (effect.id === recurring?.id || effect.id === rider?.id
          ? (input.maintainedState?.id ?? null)
          : null)
    )
      throw new Error('Created action effect does not match its current owner and source.')
  }
  const projected = projectNativeActionEffectTransitions({
    state,
    recurring,
    rider,
    targetActorId: target.id
  })
  const characterReceipts = (
    transitions: typeof projected.activeEffectTransitions,
    maintainedEffectStateId: string | null
  ) =>
    target.kind === 'CHARACTER'
      ? transitions.map(({ targetActorId: _targetActorId, ...transition }) => ({
          ...transition,
          characterId: target.sourceId,
          sourceEncounterId: input.state.id,
          maintainedEffectStateId
        }))
      : transitions
  const reactionReceipts = characterReceipts(
    projectNativeActionEffectTransitions({
      state: null,
      recurring: reaction,
      targetActorId: target.id
    }).activeEffectTransitions,
    null
  )
  const grantReceipts = characterReceipts(
    grants.flatMap(
      (grant) =>
        projectNativeActionEffectTransitions({
          state: null,
          recurring: grant,
          targetActorId: target.id
        }).activeEffectTransitions
    ),
    null
  )
  if (
    checksumCanonicalJson(grantReceipts) !==
      checksumCanonicalJson(outputs.grantEffectTransitions) ||
    checksumCanonicalJson(projected.stateEffectTransitions) !==
      checksumCanonicalJson(outputs.stateEffectTransitions) ||
    checksumCanonicalJson(
      characterReceipts(projected.activeEffectTransitions, input.maintainedState?.id ?? null)
    ) !== checksumCanonicalJson(outputs.activeEffectTransitions) ||
    checksumCanonicalJson(reactionReceipts) !==
      checksumCanonicalJson(
        outputs.kind === 'CHARACTER_MECHANICS_BATCH'
          ? [
              ...(outputs.reaction?.activeEffectTransitions ?? []),
              ...outputs.reactionEffectTransitions
            ]
          : []
      )
  )
    throw new Error('Completed action effect receipts changed before settlement.')
  const supplied = input.maintainedState
  if (input.maintenance && !supplied)
    throw new Error('Completed action maintenance preparation is incomplete.')

  const store = createActiveRuleEffectStore(ctx)
  if (supplied && !input.maintenance) {
    // One creature of an area whose first creature already created the state its effect depends on.
    const existing = await store.findMaintainedState({
      encounterId: input.state.id,
      ownerActorId: input.command.actorId,
      maintenanceDefinitionId: supplied.maintenanceDefinitionId
    })
    if (
      !existing ||
      !outputs.maintenanceTransition ||
      checksumCanonicalJson(existing) !== checksumCanonicalJson(supplied) ||
      checksumCanonicalJson(outputs.maintenanceTransition) !==
        checksumCanonicalJson(
          buildEncounterJoinedMaintenanceTransition({
            createdState: supplied,
            createdDependentEffectIds: [recurring, rider].flatMap((effect) =>
              effect ? [effect.id] : []
            )
          })
        )
    )
      throw new Error('Joined maintained effect state is unavailable.')
  }
  if (input.maintenance && supplied)
    await applyMaintenanceReplacement(ctx, {
      state: input.state,
      actorId: input.command.actorId,
      maintenance: input.maintenance,
      created: supplied,
      occurredAt: input.occurredAt
    })
  for (const effect of input.createdEffects) {
    const created = await store.create({
      id: effect.id,
      owner: effect.owner,
      definition: effect.definition,
      lifecycle: effect.lifecycle,
      maintainedEffectStateId: effect.maintainedEffectStateId,
      occurredAt: input.occurredAt
    })
    if (checksumCanonicalJson(created) !== checksumCanonicalJson(effect))
      throw new Error('Created action effect changed before settlement.')
  }
  // The one place effects are created for an actor, so every activation path arms it the same way.
  const armed = armIdleTurnActor({
    actor: target,
    createdEffects: input.createdEffects,
    currentActorId: input.state.currentActorId
  })
  if (armed !== target) await replaceRunActor(ctx, target, armed)
  const actors = input.actors.map((actor) => (actor.id === armed.id ? armed : actor))
  return input.maintenance && !input.deferOwnerReconcile
    ? reconcileNativeMaintenanceOwners(ctx, {
        encounterId: input.state.id,
        maintenance: input.maintenance,
        actors,
        occurredAt: input.occurredAt
      })
    : actors
}
