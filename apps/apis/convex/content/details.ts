import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredDetailReadInputSchema,
  authoredDetailReadEnvelopeSchema,
  authoredDetailResponseSchemas,
  toAuthoredValidationIssues,
  type AuthoredDetailReadInput,
  type AuthoredDetailReadResult
} from '@artificer-toolkit/schema/api/content'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import { readVisibleAuthoredRouteId } from './routeIds'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { getAuthenticatedProfile } from '../lib/identity'
import {
  canReadAuthoredRoot,
  readAuthoredVersion,
  readDraft,
  readPublishedDocument
} from './documents'
import { creatureAuthoredDtoSchema } from '@artificer-toolkit/schema/subjects/creature'
import { readDetailMeta } from './detailMeta'
import { readCreatureArmorClass } from './creatureLoadoutHands'

async function readComputedArmorClass(
  ctx: QueryCtx,
  subjectKind: AuthoredDetailReadInput['subjectKind'],
  item: unknown,
  userId: string | null
) {
  if (subjectKind !== 'CREATURE') return {}
  const creature = creatureAuthoredDtoSchema.safeParse(item)
  if (!creature.success) return {}
  const result = await readCreatureArmorClass(ctx, creature.data, userId)
  return { armorClass: result?.ok ? result.armorClass : null }
}

export const get = query({
  args: zodToConvexFields(authoredDetailReadInputSchema.shape),
  returns: zodToConvex(authoredDetailReadEnvelopeSchema),
  handler: readAuthoredDetail
})

export async function readAuthoredDetail(
  ctx: QueryCtx,
  args: AuthoredDetailReadInput
): Promise<AuthoredDetailReadResult> {
  const input = authoredDetailReadInputSchema.parse(args)
  const uuid = postgresUuidSchema.safeParse(input.id)
  const route = await readVisibleAuthoredRouteId(
    ctx,
    uuid.success ? { subjectId: uuid.data.toLowerCase() } : { publicId: input.id }
  )
  if (!route || route.subjectKind !== input.subjectKind) return null
  const userId = (await getAuthenticatedProfile(ctx))?.identity.userId ?? null
  const root = await ctx.db
    .query('authoredRoots')
    .withIndex('by_publicId', (q) => q.eq('id', route.subjectId))
    .unique()
  if (
    root &&
    (root.subjectKind !== input.subjectKind || !(await canReadAuthoredRoot(ctx, root, userId)))
  )
    return null
  const storedDraft = userId
    ? await ctx.db
        .query('authoredDrafts')
        .withIndex('by_subjectId', (q) => q.eq('subjectId', route.subjectId))
        .unique()
    : null
  const ownedDraft =
    storedDraft?.userId === userId && storedDraft?.subjectKind === input.subjectKind
      ? storedDraft
      : null
  if (
    ownedDraft &&
    (ownedDraft.publicId !== route.publicId || (root && ownedDraft.systemId !== root.systemId))
  )
    throw new Error('Stored draft identity mismatch.')
  const version = root ? await readAuthoredVersion(ctx, root) : null
  const activeUpdatedAt = version ? new Date(version._creationTime).toISOString() : null
  const responseSchema = authoredDetailResponseSchemas[input.subjectKind]
  const itemSchema = responseSchema._zod.def.innerType.shape.item
  let draftDetail: AuthoredDetailReadResult = null
  if (input.view === 'draft' && ownedDraft) {
    const draft = await readDraft(ctx, ownedDraft)
    const parsed = itemSchema.safeParse({
      ...draft.payload,
      kind: input.subjectKind,
      id: draft.subjectId,
      label: draft.label,
      systemId: draft.systemId,
      userId,
      status: 'DRAFT'
    })
    draftDetail = responseSchema.parse({
      item: parsed.success ? parsed.data : null,
      publicId: route.publicId,
      activeUpdatedAt,
      hasDraft: true,
      draft,
      provenance: { kind: 'OWNED', ownerUserId: userId },
      permissions: { canView: true, canEdit: true, canCopy: false, canDelete: true },
      ...(parsed.success && parsed.data
        ? { meta: await readDetailMeta(ctx, input, parsed.data, userId) }
        : {}),
      ...(parsed.success
        ? await readComputedArmorClass(ctx, input.subjectKind, parsed.data, userId)
        : {}),
      ...(!parsed.success
        ? { validationIssues: toAuthoredValidationIssues(parsed.error.issues) }
        : {})
    })
    if (draftDetail?.item) return draftDetail
  }
  if (!root || !version) return draftDetail
  const document = await readPublishedDocument(ctx, root, version)
  const parsed = itemSchema.safeParse(document)
  const owned = root.ownerUserId === userId
  return responseSchema.parse({
    item: parsed.success ? parsed.data : null,
    publicId: route.publicId,
    activeUpdatedAt,
    hasDraft: ownedDraft !== null,
    provenance: { kind: owned ? 'OWNED' : 'MASTER', ownerUserId: root.ownerUserId ?? null },
    permissions: { canView: true, canEdit: owned, canCopy: userId !== null, canDelete: owned },
    ...(parsed.success && parsed.data
      ? { meta: await readDetailMeta(ctx, input, parsed.data, userId) }
      : {}),
    ...(parsed.success
      ? await readComputedArmorClass(ctx, input.subjectKind, parsed.data, userId)
      : {}),
    ...(!parsed.success
      ? { validationIssues: toAuthoredValidationIssues(parsed.error.issues) }
      : {}),
    ...(draftDetail
      ? { draft: draftDetail.draft, validationIssues: draftDetail.validationIssues }
      : {})
  })
}
