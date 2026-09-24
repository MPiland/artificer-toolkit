import type { AuthoredNodeRuntimeSourceFacts } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import type {
  NodeRuntimeQueryRow,
  NodeRuntimeSourceReader
} from '@artificer-toolkit/authoring/nodeRuntime'
import { postgresUuidSchema } from '@artificer-toolkit/schema/shared/postgresUuid'
import type { QueryCtx } from '../_generated/server'
import { readSystem } from '../content/systemDocuments'
import { readAuthoringSources } from '../content/sources'
import { readCurrentSourceDefinitions } from '../content/definitionStore'
import { createAuthoredSourceReader } from './authoredSources'

export async function createSystemSourceReader(
  ctx: QueryCtx,
  requestedSystemId: string,
  userId: string,
  currentDraftFacts?: AuthoredNodeRuntimeSourceFacts
): Promise<NodeRuntimeSourceReader> {
  const systemId = postgresUuidSchema.parse(requestedSystemId).toLowerCase()
  const stored = await ctx.db
    .query('systems')
    .withIndex('by_publicId', (q) => q.eq('id', systemId))
    .unique()
  if (!stored) throw new Error('System not found.')
  const system = readSystem(stored)
  const vocabulary: Readonly<Record<string, readonly NodeRuntimeQueryRow[]>> = {
    ability_definitions: 'abilities' in system ? system.abilities : [],
    alignments: system.alignments,
    challenge_ratings: system.challengeRatings,
    condition_types: system.conditionTypes,
    creature_types: system.creatureTypes,
    currencies: system.currencies,
    damage_types: system.damageTypes,
    heritages: system.heritages,
    languages: system.languages,
    magic_schools: system.magicSchools,
    rarities: system.rarities,
    senses: system.senses,
    skills: system.skills,
    speeds: system.speeds
  }
  // Nested feature maps share these reads within this one query, never across requests/users.
  let definitions: Promise<NodeRuntimeQueryRow[]> | undefined
  const authored = createAuthoredSourceReader(ctx, systemId, userId)
  return async (table, columns, _where, scopeSystemId) => {
    if (scopeSystemId?.toLowerCase() !== systemId) throw new Error('Authoring System mismatch.')
    const rows =
      table === 'reusable_definitions'
        ? await (definitions ??= readDefinitionOptions(ctx, systemId, userId, system.userId))
        : (vocabulary[table] ?? [
            ...(await authored(table)),
            ...(currentDraftFacts?.rows[table] ?? [])
          ])
    if (!rows) throw new Error(`Authoring source is not migrated: ${table}.`)
    // The shared executor applies the validated predicate; this reader only supplies trusted facts.
    return rows.map((row) =>
      Object.fromEntries(columns.map((column) => [column, row[column] ?? null]))
    )
  }
}

async function readDefinitionOptions(
  ctx: QueryCtx,
  systemId: string,
  userId: string,
  systemAuthorUserId: string
): Promise<NodeRuntimeQueryRow[]> {
  const sources = await readAuthoringSources(ctx, systemId, userId)
  const definitions = await readCurrentSourceDefinitions(
    ctx,
    sources,
    userId,
    systemAuthorUserId
  ).catch(() => {
    throw new Error('Stored authoring definition mismatch.')
  })
  const rows = definitions.map(({ id, label }) => ({ id, label }))
  return rows.sort(
    (left, right) =>
      String(left.label).localeCompare(String(right.label)) ||
      String(left.id).localeCompare(String(right.id))
  )
}
