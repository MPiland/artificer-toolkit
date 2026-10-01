import {
  prepareEncounterActionMaintenance,
  persistEncounterActionEffects
} from '@artificer-toolkit/encounter-persistence/actionEffectPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/** Reads replaced maintenance and affected Character versions through the owning transaction. */
export async function prepareLiveEncounterActionMaintenance(
  ctx: MutationCtx,
  input: Parameters<typeof prepareEncounterActionMaintenance>[1]
): ReturnType<typeof prepareEncounterActionMaintenance> {
  return prepareEncounterActionMaintenance(encounterWriteTransaction(ctx), input)
}

/** Persists projected effects and reconciles owners through the owning transaction. */
export async function persistLiveEncounterActionEffects(
  ctx: MutationCtx,
  input: Parameters<typeof persistEncounterActionEffects>[1]
): ReturnType<typeof persistEncounterActionEffects> {
  return persistEncounterActionEffects(encounterWriteTransaction(ctx), input)
}
