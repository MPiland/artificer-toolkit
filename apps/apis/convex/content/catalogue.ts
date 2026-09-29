import * as zMini from 'zod/mini'
import { zodToConvex, zodToConvexFields } from 'convex-helpers/server/zod4'
import {
  authoredCatalogueCountsSchema,
  authoredCatalogueScopeSchema,
  type AuthoredCatalogueScope
} from '@artificer-toolkit/schema/api/authoredCatalogue'
import type { QueryCtx } from '../_generated/server'
import { query } from '../lib/queries'
import { getAuthenticatedProfile } from '../lib/identity'
import { readAuthoringSources } from './sources'

async function requireCompleteCatalogue(
  ctx: QueryCtx,
  input: { subjectKind: AuthoredCatalogueScope['subjectKind']; systemId?: string },
  owners: (string | undefined)[]
) {
  for (const owner of owners) {
    const roots = ctx.db.query('authoredRoots')
    const systemId = input.systemId
    const missing = systemId
      ? roots
          .withIndex('by_system_kind_owner_name_id', (q) =>
            q
              .eq('systemId', systemId)
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', owner)
              .eq('catalogue.nameKey', undefined)
          )
          .first()
      : roots
          .withIndex('by_kind_owner_name_id', (q) =>
            q
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', owner)
              .eq('catalogue.nameKey', undefined)
          )
          .first()
    if (await missing) throw new Error('Catalogue metadata backfill is incomplete.')
    if (input.subjectKind === 'SPELL') {
      const missingSpell = systemId
        ? roots
            .withIndex('by_system_kind_owner_spellLevel_name_id', (q) =>
              q
                .eq('systemId', systemId)
                .eq('subjectKind', 'SPELL')
                .eq('ownerUserId', owner)
                .eq('catalogue.spell.level', undefined)
            )
            .first()
        : roots
            .withIndex('by_kind_owner_spellLevel_name_id', (q) =>
              q
                .eq('subjectKind', 'SPELL')
                .eq('ownerUserId', owner)
                .eq('catalogue.spell.level', undefined)
            )
            .first()
      if (await missingSpell) throw new Error('Spell catalogue metadata backfill is incomplete.')
    }
  }
}

export const counts = query({
  args: zodToConvexFields(zMini.omit(authoredCatalogueScopeSchema, { source: true }).shape),
  returns: zodToConvex(authoredCatalogueCountsSchema),
  handler: async (ctx, args) => {
    const input = zMini.omit(authoredCatalogueScopeSchema, { source: true }).parse(args)
    const userId = (await getAuthenticatedProfile(ctx))?.identity.userId ?? null
    const sources = await readAuthoringSources(ctx, input.systemId, userId)
    await requireCompleteCatalogue(ctx, input, userId ? [undefined, userId] : [undefined])
    let masterCount = 0
    let ownedCount = 0
    for (const source of sources) {
      const counts = await ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) =>
          q.eq('contentSourceId', source.id).eq('subjectKind', input.subjectKind)
        )
        .unique()
      const count = counts?.count ?? 0
      if (
        !counts &&
        (await ctx.db
          .query('authoredRoots')
          .withIndex('by_contentSourceId_subjectKind_ownerUserId', (q) =>
            q
              .eq('contentSourceId', source.id)
              .eq('subjectKind', input.subjectKind)
              .eq('ownerUserId', source.kind === 'USER' ? source.ownerUserId : undefined)
          )
          .first())
      )
        throw new Error('Catalogue counts are not materialized.')
      if (!Number.isSafeInteger(count) || count < 0)
        throw new Error('Catalogue count integrity mismatch.')
      if (source.kind === 'PLATFORM') masterCount += count
      else ownedCount += count
    }
    return authoredCatalogueCountsSchema.parse({
      activeCount: masterCount + ownedCount,
      masterCount,
      ownedCount
    })
  }
})
