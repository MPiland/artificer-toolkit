import type { CharacterRuleActionActiveEffectPlan } from '@artificer-toolkit/rules-runtime/characterRuleActionSystemAdapter'
import {
  buildEncounterMaintenanceTransition,
  prepareEncounterActionMaintenance
} from '@artificer-toolkit/rules-runtime/encounterActionMaintenance'
import type {
  ActiveRuleEffectRecord,
  EncounterMaintainedEffectStateRecord
} from '@artificer-toolkit/schema/projections/activeRuleEffectPersistence'
import type { EncounterRunActorState } from '@artificer-toolkit/schema/projections/encounterRunState'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readCharacterRecord, readCharacterSheetState } from '../characters/documents'
import { createActiveRuleEffectStore } from '../rules/effectStore'
import type { MovementTarget } from './movementTargets'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence'
import type { prepareNativeEncounterActionMechanics } from './actionMechanicsPreparation'

type Prepared = Awaited<ReturnType<typeof prepareNativeEncounterActionMechanics>>

export type NativeMaintenanceOwner = {
  owner: ActiveRuleEffectRecord['owner']
  effects: ActiveRuleEffectRecord[]
  character: Doc<'characters'> | null
}

/** Only uncommitted maintenance changes from earlier contacts in this movement evaluation. */
export type NativeMaintenanceProjection = {
  slots: ReadonlyMap<
    string,
    {
      state: EncounterMaintainedEffectStateRecord | null
      dependents: ActiveRuleEffectRecord[]
    }
  >
  owners: ReadonlyMap<string, NativeMaintenanceOwner>
}

/** Reads each affected owner once, including changes staged by earlier movement contacts. */
export async function prepareNativeMaintenanceOwners(
  ctx: MutationCtx,
  input: {
    gameSystemId: string
    removed: readonly ActiveRuleEffectRecord[]
    targets?: ReadonlyMap<string, MovementTarget>
    projection?: NativeMaintenanceProjection
  }
) {
  const store = createActiveRuleEffectStore(ctx)
  const characterVersions: {
    characterId: string
    beforeStreamVersion: number
  }[] = []
  const owners: NativeMaintenanceOwner[] = []
  const uniqueOwners = new Map(
    input.removed.map((effect) => [checksumCanonicalJson(effect.owner), effect.owner])
  )
  for (const [key, owner] of uniqueOwners) {
    const target = [...(input.targets?.values() ?? [])].find((candidate) =>
      owner.kind === 'CHARACTER'
        ? candidate.actor.kind === 'CHARACTER' && candidate.actor.sourceId === owner.characterId
        : candidate.actor.id === owner.targetActorId
    )
    const projectedOwner = input.projection?.owners.get(key)
    const effects = target?.activeEffects ?? projectedOwner?.effects ?? (await store.list(owner))
    if (owner.kind !== 'CHARACTER') {
      owners.push({ owner, effects: [...effects], character: null })
      continue
    }
    const row =
      target?.characterFacts?.active ??
      projectedOwner?.character ??
      (await ctx.db
        .query('characters')
        .withIndex('by_publicId', (q) => q.eq('id', owner.characterId))
        .unique())
    if (!row || row.status !== 'ACTIVE' || readCharacterRecord(row).systemId !== input.gameSystemId)
      throw new Error('Maintained-effect Character owner is unavailable.')
    readCharacterSheetState(row)
    owners.push({ owner, effects: [...effects], character: row })
    characterVersions.push({
      characterId: owner.characterId,
      beforeStreamVersion: row.streamVersion
    })
  }
  characterVersions.sort((left, right) => left.characterId.localeCompare(right.characterId))
  return { characterVersions, owners }
}

export type PreparedMaintenance = NonNullable<
  Awaited<
    ReturnType<
      typeof prepareEncounterActionMaintenance<
        Awaited<ReturnType<typeof prepareNativeMaintenanceOwners>>
      >
    >
  >
>

/** Replacement and its new dependent remain inside the action's owning mutation. */
export async function replaceNativeActionMaintenance(
  ctx: MutationCtx,
  input: {
    prepared: Prepared
    maintenance: PreparedMaintenance
    policy: NonNullable<CharacterRuleActionActiveEffectPlan['maintenance']>
    actionId: string
    occurrenceId: string
    id?: string
    occurredAt?: string
  }
) {
  const { maintenance, prepared } = input
  if (checksumCanonicalJson(input.policy) !== checksumCanonicalJson(maintenance.policy))
    throw new Error('The completed action maintenance policy changed.')
  const store = createActiveRuleEffectStore(ctx)
  for (const effect of maintenance.removed)
    await store.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version
    })
  if (maintenance.prior)
    await store.deleteMaintainedStateCas({
      id: maintenance.prior.id,
      encounterId: prepared.state.id,
      ownerActorId: prepared.actor.id,
      expectedVersion: maintenance.prior.version
    })
  return store.createMaintainedState({
    id: input.id ?? crypto.randomUUID(),
    encounterId: prepared.state.id,
    ownerActorId: prepared.actor.id,
    occurredAt: input.occurredAt,
    descriptor: {
      schemaVersion: 2,
      maintenanceDefinitionId: maintenance.policy.definitionId,
      definitionChecksum: maintenance.definitionChecksum,
      sourceActionId: input.actionId,
      sourceOccurrenceId: input.occurrenceId,
      sourceActorId: prepared.actor.id,
      replacementPolicy: maintenance.policy.replacementPolicy,
      emptyDependentPolicy: maintenance.policy.emptyDependentPolicy
    }
  })
}

export async function finishNativeActionMaintenance(
  ctx: MutationCtx,
  input: {
    prepared: Prepared
    maintenance: PreparedMaintenance
    createdState: Awaited<ReturnType<typeof replaceNativeActionMaintenance>>
    createdDependentEffectIds: string[]
    actors: EncounterRunActorState[]
    occurredAt: string
  }
) {
  return {
    actors: await reconcileNativeMaintenanceOwners(ctx, {
      encounterId: input.prepared.state.id,
      maintenance: input.maintenance,
      actors: input.actors,
      occurredAt: input.occurredAt
    }),
    transition: buildEncounterMaintenanceTransition(input)
  }
}
