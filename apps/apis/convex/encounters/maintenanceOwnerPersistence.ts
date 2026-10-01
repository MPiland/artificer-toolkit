import { reconcileNativeMaintenanceOwners as reconcileMaintenanceOwners } from '@artificer-toolkit/encounter-persistence/maintenanceOwnerPersistence'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from './encounterPorts'

/** Reconciles owners in the existing Convex Character write transaction. */
export function reconcileNativeMaintenanceOwners(
  ctx: MutationCtx,
  input: Parameters<typeof reconcileMaintenanceOwners>[1]
) {
  return reconcileMaintenanceOwners(encounterWriteTransaction(ctx), input)
}
