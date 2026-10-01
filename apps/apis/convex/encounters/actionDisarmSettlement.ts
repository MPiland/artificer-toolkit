import { settleDisarm as settleSharedDisarm } from '@artificer-toolkit/encounter-persistence/disarmSettlement'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from './encounterPorts'

/** Settles Disarm through the owning Convex Character write transaction. */
export async function settleDisarm(
  ctx: MutationCtx,
  input: Parameters<typeof settleSharedDisarm>[1]
): ReturnType<typeof settleSharedDisarm> {
  return settleSharedDisarm(encounterWriteTransaction(ctx), input)
}
