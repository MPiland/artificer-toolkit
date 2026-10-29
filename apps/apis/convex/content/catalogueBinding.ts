import type { QueryCtx } from '../_generated/server'
import { requireSystem } from './systemDocuments'

type RulesCatalogueBindingInput = {
  systemId: string
  primaryRulesCatalogueId: string
  additionalRulesCatalogueIds?: readonly string[]
}

export async function requireRulesCatalogueBinding(
  ctx: QueryCtx,
  input: RulesCatalogueBindingInput
) {
  const [system, binding] = await Promise.all([
    requireSystem(ctx, input.systemId),
    requireRulesCatalogueSources(ctx, input)
  ])
  return { system, ...binding }
}

/**
 * The binding's validated content sources without the System document, for readers that need
 * only source authority; each catalogue and source is still checked against `systemId`.
 */
export async function requireRulesCatalogueSources(
  ctx: QueryCtx,
  input: RulesCatalogueBindingInput
) {
  const catalogueIds = [input.primaryRulesCatalogueId, ...(input.additionalRulesCatalogueIds ?? [])]
  if (new Set(catalogueIds).size !== catalogueIds.length)
    throw new Error('Rules Catalogues must be unique.')
  const catalogues = await Promise.all(
    catalogueIds.map((id) =>
      ctx.db
        .query('rulesCatalogues')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
    )
  )
  const sourceIds = new Set<string>()
  for (const [index, catalogue] of catalogues.entries()) {
    if (!catalogue || catalogue.gameSystemId !== input.systemId) {
      throw new Error(
        index === 0
          ? 'The selected primary Rules Catalogue is unavailable for the Game System.'
          : 'The selected additional Rules Catalogue is unavailable for the Game System.'
      )
    }
    if (
      catalogue.contentSourceIds.length === 0 ||
      catalogue.contentSourceIds.length > 100 ||
      new Set(catalogue.contentSourceIds).size !== catalogue.contentSourceIds.length
    )
      throw new Error('Invalid catalogue content sources.')
    for (const id of catalogue.contentSourceIds) sourceIds.add(id)
  }
  if (sourceIds.size > 100) throw new Error('System content source limit exceeded.')
  const sources = await Promise.all(
    [...sourceIds].map(async (id) => {
      const source = await ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', id))
        .unique()
      if (
        !source ||
        source.gameSystemId !== input.systemId ||
        source.kind !== 'PLATFORM' ||
        source.ownerUserId !== null
      )
        throw new Error('Invalid catalogue content source binding.')
      return source
    })
  )
  return { sourceIds, sources }
}
