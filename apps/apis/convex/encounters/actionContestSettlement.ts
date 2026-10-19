import { settleContest as settleSharedContest } from '@artificer-toolkit/encounter-persistence/contestSettlement'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from './encounterPorts'

/** Settles a contest through the owning Convex Character write transaction. */
export async function settleContest(
  ctx: MutationCtx,
  input: Parameters<typeof settleSharedContest>[1]
): ReturnType<typeof settleSharedContest> {
  return settleSharedContest(encounterWriteTransaction(ctx), input)
}
