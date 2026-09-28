import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  raceAuthoredDtoSchema,
  type SubraceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'

export async function requireRaceParent(
  ctx: QueryCtx,
  document: SubraceAuthoredDto,
  userId: string | null,
  allowedSourceIds?: ReadonlySet<string>,
  canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>,
  currentImportJobId?: string,
  onRead?: (root: Doc<'authoredRoots'>) => void,
  /** A transaction-scoped root lookup; commit reuses the roots it has already read. */
  readRoot: (id: string) => Promise<Doc<'authoredRoots'> | null> = (id) =>
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
) {
  const parent = await readRoot(document.parentRaceId)
  if (
    document.parentRaceId === document.id ||
    !parent ||
    parent.subjectKind !== 'RACE' ||
    parent.systemId !== document.systemId ||
    parent.parentRaceId !== null ||
    (!(
      (allowedSourceIds === undefined || allowedSourceIds.has(parent.contentSourceId)) &&
      (await canReadAuthoredRoot(ctx, parent, userId, undefined, currentImportJobId))
    ) &&
      !(await canReadSharedRoot?.(parent)))
  )
    throw new Error('A readable base Race in the same System is required.')
  const authored = raceAuthoredDtoSchema.parse(
    await readPublishedDocument(
      ctx,
      parent,
      await readAuthoredVersion(ctx, parent, currentImportJobId)
    )
  )
  if (authored.category !== 'BASE')
    throw new Error('A readable base Race in the same System is required.')
  onRead?.(parent)
  return authored
}

export async function requireEquipmentParents(
  ctx: QueryCtx,
  document: EquipmentAuthoredDto,
  userId: string | null,
  allowedSourceIds?: ReadonlySet<string>,
  canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>,
  currentImportJobId?: string,
  onRead?: (root: Doc<'authoredRoots'>) => void,
  /** A transaction-scoped root lookup; commit reuses the roots it has already read. */
  readRoot: (id: string) => Promise<Doc<'authoredRoots'> | null> = (id) =>
    ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', id))
      .unique()
) {
  const ancestors = new Map<string, EquipmentAuthoredDto>([[document.id, document]])
  let current = document
  while (current.category === 'VARIANT') {
    const parentId = current.parentEquipmentId
    if (ancestors.has(parentId)) throw new Error('Equipment variant cycle detected.')
    if (ancestors.size >= 500) throw new Error('Equipment inheritance exceeds the authoring limit.')
    const root = await readRoot(parentId)
    if (
      !root ||
      root.subjectKind !== 'EQUIPMENT' ||
      root.systemId !== document.systemId ||
      (!(
        (allowedSourceIds === undefined || allowedSourceIds.has(root.contentSourceId)) &&
        (await canReadAuthoredRoot(ctx, root, userId, undefined, currentImportJobId))
      ) &&
        !(await canReadSharedRoot?.(root)))
    )
      throw new Error('Readable parent Equipment in the same System is required.')
    current = equipmentAuthoredDtoSchema.parse(
      await readPublishedDocument(
        ctx,
        root,
        await readAuthoredVersion(ctx, root, currentImportJobId)
      )
    )
    if (
      root.parentEquipmentId !== (current.category === 'VARIANT' ? current.parentEquipmentId : null)
    )
      throw new Error('Stored Equipment parent metadata mismatch.')
    onRead?.(root)
    ancestors.set(current.id, current)
  }
  return ancestors
}
