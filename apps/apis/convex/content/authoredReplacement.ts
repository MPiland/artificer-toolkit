import type { AuthoredStoredCompilation } from '@artificer-toolkit/schema/api/authoredPublication'
import type { AuthoredNodeRuntimeSourceFacts } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type { Doc } from '../_generated/dataModel'
import type { MutationCtx } from '../_generated/server'
import { catalogueMetadata, syncCatalogueMetadata } from './catalogueMetadata'
import { publishClassCatalogueFamily, readCatalogueParent } from './catalogueFamilies'
import { deleteAuthoredVersion, insertAuthoredVersion } from './documents'
import { writeSourceFacts } from './sourceFacts'

/**
 * Makes `version` the subject's single current version: the one replacement shared by user
 * publication and canonical re-import (ADR 0024). The previous version, its payload chunks and its
 * compilation are deleted, the catalogue projection is re-synced and the Class/Race family is
 * re-linked, all in the caller's transaction.
 */
export async function replaceCurrentAuthoredVersion(
  ctx: MutationCtx,
  args: {
    root: Doc<'authoredRoots'> | null
    previous: Doc<'authoredVersions'> | null
    version: Parameters<typeof insertAuthoredVersion>[1]
    documentJson: string
    compilation?: AuthoredStoredCompilation
    /** The root's own fields; its version pointer and catalogue projections are derived here. */
    current: Omit<
      Doc<'authoredRoots'>,
      '_id' | '_creationTime' | 'currentVersionId' | 'catalogue' | 'catalogueFamily'
    >
    authoringSources: AuthoredNodeRuntimeSourceFacts
    document: Parameters<typeof catalogueMetadata>[1]['document']
    publicId: string
  }
) {
  const { root, previous, version, documentJson, compilation, current, document, publicId } = args
  const currentVersionId = await insertAuthoredVersion(ctx, version, documentJson, compilation)
  const fields = {
    ...current,
    currentVersionId,
    catalogue: root?.catalogue,
    catalogueFamily: root?.catalogueFamily
  }
  const rootId = root?._id ?? (await ctx.db.insert('authoredRoots', fields))
  if (root) await ctx.db.replace(root._id, fields)
  await writeSourceFacts(ctx, current.id, args.authoringSources)
  if (previous) await deleteAuthoredVersion(ctx, previous)
  const published = await ctx.db.get(currentVersionId)
  if (!published) throw new Error('Published content is missing.')
  await syncCatalogueMetadata(
    ctx,
    rootId,
    await catalogueMetadata(
      ctx,
      { subjectKind: current.subjectKind, document },
      {
        checksum: version.checksum,
        publicId,
        createdAt: published._creationTime
      }
    )
  )
  if (current.subjectKind === 'CLASS') {
    const currentRoot = await ctx.db.get(rootId)
    if (!currentRoot) throw new Error('Published Class root is missing.')
    await publishClassCatalogueFamily(ctx, currentRoot, root?.label, current.ownerUserId ?? null)
  }
  if (current.subjectKind === 'RACE') {
    const currentRoot = await ctx.db.get(rootId)
    if (!currentRoot) throw new Error('Published Race root is missing.')
    const parent = await readCatalogueParent(ctx, currentRoot, current.ownerUserId ?? null)
    await ctx.db.patch(rootId, {
      catalogueFamily: {
        id: parent?.id ?? currentRoot.id,
        nameKey: (parent?.label ?? currentRoot.label).toLowerCase()
      }
    })
  }
  return { rootId, published }
}
