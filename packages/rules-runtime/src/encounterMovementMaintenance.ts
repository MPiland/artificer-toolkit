import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { MovementConcentrationExecutionDto } from '@artificer-toolkit/schema/shared/ruleExecutionMovementConcentration'
import {
  temporaryHitPointsAfterEffectsEnd,
  withActorTemporaryHitPoints,
  withCharacterTemporaryHitPoints,
  type TemporaryHitPointsPool
} from '@artificer-toolkit/schema/shared/temporaryHitPoints'
import {
  encodeCharacterRecord,
  type StoredCharacter
} from '@artificer-toolkit/schema/projections/characterStoredState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import { endedMaintenanceConditions } from './encounterActionMaintenance.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'

export type MovementCharacterRow = StoredCharacter
export type MovementMaintenanceOwner<TRow extends MovementCharacterRow> = {
  owner: ActiveRuleEffectRecord['owner']
  effects: ActiveRuleEffectRecord[]
  character: TRow | null
}
/** One held maintained state's simulated slot; an actor can hold several at once. */
export function movementSlotKey(actorId: string, definitionId: string, stateId: string) {
  return `${actorId}:${definitionId}:${stateId}`
}
export type MovementMaintenanceProjection<TRow extends MovementCharacterRow> = {
  slots: ReadonlyMap<
    string,
    {
      state: EncounterMaintainedEffectStateRecord | null
      dependents: ActiveRuleEffectRecord[]
      zoneIds: readonly string[]
    }
  >
  owners: ReadonlyMap<string, MovementMaintenanceOwner<TRow>>
}
/**
 * An actor's held states as the movement chain sees them, in casting order: the stored ones less
 * those the chain ended or replaced, plus those it created.
 */
export function projectedHeldStates(
  projection: Pick<MovementMaintenanceProjection<MovementCharacterRow>, 'slots'> | undefined,
  stored: readonly EncounterMaintainedEffectStateRecord[],
  actorId: string,
  definitionId: string
) {
  const slots = projection?.slots
  if (!slots) return [...stored]
  const held = stored.filter(
    ({ id }) => slots.get(movementSlotKey(actorId, definitionId, id))?.state !== null
  )
  for (const { state } of slots.values())
    if (
      state?.ownerActorId === actorId &&
      state.maintenanceDefinitionId === definitionId &&
      !held.some(({ id }) => id === state.id)
    )
      held.push(state)
  return held.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
}
type Maintenance<TRow extends MovementCharacterRow> = {
  removed: readonly ActiveRuleEffectRecord[]
  owners: readonly MovementMaintenanceOwner<TRow>[]
  characterVersions: readonly { characterId: string; beforeStreamVersion: number }[]
}

function maintenanceTargetState(target: MovementTarget) {
  return characterMechanicsTargetStateDtoSchema.parse({
    currentHitPoints: target.state.current,
    temporaryHitPoints: target.state.temporary,
    ...(target.state.temporarySourceEffectId && {
      temporaryHitPointsSourceEffectId: target.state.temporarySourceEffectId
    }),
    maximumHitPoints: target.effectiveMaximumHitPoints,
    scalarValues: target.effectiveScalarValues,
    conditionIds: target.state.conditions,
    deathSaves: target.state.deathSaves
  })
}

type MovementMaintenanceProjectionInput<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
> = {
  targets: ReadonlyMap<string, MovementTarget<TCharacterFacts>>
  projection?: MovementMaintenanceProjection<TRow>
  campaignId: string
  gameSystemId: string
  occurredAt: string
}

function projectEncounterMovementMaintenanceOwners<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
>(
  input: MovementMaintenanceProjectionInput<TRow, TCharacterFacts> & {
    maintenance: Maintenance<TRow>
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { maintenance } = input
  const targets = new Map(input.targets)
  const owners = new Map(input.projection?.owners)
  const ownerTransitions: MovementConcentrationExecutionDto['ownerTransitions'] = []
  const removedIds = new Set(maintenance.removed.map((effect) => effect.id))
  for (const snapshot of maintenance.owners) {
    const owner = snapshot.owner
    const key = checksumCanonicalJson(owner)
    const target = [...targets.values()].find((candidate) =>
      owner.kind === 'CHARACTER'
        ? candidate.actor.kind === 'CHARACTER' && candidate.actor.sourceId === owner.characterId
        : candidate.actor.id === owner.targetActorId
    )
    const remaining = (target?.activeEffects ?? snapshot.effects).filter(
      (effect) => !removedIds.has(effect.id)
    )
    const ownerRemoved = maintenance.removed.filter(
      (effect) => checksumCanonicalJson(effect.owner) === key
    )
    const ended = endedMaintenanceConditions(ownerRemoved, remaining)
    // Temporary hit points a removed effect gave leave with it (D156), as persistence settles them.
    const releasedTemporary = (pool: TemporaryHitPointsPool) =>
      temporaryHitPointsAfterEffectsEnd(
        pool,
        ownerRemoved.map((effect) => effect.id)
      )
    const active = target?.characterFacts?.active
    let row = snapshot.character
    if (active) {
      if (!row) throw new Error('Movement maintenance Character row is unavailable.')
      row = { ...row, ...active }
    }
    let characterUpdate: Parameters<typeof projectEncounterActionTarget>[0]['plan'] = null
    if (owner.kind === 'CHARACTER') {
      const before = maintenance.characterVersions.find(
        (value) => value.characterId === owner.characterId
      )?.beforeStreamVersion
      if (
        !row ||
        before === undefined ||
        (row.play.streamVersion !== before && row.play.streamVersion !== before + 1)
      )
        throw new Error('Movement maintenance Character forecast is stale.')
      const character = readCharacter(row)
      const conditions = character.state.conditions ?? []
      const retained = conditions.filter((condition) => !ended.has(condition.conditionTypeId))
      const { hitpoints } = character.state
      const temporary = releasedTemporary({
        amount: hitpoints.temp,
        sourceEffectId: hitpoints.tempSourceEffectId ?? null
      })
      const changed = retained.length !== conditions.length || temporary.amount !== hitpoints.temp
      const next = changed
        ? {
            ...character,
            state: {
              ...character.state,
              conditions: retained,
              hitpoints: withCharacterTemporaryHitPoints(hitpoints, temporary)
            }
          }
        : character
      row = encodeCharacterRecord(row, {
        document: next,
        streamVersion: before + 1,
        updatedAt: input.occurredAt
      })
      if (changed)
        characterUpdate = {
          characterUpdate: {
            character: next as CharacterAuthored,
            sheetState: null
          },
          characterStreamVersion: before + 1
        }
    }
    owners.set(key, { owner, effects: remaining, character: row })
    if (!target) {
      if (owner.kind !== 'CHARACTER')
        throw new Error('Movement maintenance Encounter owner is unavailable.')
      continue
    }
    // A Character's conditions and hit points live on the Character, which `characterUpdate` above
    // rewrites; only a form it holds keeps its own temporary hit points on the actor.
    const actor = (() => {
      const pool = (holder: { tempHitPoints: number; tempHitPointsSourceEffectId?: string }) =>
        releasedTemporary({
          amount: holder.tempHitPoints,
          sourceEffectId: holder.tempHitPointsSourceEffectId ?? null
        })
      if (target.actor.kind === 'CHARACTER') {
        const { form } = target.actor
        const temporary = form ? pool(form) : null
        return form && temporary && temporary.amount !== form.tempHitPoints
          ? { ...target.actor, form: withActorTemporaryHitPoints(form, temporary) }
          : target.actor
      }
      const temporary = pool(target.actor)
      if (!ended.size && temporary.amount === target.actor.tempHitPoints) return target.actor
      const conditions = readEncounterActorConditionState(target.actor.conditions ?? [])
      return encounterRunActorStateSchema.parse(
        withActorTemporaryHitPoints(
          {
            ...target.actor,
            conditions: conditions.values.filter(
              (_value, index) => !ended.has(conditions.ids[index]!)
            )
          },
          temporary
        )
      )
    })()
    const projected = projectEncounterActionTarget({
      target: {
        ...target,
        activeEffects: remaining,
        characterFacts:
          target.characterFacts && row
            ? { ...target.characterFacts, active: { ...target.characterFacts.active, ...row } }
            : target.characterFacts
      },
      actor,
      plan: characterUpdate,
      campaignId: input.campaignId,
      gameSystemId: input.gameSystemId,
      occurredAt: input.occurredAt
    })
    targets.set(actor.id, projected)
    ownerTransitions.push({
      targetActorId: actor.id,
      characterId: owner.kind === 'CHARACTER' ? owner.characterId : null,
      before: maintenanceTargetState(target),
      after: maintenanceTargetState(projected)
    })
    if (row && projected.characterFacts)
      owners.set(key, {
        owner,
        effects: remaining,
        character: { ...row, ...projected.characterFacts.active }
      })
  }
  return {
    targets,
    owners,
    ownerTransitions: ownerTransitions.sort((left, right) =>
      left.targetActorId.localeCompare(right.targetActorId)
    )
  }
}

/**
 * Forecasts the release of effects a made repeat save ended on their holder: no maintained state
 * ends, so the slots stand and only the holder's owner record advances.
 */
export function projectEncounterMovementEffectRelease<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
>(
  input: MovementMaintenanceProjectionInput<TRow, TCharacterFacts> & {
    maintenance: Maintenance<TRow>
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { targets, owners, ownerTransitions } = projectEncounterMovementMaintenanceOwners(
    input,
    readCharacter
  )
  return {
    targets,
    ownerTransitions,
    projection: { slots: new Map(input.projection?.slots), owners },
    characterOwnerTransitions: input.maintenance.characterVersions.map((entry) => ({
      ...entry,
      afterStreamVersion: entry.beforeStreamVersion + 1
    }))
  }
}

/** Forecasts failed-save cleanup; an explicit empty slot prevents stale storage fallback. */
export function projectEncounterMovementConcentrationEnd<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
>(
  input: MovementMaintenanceProjectionInput<TRow, TCharacterFacts> & {
    maintenance: Maintenance<TRow> & {
      state: EncounterMaintainedEffectStateRecord
      zoneIds: readonly string[]
    }
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { targets, owners, ownerTransitions } = projectEncounterMovementMaintenanceOwners(
    input,
    readCharacter
  )
  const { state, removed, zoneIds, characterVersions } = input.maintenance
  const slots = new Map(input.projection?.slots)
  slots.set(movementSlotKey(state.ownerActorId, state.maintenanceDefinitionId, state.id), {
    state: null,
    dependents: [],
    zoneIds: []
  })
  return {
    targets,
    ownerTransitions,
    projection: { slots, owners },
    cleanup: {
      maintainedStateId: state.id,
      removedDependentEffectIds: removed.map((effect) => effect.id),
      removedZoneIds: [...zoneIds],
      characterOwnerTransitions: characterVersions.map((entry) => ({
        ...entry,
        afterStreamVersion: entry.beforeStreamVersion + 1
      }))
    }
  }
}
