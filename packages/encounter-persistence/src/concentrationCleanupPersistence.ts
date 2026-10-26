import type {
  EncounterRunActorState,
  EncounterRunState
} from '@artificer-toolkit/schema/projections/encounterRunState'
import type { concentrationCheckApplicationOutputDtoSchema } from '@artificer-toolkit/schema/shared/ruleExecutionDamageSaveOutputs'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { EncounterCharacterWriteTransaction } from './ports.js'
import { reconcileNativeMaintenanceOwners } from './maintenanceOwnerPersistence.js'
import { createActiveRuleEffectStore } from './effectStore.js'
import { recordConcentrationCaster } from './actionEffectPersistence.js'
import { deleteStateZones, listStateZones } from './maintainedStateZones.js'

type MaintainedSlot = NonNullable<
  Awaited<ReturnType<ReturnType<typeof createActiveRuleEffectStore>['findMaintainedStateById']>>
>
type Cleanup = NonNullable<
  ReturnType<typeof concentrationCheckApplicationOutputDtoSchema.parse>['cleanup']
>

/**
 * The cleanup a concentration slot's end implies, read from the current dependents and Character
 * owners. A Character in advancedCharacterIds already took its stream-version increment in this
 * transaction, which the cleanup shares instead of adding a second one.
 */
export async function deriveLiveConcentrationCleanup(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    slot: MaintainedSlot
    authorizedCharacterIds: ReadonlySet<string>
    advancedCharacterIds?: ReadonlySet<string>
  }
) {
  const { state, slot } = input
  const store = createActiveRuleEffectStore(ctx)
  const removed = await store.listDependentEffects({ encounterId: state.id, stateId: slot.id })
  const zones = await listStateZones(ctx, { encounterId: state.id, stateId: slot.id })
  const characterVersions: { characterId: string; beforeStreamVersion: number }[] = []
  for (const characterId of new Set(
    removed.flatMap((effect) =>
      effect.owner.kind === 'CHARACTER' ? [effect.owner.characterId] : []
    )
  )) {
    if (!input.authorizedCharacterIds.has(characterId))
      throw new Error('Live Session concentration owner is outside the captured scope.')
    const row = await ctx.ports.readCharacterRow(characterId)
    if (
      !row ||
      row.status !== 'ACTIVE' ||
      ctx.ports.readCharacterRecord(row).systemId !== state.gameSystemId
    )
      throw new Error('Maintained-effect Character owner is unavailable.')
    characterVersions.push({
      characterId,
      beforeStreamVersion:
        row.play.streamVersion - (input.advancedCharacterIds?.has(characterId) ? 1 : 0)
    })
  }
  characterVersions.sort((left, right) => left.characterId.localeCompare(right.characterId))
  const cleanup = {
    maintainedStateId: slot.id,
    removedDependentEffectIds: removed.map((effect) => effect.id),
    removedZoneIds: zones.map((zone) => zone.id),
    characterOwnerTransitions: characterVersions.map((entry) => ({
      ...entry,
      afterStreamVersion: entry.beforeStreamVersion + 1
    }))
  }
  return { removed, zones, characterVersions, cleanup }
}

/** Deletes the exact failed concentration slot and reconciles its current owners. */
export async function applyLiveConcentrationCleanup(
  ctx: EncounterCharacterWriteTransaction,
  input: {
    state: EncounterRunState
    actors: EncounterRunActorState[]
    slot: MaintainedSlot
    cleanup: Cleanup
    authorizedCharacterIds: ReadonlySet<string>
    advancedCharacterIds?: ReadonlySet<string>
    occurredAt: string
  }
) {
  const { state, slot } = input
  const store = createActiveRuleEffectStore(ctx)
  const { removed, zones, characterVersions, cleanup } = await deriveLiveConcentrationCleanup(
    ctx,
    input
  )
  if (checksumCanonicalJson(cleanup) !== checksumCanonicalJson(input.cleanup))
    throw new Error('Live Session concentration cleanup changed.')
  for (const effect of removed)
    await store.deleteCas({
      id: effect.id,
      owner: effect.owner,
      expectedVersion: effect.version,
      removal: 'ENDED'
    })
  await deleteStateZones(ctx, zones)
  await store.deleteMaintainedStateCas({
    id: slot.id,
    encounterId: state.id,
    ownerActorId: slot.ownerActorId,
    expectedVersion: slot.version,
    removal: 'ENDED'
  })
  // D151: a reinstated carried Concentration's end reaches the caster's grants outside the Run too.
  const { provenance } = slot.descriptor
  if (provenance.kind === 'CARRIED')
    await recordConcentrationCaster(ctx, state.id, provenance.casterCharacterId)
  return reconcileNativeMaintenanceOwners(ctx, {
    encounterId: state.id,
    maintenance: { removed, characterVersions },
    actors: input.actors,
    occurredAt: input.occurredAt
  })
}
