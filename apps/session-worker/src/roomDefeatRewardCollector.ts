import { reducedToZeroHitPoints } from '@artificer-toolkit/rules-runtime/encounterDefeatReward'
import type { ReceiptApplications } from '@artificer-toolkit/rules-runtime/encounterCharacterMechanicsBatch'
import type { EncounterActorDispositionDto } from '@artificer-toolkit/schema/api/encounterData'
import type { RoomTransaction } from './roomEncounterStore.js'

type CollectedDefeat = {
  killerActorId: string
  defeatedDisposition: EncounterActorDispositionDto
  occurrenceId: string
  rootCommandId: string
}

const collected = new WeakMap<
  RoomTransaction,
  { entries: CollectedDefeat[]; settledBatches: number }
>()

/** The defeats a command's transaction has collected and the reward batches it has settled. */
export function defeatRewardLedger(transaction: RoomTransaction) {
  const existing = collected.get(transaction)
  if (existing) return existing
  const created = { entries: [], settledBatches: 0 }
  collected.set(transaction, created)
  return created
}

/**
 * The commit seam's check that every damage-applying path settled its defeats: a path that
 * collected a creature reduced to 0 hit points and never called `settleDefeatRewards` fails its
 * command here, rather than leaving a killer without what the defeat grants.
 */
export function assertDefeatRewardsSettled(transaction: RoomTransaction) {
  if (collected.get(transaction)?.entries.length)
    throw new Error('Collected defeat rewards were never settled.')
}

/**
 * Notes that a damager reduced a creature to 0 hit points, as the committed receipt shows it, so the
 * command's `settleDefeatRewards` can give the damager what its defeat grants once the root's own
 * settlement is done. A creature that is its own damager is no defeat to reward.
 */
export function collectDefeatReward(
  transaction: RoomTransaction,
  input: {
    killerActorId: string | undefined
    defeatedActorId: string
    defeatedDisposition: EncounterActorDispositionDto
    occurrenceId: string
    rootCommandId: string
    receiptApplications: ReceiptApplications
  }
) {
  const { killerActorId, ...defeat } = input
  if (
    killerActorId === undefined ||
    killerActorId === input.defeatedActorId ||
    !reducedToZeroHitPoints(input.receiptApplications)
  )
    return
  defeatRewardLedger(transaction).entries.push({
    killerActorId,
    defeatedDisposition: defeat.defeatedDisposition,
    occurrenceId: defeat.occurrenceId,
    rootCommandId: defeat.rootCommandId
  })
}
