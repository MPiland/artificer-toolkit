import { applyLiveConcentrationCleanup as applyConcentrationCleanup } from '@artificer-toolkit/encounter-persistence/concentrationCleanupPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from '../encounters/encounterPorts'

/** Applies cleanup through the owning Convex Character write transaction. */
export function applyLiveConcentrationCleanup(
  ctx: MutationCtx,
  input: Parameters<typeof applyConcentrationCleanup>[1]
) {
  return applyConcentrationCleanup(encounterWriteTransaction(ctx), input)
}
