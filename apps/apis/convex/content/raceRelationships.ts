import { v } from 'convex/values'
import { zodToConvexFields } from 'convex-helpers/server/zod4'
import { sourceImportAuditRecordDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import {
  raceAuthoredDtoSchema,
  type RaceAuthoredDto
} from '@artificer-toolkit/schema/subjects/race'
import {
  resolveRaceAuthored,
  type ResolvedBaseRace
} from '@artificer-toolkit/shared/subjects/compilers'
import { checksumRuleDocument } from '@artificer-toolkit/shared/rules'
import type { RaceAuthored } from '@artificer-toolkit/shared/authored'
import { type MutationCtx, type QueryCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'
import { internalMutation } from '../lib/mutations'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'
import { compilePublicationDocument } from './publicationDocument'
import { backfillCatalogueFamily } from './catalogueFamilies'
import { requireRaceParent } from './relationshipReads'
import { isImportRowVisible } from '../imports/visibility'

export { requireRaceParent } from './relationshipReads'
export async function assertRaceRelationshipsIndexed(ctx: QueryCtx, systemId: string) {
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentRaceId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'RACE').eq('parentRaceId', undefined)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId))
      throw new Error('Race parent metadata backfill is incomplete.')
  }
}

export async function compileCurrentRace(
  ctx: QueryCtx,
  document: RaceAuthoredDto,
  userId: string | null,
  allowedSourceIds?: ReadonlySet<string>,
  canReadSharedRoot?: (root: Doc<'authoredRoots'>) => Promise<boolean>,
  currentImportJobId?: string
) {
  const parent =
    document.category === 'SUBRACE'
      ? await requireRaceParent(
          ctx,
          document,
          userId,
          allowedSourceIds,
          canReadSharedRoot,
          currentImportJobId
        )
      : undefined
  // The validated DTO's charge superRefine cannot express CLASS_LEVEL narrowing in its type.
  const effective = resolveRaceAuthored(
    document as RaceAuthored,
    (id) => (id === parent?.id ? parent : undefined) as RaceAuthored | undefined
  )
  return {
    parent,
    effective,
    compilation: compilePublicationDocument({ subjectKind: 'RACE', document }, effective)
  }
}

export async function assertNoRaceChildren(ctx: QueryCtx, systemId: string, raceId: string) {
  await assertRaceRelationshipsIndexed(ctx, systemId)
  for await (const root of ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentRaceId', (q) =>
      q.eq('systemId', systemId).eq('subjectKind', 'RACE').eq('parentRaceId', raceId)
    )) {
    if (await isImportRowVisible(ctx, root.importJobId))
      throw new Error('A Race with published subraces cannot be deleted or made a subrace.')
  }
}

export async function recompileRaceChildren(
  ctx: MutationCtx,
  parent: ResolvedBaseRace,
  userId: string
) {
  const children = await ctx.db
    .query('authoredRoots')
    .withIndex('by_system_kind_parentRaceId', (q) =>
      q.eq('systemId', parent.systemId).eq('subjectKind', 'RACE').eq('parentRaceId', parent.id)
    )
    .take(500)
  if (children.length >= 500) throw new Error('Race inheritance exceeds the authoring limit.')
  for (const root of children) {
    if (!(await isImportRowVisible(ctx, root.importJobId))) continue
    if (root.ownerUserId !== userId || !(await canReadAuthoredRoot(ctx, root, userId)))
      throw new Error('Race dependent ownership mismatch.')
    const version = await readAuthoredVersion(ctx, root)
    const document = raceAuthoredDtoSchema.parse(await readPublishedDocument(ctx, root, version))
    if (
      document.category !== 'SUBRACE' ||
      document.parentRaceId !== parent.id ||
      root.parentRaceId !== parent.id
    )
      throw new Error('Stored Race parent metadata mismatch.')
    const effective = resolveRaceAuthored(document as RaceAuthored, (id) =>
      id === parent.id ? parent : undefined
    )
    await ctx.db.patch(version._id, {
      compilation: compilePublicationDocument({ subjectKind: 'RACE', document }, effective)
    })
    await ctx.db.patch(root._id, {
      catalogueFamily: { id: parent.id, nameKey: parent.label.toLowerCase() }
    })
  }
}

export const syncDerived = internalMutation({
  args: zodToConvexFields(sourceImportAuditRecordDtoSchema.shape),
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const input = sourceImportAuditRecordDtoSchema.parse(args)
    const root = await ctx.db
      .query('authoredRoots')
      .withIndex('by_publicId', (q) => q.eq('id', input.id))
      .unique()
    if (
      !root ||
      root.subjectKind !== 'RACE' ||
      root.ownerUserId !== undefined ||
      root.checksum !== input.checksum ||
      !(await canReadAuthoredRoot(ctx, root, null))
    )
      throw new Error('Canonical Race identity mismatch.')
    const version = await readAuthoredVersion(ctx, root)
    const document = raceAuthoredDtoSchema.parse(await readPublishedDocument(ctx, root, version))
    const parentRaceId = document.category === 'SUBRACE' ? document.parentRaceId : null
    if (root.parentRaceId !== undefined && root.parentRaceId !== parentRaceId)
      throw new Error('Canonical content conflict.')
    const { compilation } = await compileCurrentRace(ctx, document, null)
    if (
      version.compilation !== undefined &&
      checksumRuleDocument(version.compilation) !== checksumRuleDocument(compilation)
    )
      throw new Error('Canonical content conflict.')
    if (root.parentRaceId === undefined) await ctx.db.patch(root._id, { parentRaceId })
    if (version.compilation === undefined) await ctx.db.patch(version._id, { compilation })
    const current = await ctx.db.get(root._id)
    if (!current) throw new Error('Canonical Race root is missing.')
    await backfillCatalogueFamily(ctx, current)
    return null
  }
})
