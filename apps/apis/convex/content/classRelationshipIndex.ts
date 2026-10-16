import type { QueryCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'

export async function assertClassRelationshipsIndexed(ctx: QueryCtx, systemId: string) {
  // Fail closed until exact canonical replay has indexed every imported Class relationship.
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentClassId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'CLASS').eq('parentClassId', undefined)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId))
      throw new Error('Class parent metadata backfill is incomplete.')
  }
}

export async function assertNoClassChildren(ctx: QueryCtx, systemId: string, classId: string) {
  await assertClassRelationshipsIndexed(ctx, systemId)
  const dependents: string[] = []
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentClassId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'CLASS').eq('parentClassId', classId)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId)) dependents.push(root.id)
  }
  if (dependents.length > 0)
    throw new Error(
      `A class with published subclasses cannot be deleted or made a subclass. Subclasses: ${dependents.join(', ')}.`
    )
}
