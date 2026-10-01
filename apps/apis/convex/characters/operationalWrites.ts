import type { WithoutSystemFields } from 'convex/server'
import { encodeCharacterOperationalStructure } from '@artificer-toolkit/schema/projections/characterOperationalState'
import type { CharacterCollectionTable } from '@artificer-toolkit/schema/projections/characterOperationalRecords'
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

/** Shares the caller's transaction and preserves all collection ordering and public IDs. */
export async function writeCharacterOperationalStructure(
  ctx: MutationCtx,
  current: Capture | null,
  next: Capture
) {
  const before = current ? encodeCharacterOperationalStructure(current) : null
  const after = encodeCharacterOperationalStructure(next)
  if (before?.build.checksum !== after.build.checksum) {
    const stored = await ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', next.id))
      .unique()
    if (stored) await ctx.db.replace(stored._id, after.build)
    else await ctx.db.insert('characterBuildStates', after.build)
  }
  await syncCollection(
    ctx,
    'characterInventoryItems',
    before?.collections.characterInventoryItems ?? [],
    after.collections.characterInventoryItems
  )
  await syncCollection(
    ctx,
    'characterCurrencyGroups',
    before?.collections.characterCurrencyGroups ?? [],
    after.collections.characterCurrencyGroups
  )
  await syncCollection(
    ctx,
    'characterClassSpellStates',
    before?.collections.characterClassSpellStates ?? [],
    after.collections.characterClassSpellStates
  )
  await syncCollection(
    ctx,
    'characterSpellCustomizations',
    before?.collections.characterSpellCustomizations ?? [],
    after.collections.characterSpellCustomizations
  )
  await syncCollection(
    ctx,
    'characterCreatureInstances',
    before?.collections.characterCreatureInstances ?? [],
    after.collections.characterCreatureInstances
  )
  await syncCollection(
    ctx,
    'characterVehicleInstances',
    before?.collections.characterVehicleInstances ?? [],
    after.collections.characterVehicleInstances
  )
  await syncCollection(
    ctx,
    'characterNotes',
    before?.collections.characterNotes ?? [],
    after.collections.characterNotes
  )
  await syncCollection(
    ctx,
    'characterNoteGroups',
    before?.collections.characterNoteGroups ?? [],
    after.collections.characterNoteGroups
  )
  await syncCollection(
    ctx,
    'characterExtraEquipment',
    before?.collections.characterExtraEquipment ?? [],
    after.collections.characterExtraEquipment
  )
}
