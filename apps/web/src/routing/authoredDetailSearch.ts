export type AuthoredDetailSearch = {
  view?: 'active' | 'draft'
}

export function validateAuthoredDetailSearch(search: Record<string, unknown>): AuthoredDetailSearch {
  return search.view === 'draft' ? { view: 'draft' } : {}
}

export function authoredDetailSearchFor(view: AuthoredDetailSearch['view']) {
  return view === 'draft' ? { view } : {}
}
