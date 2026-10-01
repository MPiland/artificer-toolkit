import { persistEncounterActionChildren } from '@artificer-toolkit/encounter-persistence/actionChildrenPersistence'
import type { MutationCtx } from '../_generated/server'
import {
  bindLiveConcentrationApplications,
  persistLiveEncounterConcentrationChildren
} from './encounterConcentrationChildrenCommit'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/** Persists children through the owning transaction and native concentration bindings. */
export async function persistLiveEncounterActionChildren(
  ctx: MutationCtx,
  args: Parameters<typeof persistEncounterActionChildren>[1]
): ReturnType<typeof persistEncounterActionChildren> {
  return persistEncounterActionChildren(encounterWriteTransaction(ctx), args, {
    bindConcentrationApplications: (state, applications) =>
      bindLiveConcentrationApplications(ctx, state, applications),
    persistConcentrationChildren: (input) => persistLiveEncounterConcentrationChildren(ctx, input)
  })
}
