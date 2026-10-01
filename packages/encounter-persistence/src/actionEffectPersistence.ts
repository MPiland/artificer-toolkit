import { buildEncounterMaintenanceTransition } from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import { projectNativeActionEffectTransitions } from '@artificer-toolkit/rules-runtime/encounterActionEffectReceipts'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { ResolveEncounterActionInputDto } from '@artificer-toolkit/schema/api/encounterRuleCommands'
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

type CompleteExecution = Extract<StoredRuleExecutionResultDto, { status: 'COMPLETE' }>

type EffectCommitInput = {
  state: EncounterRunState
  command: Pick<
    ResolveEncounterActionInputDto,
    'encounterId' | 'actorId' | 'targetActorId' | 'actionId' | 'commandId'
  >
  execution: Pick<CompleteExecution, 'occurrenceId' | 'applicationOutputs'>
  maintainedState: EncounterMaintainedEffectStateRecord | null
  createdEffects: ActiveRuleEffectRecord[]
  authorizedCharacterIds: ReadonlySet<string>
}

type PreparedMaintenance = {
  prior: EncounterMaintainedEffectStateRecord | null
  removed: ActiveRuleEffectRecord[]
  characterVersions: { characterId: string; beforeStreamVersion: number }[]
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
    outputs.targetActorId !== command.targetActorId
  )
    throw new Error('Completed action effect receipt does not match the command.')
  return outputs
}

function classifyCreatedEffects(input: EffectCommitInput) {
  const outputs = actionOutputs(input)
  const stateTransition = outputs.stateEffectTransitions
  const activeTransition = outputs.activeEffectTransitions
  if (
    input.createdEffects.length > 2 ||
    stateTransition.length > 1 ||
    activeTransition.length > 1 ||
    input.createdEffects.length !== stateTransition.length + activeTransition.length
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
  if (
    (stateTransition.length > 0 && !state) ||
    (activeTransition.length > 0 && !recurring) ||
    (state && recurring && state.id === recurring.id)
  )
    throw new Error('Completed action effects do not match the stored receipt.')
  return { state, recurring, outputs }
}

/** Reads the exact replaced slot and affected Character versions before mechanics are applied. */
export async function prepareEncounterActionMaintenance(
  ctx: EncounterCharacterWriteTransaction,
  input: EffectCommitInput
): Promise<PreparedMaintenance | null> {
  const { recurring, outputs } = classifyCreatedEffects(input)
  const created = input.maintainedState
  if (!created) {
    if (outputs.maintenanceTransition)
      throw new Error('Completed action maintenance receipt has no created state.')
    return null
  }
  if (
    created.encounterId !== input.state.id ||
    created.ownerActorId !== input.command.actorId ||
    created.maintenanceDefinitionId !== created.descriptor.maintenanceDefinitionId ||
    created.descriptor.sourceActorId !== input.command.actorId ||
    created.descriptor.sourceActionId !== input.command.actionId ||
    created.descriptor.sourceOccurrenceId !== input.execution.occurrenceId
  )
    throw new Error('Created maintained effect state does not match the completed action.')
  if (!outputs.maintenanceTransition)
    throw new Error('Created maintained effect state has no completed action receipt.')

  const store = createActiveRuleEffectStore(ctx)
  const prior = await store.findMaintainedState({
    encounterId: input.state.id,
    ownerActorId: input.command.actorId,
    maintenanceDefinitionId: created.maintenanceDefinitionId
  })
  const removed = prior
    ? await store.listDependentEffects({ encounterId: input.state.id, stateId: prior.id })
    : []
  removed.sort((left, right) => {
    const key = (effect: ActiveRuleEffectRecord) =>
      `${effect.owner.kind === 'CHARACTER' ? `0:${effect.owner.characterId}` : `1:${effect.owner.targetActorId}`}:${effect.createdOrdinal.toString().padStart(10, '0')}:${effect.id}`
    return key(left).localeCompare(key(right))
  })
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
  const maintenance = { prior, removed, characterVersions }
  const transition = buildEncounterMaintenanceTransition({
    maintenance,
    createdState: created,
    createdDependentEffectIds: recurring ? [recurring.id] : []
  })
  if (checksumCanonicalJson(transition) !== checksumCanonicalJson(outputs.maintenanceTransition))
    throw new Error('Completed action maintenance receipt changed before settlement.')
  return maintenance
}

/** Persists only records already projected into the completed action receipt. */
export async function persistEncounterActionEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: EffectCommitInput & {
    maintenance: PreparedMaintenance | null
    actors: EncounterRunActorState[]
    occurredAt: string
  }
): Promise<EncounterRunActorState[]> {
  const { state, recurring, outputs } = classifyCreatedEffects(input)
  const target = input.actors.find((actor) => actor.id === input.command.targetActorId)
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
      origin.sourceActorId !== input.command.actorId ||
      origin.sourceOccurrenceId !== input.execution.occurrenceId ||
      origin.rootCommandId !== input.command.commandId ||
      effect.definition.frozenGraph.source.gameSystemId !== input.state.gameSystemId ||
      effect.sourceEncounterId !==
        (owner.kind === 'CHARACTER' && effect.definition.recurrence.lifetimeScope === 'ENCOUNTER'
          ? input.state.id
          : null) ||
      effect.maintainedEffectStateId !==
        (effect.id === recurring?.id ? (input.maintainedState?.id ?? null) : null)
    )
      throw new Error('Created action effect does not match its current owner and source.')
  }
  const projected = projectNativeActionEffectTransitions({
    state,
    recurring,
    targetActorId: target.id
  })
  const activeEffectTransitions =
    target.kind === 'CHARACTER'
      ? projected.activeEffectTransitions.map(
          ({ targetActorId: _targetActorId, ...transition }) => ({
            ...transition,
            characterId: target.sourceId,
            sourceEncounterId: input.state.id,
            maintainedEffectStateId: input.maintainedState?.id ?? null
          })
        )
      : projected.activeEffectTransitions
  if (
    checksumCanonicalJson(projected.stateEffectTransitions) !==
      checksumCanonicalJson(outputs.stateEffectTransitions) ||
    checksumCanonicalJson(activeEffectTransitions) !==
      checksumCanonicalJson(outputs.activeEffectTransitions)
  )
    throw new Error('Completed action effect receipts changed before settlement.')
  if (Boolean(input.maintainedState) !== Boolean(input.maintenance))
    throw new Error('Completed action maintenance preparation is incomplete.')

  const store = createActiveRuleEffectStore(ctx)
  if (input.maintenance) {
    for (const effect of input.maintenance.removed)
      await store.deleteCas({ id: effect.id, owner: effect.owner, expectedVersion: effect.version })
    if (input.maintenance.prior)
      await store.deleteMaintainedStateCas({
        id: input.maintenance.prior.id,
        encounterId: input.state.id,
        ownerActorId: input.command.actorId,
        expectedVersion: input.maintenance.prior.version
      })
    const supplied = input.maintainedState!
    const created = await store.createMaintainedState({
      id: supplied.id,
      encounterId: supplied.encounterId,
      ownerActorId: supplied.ownerActorId,
      descriptor: supplied.descriptor,
      occurredAt: input.occurredAt
    })
    if (checksumCanonicalJson(created) !== checksumCanonicalJson(supplied))
      throw new Error('Created maintained effect state changed before settlement.')
  }
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
  return input.maintenance
    ? reconcileNativeMaintenanceOwners(ctx, {
        encounterId: input.state.id,
        maintenance: input.maintenance,
        actors: input.actors,
        occurredAt: input.occurredAt
      })
    : input.actors
}
