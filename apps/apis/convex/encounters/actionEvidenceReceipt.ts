import { insertActionEvidenceReceipt as insertSharedActionEvidenceReceipt } from '@artificer-toolkit/encounter-persistence/actionEvidenceReceipt'
import type { MutationCtx } from '../_generated/server'
import { encounterWriteTransaction } from './encounterPorts'

export function insertActionEvidenceReceipt(
  ctx: MutationCtx,
  input: Parameters<typeof insertSharedActionEvidenceReceipt>[1]
) {
  return insertSharedActionEvidenceReceipt(encounterWriteTransaction(ctx), input)
}
