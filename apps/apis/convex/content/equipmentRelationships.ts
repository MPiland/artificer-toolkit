import {
  equipmentAuthoredDtoSchema,
  type EquipmentAuthoredDto
} from '@artificer-toolkit/schema/subjects/equipment'
import {
  resolveEquipmentAuthored,
  type ResolvedEquipment
} from '@artificer-toolkit/shared/subjects/compilers'
import type { EquipmentAuthored } from '@artificer-toolkit/shared/authored'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import {
  canReadAuthoredRoot,
  replaceAuthoredVersionCompilation,
  type PublishedDocumentReads
} from './documents'
import { compilePublicationDocument } from './publicationDocument'
import { equipmentOptionFacts } from '@artificer-toolkit/rules-runtime/character/equipmentOptionFacts'
import { isImportRowVisible } from '../imports/visibility'
import { readRecompiledDependent, requireEquipmentParents } from './relationshipReads'

export async function assertEquipmentRelationshipsIndexed(ctx: QueryCtx, systemId: string) {
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentEquipmentId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'EQUIPMENT').eq('parentEquipmentId', undefined)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId))
      throw new Error('Equipment parent metadata backfill is incomplete.')
  }
}

/** The effective Equipment over its validated parents; read paths stop here and never compile (D163). */
export async function resolveCurrentEquipment(
  ctx: QueryCtx,
  document: EquipmentAuthoredDto,
  userId: string | null,
  allowedSourceIds?: ReadonlySet<string>,
  canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>,
  currentImportJobId?: string,
  readRoot?: (id: string) => Promise<Doc<'authoredRoots'> | null>,
  documents?: PublishedDocumentReads
) {
  const ancestors = await requireEquipmentParents(
    ctx,
    document,
    userId,
    allowedSourceIds,
    canReadSharedRoot,
    currentImportJobId,
    undefined,
    readRoot,
    documents
  )
  // The DTO validates conditional CLASS_LEVEL charge IDs with superRefine; its inferred
  // type cannot express that narrowing. Keep the compiler-type bridge after schema validation.
  const effective = resolveEquipmentAuthored(
    document as EquipmentAuthored,
    (id) => ancestors.get(id) as EquipmentAuthored | undefined
  )
  return { effective, documentsById: ancestors }
}

/** The resolved Equipment and its compilation, for the paths that store one. */
export async function compileCurrentEquipment(...args: Parameters<typeof resolveCurrentEquipment>) {
  const resolved = await resolveCurrentEquipment(...args)
  return {
    ...resolved,
    compilation: compilePublicationDocument(
      { subjectKind: 'EQUIPMENT', document: args[1] },
      resolved.effective
    )
  }
}

export async function assertNoEquipmentChildren(
  ctx: QueryCtx,
  systemId: string,
  equipmentId: string
) {
  await assertEquipmentRelationshipsIndexed(ctx, systemId)
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentEquipmentId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'EQUIPMENT').eq('parentEquipmentId', equipmentId)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId))
      throw new Error('Equipment with published variants cannot be deleted.')
  }
}

export async function recompileEquipmentChildren(
  ctx: MutationCtx,
  published: ResolvedEquipment,
  userId: string | null,
  reimportedIds: ReadonlySet<string> = new Set()
) {
  // Parent-first traversal carries the validated effective parent, so each descendant's
  // source is read and compiled once within this mutation; nothing survives the transaction.
  const parents = [published]
  const visited = new Set([published.id])
  for (const parent of parents) {
    const children = await ctx.db
      .query('authoredRoots')
      .withIndex('by_system_kind_parentEquipmentId', (q) =>
        q
          .eq('systemId', published.systemId)
          .eq('subjectKind', 'EQUIPMENT')
          .eq('parentEquipmentId', parent.id)
      )
      .take(501 - visited.size)
    if (visited.size + children.length > 500)
      throw new Error('Equipment inheritance exceeds the authoring limit.')
    for (const root of children) {
      if (!(await isImportRowVisible(ctx, root.importJobId))) continue
      if (visited.has(root.id)) throw new Error('Equipment variant cycle detected.')
      if (
        root.ownerUserId !== (userId ?? undefined) ||
        !(await canReadAuthoredRoot(ctx, root, userId))
      )
        throw new Error('Equipment dependent ownership mismatch.')
      const dependent = await readRecompiledDependent(
        ctx,
        root,
        equipmentAuthoredDtoSchema,
        reimportedIds
      )
      if (!dependent) continue
      const { version, document } = dependent
      if (document.category !== 'VARIANT' || document.parentEquipmentId !== parent.id)
        throw new Error('Stored Equipment parent metadata mismatch.')
      const effective = resolveEquipmentAuthored(document as EquipmentAuthored, (id) =>
        id === parent.id ? parent : undefined
      )
      const compilation = compilePublicationDocument(
        { subjectKind: 'EQUIPMENT', document },
        effective
      )
      // This is derived current behavior, not a new source publication or draft revision.
      await ctx.db.patch(root._id, {
        equipmentOptions: equipmentOptionFacts(document, root.checksum, effective)
      })
      await replaceAuthoredVersionCompilation(ctx, version, compilation)
      visited.add(root.id)
      parents.push(effective)
    }
  }
}
