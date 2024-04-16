import {
  selectAllRaces,
  useDeleteRaceMutation,
  useGetRacesQuery,
} from './raceApiSlice'
import {
  selectFilter,
  clearFilter,
  setFilter,
} from './raceSlice'
import List from '../../components/List/List'
import { RowHeader, RowInput } from '../../utils/types'

const RaceList = () => {
  const { races } = useGetRacesQuery(undefined, {
    selectFromResult: ({ data }) => ({
      races: data && selectAllRaces(data),
    }),
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
      setFilter={setFilter}
      subrow={{
        collapse: true,
        filter: 'subrace',
        filterOn: 'category.name',
        matchKey: 'lineage',
      }}
      filterReset={clearFilter}
      selectFilter={selectFilter}
    />
  )
}
export default RaceList
