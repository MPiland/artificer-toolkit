import {
  characterDocumentSchema,
  readCharacterPlay,
  readCharacterRecord,
  type CharacterDocument
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { z } from 'zod'
import type { characterStoredRecordSchema } from '@artificer-toolkit/schema/projections/characterPersistence'
import {
  assembleCharacterStructure,
  readCharacterBuildFields
} from '@artificer-toolkit/schema/projections/characterOperationalState'
import type { CharacterCollectionTable } from '@artificer-toolkit/schema/projections/characterOperationalRecords'

export { characterDocumentSchema, readCharacterPlay, readCharacterRecord, type CharacterDocument }

/** A Character's play record as written in this transaction; its system creation time is not needed. */
export type CharacterPlayRow = Omit<Doc<'characterPlayStates'>, '_creationTime'>

/**
 * A Character row with its play record joined, as written in this transaction; its system creation
 * time is not needed. The row holds the Builder-owned structure and `play` the play state.
 */
export type CharacterRecordRow = Omit<Doc<'characters'>, '_creationTime'> &
  z.infer<typeof characterStoredRecordSchema> & {
    play: CharacterPlayRow
  }

/** A Character row read from the database, with its play record joined. */
export type CharacterRow = CharacterRecordRow & {
  _creationTime: number
  play: Doc<'characterPlayStates'>
}

/** Complete boundary reads use every indexed owned row; Convex refuses transaction limits rather than truncating. */
export async function readCharacterCollection<Table extends CharacterCollectionTable>(
  ctx: QueryCtx,
  table: Table,
  characterId: string
): Promise<Doc<Table>[]> {
  const rows: Doc<Table>[] = []
  for await (const row of ctx.db
    .query(table as CharacterCollectionTable)
    .withIndex('by_characterId_position', (q) => q.eq('characterId', characterId)))
    // Convex widens a generic index's row type; this query still selects exactly the given table.
    rows.push(row as unknown as Doc<Table>)
  return rows
}

export async function readCharacterPlayRow(ctx: QueryCtx, characterId: string) {
  const play = await ctx.db
    .query('characterPlayStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (!play) throw new Error('Stored Character play state is unavailable.')
  return play
}

/**
 * A Character head's play record and checksum-verified build fields, without hydrating any owned
 * collection: focused reads check the Character's integrity at a cost that does not grow with it.
 */
export async function readVerifiedCharacterBuild(ctx: QueryCtx, head: Doc<'characters'>) {
  const [play, build] = await Promise.all([
    readCharacterPlayRow(ctx, head.id),
    ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', head.id))
      .unique()
  ])
  if (play.userId !== head.userId || play.characterId !== head.id)
    throw new Error('Stored Character identity mismatch.')
  readCharacterPlay(play)
  if (!build) throw new Error('Stored Character build state is unavailable.')
  const { _id, _creationTime, ...buildFields } = build
  return { play, fields: readCharacterBuildFields(head.id, buildFields) }
}

/** Joins the Character row's play record. */
export async function joinCharacterPlay(
  ctx: QueryCtx,
  row: Doc<'characters'>
): Promise<CharacterRow> {
  const [
    play,
    build,
    inventory,
    currency,
    classes,
    spells,
    creatures,
    vehicles,
    notes,
    groups,
    equipment
  ] = await Promise.all([
    readCharacterPlayRow(ctx, row.id),
    ctx.db
      .query('characterBuildStates')
      .withIndex('by_characterId', (q) => q.eq('characterId', row.id))
      .unique(),
    readCharacterCollection(ctx, 'characterInventoryItems', row.id),
    readCharacterCollection(ctx, 'characterCurrencyGroups', row.id),
    readCharacterCollection(ctx, 'characterClassSpellStates', row.id),
    readCharacterCollection(ctx, 'characterSpellCustomizations', row.id),
    readCharacterCollection(ctx, 'characterCreatureInstances', row.id),
    readCharacterCollection(ctx, 'characterVehicleInstances', row.id),
    readCharacterCollection(ctx, 'characterNotes', row.id),
    readCharacterCollection(ctx, 'characterNoteGroups', row.id),
    readCharacterCollection(ctx, 'characterExtraEquipment', row.id)
  ])
  if (!build) throw new Error('Stored Character build state is unavailable.')
  const { _id, _creationTime, ...buildFields } = build
  return {
    ...row,
    ...assembleCharacterStructure(row, buildFields, {
      characterInventoryItems: inventory,
      characterCurrencyGroups: currency,
      characterClassSpellStates: classes,
      characterSpellCustomizations: spells,
      characterCreatureInstances: creatures,
      characterVehicleInstances: vehicles,
      characterNotes: notes,
      characterNoteGroups: groups,
      characterExtraEquipment: equipment
    }),
    play
  }
}

/** The Character row by public ID with its play record joined; null when it does not exist. */
export async function readCharacterRow(
  ctx: QueryCtx,
  characterId: string
): Promise<CharacterRow | null> {
  const row = await readCharacterHead(ctx, characterId)
  return row ? joinCharacterPlay(ctx, row) : null
}

/** Identity and clock reads do not hydrate owned collections or evaluate rules. */
export async function readCharacterHead(ctx: QueryCtx, characterId: string) {
  return ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', characterId))
    .unique()
}

export async function loadCharacterState(
  ctx: QueryCtx,
  characterId: string,
  /** False when the caller already holds the active row it wrote in this transaction. */
  readActive = true
) {
  const [active, draft] = await Promise.all([
    readActive
      ? ctx.db
          .query('characters')
          .withIndex('by_publicId', (q) => q.eq('id', characterId))
          .unique()
          .then((row) => (row ? joinCharacterPlay(ctx, row) : null))
      : null,
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
  ])
  return { active, draft }
}
