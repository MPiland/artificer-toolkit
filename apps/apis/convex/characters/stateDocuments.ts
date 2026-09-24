import * as zMini from 'zod/mini'
import { characterAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/character'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'

export const characterDocumentSchema = zMini.omit(characterAuthoredDtoSchema, {
  primaryRulesCatalogueId: true
})
export async function loadCharacterState(ctx: QueryCtx, characterId: string) {
  const [active, draft] = await Promise.all([
    ctx.db
      .query('characters')
      .withIndex('by_publicId', (q) => q.eq('id', characterId))
      .unique(),
    ctx.db
      .query('characterDrafts')
      .withIndex('by_characterId', (q) => q.eq('characterId', characterId))
      .unique()
  ])
  return { active, draft }
}

export function readCharacterRecord(record: Doc<'characters'>) {
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
