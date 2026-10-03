import {
  encounterStoreSchemas,
  type EncounterStoreDocuments
} from '@artificer-toolkit/schema/projections/encounterStore'
import {
  canonicalJsonRecordSchema,
  canonicalJsonValueSchema,
  type JsonValue
} from '@artificer-toolkit/schema/shared/jsonDelta'
import { canonicalizeJson } from '@artificer-toolkit/shared/canonicalJson'

/** Canonical checkpoint values decode stored JSON; Character play carries the room's play clock. */
export function decodeCheckpointRecord(
  table: keyof EncounterStoreDocuments,
  fields: Record<string, unknown>
): Record<string, JsonValue> {
  const validated = encounterStoreSchemas[table].parse(fields)
  const decoded = Object.fromEntries(
    Object.entries(validated).flatMap(([field, value]) => {
      if (value === undefined) return []
      if (field.endsWith('Json') && value !== null) {
        if (typeof value !== 'string') throw new Error(`Invalid stored JSON ${table}.${field}.`)
        return [[field, canonicalJsonValueSchema.parse(JSON.parse(value))]]
      }
      return [[field, value]]
    })
  )
  return canonicalJsonRecordSchema.parse(JSON.parse(canonicalizeJson(decoded)))
}

/** Restores storage JSON fields before validating the complete stored shape. */
export function encodeCheckpointRecord<Table extends keyof EncounterStoreDocuments>(
  table: Table,
  fields: Record<string, JsonValue>
): EncounterStoreDocuments[Table] {
  const encoded = Object.fromEntries(
    Object.entries(canonicalJsonRecordSchema.parse(fields)).map(([field, value]) => [
      field,
      field.endsWith('Json') && value !== null ? canonicalizeJson(value) : value
    ])
  )
  // The selected schema restores the correlation between the table and its validated fields.
  return encounterStoreSchemas[table].parse(encoded) as EncounterStoreDocuments[Table]
}
