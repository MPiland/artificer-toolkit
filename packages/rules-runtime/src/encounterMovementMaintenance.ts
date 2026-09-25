import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import { encounterRunActorStateSchema } from '@artificer-toolkit/schema/projections/encounterRunState'
import type { ServerKernelRuleExecutionPendingSnapshotDto } from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { characterMechanicsTargetStateDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMechanics'
import type { movementReactionActionExecutionDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionMovementReactionReceipts'
import { canonicalizeRuleDocument, checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { CharacterAuthored } from '@artificer-toolkit/shared/subjects/authored'
import { readEncounterActorConditionState } from './encounterCharacterMechanicsBatch.js'
import {
  buildEncounterMaintenanceTransition,
  endedMaintenanceConditions
} from './encounterActionMaintenance.js'
import {
  projectEncounterActionTarget,
  type ProjectableCharacterFacts
} from './encounterActionProjection.js'
import type { MovementTarget } from './encounterMovementTargets.js'

export type MovementCharacterRow = {
  id: string
  streamVersion: number
  documentJson: string
  checksum: string
  updatedAt: string
}
export type MovementMaintenanceOwner<TRow extends MovementCharacterRow> = {
  owner: ActiveRuleEffectRecord['owner']
  effects: ActiveRuleEffectRecord[]
  character: TRow | null
}
export type MovementMaintenanceProjection<TRow extends MovementCharacterRow> = {
  slots: ReadonlyMap<
    string,
    { state: EncounterMaintainedEffectStateRecord | null; dependents: ActiveRuleEffectRecord[] }
  >
  owners: ReadonlyMap<string, MovementMaintenanceOwner<TRow>>
}
type Maintenance<TRow extends MovementCharacterRow> = {
  prior: EncounterMaintainedEffectStateRecord | null
  removed: readonly ActiveRuleEffectRecord[]
  owners: readonly MovementMaintenanceOwner<TRow>[]
  characterVersions: readonly { characterId: string; beforeStreamVersion: number }[]
}

function maintenanceTargetState(target: MovementTarget) {
  return characterMechanicsTargetStateDtoSchema.parse({
    currentHitPoints: target.state.current,
    temporaryHitPoints: target.state.temporary,
    maximumHitPoints: target.effectiveMaximumHitPoints,
    scalarValues: target.effectiveScalarValues,
    conditionIds: target.state.conditions
  })
}

type MovementMaintenanceProjectionInput<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
> = {
  createdEffects: readonly ActiveRuleEffectRecord[]
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
    maintenance: Pick<Maintenance<TRow>, 'removed' | 'owners' | 'characterVersions'>
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { maintenance } = input
  const targets = new Map(input.targets)
  const owners = new Map(input.projection?.owners)
  const ownerTransitions: NonNullable<
    ReturnType<typeof movementReactionActionExecutionDtoSchema.parse>['maintenanceOwnerTransitions']
  > = []
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
    for (const effect of input.createdEffects)
      if (
        checksumCanonicalJson(effect.owner) === key &&
        !remaining.some((value) => value.id === effect.id)
      )
        remaining.push(effect)
    const ended = endedMaintenanceConditions(
      maintenance.removed.filter((effect) => checksumCanonicalJson(effect.owner) === key),
      remaining
    )
    const active = target?.characterFacts?.active
    let row = snapshot.character
    if (active) {
      if (!row) throw new Error('Movement maintenance Character row is unavailable.')
      row = {
        ...row,
        ...active,
        documentJson: active.documentJson ?? row.documentJson,
        updatedAt: active.updatedAt ?? row.updatedAt
      }
    }
    let characterUpdate: Parameters<typeof projectEncounterActionTarget>[0]['plan'] = null
    if (owner.kind === 'CHARACTER') {
      const before = maintenance.characterVersions.find(
        (value) => value.characterId === owner.characterId
      )?.beforeStreamVersion
      if (
        !row ||
        before === undefined ||
        (row.streamVersion !== before && row.streamVersion !== before + 1)
      )
        throw new Error('Movement maintenance Character forecast is stale.')
      const character = readCharacter(row)
      const conditions = character.state.conditions ?? []
      const retained = conditions.filter((condition) => !ended.has(condition.conditionTypeId))
      const next =
        retained.length === conditions.length
          ? character
          : {
              ...character,
              state: { ...character.state, conditions: retained }
            }
      row = {
        ...row,
        ...(retained.length === conditions.length
          ? {}
          : {
              documentJson: canonicalizeRuleDocument(next),
              checksum: checksumRuleDocument(next)
            }),
        streamVersion: before + 1,
        updatedAt: input.occurredAt
      }
      if (retained.length !== conditions.length)
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
    // A Character's conditions live on the Character, which `characterUpdate` above rewrites.
    const actor =
      target.actor.kind === 'CHARACTER' || !ended.size
        ? target.actor
        : (() => {
            const conditions = readEncounterActorConditionState(target.actor.conditions ?? [])
            return encounterRunActorStateSchema.parse({
              ...target.actor,
              conditions: conditions.values.filter(
                (_value, index) => !ended.has(conditions.ids[index]!)
              )
            })
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
        character: {
          ...row,
          ...projected.characterFacts.active,
          documentJson: projected.characterFacts.active.documentJson ?? row.documentJson,
          updatedAt: projected.characterFacts.active.updatedAt ?? row.updatedAt
        }
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

/** Carries exact slot, owner and condition changes into the next contact without publishing. */
export function projectEncounterMovementMaintenance<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
>(
  input: MovementMaintenanceProjectionInput<TRow, TCharacterFacts> & {
    maintenance: Maintenance<TRow>
    state: EncounterMaintainedEffectStateRecord
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { targets, owners, ownerTransitions } = projectEncounterMovementMaintenanceOwners(
    input,
    readCharacter
  )
  const slots = new Map(input.projection?.slots)
  const dependents = input.createdEffects.filter(
    (effect) => effect.maintainedEffectStateId === input.state.id
  )
  slots.set(`${input.state.ownerActorId}:${input.state.maintenanceDefinitionId}`, {
    state: input.state,
    dependents
  })
  return {
    targets,
    ownerTransitions,
    projection: { slots, owners },
    transition: buildEncounterMaintenanceTransition({
      maintenance: input.maintenance,
      createdState: input.state,
      createdDependentEffectIds: dependents.map((effect) => effect.id)
    })
  }
}

/** Forecasts failed-save cleanup; an explicit empty slot prevents stale storage fallback. */
export function projectEncounterMovementConcentrationEnd<
  TRow extends MovementCharacterRow,
  TCharacterFacts extends ProjectableCharacterFacts
>(
  input: Omit<MovementMaintenanceProjectionInput<TRow, TCharacterFacts>, 'createdEffects'> & {
    maintenance: Pick<Maintenance<TRow>, 'removed' | 'owners' | 'characterVersions'> & {
      state: EncounterMaintainedEffectStateRecord
    }
  },
  readCharacter: (row: TRow) => CharacterAuthored
) {
  const { targets, owners, ownerTransitions } = projectEncounterMovementMaintenanceOwners(
    {
      ...input,
      createdEffects: []
    },
    readCharacter
  )
  const { state, removed, characterVersions } = input.maintenance
  const slots = new Map(input.projection?.slots)
  slots.set(`${state.ownerActorId}:${state.maintenanceDefinitionId}`, {
    state: null,
    dependents: []
  })
  return {
    targets,
    ownerTransitions,
    projection: { slots, owners },
    cleanup: {
      maintainedStateId: state.id,
      removedDependentEffectIds: removed.map((effect) => effect.id),
      characterOwnerTransitions: characterVersions.map((entry) => ({
        ...entry,
        afterStreamVersion: entry.beforeStreamVersion + 1
      }))
    }
  }
}

/** The native caller adds its preflight binding before the whole snapshot is stored and checksummed. */
export function bindEncounterMovementMaintenancePending(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  maintenance: Maintenance<MovementCharacterRow> | null
): ServerKernelRuleExecutionPendingSnapshotDto {
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    (context.phase.kind !== 'ACTION_EVIDENCE' &&
      context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE')
  )
    throw new Error('Movement maintenance requires a pending action phase.')
  return maintenance
    ? {
        ...snapshot,
        applicationContext: {
          ...context,
          phase: {
            ...context.phase,
            maintenanceCurrentnessChecksum: checksumRuleDocument(maintenance)
          }
        }
      }
    : snapshot
}

export function requireEncounterMovementMaintenanceCurrentness(
  snapshot: ServerKernelRuleExecutionPendingSnapshotDto,
  maintenance: Maintenance<MovementCharacterRow> | null
) {
  const context = snapshot.applicationContext
  if (
    context.kind !== 'ENCOUNTER_MOVEMENT_REACTION' ||
    (context.phase.kind !== 'ACTION_EVIDENCE' &&
      context.phase.kind !== 'LEGENDARY_RESISTANCE_CHOICE') ||
    (context.phase.maintenanceCurrentnessChecksum ?? null) !==
      (maintenance ? checksumRuleDocument(maintenance) : null)
  )
    throw new Error('The pending movement maintenance state or owner changed.')
}
