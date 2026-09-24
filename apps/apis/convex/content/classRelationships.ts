import {
  classAuthoredDtoSchema,
  type SubclassAuthoredDto
} from '@artificer-toolkit/schema/subjects/class'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'

export async function requireClassParent(
  ctx: QueryCtx,
  document: SubclassAuthoredDto,
  userId: string | null,
  allowedSourceIds?: ReadonlySet<string>,
  canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>,
  currentImportJobId?: string,
  onRead?: (root: Doc<'authoredRoots'>) => void
) {
  const parent = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', document.parentClassId))
    .unique()
  if (
    document.parentClassId === document.id ||
    !parent ||
    parent.subjectKind !== 'CLASS' ||
    parent.systemId !== document.systemId ||
    (!(
      (allowedSourceIds === undefined || allowedSourceIds.has(parent.contentSourceId)) &&
      (await canReadAuthoredRoot(ctx, parent, userId, undefined, currentImportJobId))
    ) &&
      !(await canReadSharedRoot?.(parent)))
  )
    throw new Error('A readable base class in the same System is required.')
  const version = await readAuthoredVersion(ctx, parent, currentImportJobId)
  const authored = classAuthoredDtoSchema.parse(await readPublishedDocument(ctx, parent, version))
  if (authored.category !== 'BASE')
    throw new Error('A readable base class in the same System is required.')
  onRead?.(parent)
  return authored
}

export { assertClassRelationshipsIndexed, assertNoClassChildren } from './classRelationshipIndex'
