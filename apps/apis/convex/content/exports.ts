import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  artificerPortableContentDtoSchema,
  authoredContentExportRequestDtoSchema,
  IMPORT_MAX_PORTABLE_REFERENCES,
  type ArtificerPortableContentDto
} from '@artificer-toolkit/schema/api/imports'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import {
  collectTopLevelReferenceCandidates,
  stripPortableMetadata
} from '@artificer-toolkit/shared/utils'
import { query } from '../lib/queries'
import { isImportRowVisible } from '../imports/visibility'
import { requireIdentity } from '../lib/identity'
import { readAuthoredDetail } from './details'
import { canReadAuthoredRoot } from './documents'

export const get = query({
  args: zodToConvexFields(authoredContentExportRequestDtoSchema.shape),
  returns: zodToConvex(artificerPortableContentDtoSchema),
  handler: async (ctx, args): Promise<ArtificerPortableContentDto> => {
    const input = authoredContentExportRequestDtoSchema.parse(args)
    const { userId } = await requireIdentity(ctx)
    const detail = await readAuthoredDetail(ctx, input)
    if (!detail || !detail.permissions.canEdit || detail.provenance.kind !== 'OWNED')
      throw new Error('Only owned authored content can be exported.')

    const item = input.view === 'draft' ? detail.draft?.payload : detail.item
    if (!item) throw new Error(`Authored content has no exportable ${input.view} view.`)
    // Validate the portable bounds before performing reference lookups.
    const content = artificerPortableContentDtoSchema.parse({
      format: 'artificer-content',
      version: 1,
      item: { kind: input.subjectKind, data: stripPortableMetadata(item) },
      references: []
    })
    const candidates = collectTopLevelReferenceCandidates(content.item.data)
    if (candidates.length > IMPORT_MAX_PORTABLE_REFERENCES)
      throw new Error('Portable content contains too many references.')
    content.references = await Promise.all(
      candidates.map(async ({ kind, id }) => {
        const uuid = postgresUuidSchema.safeParse(id)
        const lookupId = uuid.success ? uuid.data : id
        const [root, importRef] = await Promise.all([
          ctx.db
            .query('authoredRoots')
            .withIndex('by_publicId', (q) => q.eq('id', lookupId))
            .unique(),
          ctx.db
            .query('authoredImportRefs')
            .withIndex('by_userId_subjectKind_subjectId_createdAt', (q) =>
              q.eq('userId', userId).eq('subjectKind', kind).eq('subjectId', lookupId)
            )
            .first()
        ])
        const visible =
          root &&
          root.subjectKind === kind &&
          root.systemId === item.systemId &&
          (await canReadAuthoredRoot(ctx, root, userId))
        const visibleImportRef =
          importRef && (await isImportRowVisible(ctx, importRef.importJobId)) ? importRef : null
        return {
          kind,
          id,
          label: visible ? root.label : id,
          importSource: visibleImportRef?.source ?? null,
          importId: visibleImportRef?.externalId ?? null
        }
      })
    )
    return artificerPortableContentDtoSchema.parse(content)
  }
})
