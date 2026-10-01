import {
  serverRuleExecutionPendingSnapshotDtoSchema,
  type ServerRuleExecutionPendingSnapshotDto
} from '@artificer-toolkit/schema/shared/ruleExecutionPendingSnapshots'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import type { JsonDelta, JsonValue } from '@artificer-toolkit/schema/shared/jsonDelta'
import { applyJsonDelta, diffJson } from './jsonDelta.js'
import type { EncounterDocument, EncounterReadContext, EncounterWriteContext } from './store.js'

/**
 * A pending occurrence's sealed snapshot is stored in parts beside it (ADR 0035 Amendment 12): a
 * base, then one delta per update, so a tied initiative-order choice writes only what it changed.
 * The occurrence keeps the whole snapshot's checksum; a reader rebuilds the snapshot from its parts
 * and checks it. A delta that is not much smaller than the base, or a chain at this bound, starts a
 * new base.
 */
const MAX_PENDING_SNAPSHOT_PARTS = 128

type StoredPart = { base: JsonValue } | { delta: JsonDelta }
type PendingOccurrence = Pick<
  EncounterDocument<'encounterRuleOccurrences'>,
  'id' | 'encounterId' | 'pendingSnapshotChecksum'
>

async function readParts(ctx: EncounterReadContext, occurrenceId: string) {
  const parts = await ctx.db
    .query('encounterPendingSnapshotParts')
    .withIndex('by_occurrenceId_sequence', (q) => q.eq('occurrenceId', occurrenceId))
    .take(MAX_PENDING_SNAPSHOT_PARTS + 1)
  if (parts.length > MAX_PENDING_SNAPSHOT_PARTS)
    throw new Error('Pending snapshot parts exceed the supported bound.')
  return parts
}

function assemble(parts: readonly EncounterDocument<'encounterPendingSnapshotParts'>[]) {
  let value: JsonValue | undefined
  for (const part of parts) {
    const stored = JSON.parse(part.partJson) as StoredPart
    if ('base' in stored === (value !== undefined))
      throw new Error('Pending snapshot parts are out of order.')
    value = 'base' in stored ? stored.base : applyJsonDelta(value!, stored.delta)
  }
  if (value === undefined) throw new Error('Pending snapshot is unavailable.')
  return value
}

const parsedSnapshots = new WeakMap<object, Map<string, ServerRuleExecutionPendingSnapshotDto>>()

/**
 * An occurrence's pending snapshot rebuilt from its parts and checked against its stored checksum,
 * or null when it has none. It is parsed once per transaction and checksum, however often read.
 */
export async function readPendingSnapshot(
  ctx: EncounterReadContext,
  occurrence: PendingOccurrence
): Promise<ServerRuleExecutionPendingSnapshotDto | null> {
  const checksum = occurrence.pendingSnapshotChecksum
  if (checksum === null) return null
  const parts = await readParts(ctx, occurrence.id)
  let parsed = parsedSnapshots.get(ctx.db)
  if (!parsed) parsedSnapshots.set(ctx.db, (parsed = new Map()))
  const known = parsed.get(checksum)
  if (known) return known
  const value = assemble(parts)
  if (checksumCanonicalJson(value) !== checksum)
    throw new Error('Pending snapshot does not match its checksum.')
  const snapshot = serverRuleExecutionPendingSnapshotDtoSchema.parse(value)
  parsed.set(checksum, snapshot)
  return snapshot
}

/**
 * Stores `snapshot` as the occurrence's pending snapshot, or removes it when null, and returns the
 * checksum the occurrence stores. The caller writes the occurrence in the same transaction.
 */
export async function writePendingSnapshot(
  ctx: EncounterWriteContext,
  occurrence: Pick<PendingOccurrence, 'id' | 'encounterId'>,
  snapshot: ServerRuleExecutionPendingSnapshotDto | null
): Promise<string | null> {
  const parts = await readParts(ctx, occurrence.id)
  if (snapshot === null) {
    for (const part of parts) await ctx.db.delete(part._id)
    return null
  }
  const next = JSON.parse(JSON.stringify(snapshot)) as JsonValue
  const checksum = checksumCanonicalJson(snapshot)
  const last = parts.at(-1)
  if (last && parts.length < MAX_PENDING_SNAPSHOT_PARTS) {
    const delta = diffJson(assemble(parts), next)
    if (!delta) return checksum
    const partJson = JSON.stringify({ delta } satisfies StoredPart)
    if (partJson.length * 2 < parts[0]!.partJson.length) {
      await ctx.db.insert('encounterPendingSnapshotParts', {
        encounterId: occurrence.encounterId,
        occurrenceId: occurrence.id,
        sequence: last.sequence + 1,
        partJson
      })
      return checksum
    }
  }
  for (const part of parts) await ctx.db.delete(part._id)
  await ctx.db.insert('encounterPendingSnapshotParts', {
    encounterId: occurrence.encounterId,
    occurrenceId: occurrence.id,
    sequence: 0,
    partJson: JSON.stringify({ base: next } satisfies StoredPart)
  })
  return checksum
}
