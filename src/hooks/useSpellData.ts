import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchSpell, fetchSpells } from '../apis/spellsApi'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '../utils/data'
import type { SpellListItem } from '../../amplify/gql/types'

const useSpellData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchSpells(systemPref))
  const { spells, metaData } = data
  return {
    spells: createArrayWithMethods(spells, {
      findSpell: (id?: string | null) => {
        if (!id) return null
        return suspenseQuery(fetchSpell(id)).data
      },
      findSpells: (ids: string[] | null) => {
        if (!ids || !ids.length) return null
        return suspenseQueries({
          queries: ids.map((id) => fetchSpell(id)),
          combine: (results) => results.map((result) => result.data),
        })
      },
      filterByClass(this: SpellListItem[], id?: string | null) {
        if (!id) return this
        return this.filter((spell) => metaData.classes?.find((c) => c.id === id)?.spellIds?.includes(spell.id))
      },
      filterByClasses(this: SpellListItem[], ids?: string[] | null) {
        if (!ids || !ids.length) return this
        return this.filter((spell) =>
          ids.some((id) => metaData.classes?.find((c) => c.id === id)?.spellIds?.includes(spell.id))
        )
      },
      findLevel(id?: string | null) {
        if (!id) return null
        return metaData.levels?.find((l) => l.spellIds?.includes(id))?.id
      },
    }),
    metaData: metaData,
  }
}
export default useSpellData
