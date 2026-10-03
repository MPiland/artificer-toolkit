import {
  liveSessionCheckpointRetainedRollSchema,
  type LiveSessionCheckpointRetainedRoll
} from '@artificer-toolkit/schema/api/liveSessionCheckpointRecords'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomEncounterStore, RoomTransaction } from './roomEncounterStore.js'

export const ROOM_PRIVATE_ROLL = 'PRIVATE_ROLL_CHECKPOINT'

/**
 * The journal retains every append until checkpoint acknowledgement; visible history keeps twenty.
 * Only committed rolls expire: a roll set and deleted in one command would never reach the journal,
 * so a command's own appends stay until the next command trims them.
 */
export function retainRoomPrivateRoll(
  store: RoomEncounterStore,
  transaction: RoomTransaction,
  supplied: LiveSessionCheckpointRetainedRoll
) {
  const value = liveSessionCheckpointRetainedRollSchema.parse(supplied)
  const key = canonicalizeJson([value.userId, value.record.id])
  const json = canonicalizeJson(value)
  const previous = transaction.record(ROOM_PRIVATE_ROLL, key)
  if (previous) {
    if (previous.json !== json) throw new Error('Private roll ID was used with different evidence.')
    return
  }
  transaction.setRecord({ kind: ROOM_PRIVATE_ROLL, key, revision: null, json })
  const retained = transaction
    .records(ROOM_PRIVATE_ROLL)
    .map((record) => ({
      key: record.key,
      value: liveSessionCheckpointRetainedRollSchema.parse(JSON.parse(record.json))
    }))
    .filter((record) => record.value.userId === value.userId)
    .sort(
      (left, right) =>
        right.value.record.createdAt.localeCompare(left.value.record.createdAt) ||
        right.value.record.id.localeCompare(left.value.record.id)
    )
  for (const expired of retained.slice(20))
    if (store.record(ROOM_PRIVATE_ROLL, expired.key))
      transaction.deleteRecord(ROOM_PRIVATE_ROLL, expired.key)
}
