import { authoredContentSourceDtoSchema } from '@artificer-toolkit/schema/api/sourceImport'
import type { MutationCtx, QueryCtx } from '../_generated/server'

export async function requireDefaultUserContentSource(
  ctx: MutationCtx,
  gameSystemId: string,
  userId: string
) {
  const source = await ctx.db
    .query('contentSources')
    .withIndex('by_gameSystemId_kind_ownerUserId_code', (q) =>
      q
        .eq('gameSystemId', gameSystemId)
        .eq('kind', 'USER')
        .eq('ownerUserId', userId)
        .eq('code', 'default')
    )
    .unique()
  if (source) return source.id
  const id = crypto.randomUUID()
  await ctx.db.insert(
    'contentSources',
    authoredContentSourceDtoSchema.parse({
      id,
      gameSystemId,
      kind: 'USER',
      ownerUserId: userId,
      code: 'default',
      label: 'Default homebrew source',
      description: ''
    })
  )
  return id
}

export async function readAuthoringSources(ctx: QueryCtx, systemId: string, userId: string | null) {
  const [platform, owned] = await Promise.all([
    ctx.db
      .query('contentSources')
      .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
        q.eq('gameSystemId', systemId).eq('kind', 'PLATFORM').eq('ownerUserId', null)
      )
      .take(101),
    userId === null
      ? Promise.resolve([])
      : ctx.db
          .query('contentSources')
          .withIndex('by_gameSystemId_kind_ownerUserId', (q) =>
            q.eq('gameSystemId', systemId).eq('kind', 'USER').eq('ownerUserId', userId)
          )
          .take(101)
  ])
  // ponytail: inline selectors require all visible sources; above 100, migrate
  // to paginated option search instead of silently truncating normalization.
  if (platform.length + owned.length > 100) throw new Error('System content source limit exceeded.')
  return [...platform, ...owned]
}
