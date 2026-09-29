import {
  characterDocumentSchema,
  readCharacterPlay,
  readCharacterRecord,
  type CharacterDocument
} from '@artificer-toolkit/schema/projections/characterStoredState'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export { characterDocumentSchema, readCharacterPlay, readCharacterRecord, type CharacterDocument }

/** A Character's play record as written in this transaction; its system creation time is not needed. */
export type CharacterPlayRow = Omit<Doc<'characterPlayStates'>, '_creationTime'>

/**
 * A Character row with its play record joined, as written in this transaction; its system creation
 * time is not needed. The row holds the Builder-owned structure and `play` the play state.
 */
export type CharacterRecordRow = Omit<Doc<'characters'>, '_creationTime'> & {
  play: CharacterPlayRow
}

/** A Character row read from the database, with its play record joined. */
export type CharacterRow = Doc<'characters'> & { play: Doc<'characterPlayStates'> }

export async function readCharacterPlayRow(ctx: QueryCtx, characterId: string) {
  const play = await ctx.db
    .query('characterPlayStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
  if (!play) throw new Error('Stored Character play state is unavailable.')
  return play
}

/** Joins the Character row's play record. */
export async function joinCharacterPlay(
  ctx: QueryCtx,
  row: Doc<'characters'>
): Promise<CharacterRow> {
  return { ...row, play: await readCharacterPlayRow(ctx, row.id) }
}

/** The Character row by public ID with its play record joined; null when it does not exist. */
export async function readCharacterRow(
  ctx: QueryCtx,
  characterId: string
): Promise<CharacterRow | null> {
  const row = await ctx.db
    .query('characters')
    .withIndex('by_publicId', (q) => q.eq('id', characterId))
    .unique()
  return row ? joinCharacterPlay(ctx, row) : null
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
