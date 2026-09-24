import type { AuthoredRouteSubjectKind } from '@artificer-toolkit/schema/shared/authoredRouteIdentity'
import type { MutationCtx, QueryCtx } from '../_generated/server'
import { isImportRowVisible } from '../imports/visibility'

export async function readVisibleAuthoredRouteId(
  ctx: QueryCtx | MutationCtx,
  lookup: { subjectId: string } | { publicId: string }
) {
  const route =
    'subjectId' in lookup
      ? await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_subjectId', (q) => q.eq('subjectId', lookup.subjectId))
          .unique()
      : await ctx.db
          .query('authoredRouteIds')
          .withIndex('by_publicId', (q) => q.eq('publicId', lookup.publicId))
          .unique()
  return route && (await isImportRowVisible(ctx, route.importJobId)) ? route : null
}

export async function ensureAuthoredRouteId(
  ctx: MutationCtx,
  subjectKind: AuthoredRouteSubjectKind,
  subjectId: string,
  seeded = false,
  ownerUserId?: string,
  currentJobId?: string
) {
  const existing = await ctx.db
    .query('authoredRouteIds')
    .withIndex('by_subjectId', (q) => q.eq('subjectId', subjectId))
    .unique()
  if (
    subjectKind === 'CHARACTER' &&
    (!ownerUserId || (existing && existing.ownerUserId !== ownerUserId))
  ) {
    throw new Error('Character route is not available to the current user.')
  }
  if (existing) {
    if (existing.subjectKind !== subjectKind) throw new Error('Authored route identity mismatch.')
    if (!(await isImportRowVisible(ctx, existing.importJobId, currentJobId)))
      throw new Error('Authored route identity conflict.')
    return existing.publicId
  }

  // Preserve the existing canonical SRD route numbers, not names or newly assigned UUIDs.
  const match = seeded
    ? /^00000000-0000-0000-([0-9a-f]{4})-([0-9a-f]{4})00000000$/.exec(subjectId)
    : null
  const domain = match ? Number.parseInt(match[1], 16) : 0
  const index = match ? Number.parseInt(match[2], 16) : 0
  const sequence = await ctx.db
    .query('authoredRouteSequence')
    .withIndex('by_key', (q) => q.eq('key', 'authored'))
    .unique()
  // ponytail: new content creation shares this indexed allocator; separate allocation
  // only if measured authoring contention requires it. Convex OCC retries collisions.
  const routeNumber =
    domain > 0 && index > 0
      ? domain * 100000 + index
      : // The legacy SRD encoding has two 16-bit fields. Reserve its entire range
        // so future canonical additions cannot collide with already-issued drafts.
        Math.max(sequence?.lastNumber ?? 0, 0xffff * 100000 + 0xffff) + 1
  if (!Number.isSafeInteger(routeNumber) || routeNumber <= 0)
    throw new Error('Invalid authored route number.')
  const publicId = routeNumber.toString(36)
  if (
    await ctx.db
      .query('authoredRouteIds')
      .withIndex('by_publicId', (q) => q.eq('publicId', publicId))
      .unique()
  ) {
    throw new Error('Authored route identity conflict.')
  }
  await ctx.db.insert('authoredRouteIds', {
    subjectKind,
    subjectId,
    routeNumber,
    publicId,
    ...(currentJobId !== undefined ? { importJobId: currentJobId } : {}),
    ...(subjectKind === 'CHARACTER' ? { ownerUserId } : {})
  })
  const lastNumber = Math.max(routeNumber, sequence?.lastNumber ?? 0)
  if (sequence) await ctx.db.patch(sequence._id, { lastNumber })
  else await ctx.db.insert('authoredRouteSequence', { key: 'authored', lastNumber })
  return publicId
}
