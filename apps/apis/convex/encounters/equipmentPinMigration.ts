import { Migrations } from '@convex-dev/migrations'
import { jsonValueSchema, type JsonValue } from '@artificer-toolkit/schema/projections/identity'
import {
  checksumActorSnapshot,
  runActorPlayState
} from '@artificer-toolkit/rules-runtime/encounterActorStorage'
import {
  ensureActorSnapshot,
  readActorSnapshot,
  releaseActorSnapshot
} from '@artificer-toolkit/encounter-persistence/actorSnapshots'
import {
  readStoredRunActor,
  serializeStoredRunActor
} from '@artificer-toolkit/encounter-persistence/actorProjectionFacts'
import { checksumCanonicalJson } from '@artificer-toolkit/shared/canonicalJson'
import { components } from '../_generated/api'
import type { MutationCtx } from '../_generated/server'
import schema from '../schema'
import { readAuthoredVersionCompilation } from '../content/documents'
import { createConvexEncounterStore } from '../lib/convexEncounterStore'
import { internalMutation } from '../lib/mutations'

/**
 * D163: a Creature's pinned loadout Equipment stores the stored compilation of the pinned version
 * (`compilation`) instead of its authored `payload`, and the room never compiles it. Rewrites every
 * stored pin of the old shape, in Blueprints and in Run actor snapshots. A snapshot's checksum
 * covers its pins, so a Run actor's snapshot moves to a new row and the actor's references follow.
 * Run `content/compilationMigration` first: a superseded or missing compilation fails the row.
 * Idempotent: a pin that carries a `compilation` is left alone.
 */
const migrations = new Migrations(components.migrations, { schema, internalMutation })

function isRecord(value: unknown): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function currentPin(ctx: MutationCtx, source: JsonValue): Promise<JsonValue> {
  if (!isRecord(source) || !('payload' in source)) return source
  const { payload: _payload, ...kept } = source
  const versionId = kept.sourceVersionId
  if (typeof versionId !== 'string') throw new Error('Encounter Equipment pin has no version.')
  const compilation = await readAuthoredVersionCompilation(ctx, { versionId })
  if (!compilation) throw new Error('Pinned Equipment compilation is missing.')
  return {
    ...kept,
    sourceChecksum: compilation.authoredChecksum,
    compilation: jsonValueSchema.parse(compilation)
  }
}

/** The snapshot with every legacy pin replaced; the same value when nothing is legacy. */
async function currentSnapshot(ctx: MutationCtx, snapshot: JsonValue): Promise<JsonValue> {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.equipmentSources)) return snapshot
  const equipmentSources = await Promise.all(
    snapshot.equipmentSources.map((source) => currentPin(ctx, source))
  )
  return { ...snapshot, equipmentSources }
}

/** The checksum of the Run's current snapshot for the one stored under `checksum`. */
async function currentSnapshotChecksum(ctx: MutationCtx, encounterId: string, checksum: string) {
  const store = { db: createConvexEncounterStore(ctx) }
  const snapshot = await currentSnapshot(ctx, await readActorSnapshot(store, encounterId, checksum))
  const current = checksumActorSnapshot(snapshot)
  if (current !== checksum) await ensureActorSnapshot(store, encounterId, current, snapshot)
  return current
}

export const blueprintEquipmentPins = migrations.define({
  table: 'encounterBlueprints',
  // Blueprint enemies can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const enemies: JsonValue = JSON.parse(row.enemiesJson)
    if (!Array.isArray(enemies)) return
    const current = await Promise.all(
      enemies.map(async (enemy) =>
        isRecord(enemy) && enemy.snapshot !== undefined
          ? { ...enemy, snapshot: await currentSnapshot(ctx, enemy.snapshot) }
          : enemy
      )
    )
    const enemiesJson = JSON.stringify(current)
    if (enemiesJson === row.enemiesJson) return
    await ctx.db.patch(row._id, {
      enemiesJson,
      setupChecksum: checksumCanonicalJson({ name: row.name, enemies: current })
    })
  }
})

export const runActorEquipmentPins = migrations.define({
  table: 'encounterRunActors',
  // Actor state can approach the document size limit.
  batchSize: 1,
  migrateOne: async (ctx, row) => {
    const snapshotChecksum = await currentSnapshotChecksum(
      ctx,
      row.encounterId,
      row.snapshotChecksum
    )
    const formOriginSnapshotChecksum =
      typeof row.formOriginSnapshotChecksum === 'string'
        ? await currentSnapshotChecksum(ctx, row.encounterId, row.formOriginSnapshotChecksum)
        : row.formOriginSnapshotChecksum
    if (
      snapshotChecksum === row.snapshotChecksum &&
      formOriginSnapshotChecksum === row.formOriginSnapshotChecksum
    )
      return
    const stored = readStoredRunActor(row)
    const actor =
      stored.kind !== 'CHARACTER' && stored.form !== null && formOriginSnapshotChecksum
        ? {
            ...stored,
            snapshotChecksum,
            form: {
              ...stored.form,
              origin: { ...stored.form.origin, snapshotChecksum: formOriginSnapshotChecksum }
            }
          }
        : { ...stored, snapshotChecksum }
    await ctx.db.patch(row._id, {
      snapshotChecksum,
      formOriginSnapshotChecksum,
      stateJson: serializeStoredRunActor(actor),
      stateChecksum: checksumCanonicalJson(runActorPlayState(actor))
    })
    const store = { db: createConvexEncounterStore(ctx) }
    await releaseActorSnapshot(store, row.encounterId, row.snapshotChecksum)
    if (typeof row.formOriginSnapshotChecksum === 'string')
      await releaseActorSnapshot(store, row.encounterId, row.formOriginSnapshotChecksum)
  }
})
