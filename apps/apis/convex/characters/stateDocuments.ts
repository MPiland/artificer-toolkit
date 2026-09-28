import * as zMini from 'zod/mini'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export const characterDocumentSchema = zMini.omit(characterAuthoredDtoSchema, {
  primaryRulesCatalogueId: true
})
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
      : null,
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
  ])
  return { active, draft }
}

/** A Character row as written in this transaction; its system creation time is not needed. */
export type CharacterRecordRow = Omit<Doc<'characters'>, '_creationTime'>

export function readCharacterRecord(record: CharacterRecordRow) {
  const raw: unknown = JSON.parse(record.documentJson)
  if (checksumRuleDocument(raw) !== record.checksum)
    throw new Error('Stored Character checksum mismatch.')
  const character = characterDocumentSchema.parse(raw)
  if (
    character.id !== record.id ||
    character.userId !== record.userId ||
    character.systemId !== record.systemId ||
    character.label !== record.label ||
    character.status !== record.status
  )
    throw new Error('Stored Character identity mismatch.')
  return character
}
