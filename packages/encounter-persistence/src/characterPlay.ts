import type { EncounterDocument, EncounterReadContext } from './store.js'

/** A Character row with its play record joined (ADR 0035 Amendment 12): structure plus play state. */
export type EncounterCharacterRow = EncounterDocument<'characters'> & {
  play: EncounterDocument<'characterPlayStates'>
}

/** The Character's small play record; every Character has one from the moment it is written. */
export async function readEncounterCharacterPlay(ctx: EncounterReadContext, characterId: string) {
  return ctx.db
    .query('characterPlayStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}

/** The Character row by public ID, with its play record joined; null when it does not exist. */
export async function readEncounterCharacterRow(
  ctx: EncounterReadContext,
  characterId: string
): Promise<EncounterCharacterRow | null> {
  const [row, play] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique(),
    readEncounterCharacterPlay(ctx, characterId)
  ])
  if (!row) return null
  if (!play) throw new Error('Stored Character play state is unavailable.')
  return { ...row, play }
}
