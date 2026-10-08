import type { WithoutSystemFields } from 'convex/server'
import { encodeCharacterOperationalStructure } from '@artificer-toolkit/schema/projections/characterOperationalState'
import type {
  CharacterCollectionRecords,
  CharacterCollectionTable,
  CharacterStoredBuildState
} from '@artificer-toolkit/schema/projections/characterOperationalRecords'
import type { z } from 'zod'
import type { characterStoredRecordSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'

type Capture = z.infer<typeof characterStoredRecordSchema>

/** Only changed IDs are read and written; an HP write never enters this structural writer. */
async function syncCollection(
  ctx: MutationCtx,
  table: CharacterCollectionTable,
  before: readonly WithoutSystemFields<Doc<CharacterCollectionTable>>[],
  after: readonly WithoutSystemFields<Doc<CharacterCollectionTable>>[]
) {
  const previous = new Map(before.map((row) => [row.id, row]))
  const seen = new Set<string>()
  for (const row of after) {
    if (seen.has(row.id)) throw new Error('Stored Character collection ID is duplicated.')
    seen.add(row.id)
    const prior = previous.get(row.id)
    previous.delete(row.id)
    if (prior?.checksum === row.checksum) continue
    const stored = await ctx.db
      .query(table)
      .withIndex('by_characterId_id', (q) => q.eq('characterId', row.characterId).eq('id', row.id))
      .unique()
    if (stored) await ctx.db.replace(stored._id, row)
    else await ctx.db.insert(table, row)
  }
  for (const row of previous.values()) {
    const stored = await ctx.db
      .query(table)
      .withIndex('by_characterId_id', (q) => q.eq('characterId', row.characterId).eq('id', row.id))
      .unique()
    if (!stored) throw new Error('Stored Character collection disappeared.')
    await ctx.db.delete(stored._id)
  }
}

type OperationalRecords = {
  build: CharacterStoredBuildState
  collections: Partial<CharacterCollectionRecords>
}

/**
 * Writes the build record and the given collections where they changed from `before`. A focused
 * write passes only the collections it owns; every other record stays unread and unwritten.
 */
export async function writeCharacterOperationalRecords(
  ctx: MutationCtx,
  before: OperationalRecords | null,
  after: OperationalRecords
) {
  if (before?.build.checksum !== after.build.checksum) {
    const stored = await ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', after.build.characterId))
      .unique()
    if (stored) await ctx.db.replace(stored._id, after.build)
    else await ctx.db.insert('characterBuildStates', after.build)
  }
  for (const [table, rows] of Object.entries(after.collections) as [
    CharacterCollectionTable,
    CharacterCollectionRecords[CharacterCollectionTable]
  ][])
    await syncCollection(ctx, table, before?.collections[table] ?? [], rows)
}

/** Shares the caller's transaction and preserves all collection ordering and public IDs. */
export async function writeCharacterOperationalStructure(
  ctx: MutationCtx,
  current: Capture | null,
  next: Capture
) {
  await writeCharacterOperationalRecords(
    ctx,
    current ? encodeCharacterOperationalStructure(current) : null,
    encodeCharacterOperationalStructure(next)
  )
}
