import {
  selectAllRaces,
  useDeleteRaceMutation,
  useGetRacesQuery,
} from './raceApiSlice'
import {
  selectRacesFilter,
  clearRaceFilter,
  setRaceFilter,
} from './raceSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

interface RaceListProps {
  scrollPosition: number
}

const RaceList = ({ scrollPosition }: RaceListProps) => {
  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
    refetchOnMountOrArgChange: true,
  })

  const [deleteRace] = useDeleteRaceMutation()

  const tableColumns: { headers: RowHeader[]; inputs: RowInput[] } = {
    headers: [
      {
        name: {
          sortOn: 'name',
          filter: {
            filterKey: 'base',
            filterOn: 'category.name',
          },
        },
        value: 'Name',
        defaultSort: true,
      },
    ],
    inputs: [
      {
        name: 'value',
      },
    ],
  }

  return (
    <List
      tableColumns={tableColumns}
      context={{ title: 'race' }}
      items={races}
      deleteItem={deleteRace}
      scrollPosition={scrollPosition}
      setFilter={setRaceFilter}
      subrow={{
        collapse: true,
        filter: 'subrace',
        filterOn: 'category.name',
        matchKey: 'lineage',
      }}
      filterReset={clearRaceFilter}
      selectFilter={selectRacesFilter}
    />
  )
}
export default RaceList
