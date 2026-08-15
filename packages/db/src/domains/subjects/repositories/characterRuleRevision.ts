import type { DBLike } from '#types'

export async function setCharacterRulePackRevision(
  db: DBLike,
  characterId: string,
  expectedRevisionId: string,
  revisionId: string
): Promise<boolean> {
  const result = await db
    .updateTable('characters')
    .set({ rule_pack_revision_id: revisionId })
    .where('id', '=', characterId)
    .where('rule_pack_revision_id', '=', expectedRevisionId)
    .returning('id')
    .executeTakeFirst()
  return result !== undefined
}
