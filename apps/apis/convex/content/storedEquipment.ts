import { equipmentAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/equipment'
import { hydrateStoredCompilation } from '@artificer-toolkit/rules-runtime/authoredPublicationHydrate'
import { canonicalizeRuleDocument } from '@artificer-toolkit/shared/rules/checksum'
import type { QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { readAuthoredVersionCompilation, readPublishedRootDocument } from './documents'
import { requireEquipmentParents } from './relationshipReads'

/**
 * A readable Equipment root's current published version with its stored compilation, hydrated
 * (D163); nothing compiles. A variant's stored rules are already resolved against its parents,
 * which the caller must be able to read.
 */
export async function readStoredEquipment(
  ctx: QueryCtx,
  root: Doc<'authoredRoots'>,
  userId: string | null
) {
  const { version, document } = await readPublishedRootDocument(ctx, root)
  const stored = equipmentAuthoredDtoSchema.parse(document)
  const ancestors = await requireEquipmentParents(ctx, stored, userId)
  const compilation = await readAuthoredVersionCompilation(ctx, version)
  if (!compilation || compilation.authoredChecksum !== root.checksum)
    throw new Error('Equipment compilation is missing or stale.')
  const compiled = hydrateStoredCompilation(
    'EQUIPMENT',
    { id: root.id, checksum: root.checksum },
    compilation
  )
  if (
    canonicalizeRuleDocument(compiled.parentEquipmentIds) !==
    canonicalizeRuleDocument([...ancestors.keys()].slice(1))
  )
    throw new Error('Equipment compilation has stale variant parents.')
  return { version, document: stored, compilation, compiled }
}
