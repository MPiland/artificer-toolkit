import type { AuthoredNodeRuntimeSourceFacts } from '@artificer-toolkit/schema/api/nodeRuntimeSources'
import {
  createNodeRuntimeSourceReader,
  type NodeRuntimeSourceReader
} from '@artificer-toolkit/authoring/nodeRuntime'
import { systemCoreCodeRegistry } from '@artificer-toolkit/rules-runtime/platformSystemCoreCodes'
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
  const authored = createAuthoredSourceReader(ctx, systemId, userId)
  return createNodeRuntimeSourceReader({
    system,
    coreCodes: {
      rollInfluence: systemCoreCodeRegistry.entries(systemId, 'rollInfluence'),
      rollMode: systemCoreCodeRegistry.entries(systemId, 'rollMode'),
      spellSlotPool: systemCoreCodeRegistry.entries(systemId, 'spellSlotPool'),
      effectConsumeEvent: systemCoreCodeRegistry.entries(systemId, 'effectConsumeEvent'),
      effectEndEvent: systemCoreCodeRegistry.entries(systemId, 'effectEndEvent'),
      actionTrait: systemCoreCodeRegistry.entries(systemId, 'actionTrait')
    },
    readAuthoredRows: async (table) => [
      ...(await authored(table)),
      ...(currentDraftFacts?.rows[table] ?? [])
    ],
    readReusableDefinitions: () => readDefinitionOptions(ctx, systemId, userId)
  })
}

async function readDefinitionOptions(ctx: QueryCtx, systemId: string, userId: string) {
  const sources = await readAuthoringSources(ctx, systemId, userId)
  return readCurrentSourceDefinitions(ctx, sources, userId).catch(() => {
    throw new Error('Stored authoring definition mismatch.')
  })
}
