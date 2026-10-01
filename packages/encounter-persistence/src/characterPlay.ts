import type { EncounterDocument, EncounterReadContext } from './store.js'
import type { z } from 'zod'
import type { characterStoredRecordSchema } from '@artificer-toolkit/schema/projections/characterPersistence'

/** A Character row with its play record joined (ADR 0035 Amendment 12): structure plus play state. */
export type EncounterCharacterRow = EncounterDocument<'characters'> &
  z.infer<typeof characterStoredRecordSchema> & {
    play: EncounterDocument<'characterPlayStates'>
  }

/** The Character's small play record; every Character has one from the moment it is written. */
export async function readEncounterCharacterPlay(ctx: EncounterReadContext, characterId: string) {
  return ctx.db
    .query('characterPlayStates')
    .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
    .unique()
}
