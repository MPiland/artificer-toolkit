import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredPublicationNameBackfillInputSchema,
  authoredPublicationNameBackfillResultSchema
} from '@artificer-toolkit/schema/api/authoredPublication'
import { internalMutation } from '../lib/mutations'
import { canReadAuthoredRoot, readAuthoredVersion, readPublishedDocument } from './documents'
import { requireClassParent } from './classRelationships'
import { requireRaceParent } from './raceRelationships'
import { parsePublicationDocument } from './publicationDocument'
import { activePublicationNameKey } from './publicationPersistence'

export const backfill = internalMutation({
  args: zodToConvexFields(authoredPublicationNameBackfillInputSchema.shape),
  returns: zodToConvex(authoredPublicationNameBackfillResultSchema),
  handler: async (ctx, args) => {
    const input = authoredPublicationNameBackfillInputSchema.parse(args)
    const result = await ctx.db
      .query('authoredRoots')
      .withIndex('by_system_kind_owner_name_id', (q) =>
        q
          .eq('systemId', input.systemId)
          .eq('subjectKind', input.subjectKind)
          .eq('ownerUserId', input.ownerUserId)
      )
      .paginate({
        cursor: input.cursor,
        numItems: 2,
        maximumRowsRead: 2,
        maximumBytesRead: 1024 * 1024
      })
    for (const root of result.page) {
      if (
        root.systemId !== input.systemId ||
        root.subjectKind !== input.subjectKind ||
        root.ownerUserId !== input.ownerUserId ||
        !(await canReadAuthoredRoot(ctx, root, input.ownerUserId))
      )
        throw new Error('Active name backfill root identity mismatch.')
      const version = await readAuthoredVersion(ctx, root)
      const subject = parsePublicationDocument(
        root.subjectKind,
        await readPublishedDocument(ctx, root, version)
      )
      if (
        subject.document.id !== root.id ||
        subject.document.systemId !== root.systemId ||
        subject.document.label !== root.label
      )
        throw new Error('Active name backfill document identity mismatch.')
      if (subject.subjectKind === 'CLASS') {
        const parentClassId =
          subject.document.category === 'SUBCLASS' ? subject.document.parentClassId : null
        if (root.parentClassId !== parentClassId)
          throw new Error('Active name backfill Class parent mismatch.')
        if (subject.document.category === 'SUBCLASS')
          await requireClassParent(ctx, subject.document, input.ownerUserId)
      }
      if (subject.subjectKind === 'RACE') {
        const parentRaceId =
          subject.document.category === 'SUBRACE' ? subject.document.parentRaceId : null
        if (root.parentRaceId !== parentRaceId)
          throw new Error('Active name backfill Race parent mismatch.')
        if (subject.document.category === 'SUBRACE')
          await requireRaceParent(ctx, subject.document, input.ownerUserId)
      }
      const activeNameKey = activePublicationNameKey(subject.document.label)
      if (root.activeNameKey !== undefined && root.activeNameKey !== activeNameKey)
        throw new Error('Active name backfill key mismatch.')
      if (root.activeNameKey === undefined) await ctx.db.patch(root._id, { activeNameKey })
    }
    return {
      processed: result.page.length,
      continueCursor: result.continueCursor,
      isDone: result.isDone
    }
  }
})
