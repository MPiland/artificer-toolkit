import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query'
import { fetchRace, fetchRaces } from '@/apis/racesApi'
import { useRouteContext } from '@tanstack/react-router'
import { createArrayWithMethods } from '@/utils'
import { Categories } from '@/enums'

const useRaceData = () => {
  const suspenseQuery = useSuspenseQuery
  const suspenseQueries = useSuspenseQueries
  const { systemPref } = useRouteContext({ from: '__root__' })
  const { data } = suspenseQuery(fetchRaces(systemPref))
  const { races, metaData } = data
  const subraces = data.races.filter((r) =>
    metaData.categories?.find((cat) => cat.id === Categories.SUBRACE)?.raceIds?.includes(r.id)
  )
  const baseRaces = races.filter(
    (r) => !metaData.categories?.find((cat) => cat.id === Categories.SUBRACE)?.raceIds?.includes(r.id)
  )

  const raceMethods = createArrayWithMethods(races, {
    findRace: (id?: string | null) => {
      if (!id) return null
      return suspenseQuery(fetchRace(id)).data
    },
    findRaces: (ids: string[] | null) => {
      if (!ids || !ids.length) return null
      return suspenseQueries({
        queries: ids.map((id) => fetchRace(id)),
        combine: (results) => results.map((result) => result.data),
      })
    },
    findLineages(id?: string | null) {
      if (!id) return null
      const lineageIds = metaData.lineages?.filter((p) => p.raceIds?.includes(id)).map((p) => p.id)
      if (!lineageIds) return null
      return races.filter((c) => lineageIds.includes(c.id))
    },
    findByLineage: (id?: string | null) => {
      if (!id) return null
      const subIds = metaData.lineages?.find((p) => p.id === id)?.raceIds
      return subraces.filter((c) => subIds?.includes(c.id))
    },
  })

  return {
    races: raceMethods,
    subraces,
    baseRaces,
    metaData,
  }
}
export default useRaceData
