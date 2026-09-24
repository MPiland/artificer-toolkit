import {
  authoredCataloguePageSchema,
  type AuthoredCataloguePage,
  type AuthoredCatalogueReadInput
} from '@artificer-toolkit/schema/api/authoredCatalogue'

export async function loadPagedAuthoredCatalogItems(
  list: (input: AuthoredCatalogueReadInput) => Promise<AuthoredCataloguePage>,
  request: AuthoredCatalogueReadInput
): Promise<AuthoredCataloguePage['page']> {
  const items: AuthoredCataloguePage['page'] = []
  const seenCursors = new Set<string | null>()
  let cursor = request.paginationOpts.cursor

  while (true) {
    if (seenCursors.has(cursor)) {
      throw new Error('Authored catalogue pagination returned a repeated cursor.')
    }
    seenCursors.add(cursor)

    const response = authoredCataloguePageSchema.parse(
      await list({
        ...request,
        paginationOpts: { ...request.paginationOpts, cursor }
      })
    )
    items.push(...response.page)

    if (response.isDone) return items

    if (response.continueCursor.length === 0) {
      throw new Error('Authored catalogue pagination did not advance.')
    }
    cursor = response.continueCursor
  }
}
