import { v } from 'convex/values'
import { internalMutation } from '../lib/mutations'
import { requireFixtureAccount } from '../lib/developmentFixtures'

export const removeFixtureState = internalMutation({
  args: {
    ownerUserId: v.string(),
    contentSourceId: v.string(),
    catalogueId: v.string(),
    definitionIds: v.array(v.string())
  },
  returns: v.null(),
  handler: async (ctx, { ownerUserId, contentSourceId, catalogueId, definitionIds }) => {
    await requireFixtureAccount(ctx, ownerUserId)
    if (
      ![6, 8].includes(definitionIds.length) ||
      new Set(definitionIds).size !== definitionIds.length
    )
      throw new Error('Expected six or eight unique lifecycle fixture definitions.')
    const [source, catalogue, definitions] = await Promise.all([
      ctx.db
        .query('contentSources')
        .withIndex('by_publicId', (q) => q.eq('id', contentSourceId))
        .unique(),
      ctx.db
        .query('rulesCatalogues')
        .withIndex('by_publicId', (q) => q.eq('id', catalogueId))
        .unique(),
      ctx.db
        .query('reusableDefinitions')
        .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', contentSourceId))
        .take(9)
    ])
    if (!source && !catalogue && definitions.length === 0) return null
    if (
      !source ||
      !catalogue ||
      source.id === catalogue.id ||
      source.kind !== 'PLATFORM' ||
      source.ownerUserId !== null ||
      source.code !== `v08-${ownerUserId}` ||
      catalogue.code !== source.code ||
      source.label !== 'V08 lifecycle fixture' ||
      catalogue.label !== source.label ||
      catalogue.gameSystemId !== source.gameSystemId ||
      catalogue.contentSourceIds.length !== 1 ||
      catalogue.contentSourceIds[0] !== source.id
    )
      throw new Error('Lifecycle fixture source or catalogue mismatch.')

    // ponytail: CLI fixtures inspect at most 100 surrounding records per table; larger
    // deployments need indexed references rather than an incomplete deletion check.
    const [
      roots,
      counts,
      catalogues,
      campaigns,
      characters,
      characterDrafts,
      definitionDrafts,
      runs
    ] = await Promise.all([
      ctx.db
        .query('authoredRoots')
        .withIndex('by_contentSourceId', (q) => q.eq('contentSourceId', source.id))
        .first(),
      ctx.db
        .query('authoredCatalogueCounts')
        .withIndex('by_source_kind', (q) => q.eq('contentSourceId', source.id))
        .first(),
      ctx.db
        .query('rulesCatalogues')
        .withIndex('by_gameSystemId', (q) => q.eq('gameSystemId', source.gameSystemId))
        .take(101),
      ctx.db.query('campaigns').withIndex('by_ownerUserId_status').take(101),
      ctx.db.query('characters').withIndex('by_userId').take(101),
      ctx.db.query('characterDrafts').withIndex('by_userId_updatedAt').take(101),
      ctx.db.query('reusableDefinitionDrafts').withIndex('by_definitionId').take(101),
      ctx.db.query('encounterRuns').withIndex('by_campaignId_createdAt_id').take(101)
    ])
    const characterDraftPayloadRows = await Promise.all(
      characterDrafts.flatMap((draft) =>
        draft.payloadId
          ? [
              ctx.db
                .query('characterDraftPayloads')
                .withIndex('by_characterId_id', (q) =>
                  q.eq('characterId', draft.characterId).eq('id', draft.payloadId!)
                )
                .unique()
            ]
          : []
      )
    )
    if (characterDraftPayloadRows.some((payload) => payload === null))
      throw new Error('Lifecycle fixture Character draft payload is missing.')
    const characterDraftPayloads = characterDraftPayloadRows.flatMap((payload) =>
      payload ? [payload] : []
    )
    if (
      definitions.length > 8 ||
      [
        catalogues,
        campaigns,
        characters,
        characterDrafts,
        characterDraftPayloads,
        definitionDrafts,
        runs
      ].some((rows) => rows.length > 100)
    )
      throw new Error('Lifecycle fixture reference inspection exceeds its bounds.')
    // Bootstrap and definition import commit separately; cleanup also accepts a failed
    // setup with only a subset of the expected definitions present.
    if (
      roots ||
      counts ||
      definitions.some(
        (definition) =>
          !definitionIds.includes(definition.id) ||
          definition.ownerUserId !== undefined ||
          definition.gameSystemId !== source.gameSystemId ||
          definition.version !== 1 ||
          (!definition.label.startsWith('V08 lifecycle ') &&
            definition.label !== 'Movement reaction browser fixture') ||
          !['rules-runtime-graph', 'initiative-policy'].includes(definition.definitionFamilyKey)
      ) ||
      catalogues.some(
        (candidate) =>
          candidate.id !== catalogue.id && candidate.contentSourceIds.includes(source.id)
      )
    )
      throw new Error('Lifecycle fixture source contains unexpected content or references.')

    const identities = [source.id, catalogue.id, ...definitionIds]
    const consumers = [
      ...campaigns,
      ...characters,
      ...characterDrafts,
      ...characterDraftPayloads,
      ...definitionDrafts,
      ...runs
    ]
    // An incidental literal UUID also blocks cleanup; a false positive is safe for this fixture.
    const references = (consumer: unknown) => {
      const document = JSON.stringify(consumer)
      return identities.some((identity) => document.includes(identity))
    }
    if (consumers.some(references))
      throw new Error('Lifecycle fixture policies are still referenced.')
    // Every other definition of the System is inspected, however many a local deployment has
    // accumulated: Convex's own read limit fails the cleanup instead of truncating the check.
    for await (const definition of ctx.db
      .query('reusableDefinitions')
      .withIndex('by_gameSystemId_owner_family_label_id', (q) =>
        q.eq('gameSystemId', source.gameSystemId)
      ))
      if (definition.contentSourceId !== source.id && references(definition))
        throw new Error('Lifecycle fixture policies are still referenced.')

    for (const definition of definitions) await ctx.db.delete(definition._id)
    await ctx.db.delete(catalogue._id)
    await ctx.db.delete(source._id)
    return null
  }
})
