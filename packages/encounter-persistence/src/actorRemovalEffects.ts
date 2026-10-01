import { maintenanceCompleteRuleExecutionResultDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionTurnResults'

import { createActiveRuleEffectStore } from './effectStore.js'
import type { EncounterRunState } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { EncounterCharacterRow } from './characterPlay.js'
import type { EncounterCharacterWriteTransaction } from './ports.js'

type MaintenanceCleanupResult = Pick<
  ReturnType<typeof maintenanceCompleteRuleExecutionResultDtoSchema.parse>,
  'terminatedStates' | 'removedEffects' | 'characterOwnerTransitions'
>
type StoredEffect = Awaited<
  ReturnType<ReturnType<typeof createActiveRuleEffectStore>['list']>
>[number]
type StoredState = Awaited<
  ReturnType<ReturnType<typeof createActiveRuleEffectStore>['listMaintainedStatesByOwner']>
>[number]

function effectKey(effect: StoredEffect) {
  const ownerId =
    effect.owner.kind === 'CHARACTER' ? effect.owner.characterId : effect.owner.targetActorId
  return `${effect.owner.kind}:${ownerId}:${effect.id}`
}

function effectReceipt(effect: StoredEffect) {
  return {
    kind: effect.owner.kind,
    ownerId:
      effect.owner.kind === 'CHARACTER' ? effect.owner.characterId : effect.owner.targetActorId,
    activeEffectId: effect.id,
    createdOrdinal: effect.createdOrdinal,
    expectedVersion: effect.version,
    definitionChecksum: effect.definitionChecksum,
    lifecycleChecksum: effect.lifecycleChecksum
  } as const
}

/** Removes maintained effects which cannot outlive an Encounter actor. */
export async function cleanupRemovedActorEffects(
  ctx: EncounterCharacterWriteTransaction,
  input: { state: EncounterRunState; actorId: string; occurredAt: string }
): Promise<MaintenanceCleanupResult | null> {
  const effects = createActiveRuleEffectStore(ctx)
  const ownedStates = await effects.listMaintainedStatesByOwner({
    encounterId: input.state.id,
    ownerActorId: input.actorId
  })
  const states = new Map<string, StoredState>(ownedStates.map((state) => [state.id, state]))
  const effectsToDelete = new Map<string, StoredEffect>()
  const addEffects = (rows: readonly StoredEffect[]) => {
    for (const effect of rows) effectsToDelete.set(effectKey(effect), effect)
  }

  for (const state of ownedStates)
    addEffects(
      await effects.listDependentEffects({ encounterId: input.state.id, stateId: state.id })
    )

  const actorOwned = await effects.list({
    kind: 'ENCOUNTER_ACTOR',
    encounterId: input.state.id,
    targetActorId: input.actorId
  })
  addEffects(actorOwned)
  for (const effect of actorOwned) {
    if (!effect.maintainedEffectStateId || states.has(effect.maintainedEffectStateId)) continue
    const state = await effects.findMaintainedStateById({
      encounterId: input.state.id,
      stateId: effect.maintainedEffectStateId
    })
    if (!state) throw new Error('Maintained effect state changed before actor removal.')
    states.set(state.id, state)
    await effects.listDependentEffects({ encounterId: input.state.id, stateId: state.id })
  }

  if (effectsToDelete.size === 0 && states.size === 0) return null

  const affectedCharacterIds = [
    ...new Set(
      [...effectsToDelete.values()].flatMap((effect) =>
        effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []
      )
    )
  ].sort((left, right) => left.localeCompare(right))
  const characterRows = new Map<string, EncounterCharacterRow>()
  for (const characterId of affectedCharacterIds) {
    const row = await ctx.ports.readCharacterRow(characterId)
    if (!row || row.status !== 'ACTIVE')
      throw new Error('Maintained-effect Character owner is unavailable.')
    const character = ctx.ports.readCharacterRecord(row)
    ctx.ports.readCharacterSheetState(row)
    if (character.systemId !== input.state.gameSystemId)
      throw new Error('Maintained-effect Character owner does not match the Encounter Game System.')
    characterRows.set(characterId, row)
  }

  const orderedEffects = [...effectsToDelete.values()].sort((left, right) => {
    const leftOwner =
      left.owner.kind === 'CHARACTER' ? left.owner.characterId : left.owner.targetActorId
    const rightOwner =
      right.owner.kind === 'CHARACTER' ? right.owner.characterId : right.owner.targetActorId
    return `${left.owner.kind}:${leftOwner}:${left.createdOrdinal.toString().padStart(10, '0')}:${left.id}`.localeCompare(
      `${right.owner.kind}:${rightOwner}:${right.createdOrdinal.toString().padStart(10, '0')}:${right.id}`
    )
  })
  for (const effect of orderedEffects)
    await effects.deleteCas({ id: effect.id, owner: effect.owner, expectedVersion: effect.version })

  const terminatedStates: MaintenanceCleanupResult['terminatedStates'] = []
  for (const state of [...states.values()].sort((left, right) =>
    `${left.ownerActorId}:${left.id}`.localeCompare(`${right.ownerActorId}:${right.id}`)
  )) {
    const remaining = await effects.listDependentEffects({
      encounterId: input.state.id,
      stateId: state.id
    })
    const ownedByRemovedActor = state.ownerActorId === input.actorId
    const terminalWhenEmpty =
      state.descriptor.schemaVersion === 1 ||
      state.descriptor.emptyDependentPolicy === 'TERMINATE_WHEN_EMPTY'
    if (remaining.length !== 0 || (!ownedByRemovedActor && !terminalWhenEmpty)) continue
    await effects.deleteMaintainedStateCas({
      id: state.id,
      encounterId: input.state.id,
      ownerActorId: state.ownerActorId,
      expectedVersion: state.version
    })
    terminatedStates.push({
      id: state.id,
      ownerActorId: state.ownerActorId,
      maintenanceDefinitionId: state.maintenanceDefinitionId,
      expectedVersion: state.version,
      descriptorChecksum: state.descriptorChecksum
    })
  }

  const characterOwnerTransitions: MaintenanceCleanupResult['characterOwnerTransitions'] = []
  for (const characterId of affectedCharacterIds) {
    const character = characterRows.get(characterId)
    if (!character) throw new Error('Maintained-effect Character owner is unavailable.')
    await ctx.ports.writeCharacterRecord({
      current: character,
      fields: { streamVersion: character.play.streamVersion + 1, updatedAt: input.occurredAt }
    })
    characterOwnerTransitions.push({
      characterId,
      beforeStreamVersion: character.play.streamVersion,
      afterStreamVersion: character.play.streamVersion + 1
    })
  }

  return {
    terminatedStates,
    removedEffects: orderedEffects.map(effectReceipt),
    characterOwnerTransitions
  }
}
