import {
  liveSessionCheckpointSceneKeys,
  liveSessionCheckpointSceneSchemas,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import type { RoomTransaction } from './roomEncounterStore.js'

export function readRoomSceneRow(
  transaction: RoomTransaction,
  table: LiveSessionCheckpointSceneTable,
  key: unknown[]
) {
  const record = transaction.record('SCENE_CHECKPOINT_ROW', canonicalizeJson([table, ...key]))
  return record ? canonicalJsonRecordSchema.parse(JSON.parse(record.json)) : null
}

export function writeRoomSceneRow(
  transaction: RoomTransaction,
  table: LiveSessionCheckpointSceneTable,
  value: Record<string, unknown>
) {
  liveSessionCheckpointSceneSchemas[table].parse(value)
  transaction.setRecord({
    kind: 'SCENE_CHECKPOINT_ROW',
    key: canonicalizeJson([
      table,
      ...liveSessionCheckpointSceneKeys[table].map((field) => value[field])
    ]),
    revision: null,
    json: canonicalizeJson(value)
  })
}
