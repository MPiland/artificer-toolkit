import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  raceAuthoredDtoSchema,
  type SubraceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import type * as z from 'zod/mini'
import type { Doc } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readPublishedDocument,
  readPublishedRootDocument,
  type PublishedDocumentReads
} from './documents'

/**
 * Reads a dependent's stored document for its parent's recompile. A dependent the seed replaces in
 * a later batch is left to that import, which compiles it against the current parent, so its stored
 * document may predate the current schema. Any other dependent must parse; a failure names it.
 */
export async function readRecompiledDependent<T>(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  schema: z.ZodMiniType<T>,
  reimportedIds: ReadonlySet<string>
) {
  if (reimportedIds.has(root.id)) return undefined
  const version = await readAuthoredVersion(ctx, root)
  const parsed = schema.safeParse(await readPublishedDocument(ctx, root, version))
  if (!parsed.success)
    throw new Error(
      `Stored ${root.subjectKind} ${root.id} does not match its current schema at ${parsed.error.issues.map(({ path }) => path.join('.')).join(', ')}.`
    )
  return { version, document: parsed.data }
}

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
      .unique(),
  /** Stored documents read earlier in this transaction. */
  documents?: PublishedDocumentReads
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
    (await readPublishedRootDocument(ctx, parent, documents, currentImportJobId)).document
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
      .unique(),
  /** Stored documents read earlier in this transaction. */
  documents?: PublishedDocumentReads
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
      (await readPublishedRootDocument(ctx, root, documents, currentImportJobId)).document
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
