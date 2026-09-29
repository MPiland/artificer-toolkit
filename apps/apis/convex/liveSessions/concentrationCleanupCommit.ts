import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionEncounterApplications'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { MutationCtx } from '../_generated/server'
import { readCharacterRecord, readCharacterRow } from '../characters/stateDocuments'
import { reconcileNativeMaintenanceOwners } from '../encounters/maintenanceOwnerPersistence'
import { createActiveRuleEffectStore } from '@artificer-toolkit/encounter-persistence/effectStore'

type MaintainedSlot = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectStore>['findMaintainedStateById']>>
>
type Cleanup = NonNullable<
  ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>['cleanup']
>

/** Deletes the exact failed concentration slot and reconciles its current owners. */
export async function applyLiveConcentrationCleanup(
  ctx: MutationCtx,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    slot: MaintainedSlot
    cleanup: Cleanup
    authorizedCharacterIds: ReadonlySet<string>
    occurredAt: string
  }
) {
  const { state, slot } = input
  const store = createActiveRuleEffectStore(ctx)
  const removed = await store.listDependentEffects({ encounterId: state.id, stateId: slot.id })
  const characterVersions: { characterId: string; beforeStreamVersion: number }[] = []
  for (const characterId of new Set(
    removed.flatMap((effect) =>
      effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []
    )
  )) {
    if (!input.authorizedCharacterIds.has(characterId))
      throw new Error('Live Session concentration owner is outside the captured scope.')
    const row = await readCharacterRow(ctx, characterId)
    if (!row || row.status !== 'ACTIVE' || readCharacterRecord(row).systemId !== state.gameSystemId)
      throw new Error('Maintained-effect Character owner is unavailable.')
    characterVersions.push({ characterId, beforeStreamVersion: row.play.streamVersion })
  }
  characterVersions.sort((left, right) => left.characterId.localeCompare(right.characterId))
  const cleanup = {
    maintainedStateId: slot.id,
    removedDependentEffectIds: removed.map((effect) => effect.id),
    characterOwnerTransitions: characterVersions.map((entry) => ({
      ...entry,
      afterStreamVersion: entry.beforeStreamVersion + 1
    }))
  }
  if (checksumCanonicalJson(cleanup) !== checksumCanonicalJson(input.cleanup))
    throw new Error('Live Session concentration cleanup changed.')
  for (const effect of removed)
    await store.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version
    })
  await store.deleteMaintainedStateCas({
    id: slot.id,
    encounterId: state.id,
    ownerActorId: slot.ownerActorId,
    expectedVersion: slot.version
  })
  return reconcileNativeMaintenanceOwners(ctx, {
    encounterId: state.id,
    maintenance: { removed, characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
}
