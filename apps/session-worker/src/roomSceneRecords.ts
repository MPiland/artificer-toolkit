import {
  liveSessionCheckpointSceneKeys,
  liveSessionCheckpointSceneSchemas,
  type LiveSessionCheckpointSceneTable
} from '@artificer-toolkit/schema/api/liveSessionCheckpointScenes'
import {
  sceneStoredConcealmentPruneSchema,
  sceneStoredLiveCommandSchema
} from '@artificer-toolkit/schema/projections/sceneLivePersistence'
import { sceneStoredGeometrySaveSchema } from '@artificer-toolkit/schema/projections/sceneGeometryPersistence'
import { parseGeometrySave } from '@artificer-toolkit/encounter-persistence/sceneGeometryDocuments'
import { deriveOnce } from '@artificer-toolkit/encounter-persistence/transactionReads'
import { canonicalJsonRecordSchema } from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'
import { SCENE_EVIDENCE_ROW, type RoomTransaction } from './roomEncounterStore.js'

/**
 * Scene command receipts, geometry saves and concealment prunes back replay by command ID and owner
 * undo. They live only in the room, across epochs, and are dropped once older than this (ADR 0035
 * Amendment 26).
 */
export const SCENE_COMMAND_RETENTION_MS = 30 * 86_400_000

const evidenceSchemas = {
  sceneLiveCommands: sceneStoredLiveCommandSchema,
  sceneGeometrySaves: sceneStoredGeometrySaveSchema,
  sceneConcealmentPrunes: sceneStoredConcealmentPruneSchema
}
const evidenceKeys = {
  sceneLiveCommands: ['sceneId', 'commandId'],
  sceneGeometrySaves: ['id'],
  sceneConcealmentPrunes: ['sceneId', 'commandId']
} as const
type SceneEvidenceTable = keyof typeof evidenceSchemas
type SceneRowTable = LiveSessionCheckpointSceneTable | SceneEvidenceTable

const isEvidence = (table: SceneRowTable): table is SceneEvidenceTable =>
  Object.hasOwn(evidenceSchemas, table)

export function readRoomSceneRow(
  transaction: RoomTransaction,
  table: SceneRowTable,
  key: unknown[]
) {
  const value = transaction.recordValue(
    isEvidence(table) ? SCENE_EVIDENCE_ROW : 'SCENE_CHECKPOINT_ROW',
    canonicalizeJson([table, ...key])
  )
  return value ? deriveOnce(value, parseSceneRow) : null
}

const parseSceneRow = (value: object) => canonicalJsonRecordSchema.parse(value)

/**
 * Evidence is stamped with its write time in `revision`, so retention reads no payload. It is
 * written, not replayed, so the clock does not affect determinism.
 */
export function writeRoomSceneRow(
  transaction: RoomTransaction,
  table: SceneRowTable,
  value: Record<string, unknown>
) {
  const evidence = isEvidence(table)
  const keyFields = evidence ? evidenceKeys[table] : liveSessionCheckpointSceneKeys[table]
  if (evidence) evidenceSchemas[table].parse(value)
  else liveSessionCheckpointSceneSchemas[table].parse(value)
  transaction.setRecord({
    kind: evidence ? SCENE_EVIDENCE_ROW : 'SCENE_CHECKPOINT_ROW',
    key: canonicalizeJson([table, ...keyFields.map((field) => value[field])]),
    revision: evidence ? String(Date.now()) : null,
    json: canonicalizeJson(value)
  })
}

/**
 * The room's geometry saves of one Scene command. A Scene keeps every save of the Run, so only the
 * matches are schema-parsed.
 */
export function readCommandGeometrySaves(
  transaction: RoomTransaction,
  sceneId: string,
  commandId: string
) {
  return transaction
    .records(SCENE_EVIDENCE_ROW)
    .filter((record) => record.key.startsWith('["sceneGeometrySaves",'))
    .map((record): Record<string, unknown> => JSON.parse(record.json))
    .filter((save) => save.sceneId === sceneId && save.commandId === commandId)
    .map(parseGeometrySave)
}
