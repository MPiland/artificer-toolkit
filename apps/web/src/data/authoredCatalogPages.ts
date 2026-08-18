import type { AuthoredCatalogCursorDto } from '#app/lib/api'

type AuthoredCatalogPage<TItem> = {
  items: TItem[]
  page: {
    nextCursor: AuthoredCatalogCursorDto | null
  }
}

type AuthoredCatalogRequest = {
  cursor?: AuthoredCatalogCursorDto
  direction: 'BACKWARD' | 'FORWARD'
  limit: number
}

export async function loadPagedAuthoredCatalogItems<
  TItem,
  TRequest extends AuthoredCatalogRequest
>(
  list: (input: TRequest) => Promise<AuthoredCatalogPage<TItem>>,
  request: TRequest
): Promise<TItem[]> {
  const items: TItem[] = []
  const seenCursors = new Set<string>()
  let cursor = request.cursor

  do {
    const response = await list(
      cursor ? { ...request, cursor, direction: 'FORWARD' } : { ...request, direction: 'FORWARD' }
    )
    items.push(...response.items)
    cursor = response.page.nextCursor ?? undefined
    if (!cursor) break

    const cursorKey = JSON.stringify(cursor)
    if (seenCursors.has(cursorKey)) {
      throw new Error('Authored catalogue pagination returned a repeated cursor.')
    }
    seenCursors.add(cursorKey)
  } while (cursor)

  return items
}
