import { handleRequest, getSpellListQuery, getSpellQuery } from '@artificer-toolkit/functions'
import type { Spell, SpellListItem } from '@artificer-toolkit/shared'

// list
export const getSpellList = handleRequest<[], SpellListItem[] | []>(getSpellListQuery, () => [])

// single
export const getSpell = handleRequest<[string], Spell | null>(getSpellQuery, (req) => {
  const url = new URL(req.url)
  const segments = url.pathname.split('/').filter(Boolean)
  const id = segments[segments.length - 1]
  return [
    id
  ]
})
