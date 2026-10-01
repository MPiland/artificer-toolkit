import {
  bindEncounterConcentrationApplications,
  persistEncounterConcentrationChildren
} from '@artificer-toolkit/encounter-persistence/concentrationChildrenPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'
import { applyLiveConcentrationCleanup } from './concentrationCleanupCommit'
import { readLiveCharacterStreamVersion } from './encounterMovementTargetState'

/** Binds a parent's damage to the concentration each target currently maintains. */
export async function bindLiveConcentrationApplications(
  ctx: MutationCtx,
  state: Parameters<typeof bindEncounterConcentrationApplications>[1],
  applications: Parameters<typeof bindEncounterConcentrationApplications>[2]
) {
  return bindEncounterConcentrationApplications(encounterWriteTransaction(ctx), state, applications)
}

/** Persists a damage chain using the owning Character reader and concentration cleanup writer. */
export async function persistLiveEncounterConcentrationChildren(
  ctx: MutationCtx,
  args: Parameters<typeof persistEncounterConcentrationChildren>[1]
) {
  return persistEncounterConcentrationChildren(encounterWriteTransaction(ctx), args, {
    currentCharacterStreamVersion: (characterId) =>
      readLiveCharacterStreamVersion(ctx, args.state, characterId),
    applyCleanup: (cleanup) => applyLiveConcentrationCleanup(ctx, cleanup)
  })
}
